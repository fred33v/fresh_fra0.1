import type { DbExecutor } from '../db/transaction.js';
import { programmeReviewer } from './access.js';
/** Extra restrictions apply only to retained provider agreements. Never grants e-sign tenant access. */
export async function providerAgreementCanProceed(
  db: DbExecutor,
  documentId: string,
  userId?: string
): Promise<boolean> {
  const linked = (
    await db.query(
      `SELECT g.*,a.status,a.version,a.user_id,a.organisation_id AS candidate_org,
    a.contact_email,u.email,u.email_verified_at,u.organisation_id AS current_org,
    d.organisation_id AS document_org,
    (SELECT max(sequence) FROM public.provider_agreements WHERE application_id=g.application_id) AS latest
    FROM public.provider_agreements g JOIN public.provider_applications a ON a.id=g.application_id
    JOIN public.esign_documents d ON d.id=g.document_id
    LEFT JOIN public.users u ON u.id=a.user_id WHERE g.document_id=$1`,
      [documentId]
    )
  ).rows[0];
  if (!linked) return true;
  if (
    process.env.PROVIDERS_ENABLED !== 'true' ||
    linked.status !== 'approved' ||
    linked.version !== linked.application_version ||
    String(linked.sequence) !== String(linked.latest) ||
    !linked.email_verified_at ||
    linked.email?.toLowerCase() !== linked.contact_email.toLowerCase() ||
    linked.candidate_org !== linked.current_org
  )
    return false;
  if (!userId) return true;
  const user = (
    await db.query(
      'SELECT id,email,role,organisation_id,email_verified_at FROM public.users WHERE id=$1',
      [userId]
    )
  ).rows[0];
  return (
    !!user &&
    !!user.email_verified_at &&
    user.id !== linked.user_id &&
    user.organisation_id === linked.document_org &&
    programmeReviewer(user)
  );
}
