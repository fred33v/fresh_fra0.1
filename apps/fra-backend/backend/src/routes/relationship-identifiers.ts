import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { randomBytes, createHash } from 'node:crypto';
import { hasDatabase, requireAuth, jsonError, type AuthContext } from '../helpers.js';
import { withTransaction } from '../db/transaction.js';
import { recruitmentIdentity, RecruitmentError } from '../provider-recruitment.js';
const routes = new Hono();
routes.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  if (!hasDatabase())
    return jsonError(c, 503, 'DATABASE_REQUIRED', 'Identifiers require PostgreSQL');
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
    return jsonError(c, 403, 'FORBIDDEN', 'A personal account is required');
  try {
    return c.json({ success: true, data: await fn(auth) }, status);
  } catch (e) {
    if (e instanceof RecruitmentError)
      return jsonError(c, e.status, 'IDENTIFIER_CONTROL', e.message);
    throw e;
  }
}
const idSchema = z.uuid();
const view = `id,code,kind,user_id AS "userId",organisation_id AS "organisationId",application_id AS "applicationId",status,revision,created_at AS "createdAt",updated_at AS "updatedAt"`;
routes.get('/me', (c) =>
  run(c, (auth) =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth);
      return (
        await db.query(
          `SELECT ${view} FROM public.relationship_identifiers WHERE user_id=$1 AND organisation_id=$2 ORDER BY created_at,id`,
          [auth.userId, auth.organisationId]
        )
      ).rows;
    })
  )
);
routes.get('/review', (c) =>
  run(c, (auth) =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth, true);
      const application = c.req.query('applicationId'),
        user = c.req.query('userId');
      if (!application && !user)
        throw new RecruitmentError(400, 'Filter by applicationId or userId');
      if (
        (application && !idSchema.safeParse(application).success) ||
        (user && !idSchema.safeParse(user).success)
      )
        throw new RecruitmentError(400, 'Invalid identity filter');
      return (
        await db.query(
          `SELECT ${view},reason,suspension_source AS "suspensionSource",agreement_document_id AS "agreementDocumentId" FROM public.relationship_identifiers WHERE ($1::uuid IS NULL OR application_id=$1) AND ($2::uuid IS NULL OR user_id=$2) ORDER BY created_at,id LIMIT 200`,
          [application ?? null, user ?? null]
        )
      ).rows;
    })
  )
);
const employeeSchema = z.strictObject({
  userId: z.uuid(),
  organisationId: z.uuid(),
  agreementDocumentId: z.uuid(),
  reason: z.string().trim().min(10).max(2000),
  employmentVerified: z.literal(true),
});
routes.post('/employees', async (c) => {
  const parsed = employeeSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success)
    return jsonError(
      c,
      400,
      'VALIDATION_ERROR',
      'Provide a verified employment agreement and identity'
    );
  return run(
    c,
    (auth) =>
      withTransaction(async (db) => {
        await recruitmentIdentity(db, auth, true);
        const p = parsed.data;
        if (auth.userId === p.userId)
          throw new RecruitmentError(403, 'You cannot issue your own employee identifier');
        const employee = (
          await db.query(
            'SELECT * FROM public.users WHERE id=$1 AND organisation_id=$2 AND email_verified_at IS NOT NULL FOR SHARE',
            [p.userId, p.organisationId]
          )
        ).rows[0];
        if (!employee)
          throw new RecruitmentError(403, 'A current verified employee account is required');
        const agreement = (
          await db.query(
            `SELECT d.id FROM public.esign_documents d JOIN public.esign_artifacts a ON a.document_id=d.id WHERE d.id=$1 AND d.organisation_id=$2 AND d.status='completed' AND lower(d.title) LIKE 'employment agreement%' AND EXISTS(SELECT 1 FROM public.esign_signers s WHERE s.document_id=d.id AND lower(s.email)=lower($3) AND s.status='signed') FOR SHARE OF d`,
            [p.agreementDocumentId, auth.organisationId, employee.email]
          )
        ).rows[0];
        if (!agreement)
          throw new RecruitmentError(
            400,
            'A retained completed Employment agreement signed by this employee is required'
          );
        const row = (
          await db.query(
            `INSERT INTO public.relationship_identifiers(code,kind,user_id,organisation_id,agreement_document_id,status,reason,actor_id) VALUES($1,'employee',$2,$3,$4,'active',$5,$6) ON CONFLICT DO NOTHING RETURNING ${view}`,
            [
              'EMP-' + randomBytes(16).toString('hex'),
              p.userId,
              p.organisationId,
              p.agreementDocumentId,
              p.reason,
              auth.userId,
            ]
          )
        ).rows[0];
        if (!row)
          throw new RecruitmentError(
            409,
            'Employee identifier already exists; inspect its current status'
          );
        return row;
      }),
    201
  );
});
const transitionSchema = z.strictObject({
  revision: z.number().int().positive(),
  status: z.enum(['active', 'suspended', 'revoked']),
  reason: z.string().trim().min(10).max(2000),
});
routes.post('/:id/status', async (c) => {
  const input = transitionSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success || !idSchema.safeParse(c.req.param('id')).success)
    return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid identifier decision');
  return run(c, (auth) =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth, true);
      const link = (
        await db.query('SELECT application_id FROM public.relationship_identifiers WHERE id=$1', [
          c.req.param('id'),
        ])
      ).rows[0];
      if (!link) throw new RecruitmentError(404, 'Identifier not found');
      const application = link.application_id
        ? (
            await db.query('SELECT * FROM public.provider_applications WHERE id=$1 FOR UPDATE', [
              link.application_id,
            ])
          ).rows[0]
        : null;
      const row = (
          await db.query('SELECT * FROM public.relationship_identifiers WHERE id=$1 FOR UPDATE', [
            c.req.param('id'),
          ])
        ).rows[0],
        p = input.data;
      if (row.user_id === auth.userId)
        throw new RecruitmentError(403, 'You cannot control your own identifier');
      if (row.status === 'revoked' || row.revision !== p.revision || row.status === p.status)
        throw new RecruitmentError(
          409,
          'Identifier changed or transition unavailable; revocation is permanent'
        );
      if (p.status === 'active') {
        if (application && application.status !== 'approved')
          throw new RecruitmentError(403, 'Provider must currently be approved');
        if (
          !(
            await db.query(
              'SELECT 1 FROM public.users WHERE id=$1 AND organisation_id=$2 AND email_verified_at IS NOT NULL FOR SHARE',
              [row.user_id, row.organisation_id]
            )
          ).rowCount
        )
          throw new RecruitmentError(403, 'Current verified identity required');
      }
      if (p.status === 'active' && row.kind === 'employee') {
        const retained = (
          await db.query(
            `SELECT 1 FROM public.esign_documents d JOIN public.esign_artifacts a ON a.document_id=d.id JOIN public.users u ON u.id=$3 AND u.organisation_id=$4 WHERE d.id=$1 AND d.organisation_id=$2 AND d.status='completed' AND lower(d.title) LIKE 'employment agreement%' AND EXISTS(SELECT 1 FROM public.esign_signers s WHERE s.document_id=d.id AND lower(s.email)=lower(u.email) AND s.status='signed') FOR SHARE OF d`,
            [row.agreement_document_id, auth.organisationId, row.user_id, row.organisation_id]
          )
        ).rowCount;
        if (!retained)
          throw new RecruitmentError(
            403,
            'Current signed employment agreement binding is required'
          );
      }
      return (
        await db.query(
          `UPDATE public.relationship_identifiers SET status=$2,suspension_source=CASE WHEN $2='suspended' THEN 'manual' ELSE NULL END,revision=revision+1,reason=$3,actor_id=$4 WHERE id=$1 RETURNING ${view}`,
          [row.id, p.status, p.reason, auth.userId]
        )
      ).rows[0];
    })
  );
});
routes.get('/:id/events', (c) =>
  run(c, (auth) =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth, true);
      if (!idSchema.safeParse(c.req.param('id')).success)
        throw new RecruitmentError(404, 'Identifier not found');
      const row = (
        await db.query('SELECT * FROM public.relationship_identifiers WHERE id=$1 FOR SHARE', [
          c.req.param('id'),
        ])
      ).rows[0];
      if (!row) throw new RecruitmentError(404, 'Identifier not found');
      const events = (
        await db.query(
          'SELECT *,occurred_at::text AS occurred_at FROM public.relationship_identifier_events WHERE identifier_id=$1 ORDER BY revision',
          [row.id]
        )
      ).rows;
      let previous = '0'.repeat(64);
      for (let i = 0; i < events.length; i++) {
        const e = events[i];
        const valid = (
          await db.query(
            `SELECT $1::jsonb=jsonb_build_array($2::text,$3::int,$4::jsonb,($1::jsonb->>3),$5::text) AND ($1::jsonb->>3)::timestamptz=$6::timestamptz AS valid`,
            [
              e.canonical,
              e.identifier_id,
              e.revision,
              JSON.stringify(e.snapshot),
              e.previous_hash,
              e.occurred_at,
            ]
          )
        ).rows[0].valid;
        if (
          !valid ||
          e.revision !== i + 1 ||
          e.previous_hash !== previous ||
          createHash('sha256').update(e.canonical).digest('hex') !== e.hash
        )
          throw new Error('Identifier audit integrity failure');
        previous = e.hash;
      }
      const headValid = (
        await db.query(
          'SELECT e.snapshot=to_jsonb(i) AS valid FROM public.relationship_identifiers i JOIN public.relationship_identifier_events e ON e.identifier_id=i.id AND e.revision=i.revision WHERE i.id=$1',
          [row.id]
        )
      ).rows[0]?.valid;
      if (events.length !== row.revision || !headValid)
        throw new Error('Identifier audit head mismatch');
      return { events, head: previous };
    })
  )
);
export default routes;
