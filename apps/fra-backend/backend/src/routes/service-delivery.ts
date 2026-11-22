import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { hasDatabase, requireAuth, jsonError, type AuthContext } from '../helpers.js';
import { withTransaction } from '../db/transaction.js';
import { recruitmentIdentity, RecruitmentError } from '../provider-recruitment.js';
import { professionalSessionAuthority } from '../professional-authority.js';
import {
  deliveryAccess,
  currentDeliveryProvider,
  deliveryDetail,
  verifyDeliveryHistory,
} from '../service-delivery.js';
const routes = new Hono();
const uuid = z.uuid();
routes.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  if (!hasDatabase())
    return jsonError(c, 503, 'DATABASE_REQUIRED', 'Service delivery requires PostgreSQL');
  return next();
});
async function run(
  c: Context,
  fn: (auth: AuthContext) => Promise<unknown>,
  status: 200 | 201 = 200
) {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (c.get('apiKeyAuth' as never))
    return jsonError(c, 403, 'FORBIDDEN', 'Use a verified personal account');
  try {
    return c.json({ success: true, data: await fn(auth) }, status);
  } catch (e) {
    if (e instanceof RecruitmentError) return jsonError(c, e.status, 'DELIVERY_CONTROL', e.message);
    throw e;
  }
}
function validId(id: string) {
  if (!uuid.safeParse(id).success) throw new RecruitmentError(400, 'Invalid delivery reference');
}
const reason = z.string().trim().min(10).max(4000);
routes.get('/options', (c) =>
  run(c, (auth) =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth, true);
      const application = c.req.query('applicationId'),
        org = c.req.query('customerOrganisationId');
      if (
        !application ||
        !uuid.safeParse(application).success ||
        (org && !uuid.safeParse(org).success)
      )
        throw new RecruitmentError(
          400,
          'Provide valid application and customer organisation references'
        );
      const sessions = (
        await db.query(
          `SELECT s.id AS "assignmentId",s.reference,b.session_id AS "sessionId",b.snapshot,ws.title FROM public.provider_assignments s JOIN public.provider_session_authority b ON b.assignment_id=s.id JOIN public.workshop_sessions ws ON ws.id=b.session_id WHERE s.application_id=$1 AND s.service='training' AND s.status='accepted' ORDER BY b.created_at DESC LIMIT 200`,
          [application]
        )
      ).rows;
      const contacts = org
        ? (
            await db.query(
              "SELECT id,name FROM public.users WHERE organisation_id=$1 AND email_verified_at IS NOT NULL AND role IN ('admin','employer') ORDER BY name LIMIT 200",
              [org]
            )
          ).rows
        : [];
      return { sessions, contacts };
    })
  )
);
routes.get('/records', (c) =>
  run(c, (auth) =>
    withTransaction(async (db) => {
      const user = await recruitmentIdentity(db, auth);
      const review = c.req.query('view') === 'review',
        application = c.req.query('applicationId');
      if (application && !uuid.safeParse(application).success)
        throw new RecruitmentError(400, 'Invalid application reference');
      const page = z.coerce
        .number()
        .int()
        .min(0)
        .max(100000)
        .safeParse(c.req.query('page') ?? 0);
      if (!page.success) throw new RecruitmentError(400, 'Invalid delivery page');
      if (review) await recruitmentIdentity(db, auth, true);
      return (
        await db.query(
          `SELECT d.id,d.title,d.status,d.revision,d.starts_at AS "startsAt",d.ends_at AS "endsAt",a.company_name AS "providerName" FROM public.service_deliveries d JOIN public.provider_applications a ON a.id=d.application_id WHERE ($1::boolean OR (a.applicant_id=$2 AND a.organisation_id=$3) OR (d.customer_user_id=$2 AND d.customer_organisation_id=$3 AND $4::boolean)) AND ($5::uuid IS NULL OR d.application_id=$5) ORDER BY d.created_at DESC,d.id DESC LIMIT 100 OFFSET $6`,
          [
            review,
            auth.userId,
            auth.organisationId,
            ['admin', 'employer'].includes(user.role),
            application ?? null,
            page.data * 100,
          ]
        )
      ).rows;
    })
  )
);
const createSchema = z
  .strictObject({
    applicationId: z.uuid(),
    assignmentId: z.uuid(),
    sessionId: z.uuid(),
    customerUserId: z.uuid(),
    customerOrganisationId: z.uuid(),
    purchaseId: z.uuid().optional(),
    title: z.string().trim().min(2).max(200),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
    reason,
  })
  .refine((v) => Date.parse(v.endsAt) > Date.parse(v.startsAt), 'End must follow start');
routes.post('/records', async (c) => {
  const input = createSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success)
    return jsonError(
      c,
      400,
      'VALIDATION_ERROR',
      'Provide the accepted class assignment, designated customer, schedule and reason'
    );
  return run(
    c,
    (auth) =>
      withTransaction(async (db) => {
        await recruitmentIdentity(db, auth, true);
        const p = input.data;
        const app = (
          await db.query('SELECT * FROM public.provider_applications WHERE id=$1 FOR UPDATE', [
            p.applicationId,
          ])
        ).rows[0];
        if (!app) throw new RecruitmentError(404, 'Provider not found');
        if (
          app.applicant_id === auth.userId ||
          app.applicant_id === p.customerUserId ||
          app.organisation_id === p.customerOrganisationId
        )
          throw new RecruitmentError(403, 'Provider and designated customer must be independent');
        const authority = await professionalSessionAuthority(db, p.sessionId, 'deliver', true);
        if (
          !authority ||
          authority.application.id !== p.applicationId ||
          authority.binding.assignment_id !== p.assignmentId
        )
          throw new RecruitmentError(
            403,
            'Session must match this provider and its current subject-scoped assignment'
          );
        const assignment = (
          await db.query(
            "SELECT * FROM public.provider_assignments WHERE id=$1 AND status='accepted' FOR SHARE",
            [p.assignmentId]
          )
        ).rows[0];
        if (!assignment)
          throw new RecruitmentError(409, 'Delivery requires an accepted assignment');
        const customer = (
          await db.query(
            "SELECT id FROM public.users WHERE id=$1 AND organisation_id=$2 AND email_verified_at IS NOT NULL AND role IN ('admin','employer') FOR SHARE",
            [p.customerUserId, p.customerOrganisationId]
          )
        ).rows[0];
        if (!customer)
          throw new RecruitmentError(
            403,
            'A verified designated customer decision-maker is required'
          );
        if (
          p.purchaseId &&
          !(
            await db.query(
              'SELECT 1 FROM public.purchases WHERE id=$1 AND organisation_id=$2 AND package_id=$3',
              [p.purchaseId, p.customerOrganisationId, assignment.package_id]
            )
          ).rowCount
        )
          throw new RecruitmentError(
            400,
            'Purchase reference must belong to this customer and package'
          );
        return (
          await db.query(
            'INSERT INTO public.service_deliveries(application_id,assignment_id,session_id,customer_user_id,customer_organisation_id,purchase_id,title,starts_at,ends_at,reason,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id,revision,status',
            [
              p.applicationId,
              p.assignmentId,
              p.sessionId,
              p.customerUserId,
              p.customerOrganisationId,
              p.purchaseId ?? null,
              p.title,
              p.startsAt,
              p.endsAt,
              p.reason,
              auth.userId,
            ]
          )
        ).rows[0];
      }),
    201
  );
});
routes.get('/:id', (c) =>
  run(c, (auth) =>
    withTransaction(async (db) => {
      validId(c.req.param('id'));
      return deliveryDetail(db, await deliveryAccess(db, auth, c.req.param('id')));
    })
  )
);
routes.get('/:id/history', (c) =>
  run(c, (auth) =>
    withTransaction(async (db) => {
      validId(c.req.param('id'));
      const access = await deliveryAccess(db, auth, c.req.param('id'));
      const result = await verifyDeliveryHistory(db, access.delivery.id);
      if (access.reviewer) return { ...result, verified: true };
      return {
        head: result.head,
        verified: true,
        events: result.events.map((e) => ({
          revision: e.revision,
          occurred_at: e.occurred_at,
          hash: e.hash,
          previous_hash: e.previous_hash,
          snapshot: {
            status: e.snapshot.status,
            reason: e.snapshot.reason,
            evidence_summary: e.snapshot.evidence_summary,
          },
          actor:
            e.snapshot.actor_id === access.app.applicant_id
              ? 'provider'
              : e.snapshot.actor_id === access.delivery.customer_user_id
                ? 'customer'
                : 'operator',
        })),
      };
    })
  )
);
const attendanceSchema = z.strictObject({
  revision: z.number().int().positive(),
  learnerId: z.uuid(),
  status: z.enum(['present', 'absent', 'excused']),
  reason: reason.max(2000),
});
routes.post('/:id/attendance', async (c) => {
  const input = attendanceSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success)
    return jsonError(
      c,
      400,
      'VALIDATION_ERROR',
      'Provide learner attendance, reason and current delivery revision'
    );
  return run(
    c,
    (auth) =>
      withTransaction(async (db) => {
        validId(c.req.param('id'));
        const access = await deliveryAccess(db, auth, c.req.param('id'), true);
        await currentDeliveryProvider(db, auth, access);
        const p = input.data,
          d = access.delivery;
        if (d.revision !== p.revision)
          throw new RecruitmentError(409, 'Delivery changed; refresh before recording attendance');
        const learner = (
          await db.query(
            'SELECT u.id,u.name FROM public.session_participants m JOIN public.users u ON u.id=m.user_id WHERE m.session_id=$1 AND u.id=$2 AND u.organisation_id=$3',
            [d.session_id, p.learnerId, d.customer_organisation_id]
          )
        ).rows[0];
        if (!learner)
          throw new RecruitmentError(
            403,
            'Learner must be enrolled in this class and customer organisation'
          );
        const record = (
          await db.query(
            'INSERT INTO public.service_attendance(delivery_id,learner_id,revision,learner_name,status,reason,recorded_by) SELECT $1,$2,COALESCE(max(revision),0)+1,$3,$4,$5,$6 FROM public.service_attendance WHERE delivery_id=$1 AND learner_id=$2 RETURNING revision',
            [d.id, learner.id, learner.name, p.status, p.reason, auth.userId]
          )
        ).rows[0];
        return (
          await db.query(
            'UPDATE public.service_deliveries SET revision=revision+1,reason=$2,actor_id=$3 WHERE id=$1 RETURNING revision,status',
            [
              d.id,
              `Attendance ${learner.name}: ${p.status}; record ${record.revision}. ${p.reason}`,
              auth.userId,
            ]
          )
        ).rows[0];
      }),
    201
  );
});
routes.post('/:id/files', async (c) =>
  run(
    c,
    (auth) =>
      withTransaction(async (db) => {
        validId(c.req.param('id'));
        const access = await deliveryAccess(db, auth, c.req.param('id'), true);
        await currentDeliveryProvider(db, auth, access);
        const form = await c.req.formData().catch(() => null);
        const file = form?.get('file'),
          revision = Number(form?.get('revision'));
        if (
          !file ||
          typeof file === 'string' ||
          !Number.isInteger(revision) ||
          revision !== access.delivery.revision
        )
          throw new RecruitmentError(409, 'Provide a file and the current delivery revision');
        if (file.size < 8 || file.size > 524288)
          throw new RecruitmentError(400, 'Evidence files must be between 8 bytes and 512 KiB');
        if (
          Number(
            (
              await db.query(
                'SELECT count(*) AS count FROM public.service_delivery_files WHERE delivery_id=$1',
                [access.delivery.id]
              )
            ).rows[0].count
          ) >= 10
        )
          throw new RecruitmentError(409, 'At most 10 retained evidence files per delivery');
        const content = Buffer.from(await file.arrayBuffer());
        let mime = '';
        if (content.subarray(0, 5).toString() === '%PDF-') mime = 'application/pdf';
        else if (content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
          mime = 'image/png';
        else if (content[0] === 255 && content[1] === 216 && content[2] === 255)
          mime = 'image/jpeg';
        if (!mime) throw new RecruitmentError(400, 'Only PDF, PNG and JPEG evidence is accepted');
        const filename = file.name.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 160) || 'evidence';
        const hash = createHash('sha256').update(content).digest('hex');
        const saved = (
          await db.query(
            'INSERT INTO public.service_delivery_files(delivery_id,filename,mime_type,content,sha256,uploaded_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,sha256',
            [access.delivery.id, filename, mime, content, hash, auth.userId]
          )
        ).rows[0];
        await db.query(
          'UPDATE public.service_deliveries SET revision=revision+1,reason=$2,actor_id=$3 WHERE id=$1',
          [access.delivery.id, `Evidence uploaded: ${saved.id}; SHA-256 ${hash}`, auth.userId]
        );
        return saved;
      }),
    201
  )
);
routes.get('/:id/files/:fileId', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (c.get('apiKeyAuth' as never))
    return jsonError(c, 403, 'FORBIDDEN', 'Personal account required');
  try {
    const file = await withTransaction(async (db) => {
      validId(c.req.param('id'));
      validId(c.req.param('fileId'));
      const access = await deliveryAccess(db, auth, c.req.param('id'));
      const f = (
        await db.query(
          'SELECT * FROM public.service_delivery_files WHERE delivery_id=$1 AND id=$2',
          [access.delivery.id, c.req.param('fileId')]
        )
      ).rows[0];
      if (!f) throw new RecruitmentError(404, 'Evidence not found');
      if (createHash('sha256').update(f.content).digest('hex') !== f.sha256)
        throw new Error('Evidence integrity failure');
      return f;
    });
    c.header('Content-Type', file.mime_type);
    c.header(
      'Content-Disposition',
      `attachment; filename="evidence"; filename*=UTF-8''${encodeURIComponent(file.filename)}`
    );
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Content-Security-Policy', "default-src 'none'; sandbox");
    return c.body(new Uint8Array(file.content));
  } catch (e) {
    if (e instanceof RecruitmentError) return jsonError(c, e.status, 'DELIVERY_CONTROL', e.message);
    throw e;
  }
});
const actionSchema = z.strictObject({
  revision: z.number().int().positive(),
  action: z.enum([
    'submit',
    'reopen',
    'accept',
    'refuse',
    'dispute',
    'resolve_rework',
    'resolve_cancel',
    'cancel',
  ]),
  reason: reason.max(3500),
  evidenceSummary: z.string().trim().min(20).max(4000).optional(),
});
routes.post('/:id/action', async (c) => {
  const input = actionSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success)
    return jsonError(
      c,
      400,
      'VALIDATION_ERROR',
      'Provide an action, reason and exact current revision'
    );
  return run(c, (auth) =>
    withTransaction(async (db) => {
      validId(c.req.param('id'));
      const access = await deliveryAccess(db, auth, c.req.param('id'), true),
        d = access.delivery,
        p = input.data;
      if (d.revision !== p.revision)
        throw new RecruitmentError(409, 'Delivery changed; refresh before deciding');
      let status: string;
      let manifest: Record<string, unknown> | null = null;
      if (p.action === 'submit') {
        await currentDeliveryProvider(db, auth, access);
        if (!p.evidenceSummary)
          throw new RecruitmentError(400, 'Describe the completed service and evidence');
        const files = (
          await db.query(
            'SELECT id,sha256 FROM public.service_delivery_files WHERE delivery_id=$1 ORDER BY id',
            [d.id]
          )
        ).rows;
        const attendance = (
          await db.query(
            'SELECT DISTINCT ON(learner_id) learner_id,revision,status FROM public.service_attendance WHERE delivery_id=$1 ORDER BY learner_id,revision DESC',
            [d.id]
          )
        ).rows;
        if (!files.length || !attendance.some((a) => a.status === 'present'))
          throw new RecruitmentError(
            409,
            'Submission requires retained evidence and at least one explicit present attendance record'
          );
        manifest = { files, attendance };
        status = 'submitted';
      } else if (p.action === 'reopen') {
        if (!access.provider)
          throw new RecruitmentError(403, 'Only this provider can reopen refused work');
        if (d.status !== 'refused')
          throw new RecruitmentError(409, 'Only refused work can be reopened');
        const authority = await professionalSessionAuthority(db, d.session_id, 'deliver', true);
        if (!authority) throw new RecruitmentError(403, 'Current training authority required');
        status = 'in_progress';
      } else if (p.action === 'accept' || p.action === 'refuse') {
        if (!access.customer)
          throw new RecruitmentError(
            403,
            'Only the designated verified customer can accept or refuse this delivery'
          );
        if (!['submitted', 'disputed'].includes(d.status))
          throw new RecruitmentError(409, 'Customer review requires submitted or disputed work');
        status = p.action === 'accept' ? 'accepted' : 'refused';
      } else if (p.action === 'dispute') {
        if (!access.customer && !access.provider)
          throw new RecruitmentError(
            403,
            'Only this customer or provider can raise a service dispute'
          );
        if (!['submitted', 'accepted', 'refused'].includes(d.status))
          throw new RecruitmentError(409, 'Only reviewed or submitted work can be disputed');
        status = 'disputed';
      } else if (p.action === 'cancel') {
        if (!access.reviewer || access.customer)
          throw new RecruitmentError(403, 'Independent operator review is required');
        if (!['in_progress', 'refused'].includes(d.status))
          throw new RecruitmentError(409, 'Only uncompleted or refused work can be cancelled here');
        status = 'cancelled';
      } else {
        if (!access.reviewer || access.customer)
          throw new RecruitmentError(403, 'Independent operator review is required');
        if (d.status !== 'disputed')
          throw new RecruitmentError(409, 'There is no open service dispute');
        status = p.action === 'resolve_rework' ? 'in_progress' : 'cancelled';
      }
      return (
        await db.query(
          'UPDATE public.service_deliveries SET status=$2,revision=revision+1,reason=$3,actor_id=$4,evidence_summary=CASE WHEN $5 THEN $6 ELSE evidence_summary END,submission_manifest=CASE WHEN $5 THEN $7 ELSE submission_manifest END WHERE id=$1 RETURNING revision,status',
          [
            d.id,
            status,
            `${p.action}: ${p.reason}`,
            auth.userId,
            p.action === 'submit',
            p.evidenceSummary ?? null,
            manifest,
          ]
        )
      ).rows[0];
    })
  );
});
export default routes;
