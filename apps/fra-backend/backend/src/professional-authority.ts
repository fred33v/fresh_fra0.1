import {providerIdentifiersActive} from './relationship-identifiers.js';
import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { DbExecutor } from './db/transaction.js';
import type { AuthContext } from './helpers.js';
import { recruitmentIdentity, RecruitmentError } from './provider-recruitment.js';
import type { ProfessionalAction } from './professional-policy.js';
export const digest = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');
export async function professionalAudit(
  db: DbExecutor,
  applicationId: string,
  actorId: string,
  event: string,
  details: unknown
) {
  await db.query(
    'INSERT INTO public.professional_audit_heads(application_id) VALUES($1) ON CONFLICT DO NOTHING',
    [applicationId]
  );
  await db.query(
    'INSERT INTO public.professional_audit(application_id,actor_id,event,details) VALUES($1,$2,$3,$4)',
    [applicationId, actorId, event, details]
  );
}
export async function validProfessionalScope(
  db: DbExecutor,
  scopeId: string,
  action: ProfessionalAction,
  lock = false
) {
  const link = (
    await db.query('SELECT application_id FROM public.provider_professional_scopes WHERE id=$1', [
      scopeId,
    ])
  ).rows[0];
  if (!link) throw new RecruitmentError(403, 'Professional scope is unavailable');
  const a = (
    await db.query(
      `SELECT * FROM public.provider_applications WHERE id=$1${lock ? ' FOR SHARE' : ''}`,
      [link.application_id]
    )
  ).rows[0];
  const s = (
    await db.query(
      `SELECT * FROM public.provider_professional_scopes WHERE id=$1${lock ? ' FOR SHARE' : ''}`,
      [scopeId]
    )
  ).rows[0];
  const user = (
    await db.query(
      `SELECT id,name,email,organisation_id,email_verified_at FROM public.users WHERE id=$1${lock ? ' FOR SHARE' : ''}`,
      [a?.applicant_id]
    )
  ).rows[0];
  const subject = (
    await db.query(
      `SELECT * FROM public.professional_subjects WHERE id=$1 AND version=$2${lock ? ' FOR SHARE' : ''}`,
      [s.subject_id, s.subject_version]
    )
  ).rows[0];
  if (
    !a ||
    a.status !== 'approved' || !(await providerIdentifiersActive(db,a.id)) ||
    !['training', 'both'].includes(a.service_interest) ||
    s.status !== 'approved' ||
    a.revision !== s.application_revision ||
    !user?.email_verified_at ||
    user.organisation_id !== a.organisation_id ||
    user.email.toLowerCase() !== a.applicant_email.toLowerCase() ||
    !subject?.active ||
    !s.approved_actions.includes(action) ||
    Date.parse(s.valid_from) > Date.now() ||
    Date.parse(s.valid_until) <= Date.now()
  )
    throw new RecruitmentError(
      403,
      'Current approved subject, action, provider identity and validity period are required'
    );
  return { application: a, scope: s, subject, trainer: user };
}
export async function professionalSessionAuthority(
  db: DbExecutor,
  sessionId: string,
  action: ProfessionalAction,
  lock = false
) {
  const b = (
    await db.query('SELECT * FROM public.provider_session_authority WHERE session_id=$1', [
      sessionId,
    ])
  ).rows[0];
  if (!b) return null;
  const result = await validProfessionalScope(db, b.scope_id, action, lock);
  const assignment = (
    await db.query(
      `SELECT * FROM public.provider_assignments WHERE id=$1${lock ? ' FOR SHARE' : ''}`,
      [b.assignment_id]
    )
  ).rows[0];
  if (
    b.scope_revision !== result.scope.revision ||
    b.trainer_id !== result.trainer.id ||
    !assignment ||
    assignment.application_id !== result.application.id ||
    assignment.service !== 'training' ||
    !['accepted', 'completed'].includes(assignment.status) ||
    assignment.professional_scope_id !== b.scope_id ||
    assignment.professional_scope_revision !== b.scope_revision
  )
    throw new RecruitmentError(
      403,
      'This session no longer has a current accepted subject-scoped assignment'
    );
  if (lock)
    await db.query(
      'SELECT session_id FROM public.provider_session_authority WHERE session_id=$1 FOR SHARE',
      [sessionId]
    );
  return { ...result, binding: b };
}
export const progressHash = (p: {
  id: string;
  user_id: string;
  completed_sections: unknown;
  quiz_scores: unknown;
  completed_at: Date | string | null;
}) =>
  digest(
    JSON.stringify([
      p.id,
      p.user_id,
      p.completed_sections,
      p.quiz_scores,
      p.completed_at ? new Date(p.completed_at).toISOString() : null,
    ])
  );
export interface ProfessionalCertificateAuthority {
  applicationId: string;
  scopeId: string;
  scopeRevision: number;
  subjectId: string;
  subjectVersion: string;
  sessionId: string;
  assignmentId: string;
  assessmentId: string;
  assessmentRevision: number;
  trainerId: string;
  issuerId: string;
  policy: 'provider-completion-v1';
}
export async function authoriseProfessionalCertificate(
  db: PoolClient,
  progress: {
    id: string;
    user_id: string;
    session_id: string | null;
    provider_session_id?: string | null;
    completed_sections: unknown;
    quiz_scores: unknown;
    completed_at: Date | string | null;
  },
  courseId: string,
  courseVersion: string,
  issuer?: AuthContext,
  assessmentRevision?: number
) {
  const sessionId = progress.provider_session_id ?? progress.session_id;
  if (!sessionId) return null;
  const linked = (
    await db.query('SELECT session_id FROM public.provider_session_authority WHERE session_id=$1', [
      sessionId,
    ])
  ).rows[0];
  if (!linked) return null;
  if (!issuer)
    throw new RecruitmentError(
      403,
      'The authorised trainer must issue a certificate for this provider-led session'
    );
  await recruitmentIdentity(db, issuer);
  const a = await professionalSessionAuthority(db, sessionId, 'issue_completion', true);
  if (
    !a ||
    a.trainer.id !== issuer.userId ||
    a.application.organisation_id !== issuer.organisationId ||
    issuer.userId === progress.user_id ||
    a.subject.course_id !== courseId ||
    a.subject.course_version !== courseVersion
  )
    throw new RecruitmentError(
      403,
      'Current course-specific issuer authority is required; self-certification is not permitted'
    );
  const current = (
    await db.query('SELECT * FROM public.workshop_progress WHERE id=$1 FOR SHARE', [progress.id])
  ).rows[0];
  if (!current || progressHash(current) !== progressHash(progress))
    throw new RecruitmentError(409, 'Learner progress changed; review the current completion');
  const member = (
    await db.query('SELECT 1 FROM public.session_participants WHERE session_id=$1 AND user_id=$2', [
      sessionId,
      progress.user_id,
    ])
  ).rows[0];
  const review = (
    await db.query(
      'SELECT * FROM public.professional_completion_reviews WHERE session_id=$1 AND learner_id=$2 ORDER BY revision DESC LIMIT 1',
      [sessionId, progress.user_id]
    )
  ).rows[0];
  if (
    !member ||
    !review ||
    review.decision !== 'approved' ||
    review.revision !== assessmentRevision ||
    review.progress_hash !== progressHash(progress) ||
    review.reviewed_by !== issuer.userId
  )
    throw new RecruitmentError(
      409,
      'A current approved assessment of this exact learner completion is required'
    );
  const authority: ProfessionalCertificateAuthority = {
    applicationId: a.application.id,
    scopeId: a.scope.id,
    scopeRevision: a.scope.revision,
    subjectId: a.subject.id,
    subjectVersion: a.subject.version,
    sessionId,
    assignmentId: a.binding.assignment_id,
    assessmentId: review.id,
    assessmentRevision: review.revision,
    trainerId: a.trainer.id,
    issuerId: issuer.userId,
    policy: 'provider-completion-v1',
  };
  return {
    authority,
    delivery: {
      subjectId: a.subject.id,
      subjectVersion: a.subject.version,
      trainerName: a.binding.snapshot.trainerName,
      providerReference: a.binding.snapshot.providerReference,
    },
  };
}
export async function verifyProfessionalAudit(db: DbExecutor, applicationId: string) {
  const head = (
    await db.query('SELECT * FROM public.professional_audit_heads WHERE application_id=$1', [
      applicationId,
    ])
  ).rows[0];
  const rows = (
    await db.query(
      'SELECT *,occurred_at::text AS occurred_at FROM public.professional_audit WHERE application_id=$1 ORDER BY seq',
      [applicationId]
    )
  ).rows;
  let previous = '0'.repeat(64);
  for (let i = 0; i < rows.length; i++) {
    const e = rows[i];
    const check = (
      await db.query(
        `SELECT ($1::jsonb->>2)::timestamptz=$4::timestamptz AND $1::jsonb=jsonb_build_array($2::text,$3::bigint,($1::jsonb->>2),$5::text,$6::text,$7::jsonb,$8::text) AS valid`,
        [
          e.canonical,
          e.application_id,
          e.seq,
          e.occurred_at,
          e.event,
          e.actor_id,
          JSON.stringify(e.details),
          e.previous_hash,
        ]
      )
    ).rows[0];
    if (
      !check?.valid ||
      Number(e.seq) !== i + 1 ||
      e.previous_hash !== previous ||
      digest(e.canonical) !== e.hash
    )
      throw new Error('Professional audit integrity failure');
    previous = e.hash;
  }
  if (head && (Number(head.seq) !== rows.length || head.hash !== previous))
    throw new Error('Professional audit head mismatch');
  return { entries: rows, head: previous };
}
