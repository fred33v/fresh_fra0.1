import { randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { DbExecutor } from './db/transaction.js';
import type { AuthContext } from './helpers.js';

export class RecruitmentError extends Error {
  constructor(public status: 400 | 403 | 404 | 409, message: string) { super(message); }
}

/** Re-read and lock current authority in the same transaction as every decision. */
export async function recruitmentIdentity(db: PoolClient, auth: AuthContext, reviewer = false) {
  const { rows: [user] } = await db.query(
    `SELECT id, email, role FROM public.users WHERE id=$1 AND organisation_id=$2
     AND email_verified_at IS NOT NULL FOR SHARE`, [auth.userId, auth.organisationId]);
  if (!user || (reviewer && (user.role !== 'admin' ||
      auth.organisationId !== process.env.PROVIDER_REVIEW_ORGANISATION_ID))) {
    throw new RecruitmentError(403, reviewer ? 'Recruitment reviewer authority required' : 'A verified current account is required');
  }
  return user;
}

export async function recruitmentAudit(db: DbExecutor, id: string, actor: string, event: string, details: unknown) {
  await db.query(`INSERT INTO public.provider_recruitment_audit(application_id,actor_id,event,details)
    VALUES($1,$2,$3,$4::jsonb)`, [id, actor, event, JSON.stringify(details)]);
}

export type ReviewDecision = {
  revision: number; status: 'approved' | 'declined' | 'suspended'; reason: string;
  qualificationEvidence?: string; agreementDocumentId?: string;
};

export async function reviewProvider(db: PoolClient, auth: AuthContext, id: string, decision: ReviewDecision) {
  await recruitmentIdentity(db, auth, true);
  const { rows: [application] } = await db.query('SELECT * FROM public.provider_applications WHERE id=$1 FOR UPDATE', [id]);
  if (!application) throw new RecruitmentError(404, 'Application not found');
  if (application.applicant_id === auth.userId) throw new RecruitmentError(403, 'You cannot review your own application');
  if (application.revision !== decision.revision) throw new RecruitmentError(409, 'Application changed; reload before reviewing');
  if (decision.status === 'suspended' && application.status !== 'approved')
    throw new RecruitmentError(409, 'Only approved providers can be suspended');
  if (decision.status === 'declined' && application.status !== 'submitted')
    throw new RecruitmentError(409, 'Only submitted applications can be declined');
  if (decision.status === 'approved' && !['submitted', 'suspended'].includes(application.status))
    throw new RecruitmentError(409, 'This application cannot be approved');
  if (decision.status === 'approved') {
    if (application.service_interest !== 'sales' && !decision.qualificationEvidence)
      throw new RecruitmentError(400, 'Record qualification and training demonstration checks');
    // The agreement is retained by our operator organisation and signed by this applicant.
    // Match the current account as well as the submitted snapshot: changed email needs a new agreement.
    const { rows: [agreement] } = await db.query(`SELECT d.id FROM public.esign_documents d
      JOIN public.esign_signers s ON s.document_id=d.id
      JOIN public.users u ON u.id=$4 AND u.organisation_id=$5
      JOIN public.esign_artifacts a ON a.document_id=d.id
      WHERE d.id=$1 AND d.organisation_id=$2 AND d.status='completed'
      AND s.status='signed' AND lower(s.email)=lower($3) AND lower(s.email)=lower(u.email)
      AND u.email_verified_at IS NOT NULL`,
    [decision.agreementDocumentId ?? null, auth.organisationId, application.applicant_email,
      application.applicant_id, application.organisation_id]);
    if (!agreement) throw new RecruitmentError(400, 'A completed retained agreement signed by the applicant is required');
  }
  const { rows: [saved] } = await db.query(`UPDATE public.provider_applications SET status=$2,
    revision=revision+1,review_reason=$3,qualification_evidence=COALESCE($4,qualification_evidence),
    agreement_document_id=COALESCE($5,agreement_document_id),
    provider_code=CASE WHEN $2='approved' THEN COALESCE(provider_code,$6) ELSE provider_code END,
    reviewed_by=$7,reviewed_at=now() WHERE id=$1 RETURNING *`,
  [id, decision.status, decision.reason, decision.qualificationEvidence ?? null,
    decision.status === 'approved' ? decision.agreementDocumentId : null,
    `PRV-${randomBytes(16).toString('hex')}`, auth.userId]);
  if (decision.status === 'suspended') {
    await db.query(`UPDATE public.provider_assignments SET status='cancelled',decided_at=now()
      WHERE application_id=$1 AND status IN ('offered','accepted')`, [id]);
  }
  await recruitmentAudit(db, id, auth.userId, `application.${decision.status}`, {
    revision: saved.revision, reason: decision.reason, agreementDocumentId: saved.agreement_document_id,
    qualificationEvidence: decision.qualificationEvidence ?? null,
  });
  return saved;
}
