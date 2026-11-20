import { Hono, type Context } from 'hono';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getDbPool } from '../db.js';
import { withTransaction, type DbExecutor } from '../db/transaction.js';
import { hasDatabase, jsonError, requireAuth } from '../helpers.js';
import { actor, administrator, programmeReviewer, type Actor, type Application } from './access.js';
import { createProviderAgreementRoutes, agreementOverview } from './agreements.js';
import { rateLimit } from '../middleware.js';
import {
  PROVIDER_COMMISSION_BPS,
  PROVIDER_ENGAGEMENT_VERSION,
  hasCompleteIndependentEngagement,
  PROVIDER_TERMS_VERSION,
  PROVIDER_STATUSES,
  providerSubmissionSchema,
  providerReviewSchema,
  reviewTransitions,
} from './policy.js';

const success = (c: Context, data: unknown, status: 200 | 201 = 200) =>
  c.json({ success: true, data }, status);
async function evidence(
  db: DbExecutor,
  application: Application,
  by: Actor,
  event: string,
  reviewConfirmation?: { engagementReviewed: boolean; engagementVersion: string | null }
) {
  await db.query(
    'INSERT INTO public.provider_application_events(application_id,version,actor_id,actor_role,event,snapshot) VALUES($1,$2,$3,$4,$5,$6)',
    [
      application.id,
      application.version,
      by.id,
      by.role,
      event,
      {
        ...application,
        ...(reviewConfirmation ? { review_confirmation: reviewConfirmation } : {}),
      },
    ]
  );
}
function present(application: Application) {
  return {
    id: application.id,
    profile: application.profile,
    contactEmail: application.contact_email,
    status: application.status,
    version: application.version,
    commissionBasisPoints: application.commission_basis_points,
    termsVersion: application.terms_version,
    submittedAt: application.submitted_at,
    updatedAt: application.updated_at,
    reviewedAt: application.reviewed_at,
    reviewMessage: application.review_message,
    payoutsActive: false,
    independentEngagementComplete: hasCompleteIndependentEngagement(application.profile),
  };
}
async function detail(db: DbExecutor, application: Application) {
  const { rows } = await db.query(
    'SELECT id::text,version,event,actor_role,created_at,snapshot FROM public.provider_application_events WHERE application_id=$1 AND version <= $2 ORDER BY version',
    [application.id, application.version]
  );
  return {
    ...present(application),
    agreements: await agreementOverview(db, application),
    history: rows.map((row) => ({
      id: row.id,
      version: row.version,
      event: row.event,
      actorRole: row.actor_role,
      createdAt: row.created_at,
      profile: row.snapshot.profile,
      contactEmail: row.snapshot.contact_email,
      status: row.snapshot.status,
      message: row.snapshot.review_message,
      engagementReviewed: row.snapshot.review_confirmation?.engagementReviewed === true,
      engagementVersion: row.snapshot.review_confirmation?.engagementVersion ?? null,
    })),
  };
}
export function createProviderRoutes(
  services?: Parameters<typeof createProviderAgreementRoutes>[0]
) {
  const routes = new Hono();
  routes.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    if (process.env.PROVIDERS_ENABLED !== 'true')
      return jsonError(c, 503, 'PROVIDERS_DISABLED', 'Partner applications are not enabled yet');
    if (!hasDatabase())
      return jsonError(c, 503, 'DATABASE_REQUIRED', 'Partner applications require PostgreSQL');
    return next();
  });
  routes.route('/', createProviderAgreementRoutes(services));
  routes.get('/me', async (c) => {
    const user = await actor(c);
    if (user instanceof Response) return user;
    const application = (
      await getDbPool().query<Application>(
        'SELECT * FROM public.provider_applications WHERE user_id=$1',
        [user.id]
      )
    ).rows[0];
    if (application && application.organisation_id !== user.organisation_id)
      return jsonError(
        c,
        403,
        'AFFILIATION_CHANGED',
        'Contact support to update your application affiliation'
      );
    return success(c, {
      application: application ? await detail(getDbPool(), application) : null,
      policy: {
        commissionBasisPoints: PROVIDER_COMMISSION_BPS,
        termsVersion: PROVIDER_TERMS_VERSION,
        payoutsActive: false,
        canReview: programmeReviewer(user),
        engagementModel: 'independent_no_minimum',
        engagementVersion: PROVIDER_ENGAGEMENT_VERSION,
      },
    });
  });
  routes.post('/me', async (c) => {
    const identified = requireAuth(c);
    if (identified instanceof Response) return identified;
    const limited = await rateLimit('providers:apply', { windowMs: 60000, max: 5 })(c);
    if (limited instanceof Response) return limited;
    const parsed = providerSubmissionSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success)
      return jsonError(
        c,
        400,
        'VALIDATION_ERROR',
        'Complete the application and acknowledge the programme information'
      );
    return withTransaction(async (db) => {
      const user = await actor(c, db, true);
      if (user instanceof Response) return user;
      const existing = (
        await db.query<Application>(
          'SELECT * FROM public.provider_applications WHERE user_id=$1 FOR UPDATE',
          [user.id]
        )
      ).rows[0];
      if (existing && existing.organisation_id !== user.organisation_id)
        return jsonError(
          c,
          403,
          'AFFILIATION_CHANGED',
          'Contact support to update your application affiliation'
        );
      if (
        (existing &&
          (!['submitted', 'rejected'].includes(existing.status) ||
            existing.version !== parsed.data.version)) ||
        (!existing && parsed.data.version !== 0)
      )
        return jsonError(
          c,
          409,
          'APPLICATION_CHANGED',
          'Refresh your application. Only submitted or rejected applications can be revised'
        );
      const result = existing
        ? await db.query<Application>(
            `UPDATE public.provider_applications SET profile=$2,contact_email=$3,status='submitted',version=version+1,acknowledged_at=now(),updated_at=now(),reviewed_by=NULL,reviewed_at=NULL,review_message=NULL WHERE id=$1 RETURNING *`,
            [existing.id, parsed.data.profile, user.email]
          )
        : await db.query<Application>(
            `INSERT INTO public.provider_applications(id,user_id,organisation_id,contact_email,profile,commission_basis_points,terms_version,acknowledged_at) VALUES($1,$2,$3,$4,$5,$6,$7,now()) ON CONFLICT(user_id) DO NOTHING RETURNING *`,
            [
              randomUUID(),
              user.id,
              user.organisation_id,
              user.email,
              parsed.data.profile,
              PROVIDER_COMMISSION_BPS,
              PROVIDER_TERMS_VERSION,
            ]
          );
      const application = result.rows[0];
      if (!application)
        return jsonError(
          c,
          409,
          'APPLICATION_CHANGED',
          'An application was just submitted. Refresh to continue'
        );
      await evidence(
        db,
        application,
        user,
        existing ? 'application.resubmitted' : 'application.submitted'
      );
      return success(c, { application: await detail(db, application) }, existing ? 200 : 201);
    });
  });
  routes.get('/admin/applications', async (c) => {
    const user = await administrator(c);
    if (user instanceof Response) return user;
    const parsed = z
      .object({
        offset: z.coerce.number().int().min(0).max(1000000).default(0),
        status: z.enum(PROVIDER_STATUSES).optional(),
      })
      .safeParse({ offset: c.req.query('offset'), status: c.req.query('status') });
    if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid application filter');
    const { rows } = await getDbPool().query<Application>(
      `SELECT * FROM public.provider_applications WHERE ($1::text IS NULL OR status=$1) ORDER BY updated_at DESC,id DESC LIMIT 26 OFFSET $2`,
      [parsed.data.status ?? null, parsed.data.offset]
    );
    return success(c, {
      applications: await Promise.all(
        rows.slice(0, 25).map(async (application) => {
          const progress = (await agreementOverview(getDbPool(), application, 1))[0];
          return {
            ...present(application),
            agreementProgress: progress
              ? {
                  state: progress.state,
                  signedCount: progress.signedCount,
                  signerCount: progress.signerCount,
                }
              : null,
          };
        })
      ),
      hasMore: rows.length > 25,
    });
  });
  routes.get('/admin/applications/:id', async (c) => {
    const user = await administrator(c);
    if (user instanceof Response) return user;
    const id = c.req.param('id');
    if (!z.uuid().safeParse(id).success)
      return jsonError(c, 404, 'NOT_FOUND', 'Application not found');
    const application = (
      await getDbPool().query<Application>(
        'SELECT * FROM public.provider_applications WHERE id=$1',
        [id]
      )
    ).rows[0];
    return application
      ? success(c, {
          application: await detail(getDbPool(), application),
          canReview: application.user_id !== user.id,
        })
      : jsonError(c, 404, 'NOT_FOUND', 'Application not found');
  });
  routes.post('/admin/applications/:id/review', async (c) => {
    const parsed = providerReviewSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success || !z.uuid().safeParse(c.req.param('id')).success)
      return jsonError(
        c,
        400,
        'VALIDATION_ERROR',
        'Choose a decision, current revision and a message to the applicant'
      );
    return withTransaction(async (db) => {
      const user = await administrator(c, db, true);
      if (user instanceof Response) return user;
      const application = (
        await db.query<Application>(
          'SELECT * FROM public.provider_applications WHERE id=$1 FOR UPDATE',
          [c.req.param('id')]
        )
      ).rows[0];
      if (!application) return jsonError(c, 404, 'NOT_FOUND', 'Application not found');
      if (application.user_id === user.id)
        return jsonError(
          c,
          403,
          'SELF_REVIEW',
          'Another administrator must review your own application'
        );
      if (
        application.version !== parsed.data.version ||
        !reviewTransitions[application.status].includes(parsed.data.status)
      )
        return jsonError(
          c,
          409,
          'APPLICATION_CHANGED',
          'This application has changed or the decision is unavailable. Refresh before reviewing'
        );
      if (
        parsed.data.status === 'approved' &&
        !hasCompleteIndependentEngagement(application.profile)
      )
        return jsonError(
          c,
          409,
          'ENGAGEMENT_FORM_REQUIRED',
          'The candidate must complete the independent engagement forms before approval. Request a revised application.'
        );
      const updated = (
        await db.query<Application>(
          `UPDATE public.provider_applications SET status=$2,version=version+1,review_message=$3,reviewed_by=$4,reviewed_at=now(),updated_at=now() WHERE id=$1 RETURNING *`,
          [application.id, parsed.data.status, parsed.data.message, user.id]
        )
      ).rows[0];
      await evidence(db, updated, user, `application.${parsed.data.status}`, {
        engagementReviewed: parsed.data.status === 'approved' && parsed.data.engagementReviewed,
        engagementVersion: parsed.data.status === 'approved' ? PROVIDER_ENGAGEMENT_VERSION : null,
      });
      return success(c, { application: await detail(db, updated), canReview: true });
    });
  });
  return routes;
}
export default createProviderRoutes();
