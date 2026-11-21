import { Hono, type Context } from 'hono';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getDbPool } from '../db.js';
import { withTransaction, type DbExecutor } from '../db/transaction.js';
import { jsonError } from '../helpers.js';
import { actor, administrator, type Application, type Actor } from './access.js';
import { hasCompleteIndependentEngagement } from './policy.js';
import { prepareAgreementSchema, engagementReadySchema } from './agreement-policy.js';
import { providerAgreementCanProceed } from './agreement-guard.js';
import { verifyAgreementEvidence } from './agreement-evidence.js';
import { appendAudit } from '../esign/audit.js';
import { sha256 } from '../esign/crypto.js';

const success = (c: Context, data: unknown, status: 200 | 201 = 200) =>
  c.json({ success: true, data }, status);
async function records(db: DbExecutor, applicationId: string, limit = 20) {
  return (
    await db.query(
      `SELECT g.*,d.status AS document_status,d.expires_at,d.organisation_id AS document_org,
    d.final_sha256,d.final_version,r.reviewed_at AS ready_at,r.review_note,r.reviewed_by AS ready_by,
    r.application_version AS ready_application_version,r.final_sha256 AS verified_sha256,r.final_version AS verified_version,
    (SELECT count(*)::int FROM public.esign_signers WHERE document_id=g.document_id AND status='signed') AS signed_count,
    (SELECT count(*)::int FROM public.esign_signers WHERE document_id=g.document_id) AS signer_count
    FROM public.provider_agreements g JOIN public.esign_documents d ON d.id=g.document_id
    LEFT JOIN public.provider_engagement_readiness r ON r.agreement_id=g.id
    WHERE g.application_id=$1 ORDER BY g.sequence DESC LIMIT $2`,
      [applicationId, limit]
    )
  ).rows;
}
export async function agreementOverview(db: DbExecutor, application: Application, limit = 20) {
  const list = await records(db, application.id, limit);
  const authorityCurrent = list[0]
    ? await providerAgreementCanProceed(db, list[0].document_id)
    : false;
  return list.map((g, index) => {
    const current = index === 0;
    const matchingRevision = g.application_version === application.version;
    const ready =
      current &&
      matchingRevision &&
      authorityCurrent &&
      application.status === 'approved' &&
      g.document_status === 'completed' &&
      g.signer_count === 2 &&
      g.signed_count === 2 &&
      g.ready_application_version === application.version &&
      g.verified_sha256 === g.final_sha256 &&
      g.verified_version === g.final_version;
    return {
      id: g.id,
      documentId: g.document_id,
      applicationVersion: g.application_version,
      createdAt: g.created_at,
      terms: g.terms,
      sourceSha256: g.source_sha256,
      current,
      matchingRevision,
      documentStatus: g.document_status,
      expired: g.document_status === 'sent' && new Date(g.expires_at).getTime() <= Date.now(),
      signedCount: g.signed_count,
      signerCount: g.signer_count,
      ready: !!ready,
      readyAt: g.ready_at,
      reviewNote: g.review_note,
      state: !current
        ? 'superseded'
        : application.status !== 'approved'
          ? 'blocked'
          : !matchingRevision
            ? 'revision_changed'
            : !authorityCurrent
              ? 'candidate_changed'
              : ready
                ? 'ready'
                : g.document_status === 'completed'
                  ? 'signed_pending_review'
                  : g.document_status === 'sent' && g.signer_count === 2 && g.signed_count === 2
                    ? 'sealing_pending'
                    : g.document_status === 'sent' && new Date(g.expires_at).getTime() <= Date.now()
                      ? 'expired'
                      : g.document_status,
      payoutsActive: false,
    };
  });
}
export function createProviderAgreementRoutes(
  services = { verifyEvidence: verifyAgreementEvidence }
) {
  const routes = new Hono();
  const validId = (id: string) => z.uuid().safeParse(id).success;
  routes.post('/admin/applications/:id/agreements', async (c) => {
    if (process.env.ESIGN_ENABLED !== 'true')
      return jsonError(
        c,
        503,
        'ESIGN_DISABLED',
        'Enable electronic signing before preparing an agreement'
      );
    const input = prepareAgreementSchema.safeParse(await c.req.json().catch(() => null));
    if (!input.success || !validId(c.req.param('id')))
      return jsonError(
        c,
        400,
        'VALIDATION_ERROR',
        'Complete the agreement terms and both review confirmations. PDF text must use printable Latin characters.'
      );
    return withTransaction(async (db) => {
      const user = await administrator(c, db, true);
      if (user instanceof Response) return user;
      const app = (
        await db.query<Application>(
          'SELECT * FROM public.partner_applications WHERE id=$1 FOR UPDATE',
          [c.req.param('id')]
        )
      ).rows[0];
      if (!app) return jsonError(c, 404, 'NOT_FOUND', 'Application not found');
      if (app.user_id === user.id)
        return jsonError(
          c,
          403,
          'SELF_REVIEW',
          'Another administrator must prepare your agreement'
        );
      if (
        app.status !== 'approved' ||
        app.version !== input.data.version ||
        !hasCompleteIndependentEngagement(app.profile)
      )
        return jsonError(
          c,
          409,
          'APPLICATION_CHANGED',
          'Refresh the approved, complete application before preparing an agreement'
        );
      const candidate = (
        await db.query(
          'SELECT id,email,email_verified_at,organisation_id FROM public.users WHERE id=$1',
          [app.user_id]
        )
      ).rows[0];
      if (
        !candidate?.email_verified_at ||
        candidate.organisation_id !== app.organisation_id ||
        candidate.email.toLowerCase() !== app.contact_email.toLowerCase()
      )
        return jsonError(
          c,
          409,
          'CANDIDATE_CHANGED',
          'The candidate account changed; obtain an updated application'
        );
      if (input.data.terms.signatoryEmail === app.contact_email.toLowerCase())
        return jsonError(
          c,
          400,
          'DISTINCT_SIGNERS_REQUIRED',
          'Choose a separate authorised organisation signatory'
        );
      const previous = (await records(db, app.id))[0];
      if ((previous?.id ?? null) !== input.data.previousAgreementId)
        return jsonError(
          c,
          409,
          'AGREEMENT_CHANGED',
          'Refresh the latest agreement before continuing'
        );
      if (
        previous &&
        previous.application_version === app.version &&
        (previous.document_status === 'completed' ||
          (previous.document_status === 'sent' &&
            new Date(previous.expires_at).getTime() > Date.now()))
      )
        return jsonError(
          c,
          409,
          'AGREEMENT_ACTIVE',
          'The current agreement is awaiting signatures or completed; retain and finish that agreement'
        );
      const id = randomUUID(),
        documentId = randomUUID(),
        candidateSigner = randomUUID(),
        operatorSigner = randomUUID();
      let prepared;
      try {
        prepared = await (
          await import('./agreement-pdf.js')
        ).agreementPdf(app, input.data.terms, id);
      } catch {
        return jsonError(
          c,
          400,
          'INVALID_PDF_TEXT',
          'Agreement or candidate text cannot be represented in the PDF. Review the supplied text.'
        );
      }
      const sourceHash = sha256(prepared.pdf);
      const title = `Independent services agreement - ${id}`;
      await db.query(
        `INSERT INTO public.esign_documents(id,organisation_id,created_by,title,source_pdf,source_sha256,pages,original_pdf,original_sha256)
        VALUES($1,$2,$3,$4,$5,$6,$7,$5,$6)`,
        [
          documentId,
          user.organisation_id,
          user.id,
          title,
          prepared.pdf,
          sourceHash,
          JSON.stringify(prepared.pages),
        ]
      );
      await appendAudit(db, documentId, 'document.uploaded', user.id, {
        sourceSha256: sourceHash,
        uploadedSha256: sourceHash,
        pages: prepared.pages.length,
        generatedAgreementId: id,
      });
      const profile = app.profile as { fullName: string };
      for (const signer of [
        { id: candidateSigner, email: app.contact_email.toLowerCase(), name: profile.fullName },
        {
          id: operatorSigner,
          email: input.data.terms.signatoryEmail,
          name: input.data.terms.signatoryName,
        },
      ]) {
        await db.query(
          'INSERT INTO public.esign_signers(id,document_id,email,name) VALUES($1,$2,$3,$4)',
          [signer.id, documentId, signer.email, signer.name]
        );
        await appendAudit(db, documentId, 'signer.added', user.id, {
          signerId: signer.id,
          email: signer.email,
        });
      }
      for (const [signerId, y] of [
        [candidateSigner, 300],
        [operatorSigner, 480],
      ] as const)
        await db.query(
          `INSERT INTO public.esign_fields(id,document_id,signer_id,page,x,y,width,height,kind) VALUES($1,$2,$3,$4,45,$5,500,55,'signature')`,
          [randomUUID(), documentId, signerId, prepared.signaturePage, y]
        );
      await db.query(
        `INSERT INTO public.provider_agreements(id,application_id,application_version,document_id,source_sha256,terms,application_snapshot,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, app.id, app.version, documentId, sourceHash, input.data.terms, app, user.id]
      );
      await appendAudit(db, documentId, 'provider.agreement_prepared', user.id, {
        agreementId: id,
        applicationId: app.id,
        applicationVersion: app.version,
        sourceSha256: sourceHash,
        previousAgreementId: previous?.id ?? null,
        termsReviewed: true,
        statusReviewed: true,
      });
      return success(c, { agreements: await agreementOverview(db, app), documentId }, 201);
    });
  });
  routes.get('/admin/applications/:id/agreements', async (c) => {
    const user = await administrator(c);
    if (user instanceof Response) return user;
    if (!validId(c.req.param('id'))) return jsonError(c, 404, 'NOT_FOUND', 'Application not found');
    const db = getDbPool();
    const app = (
      await db.query<Application>('SELECT * FROM public.partner_applications WHERE id=$1', [
        c.req.param('id'),
      ])
    ).rows[0];
    if (!app) return jsonError(c, 404, 'NOT_FOUND', 'Application not found');
    const list = await records(db, app.id);
    return success(c, {
      agreements: await agreementOverview(db, app),
      canPrepare: app.user_id !== user.id,
      manageableDocumentIds:
        app.user_id === user.id
          ? []
          : list.filter((g) => g.document_org === user.organisation_id).map((g) => g.document_id),
    });
  });
  routes.post('/admin/applications/:id/engagement-ready', async (c) => {
    const input = engagementReadySchema.safeParse(await c.req.json().catch(() => null));
    if (!input.success || !validId(c.req.param('id')))
      return jsonError(
        c,
        400,
        'VALIDATION_ERROR',
        'Confirm agreement and status review and add a review note'
      );
    return withTransaction(async (db) => {
      const user = await administrator(c, db, true);
      if (user instanceof Response) return user;
      const app = (
        await db.query<Application>(
          'SELECT * FROM public.partner_applications WHERE id=$1 FOR UPDATE',
          [c.req.param('id')]
        )
      ).rows[0];
      if (!app) return jsonError(c, 404, 'NOT_FOUND', 'Application not found');
      if (app.user_id === user.id)
        return jsonError(
          c,
          403,
          'SELF_REVIEW',
          'Another administrator must validate your engagement'
        );
      const g = (await records(db, app.id))[0];
      if (
        !g ||
        g.id !== input.data.agreementId ||
        app.version !== input.data.version ||
        !(await providerAgreementCanProceed(db, g.document_id)) ||
        g.document_status !== 'completed' ||
        g.signed_count !== 2 ||
        g.signer_count !== 2
      )
        return jsonError(
          c,
          409,
          'NOT_READY',
          'The current approved revision needs the linked agreement completed by both signers'
        );
      await db.query('SELECT id FROM public.esign_documents WHERE id=$1 FOR UPDATE', [
        g.document_id,
      ]);
      try {
        await services.verifyEvidence(db, g.document_id);
      } catch {
        return jsonError(
          c,
          503,
          'EVIDENCE_UNVERIFIED',
          'Retained PDF, audit checkpoint or Object Lock protection could not be verified. No readiness was recorded.'
        );
      }
      await db.query(
        `INSERT INTO public.provider_engagement_readiness(id,agreement_id,application_version,final_sha256,final_version,review_note,reviewed_by)
        VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(agreement_id) DO NOTHING`,
        [
          randomUUID(),
          g.id,
          app.version,
          g.final_sha256,
          g.final_version,
          input.data.reviewNote,
          user.id,
        ]
      );
      return success(c, { agreements: await agreementOverview(db, app) });
    });
  });
  // Account-level access to this candidate's linked final PDFs only; never grants manager/tenant access.
  routes.get('/me/agreements/:agreementId/final', (c) => downloadFinal(c, false));
  routes.get('/admin/applications/:id/agreements/:agreementId/final', (c) =>
    downloadFinal(c, true)
  );
  async function downloadFinal(c: Context, admin: boolean): Promise<Response> {
    if (!validId(c.req.param('agreementId') ?? ''))
      return jsonError(c, 404, 'NOT_FOUND', 'Agreement not found');
    return withTransaction(async (db) => {
      const user: Actor | Response = await (admin ? administrator : actor)(c, db, true);
      if (user instanceof Response) return user;
      const g = (
        await db.query(
          `SELECT g.*,a.user_id,a.organisation_id AS candidate_org FROM public.provider_agreements g
        JOIN public.partner_applications a ON a.id=g.application_id WHERE g.id=$1`,
          [c.req.param('agreementId')]
        )
      ).rows[0];
      if (
        !g ||
        (admin
          ? g.application_id !== c.req.param('id')
          : g.user_id !== user.id || g.candidate_org !== user.organisation_id)
      )
        return jsonError(c, 404, 'NOT_FOUND', 'Agreement not found');
      await db.query('SELECT id FROM public.esign_documents WHERE id=$1 FOR UPDATE', [
        g.document_id,
      ]);
      let bytes;
      try {
        bytes = await services.verifyEvidence(db, g.document_id);
      } catch {
        return jsonError(
          c,
          503,
          'EVIDENCE_UNVERIFIED',
          'Completed retained evidence could not be verified'
        );
      }
      c.header('Content-Type', 'application/pdf');
      c.header('Content-Disposition', 'attachment; filename="signed-services-agreement.pdf"');
      return c.body(new Uint8Array(bytes));
    });
  }
  return routes;
}
