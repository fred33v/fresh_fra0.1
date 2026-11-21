import type { PoolClient } from 'pg';
import type { AuthContext } from './helpers.js';
import { recruitmentIdentity, RecruitmentError } from './provider-recruitment.js';
export async function financeReviewer(db: PoolClient, auth: AuthContext) {
  await recruitmentIdentity(db, auth, true);
  if (
    !(process.env.FINANCE_AUTHORISED_USER_IDS ?? '')
      .split(',')
      .map((v) => v.trim())
      .includes(auth.userId)
  )
    throw new RecruitmentError(403, 'Explicit finance access is required');
}
export async function financeIdentity(
  db: PoolClient,
  id: string,
  update = false,
  allowInactive = false
) {
  const link = (
    await db.query('SELECT application_id FROM public.relationship_identifiers WHERE id=$1', [id])
  ).rows[0];
  if (link?.application_id)
    await db.query('SELECT id FROM public.provider_applications WHERE id=$1 FOR SHARE', [
      link.application_id,
    ]);
  const i = (
    await db.query(
      `SELECT * FROM public.relationship_identifiers WHERE id=$1 FOR ${update ? 'UPDATE' : 'SHARE'}`,
      [id]
    )
  ).rows[0];
  if (!i || !['supplier', 'employee'].includes(i.kind) || (!allowInactive && i.status !== 'active'))
    throw new RecruitmentError(409, 'An active supplier or employee identifier is required');
  if (allowInactive) return i;
  const u = (
    await db.query(
      'SELECT id,email,organisation_id FROM public.users WHERE id=$1 AND organisation_id=$2 AND email_verified_at IS NOT NULL FOR SHARE',
      [i.user_id, i.organisation_id]
    )
  ).rows[0];
  if (!u) throw new RecruitmentError(409, 'Current verified beneficiary identity is required');
  if (i.kind === 'supplier') {
    const a = (
      await db.query('SELECT * FROM public.provider_applications WHERE id=$1 FOR SHARE', [
        i.application_id,
      ])
    ).rows[0];
    if (
      !a ||
      a.status !== 'approved' ||
      a.applicant_id !== u.id ||
      a.organisation_id !== u.organisation_id ||
      a.applicant_email.toLowerCase() !== u.email.toLowerCase()
    )
      throw new RecruitmentError(409, 'Current approved supplier relationship is required');
  }
  return i;
}
export async function currentPaymentProfile(db: PoolClient, id: string) {
  const link = (
    await db.query('SELECT identifier_id FROM public.finance_payment_profiles WHERE id=$1', [id])
  ).rows[0];
  if (!link) throw new RecruitmentError(404, 'Payment profile not found');
  const i = await financeIdentity(db, link.identifier_id);
  const p = (
    await db.query('SELECT * FROM public.finance_payment_profiles WHERE id=$1 FOR SHARE', [id])
  ).rows[0];
  const latest = (
    await db.query(
      'SELECT id FROM public.finance_payment_profiles WHERE identifier_id=$1 ORDER BY version DESC LIMIT 1',
      [i.id]
    )
  ).rows[0];
  if (
    latest.id !== p.id ||
    p.status !== 'approved' ||
    p.kind !== (i.kind === 'employee' ? 'payroll' : 'supplier')
  )
    throw new RecruitmentError(
      409,
      'The current approved payment profile is required; changed bank details need fresh review'
    );
  return { profile: p, identifier: i };
}
export async function eligibleFee(db: PoolClient, feeId: string) {
  const fee = (
    await db.query('SELECT * FROM public.finance_fee_agreements WHERE id=$1 FOR SHARE', [feeId])
  ).rows[0];
  if (!fee) throw new RecruitmentError(404, 'Fee agreement not found');
  const latest = (
    await db.query(
      'SELECT id FROM public.finance_fee_agreements WHERE delivery_id=$1 ORDER BY version DESC LIMIT 1',
      [fee.delivery_id]
    )
  ).rows[0];
  const d = (
    await db.query('SELECT * FROM public.service_deliveries WHERE id=$1 FOR SHARE', [
      fee.delivery_id,
    ])
  ).rows[0];
  if (latest.id !== fee.id || fee.status !== 'accepted' || d.status !== 'accepted')
    throw new RecruitmentError(
      409,
      'The latest supplier-accepted fee and customer-accepted delivery are required'
    );
  const p = (
    await db.query('SELECT * FROM public.purchases WHERE id=$1 FOR SHARE', [fee.purchase_id])
  ).rows[0];
  if (
    !p ||
    p.organisation_id !== d.customer_organisation_id ||
    p.currency !== 'gbp' ||
    p.status !== 'succeeded' ||
    !p.payment_reconciled_at ||
    p.refunded_amount_cents !== 0
  )
    throw new RecruitmentError(
      409,
      'Verified, undisputed, unrefunded customer payment is required'
    );
  return { fee, delivery: d, purchase: p };
}
export async function refreshFeePayment(auth: AuthContext, feeId: string) {
  const { getDbPool } = await import('./db.js');
  const row = (
    await getDbPool().query('SELECT purchase_id FROM public.finance_fee_agreements WHERE id=$1', [
      feeId,
    ])
  ).rows[0];
  if (!row) throw new RecruitmentError(404, 'Fee agreement not found');
  const { dbGetPurchaseById } = await import('./db/purchases.js');
  const { reconcilePaidPurchase } = await import('./payment-lifecycle.js');
  const purchase = await dbGetPurchaseById(row.purchase_id);
  if (!purchase?.paymentIntentId)
    throw new RecruitmentError(409, 'Trusted payment verification is unavailable');
  try {
    await reconcilePaidPurchase(purchase, purchase.paymentIntentId, 'supplier_fee_review', auth);
  } catch {
    throw new RecruitmentError(
      409,
      'Customer payment could not be independently reverified; no instruction was approved'
    );
  }
}

/** Match the existing payment lifecycle lock order before taking supplier/profile locks. */
export async function lockFeeIncome(db: PoolClient, feeId: string) {
  const row = (
    await db.query(
      'SELECT p.organisation_id FROM public.finance_fee_agreements f JOIN public.purchases p ON p.id=f.purchase_id WHERE f.id=$1',
      [feeId]
    )
  ).rows[0];
  if (!row) throw new RecruitmentError(404, 'Fee payment reference not found');
  await db.query('SELECT pg_advisory_xact_lock(193478,hashtext($1))', [row.organisation_id]);
}
/** Preserve the explicit old out-of-app bank workflow only until a supplier submits vault details. */
export async function commissionPaymentProfile(
  db: PoolClient,
  applicationId: string,
  expectedId?: string | null
) {
  const p = (
    await db.query(
      "SELECT p.id FROM public.finance_payment_profiles p JOIN public.relationship_identifiers i ON i.id=p.identifier_id WHERE i.application_id=$1 AND i.kind='supplier' ORDER BY p.version DESC LIMIT 1",
      [applicationId]
    )
  ).rows[0];
  if (!p) {
    if (expectedId) throw new RecruitmentError(409, 'Payout beneficiary no longer matches');
    return null;
  }
  await currentPaymentProfile(db, p.id);
  if (expectedId !== undefined && expectedId !== p.id)
    throw new RecruitmentError(
      409,
      'Beneficiary details changed; cancel and prepare a newly bound payout'
    );
  return p.id as string;
}
