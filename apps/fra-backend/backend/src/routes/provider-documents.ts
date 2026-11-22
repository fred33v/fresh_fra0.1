import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { withTransaction } from '../db/transaction.js';
import { recruitmentIdentity, recruitmentAudit, RecruitmentError } from '../provider-recruitment.js';
import { hasDatabase, jsonError, requireAuth } from '../helpers.js';
import { rateLimit } from '../middleware.js';
import {
  DOCUMENT_KINDS,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIN_BYTES,
  DOCUMENTS_PER_APPLICATION,
  attachmentDisposition,
  detectDocumentMime,
  safeDocumentFilename,
  sha256Hex,
} from '../provider-documents.js';

/**
 * Evidence documents on a provider application. Mounted beside the application routes: the applicant manages
 * their own under /me/documents, and recruitment reviewers (same authority and MFA rules as the review queue)
 * list, download and decide them under /:id/documents.
 */
const routes: Hono = new Hono();
const id = z.string().uuid();
const kindSchema = z.enum(DOCUMENT_KINDS);
const decisionSchema = z.strictObject({
  status: z.enum(['verified', 'rejected']),
  reason: z.string().trim().min(10).max(500).optional(),
}).refine((d) => d.status !== 'rejected' || d.reason, { message: 'Give the applicant a reason', path: ['reason'] });

// What the applicant sees. Staff identifiers stay with reviewers.
const applicantView = `id, kind, filename, mime_type AS "mimeType", octet_length(content) AS "sizeBytes", sha256,
  uploaded_at AS "uploadedAt", status, decision_reason AS "decisionReason", decided_at AS "decidedAt"`;
const reviewerView = `${applicantView}, application_revision AS "applicationRevision", uploaded_by AS "uploadedBy",
  decided_by AS "decidedBy"`;

function session(c: Context) {
  c.header('Cache-Control', 'no-store');
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (c.get('apiKeyAuth' as never)) return jsonError(c, 403, 'FORBIDDEN', 'A personal account is required');
  if (!hasDatabase()) return jsonError(c, 503, 'SERVICE_UNAVAILABLE', 'Provider applications are temporarily unavailable');
  return auth;
}

async function respond(c: Context, action: () => Promise<unknown>, status: 200 | 201 = 200) {
  try {
    return c.json({ success: true, data: await action() }, status);
  } catch (error) {
    if (error instanceof RecruitmentError) return jsonError(c, error.status, 'RECRUITMENT_ERROR', error.message);
    throw error; // The global handler logs internal details and returns a safe error.
  }
}

function fileResponse(file: { filename: string; mime_type: string; content: Buffer }) {
  return new Response(new Uint8Array(file.content), {
    status: 200,
    headers: {
      'Content-Type': file.mime_type,
      'Content-Length': String(file.content.length),
      'Content-Disposition': attachmentDisposition(file.filename),
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    },
  });
}

async function respondWithFile(c: Context, load: () => Promise<{ filename: string; mime_type: string; content: Buffer }>) {
  try {
    return fileResponse(await load());
  } catch (error) {
    if (error instanceof RecruitmentError) return jsonError(c, error.status, 'RECRUITMENT_ERROR', error.message);
    throw error;
  }
}

// ── Applicant ───────────────────────────────────────────────────

routes.post('/me/documents', async (c) => {
  const limited = await rateLimit('provider:evidence', { windowMs: 60_000, max: 20 })(c);
  if (limited instanceof Response) return limited;
  const auth = session(c);
  if (auth instanceof Response) return auth;
  const form = await c.req.formData().catch(() => null);
  const file = form?.get('file');
  const kind = kindSchema.safeParse(form?.get('kind'));
  if (!file || typeof file === 'string' || !kind.success)
    return jsonError(c, 400, 'VALIDATION_ERROR', 'Choose a document type and a file');
  if (file.size < DOCUMENT_MIN_BYTES || file.size > DOCUMENT_MAX_BYTES)
    return jsonError(c, 400, 'VALIDATION_ERROR', 'Evidence files must be between 8 bytes and 512 KiB');
  const content = Buffer.from(await file.arrayBuffer());
  const mime = detectDocumentMime(content);
  if (!mime) return jsonError(c, 400, 'VALIDATION_ERROR', 'Only PDF, PNG and JPEG evidence is accepted');
  const filename = safeDocumentFilename(file.name);
  const hash = sha256Hex(content);
  return respond(
    c,
    () =>
      withTransaction(async (db) => {
        await recruitmentIdentity(db, auth);
        // The application row lock serialises uploads, so the per-application limit cannot be raced past.
        const application = (
          await db.query(
            'SELECT id, revision, status FROM public.provider_applications WHERE applicant_id=$1 AND organisation_id=$2 FOR UPDATE',
            [auth.userId, auth.organisationId]
          )
        ).rows[0];
        if (!application) throw new RecruitmentError(404, 'Application not found');
        if (!['submitted', 'declined'].includes(application.status))
          throw new RecruitmentError(409, 'Evidence can be added only while the application is submitted or declined');
        const { count } = (
          await db.query('SELECT count(*)::int AS count FROM public.provider_application_documents WHERE application_id=$1', [
            application.id,
          ])
        ).rows[0];
        if (count >= DOCUMENTS_PER_APPLICATION)
          throw new RecruitmentError(409, `At most ${DOCUMENTS_PER_APPLICATION} evidence files per application`);
        const saved = (
          await db.query(
            `INSERT INTO public.provider_application_documents
               (application_id, application_revision, kind, filename, mime_type, content, sha256, uploaded_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING ${applicantView}`,
            [application.id, application.revision, kind.data, filename, mime, content, hash, auth.userId]
          )
        ).rows[0];
        await recruitmentAudit(db, application.id, auth.userId, 'document.uploaded', {
          documentId: saved.id,
          kind: kind.data,
          sha256: hash,
          applicationRevision: application.revision,
        });
        return saved;
      }),
    201
  );
});

routes.get('/me/documents', async (c) => {
  const auth = session(c);
  if (auth instanceof Response) return auth;
  return respond(c, () =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth);
      return (
        await db.query(
          `SELECT ${applicantView} FROM public.provider_application_documents d
           WHERE application_id = (SELECT id FROM public.provider_applications WHERE applicant_id=$1 AND organisation_id=$2)
           ORDER BY uploaded_at DESC, id`,
          [auth.userId, auth.organisationId]
        )
      ).rows;
    })
  );
});

routes.get('/me/documents/:docId/file', async (c) => {
  const auth = session(c);
  if (auth instanceof Response) return auth;
  if (!id.safeParse(c.req.param('docId')).success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid document');
  return respondWithFile(c, () =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth);
      const file = (
        await db.query(
          `SELECT filename, mime_type, content FROM public.provider_application_documents
           WHERE id=$3 AND application_id = (SELECT id FROM public.provider_applications WHERE applicant_id=$1 AND organisation_id=$2)`,
          [auth.userId, auth.organisationId, c.req.param('docId')]
        )
      ).rows[0];
      if (!file) throw new RecruitmentError(404, 'Document not found');
      return file;
    })
  );
});

// ── Reviewer ────────────────────────────────────────────────────

routes.get('/:id/documents', async (c) => {
  const auth = session(c);
  if (auth instanceof Response) return auth;
  if (!id.safeParse(c.req.param('id')).success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid application');
  return respond(c, () =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth, true);
      const application = (await db.query('SELECT id FROM public.provider_applications WHERE id=$1', [c.req.param('id')])).rows[0];
      if (!application) throw new RecruitmentError(404, 'Application not found');
      return (
        await db.query(
          `SELECT ${reviewerView} FROM public.provider_application_documents WHERE application_id=$1 ORDER BY uploaded_at DESC, id`,
          [application.id]
        )
      ).rows;
    })
  );
});

routes.get('/:id/documents/:docId/file', async (c) => {
  const auth = session(c);
  if (auth instanceof Response) return auth;
  if (!id.safeParse(c.req.param('id')).success || !id.safeParse(c.req.param('docId')).success)
    return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid document');
  return respondWithFile(c, () =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth, true);
      const file = (
        await db.query(
          `SELECT id, application_id, filename, mime_type, content, sha256 FROM public.provider_application_documents
           WHERE id=$2 AND application_id=$1`,
          [c.req.param('id'), c.req.param('docId')]
        )
      ).rows[0];
      if (!file) throw new RecruitmentError(404, 'Document not found');
      // Reading an applicant's identity documents is itself a recorded event.
      await recruitmentAudit(db, file.application_id, auth.userId, 'document.downloaded', {
        documentId: file.id,
        sha256: file.sha256,
      });
      return file;
    })
  );
});

routes.post('/:id/documents/:docId/decision', async (c) => {
  const auth = session(c);
  if (auth instanceof Response) return auth;
  const parsed = decisionSchema.safeParse(await c.req.json().catch(() => null));
  if (!id.safeParse(c.req.param('id')).success || !id.safeParse(c.req.param('docId')).success || !parsed.success)
    return jsonError(c, 400, 'VALIDATION_ERROR', parsed.success ? 'Invalid document' : (parsed.error.issues[0]?.message ?? 'Invalid decision'));
  return respond(c, () =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth, true);
      const application = (
        await db.query('SELECT id, applicant_id FROM public.provider_applications WHERE id=$1 FOR SHARE', [c.req.param('id')])
      ).rows[0];
      if (!application) throw new RecruitmentError(404, 'Application not found');
      if (application.applicant_id === auth.userId) throw new RecruitmentError(403, 'You cannot decide evidence on your own application');
      const document = (
        await db.query('SELECT id, status, kind, sha256 FROM public.provider_application_documents WHERE id=$2 AND application_id=$1 FOR UPDATE', [
          application.id,
          c.req.param('docId'),
        ])
      ).rows[0];
      if (!document) throw new RecruitmentError(404, 'Document not found');
      if (document.status !== 'pending') throw new RecruitmentError(409, 'This document has already been decided');
      const saved = (
        await db.query(
          `UPDATE public.provider_application_documents SET status=$3, decided_by=$4, decided_at=now(), decision_reason=$5
           WHERE id=$2 AND application_id=$1 RETURNING ${reviewerView}`,
          [application.id, document.id, parsed.data.status, auth.userId, parsed.data.reason ?? null]
        )
      ).rows[0];
      await recruitmentAudit(db, application.id, auth.userId, `document.${parsed.data.status}`, {
        documentId: document.id,
        kind: document.kind,
        sha256: document.sha256,
        reason: parsed.data.reason ?? null,
      });
      return saved;
    })
  );
});

export default routes;
