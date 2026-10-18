// ============================================================
// Assessment sign-off and feedback (brought over from the mobile app,
// which kept them on the phone only).
// ============================================================

import { getDbPool } from './db.js';
import { hasDatabase } from './helpers.js';

/** What the person signing confirms. Stored with each sign-off so the record shows exactly what was agreed. */
export const SIGN_OFF_STATEMENT =
  'I confirm that I have received and reviewed this fraud risk assessment, and I authorise it on behalf of the organisation.';

export type AssessmentSignOff = {
  assessmentId: string;
  organisationId: string;
  signedByUserId: string;
  signerName: string;
  signerRole: string | null;
  statement: string;
  signedAt: string;
};

export type AssessmentFeedback = {
  assessmentId: string;
  userId: string;
  organisationId: string;
  rating: number;
  comments: string | null;
  createdAt: string;
};

// In-memory stores for running without a database (development and tests)
const signOffs = new Map<string, AssessmentSignOff>();
const feedback = new Map<string, AssessmentFeedback>();

type SignOffRow = {
  assessment_id: string; organisation_id: string; signed_by_user_id: string; signer_name: string;
  signer_role: string | null; statement: string; signed_at: string | Date;
};

const fromRow = (r: SignOffRow): AssessmentSignOff => ({
  assessmentId: r.assessment_id,
  organisationId: r.organisation_id,
  signedByUserId: r.signed_by_user_id,
  signerName: r.signer_name,
  signerRole: r.signer_role,
  statement: r.statement,
  signedAt: new Date(r.signed_at).toISOString(),
});

export async function getSignOff(assessmentId: string): Promise<AssessmentSignOff | null> {
  if (!hasDatabase()) return signOffs.get(assessmentId) ?? null;
  const res = await getDbPool().query<SignOffRow>('SELECT * FROM public.assessment_sign_offs WHERE assessment_id = $1', [assessmentId]);
  return res.rows[0] ? fromRow(res.rows[0]) : null;
}

/** Records the sign-off; returns null when the assessment was already signed off (it can only be signed once). */
export async function createSignOff(s: Omit<AssessmentSignOff, 'signedAt' | 'statement'>): Promise<AssessmentSignOff | null> {
  if (!hasDatabase()) {
    if (signOffs.has(s.assessmentId)) return null;
    const record = { ...s, statement: SIGN_OFF_STATEMENT, signedAt: new Date().toISOString() };
    signOffs.set(s.assessmentId, record);
    return record;
  }
  const res = await getDbPool().query<SignOffRow>(
    `INSERT INTO public.assessment_sign_offs (assessment_id, organisation_id, signed_by_user_id, signer_name, signer_role, statement)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (assessment_id) DO NOTHING
     RETURNING *`,
    [s.assessmentId, s.organisationId, s.signedByUserId, s.signerName, s.signerRole, SIGN_OFF_STATEMENT]
  );
  return res.rows[0] ? fromRow(res.rows[0]) : null;
}

export async function saveFeedback(f: Omit<AssessmentFeedback, 'createdAt'>): Promise<AssessmentFeedback> {
  const record = { ...f, createdAt: new Date().toISOString() };
  if (!hasDatabase()) {
    feedback.set(`${f.assessmentId}:${f.userId}`, record);
    return record;
  }
  await getDbPool().query(
    `INSERT INTO public.assessment_feedback (assessment_id, user_id, organisation_id, rating, comments)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (assessment_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, comments = EXCLUDED.comments, created_at = now()`,
    [f.assessmentId, f.userId, f.organisationId, f.rating, f.comments]
  );
  return record;
}
