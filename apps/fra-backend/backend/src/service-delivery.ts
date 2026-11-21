import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { AuthContext } from './helpers.js';
import { recruitmentIdentity, RecruitmentError } from './provider-recruitment.js';
import { professionalSessionAuthority } from './professional-authority.js';
export async function deliveryAccess(db: PoolClient, auth: AuthContext, id: string, write = false) {
  const identity = await recruitmentIdentity(db, auth);
  const link = (
    await db.query('SELECT application_id FROM public.service_deliveries WHERE id=$1', [id])
  ).rows[0];
  if (!link) throw new RecruitmentError(404, 'Delivery not found');
  const app = (
    await db.query(
      `SELECT * FROM public.provider_applications WHERE id=$1${write ? ' FOR UPDATE' : ''}`,
      [link.application_id]
    )
  ).rows[0];
  const delivery = (
    await db.query(
      `SELECT * FROM public.service_deliveries WHERE id=$1${write ? ' FOR UPDATE' : ' FOR SHARE'}`,
      [id]
    )
  ).rows[0];
  const provider = app.applicant_id === auth.userId && app.organisation_id === auth.organisationId;
  const customer =
    delivery.customer_user_id === auth.userId &&
    delivery.customer_organisation_id === auth.organisationId &&
    ['admin', 'employer'].includes(identity.role) &&
    !provider;
  const reviewer =
    identity.role === 'admin' &&
    auth.organisationId === process.env.PROVIDER_REVIEW_ORGANISATION_ID &&
    !provider;
  if (!provider && !customer && !reviewer)
    throw new RecruitmentError(
      403,
      'This delivery is restricted to its provider, designated customer and operator'
    );
  return { app, delivery, provider, customer, reviewer };
}
export async function currentDeliveryProvider(
  db: PoolClient,
  auth: AuthContext,
  context: Awaited<ReturnType<typeof deliveryAccess>>
) {
  const authority = await professionalSessionAuthority(
    db,
    context.delivery.session_id,
    'deliver',
    true
  );
  if (
    !context.provider ||
    !authority ||
    authority.trainer.id !== auth.userId ||
    authority.binding.assignment_id !== context.delivery.assignment_id
  )
    throw new RecruitmentError(403, 'Current professional authority for this delivery is required');
  if (context.delivery.status !== 'in_progress')
    throw new RecruitmentError(
      409,
      'Reopen refused work before editing; submitted, accepted or disputed evidence is frozen'
    );
}
export async function deliveryDetail(
  db: PoolClient,
  c: Awaited<ReturnType<typeof deliveryAccess>>
) {
  const d = c.delivery;
  const attendance = (
    await db.query(
      'SELECT DISTINCT ON(learner_id) * FROM public.service_attendance WHERE delivery_id=$1 ORDER BY learner_id,revision DESC',
      [d.id]
    )
  ).rows;
  // No other customer organisation's participants are exposed, including in a shared class.
  const learners = (
    await db.query(
      `SELECT u.id,u.name,wp.completed_at AS "completedAt",wp.completed_sections AS "completedSections",wp.quiz_scores AS "quizScores" FROM public.session_participants m JOIN public.users u ON u.id=m.user_id LEFT JOIN public.workshop_progress wp ON wp.user_id=u.id AND wp.session_id=m.session_id WHERE m.session_id=$1 AND u.organisation_id=$2 ORDER BY u.name LIMIT 500`,
      [d.session_id, d.customer_organisation_id]
    )
  ).rows;
  const files = (
    await db.query(
      'SELECT id,filename,mime_type AS "mimeType",octet_length(content) AS bytes,sha256,created_at AS "createdAt" FROM public.service_delivery_files WHERE delivery_id=$1 ORDER BY created_at,id',
      [d.id]
    )
  ).rows;
  return {
    delivery: { ...d, ...(!c.reviewer ? { actor_id: undefined } : {}) },
    permissions: { provider: c.provider, customer: c.customer, reviewer: c.reviewer },
    attendance,
    learners,
    files,
  };
}
export async function verifyDeliveryHistory(db: PoolClient, id: string) {
  const rows = (
    await db.query(
      'SELECT *,occurred_at::text AS occurred_at FROM public.service_delivery_events WHERE delivery_id=$1 ORDER BY revision',
      [id]
    )
  ).rows;
  let previous = '0'.repeat(64);
  for (let i = 0; i < rows.length; i++) {
    const e = rows[i];
    const valid = (
      await db.query(
        `SELECT $1::jsonb=jsonb_build_array($2::text,$3::int,$4::jsonb,($1::jsonb->>3),$5::text) AND ($1::jsonb->>3)::timestamptz=$6::timestamptz AS valid`,
        [
          e.canonical,
          e.delivery_id,
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
      throw new Error('Delivery audit integrity failure');
    previous = e.hash;
  }
  const valid = (
    await db.query(
      'SELECT d.revision,e.snapshot=to_jsonb(d) AS valid FROM public.service_deliveries d JOIN public.service_delivery_events e ON e.delivery_id=d.id AND e.revision=d.revision WHERE d.id=$1',
      [id]
    )
  ).rows[0];
  if (!valid?.valid || valid.revision !== rows.length)
    throw new Error('Delivery audit head mismatch');
  return { events: rows, head: previous };
}
