import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { randomBytes, randomUUID } from 'node:crypto';
import { hasDatabase, jsonError, requireAuth, type AuthContext } from '../helpers.js';
import { withTransaction } from '../db/transaction.js';
import { recruitmentIdentity, RecruitmentError } from '../provider-recruitment.js';
import {
  scopeRequestSchema,
  scopeReviewSchema,
  professionalSessionSchema,
  completionReviewSchema,
} from '../professional-policy.js';
import {
  professionalAudit,
  validProfessionalScope,
  professionalSessionAuthority,
  progressHash,
  verifyProfessionalAudit,
} from '../professional-authority.js';
import { missingForCompletion, quizResult } from '../workshop-quiz.js';
const routes = new Hono();
routes.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  if (!hasDatabase())
    return jsonError(c, 503, 'DATABASE_REQUIRED', 'Professional authority requires PostgreSQL');
  return next();
});
async function run(
  c: Context,
  action: (auth: AuthContext) => Promise<unknown>,
  status: 200 | 201 = 200
) {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (c.get('apiKeyAuth' as never))
    return jsonError(c, 403, 'FORBIDDEN', 'Use a verified personal account');
  try {
    return c.json({ success: true, data: await action(auth) }, status);
  } catch (e) {
    if (e instanceof RecruitmentError)
      return jsonError(c, e.status, 'PROFESSIONAL_AUTHORITY', e.message);
    throw e;
  }
}
const validId = (id: string) => z.uuid().safeParse(id).success;
interface ScopeView {
  id: string;
  application_id: string;
  subject_id: string;
  subject_version: string;
  requested_actions: string[];
  approved_actions: string[];
  evidence: string;
  status: string;
  revision: number;
  application_revision: number | null;
  valid_from: Date | string | null;
  valid_until: Date | string | null;
  review_reason: string | null;
  qualification_check: string | null;
  demonstration_check: string | null;
  reviewed_by: string | null;
}
function publicScope(s: ScopeView, reviewer = false) {
  return {
    id: s.id,
    applicationId: s.application_id,
    subjectId: s.subject_id,
    subjectVersion: s.subject_version,
    requestedActions: s.requested_actions,
    actions: s.approved_actions,
    evidence: s.evidence,
    status: s.status,
    revision: s.revision,
    applicationRevision: s.application_revision,
    validFrom: s.valid_from,
    validUntil: s.valid_until,
    reason: s.review_reason,
    ...(reviewer
      ? {
          qualificationCheck: s.qualification_check,
          demonstrationCheck: s.demonstration_check,
          reviewedBy: s.reviewed_by,
        }
      : {}),
  };
}
routes.get('/subjects', (c) =>
  run(c, (auth) =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth);
      return (
        await db.query(
          'SELECT id,version,title,course_id AS "courseId",course_version AS "courseVersion" FROM public.professional_subjects WHERE active ORDER BY title'
        )
      ).rows;
    })
  )
);
routes.get('/me/scopes', (c) =>
  run(c, (auth) =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth);
      const rows = (
        await db.query(
          `SELECT s.* FROM public.provider_professional_scopes s JOIN public.provider_applications a ON a.id=s.application_id WHERE a.applicant_id=$1 AND a.organisation_id=$2 ORDER BY s.created_at DESC`,
          [auth.userId, auth.organisationId]
        )
      ).rows;
      return Promise.all(
        rows.map(async (s) => {
          let effective = false;
          try {
            await validProfessionalScope(db, s.id, 'deliver');
            effective = true;
          } catch (e) {
            if (!(e instanceof RecruitmentError)) throw e;
          }
          return { ...publicScope(s), effective };
        })
      );
    })
  )
);
routes.get('/applications/:id/scopes', (c) =>
  run(c, (auth) =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth, true);
      if (!validId(c.req.param('id'))) throw new RecruitmentError(404, 'Application not found');
      const scopes = (
        await db.query(
          'SELECT * FROM public.provider_professional_scopes WHERE application_id=$1 ORDER BY created_at DESC',
          [c.req.param('id')]
        )
      ).rows;
      return Promise.all(
        scopes.map(async (s) => {
          let effective = false;
          try {
            await validProfessionalScope(db, s.id, 'deliver');
            effective = true;
          } catch (e) {
            if (!(e instanceof RecruitmentError)) throw e;
          }
          return { ...publicScope(s, true), effective };
        })
      );
    })
  )
);
routes.post('/me/scopes', async (c) => {
  const input = scopeRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success)
    return jsonError(
      c,
      400,
      'VALIDATION_ERROR',
      input.error.issues[0]?.message ?? 'Invalid scope request'
    );
  return run(
    c,
    (auth) =>
      withTransaction(async (db) => {
        await recruitmentIdentity(db, auth);
        const a = (
          await db.query(
            'SELECT * FROM public.provider_applications WHERE applicant_id=$1 AND organisation_id=$2 FOR UPDATE',
            [auth.userId, auth.organisationId]
          )
        ).rows[0];
        if (
          !a ||
          !['submitted', 'approved'].includes(a.status) ||
          !['training', 'both'].includes(a.service_interest)
        )
          throw new RecruitmentError(403, 'A current training-provider application is required');
        const p = input.data;
        const topic = (
          await db.query(
            'SELECT 1 FROM public.professional_subjects WHERE id=$1 AND version=$2 AND active',
            [p.subjectId, p.subjectVersion]
          )
        ).rows[0];
        if (!topic) throw new RecruitmentError(400, 'Unsupported subject/version');
        const old = (
          await db.query(
            'SELECT * FROM public.provider_professional_scopes WHERE application_id=$1 AND subject_id=$2 AND subject_version=$3 FOR UPDATE',
            [a.id, p.subjectId, p.subjectVersion]
          )
        ).rows[0];
        if (
          (old?.revision ?? 0) !== p.revision ||
          old?.status === 'revoked' ||
          (old?.status === 'approved' && Date.parse(old.valid_until) > Date.now())
        )
          throw new RecruitmentError(
            409,
            'Scope changed, revoked or currently active; refresh or ask the reviewer to suspend before revising'
          );
        const s = old
          ? (
              await db.query(
                `UPDATE public.provider_professional_scopes SET requested_actions=$2,evidence=$3,status='requested',revision=revision+1,approved_actions='{}',application_revision=NULL,valid_from=NULL,valid_until=NULL,review_reason=NULL,qualification_check=NULL,demonstration_check=NULL,reviewed_by=NULL,reviewed_at=NULL WHERE id=$1 RETURNING *`,
                [old.id, p.actions, p.evidence]
              )
            ).rows[0]
          : (
              await db.query(
                'INSERT INTO public.provider_professional_scopes(application_id,subject_id,subject_version,requested_actions,evidence) VALUES($1,$2,$3,$4,$5) RETURNING *',
                [a.id, p.subjectId, p.subjectVersion, p.actions, p.evidence]
              )
            ).rows[0];
        await professionalAudit(db, a.id, auth.userId, 'scope.requested', { scope: s });
        return publicScope(s);
      }),
    201
  );
});
routes.post('/scopes/:id/review', async (c) => {
  const input = scopeReviewSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success || !validId(c.req.param('id')))
    return jsonError(
      c,
      400,
      'VALIDATION_ERROR',
      input.success ? 'Invalid scope' : (input.error.issues[0]?.message ?? 'Invalid review')
    );
  return run(c, (auth) =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth, true);
      const link = (
        await db.query(
          'SELECT application_id FROM public.provider_professional_scopes WHERE id=$1',
          [c.req.param('id')]
        )
      ).rows[0];
      if (!link) throw new RecruitmentError(404, 'Scope not found');
      const a = (
        await db.query('SELECT * FROM public.provider_applications WHERE id=$1 FOR UPDATE', [
          link.application_id,
        ])
      ).rows[0];
      if (a.applicant_id === auth.userId)
        throw new RecruitmentError(403, 'You cannot approve your own professional authority');
      const s = (
          await db.query(
            'SELECT * FROM public.provider_professional_scopes WHERE id=$1 FOR UPDATE',
            [c.req.param('id')]
          )
        ).rows[0],
        p = input.data;
      if (
        s.revision !== p.revision ||
        s.status === 'revoked' ||
        (p.status === 'declined' && s.status !== 'requested') ||
        (p.status === 'suspended' && s.status !== 'approved')
      )
        throw new RecruitmentError(409, 'Scope changed or transition is unavailable');
      if (p.status === 'approved') {
        const u = (await db.query('SELECT * FROM public.users WHERE id=$1', [a.applicant_id]))
          .rows[0];
        if (
          a.status !== 'approved' ||
          !['training', 'both'].includes(a.service_interest) ||
          !u?.email_verified_at ||
          u.organisation_id !== a.organisation_id ||
          u.email.toLowerCase() !== a.applicant_email.toLowerCase() ||
          p.actions!.some((k) => !s.requested_actions.includes(k))
        )
          throw new RecruitmentError(
            403,
            'Approved current provider and explicitly requested rights are required'
          );
        if (
          !(
            await db.query(
              'SELECT 1 FROM public.professional_subjects WHERE id=$1 AND version=$2 AND active',
              [s.subject_id, s.subject_version]
            )
          ).rowCount
        )
          throw new RecruitmentError(403, 'Subject is inactive');
      }
      const saved = (
        await db.query(
          `UPDATE public.provider_professional_scopes SET status=$2,revision=revision+1,approved_actions=CASE WHEN $2='approved' THEN $3 ELSE approved_actions END,application_revision=CASE WHEN $2='approved' THEN $4 ELSE application_revision END,
   valid_from=CASE WHEN $2='approved' THEN $5 ELSE valid_from END,valid_until=CASE WHEN $2='approved' THEN $6 ELSE valid_until END,review_reason=$7,qualification_check=COALESCE($8,qualification_check),demonstration_check=COALESCE($9,demonstration_check),reviewed_by=$10,reviewed_at=now() WHERE id=$1 RETURNING *`,
          [
            s.id,
            p.status,
            p.actions ?? [],
            a.revision,
            p.validFrom ?? null,
            p.validUntil ?? null,
            p.reason,
            p.qualificationCheck ?? null,
            p.demonstrationCheck ?? null,
            auth.userId,
          ]
        )
      ).rows[0];
      await professionalAudit(db, a.id, auth.userId, `scope.${p.status}`, {
        scope: saved,
        checksConfirmed: p.checksConfirmed ?? false,
      });
      return publicScope(saved, true);
    })
  );
});
routes.get('/applications/:id/audit', (c) =>
  run(c, (auth) =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth, true);
      if (!validId(c.req.param('id'))) throw new RecruitmentError(404, 'Application not found');
      await db.query(
        'SELECT application_id FROM public.professional_audit_heads WHERE application_id=$1 FOR SHARE',
        [c.req.param('id')]
      );
      return verifyProfessionalAudit(db, c.req.param('id'));
    })
  )
);
routes.get('/me/sessions', (c) =>
  run(c, (auth) =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth);
      return (
        await db.query(
          `SELECT b.session_id AS id,b.scope_id AS "scopeId",b.scope_revision AS "scopeRevision",b.assignment_id AS "assignmentId",b.snapshot,s.session_code AS code,s.title,s.is_active AS "isActive" FROM public.provider_session_authority b LEFT JOIN public.workshop_sessions s ON s.id=b.session_id WHERE b.trainer_id=$1 ORDER BY b.created_at DESC LIMIT 100`,
          [auth.userId]
        )
      ).rows;
    })
  )
);
routes.post('/sessions', async (c) => {
  const input = professionalSessionSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success)
    return jsonError(
      c,
      400,
      'VALIDATION_ERROR',
      'Provide a current scope and accepted scoped assignment'
    );
  return run(
    c,
    (auth) =>
      withTransaction(async (db) => {
        await recruitmentIdentity(db, auth);
        const p = input.data,
          a = await validProfessionalScope(db, p.scopeId, 'deliver', true);
        const assignment = (
          await db.query('SELECT * FROM public.provider_assignments WHERE id=$1 FOR SHARE', [
            p.assignmentId,
          ])
        ).rows[0];
        if (
          a.trainer.id !== auth.userId ||
          a.application.organisation_id !== auth.organisationId ||
          a.scope.revision !== p.scopeRevision ||
          !assignment ||
          assignment.application_id !== a.application.id ||
          assignment.service !== 'training' ||
          assignment.status !== 'accepted' ||
          assignment.professional_scope_id !== p.scopeId ||
          assignment.professional_scope_revision !== p.scopeRevision
        )
          throw new RecruitmentError(
            403,
            'Your accepted assignment must explicitly match the current subject/scope revision'
          );
        const id = randomUUID(),
          code = randomBytes(4).toString('hex').toUpperCase();
        await db.query(
          'INSERT INTO public.workshop_sessions(id,facilitator_id,session_code,title) VALUES($1,$2,$3,$4)',
          [id, auth.userId, code, p.title]
        );
        const snapshot = {
          applicationId: a.application.id,
          applicationRevision: a.application.revision,
          providerReference: a.application.provider_code,
          trainerName: a.trainer.name,
          subjectId: a.subject.id,
          subjectVersion: a.subject.version,
          subjectTitle: a.subject.title,
          courseId: a.subject.course_id,
          courseVersion: a.subject.course_version,
        };
        await db.query(
          'INSERT INTO public.provider_session_authority(session_id,scope_id,scope_revision,assignment_id,trainer_id,snapshot) VALUES($1,$2,$3,$4,$5,$6)',
          [id, p.scopeId, p.scopeRevision, p.assignmentId, auth.userId, snapshot]
        );
        await professionalAudit(db, a.application.id, auth.userId, 'session.created', {
          sessionId: id,
          scopeId: p.scopeId,
          scopeRevision: p.scopeRevision,
          assignmentId: p.assignmentId,
          snapshot,
        });
        return { id, code, title: p.title };
      }),
    201
  );
});
async function ownedSession(
  db: Parameters<typeof professionalSessionAuthority>[0],
  auth: AuthContext,
  id: string,
  action: 'deliver' | 'assess' | 'issue_completion'
) {
  if (!validId(id)) throw new RecruitmentError(404, 'Session not found');
  const a = await professionalSessionAuthority(db, id, action, true);
  if (!a || a.trainer.id !== auth.userId || a.application.organisation_id !== auth.organisationId)
    throw new RecruitmentError(403, 'Current authority for your own provider session is required');
  return a;
}
routes.get('/sessions/:id/participants', (c) =>
  run(c, (auth) =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth);
      await ownedSession(db, auth, c.req.param('id'), 'deliver');
      return (
        await db.query(
          `SELECT p.user_id AS id,u.name,wp.id AS "progressId",wp.completed_at AS "completedAt",wp.completed_sections AS "completedSections",wp.quiz_scores AS "quizScores",
  (SELECT decision FROM public.professional_completion_reviews r WHERE r.session_id=p.session_id AND r.learner_id=p.user_id ORDER BY revision DESC LIMIT 1) AS decision,
  COALESCE((SELECT max(revision) FROM public.professional_completion_reviews r WHERE r.session_id=p.session_id AND r.learner_id=p.user_id),0)::int AS "assessmentRevision"
  FROM public.session_participants p JOIN public.users u ON u.id=p.user_id LEFT JOIN public.workshop_progress wp ON wp.session_id=p.session_id AND wp.user_id=p.user_id WHERE p.session_id=$1 ORDER BY p.joined_at LIMIT 500`,
          [c.req.param('id')]
        )
      ).rows.map((p) => ({
        ...p,
        quizPercent: quizResult(p.quizScores).percent,
        missing: missingForCompletion(p.completedSections, p.quizScores),
      }));
    })
  )
);
routes.post('/sessions/:id/assessments', async (c) => {
  const input = completionReviewSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success)
    return jsonError(
      c,
      400,
      'VALIDATION_ERROR',
      'Provide the learner, assessment decision and current revision'
    );
  return run(
    c,
    (auth) =>
      withTransaction(async (db) => {
        await recruitmentIdentity(db, auth);
        await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
          'professional-assessment:' + c.req.param('id'),
        ]);
        const a = await ownedSession(db, auth, c.req.param('id'), 'assess'),
          p = input.data;
        if (p.learnerId === auth.userId)
          throw new RecruitmentError(403, 'You cannot assess yourself');
        await db.query(
          'SELECT session_id FROM public.provider_session_authority WHERE session_id=$1 FOR UPDATE',
          [c.req.param('id')]
        );
        const progress = (
          await db.query(
            `SELECT wp.* FROM public.workshop_progress wp JOIN public.session_participants m ON m.session_id=wp.session_id AND m.user_id=wp.user_id WHERE wp.session_id=$1 AND wp.user_id=$2 FOR SHARE OF wp`,
            [c.req.param('id'), p.learnerId]
          )
        ).rows[0];
        if (!progress)
          throw new RecruitmentError(404, 'Learner progress not found in this session');
        const old = (
          await db.query(
            'SELECT revision FROM public.professional_completion_reviews WHERE session_id=$1 AND learner_id=$2 ORDER BY revision DESC LIMIT 1',
            [c.req.param('id'), p.learnerId]
          )
        ).rows[0];
        if ((old?.revision ?? 0) !== p.revision)
          throw new RecruitmentError(409, 'Assessment changed; refresh before reviewing');
        const missing = missingForCompletion(progress.completed_sections, progress.quiz_scores);
        if (
          p.decision === 'approved' &&
          (!progress.completed_at ||
            missing.sections.length ||
            missing.quizzes.length ||
            !quizResult(progress.quiz_scores).passed)
        )
          throw new RecruitmentError(
            409,
            'Server-verified course completion and quiz pass are required'
          );
        const row = (
          await db.query(
            `INSERT INTO public.professional_completion_reviews(session_id,learner_id,revision,decision,reason,progress_hash,snapshot,reviewed_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,revision,decision`,
            [
              c.req.param('id'),
              p.learnerId,
              p.revision + 1,
              p.decision,
              p.reason,
              progressHash(progress),
              {
                progressId: progress.id,
                completedSections: progress.completed_sections,
                quizScores: progress.quiz_scores,
                completedAt: progress.completed_at,
                scopeId: a.scope.id,
                scopeRevision: a.scope.revision,
              },
              auth.userId,
            ]
          )
        ).rows[0];
        await professionalAudit(db, a.application.id, auth.userId, 'completion.assessed', {
          ...row,
          sessionId: c.req.param('id'),
          learnerId: p.learnerId,
          decision: p.decision,
          reason: p.reason,
          progressHash: progressHash(progress),
        });
        return row;
      }),
    201
  );
});
routes.post('/sessions/:id/certificates', async (c) => {
  const input = z
    .strictObject({ learnerId: z.uuid(), assessmentRevision: z.number().int().positive() })
    .safeParse(await c.req.json().catch(() => null));
  if (!input.success || !validId(c.req.param('id')))
    return jsonError(c, 400, 'VALIDATION_ERROR', 'Provide a current learner assessment');
  return run(c, async (auth) => {
    const learner = await withTransaction(async (db) => {
      await recruitmentIdentity(db, auth);
      await ownedSession(db, auth, c.req.param('id'), 'issue_completion');
      if (auth.userId === input.data.learnerId)
        throw new RecruitmentError(403, 'You cannot certify yourself');
      return (
        await db.query(
          'SELECT id,email,role,organisation_id FROM public.users WHERE id=$1 AND email_verified_at IS NOT NULL',
          [input.data.learnerId]
        )
      ).rows[0];
    });
    if (!learner) throw new RecruitmentError(404, 'Verified learner not found');
    const { issueTrainingCertificate, CertificateEligibilityError } =
      await import('../certificates.js');
    try {
      return await issueTrainingCertificate(
        {
          userId: learner.id,
          organisationId: learner.organisation_id,
          email: learner.email,
          role: learner.role,
        },
        c.req.param('id'),
        { professionalIssuer: auth, assessmentRevision: input.data.assessmentRevision }
      );
    } catch (e) {
      if (e instanceof CertificateEligibilityError) throw new RecruitmentError(e.status, e.message);
      throw e;
    }
  });
});
export default routes;
