import { totalWithVat } from './stripe.js';
import type { DbExecutor } from './db/transaction.js';
import type { AuthContext } from './helpers.js';
import { RecruitmentError, recruitmentAudit } from './provider-recruitment.js';

/** Prices are VAT-exclusive; refunds supplied by reconciliation include VAT. Round once, half up. */
export function commissionTarget(net: number, gross: number, refunded: number, succeeded: boolean): number {
  if (![net,gross,refunded].every(Number.isSafeInteger) || net < 0 || gross <= 0 || refunded < 0 || refunded > gross)
    throw new Error('Invalid commission amounts');
  if (!succeeded) return 0;
  const numerator = BigInt(net) * 1700n * BigInt(gross-refunded);
  const denominator = 10000n * BigInt(gross);
  return Number((2n*numerator+denominator)/(2n*denominator));
}

/** Called in the purchase-creation transaction, before Checkout can receive payment. */
export async function attributeProviderSale(db: DbExecutor, auth: AuthContext, purchaseId: string, packageId: string, code: string) {
  const { rows: [provider] } = await db.query(`SELECT a.* FROM public.provider_applications a
    JOIN public.users u ON u.id=a.applicant_id AND u.organisation_id=a.organisation_id AND u.email_verified_at IS NOT NULL
    WHERE a.provider_code=$1 FOR UPDATE OF a`,[code]);
  if (!provider || provider.status !== 'approved' || provider.service_interest === 'training')
    throw new RecruitmentError(400,'Provider reference is unavailable for sales');
  if (provider.applicant_id === auth.userId || provider.organisation_id === auth.organisationId)
    throw new RecruitmentError(400,'Self-referrals are not eligible for commission');
  const { rows: [buyer] } = await db.query(`SELECT id FROM public.users WHERE id=$1 AND organisation_id=$2
    AND email_verified_at IS NOT NULL FOR SHARE`,[auth.userId,auth.organisationId]);
  if (!buyer) throw new RecruitmentError(403,'A verified current buyer account is required');
  const { rows: [assignment] } = await db.query(`SELECT id FROM public.provider_assignments
    WHERE application_id=$1 AND package_id=$2 AND service='sales' AND status IN ('accepted','completed')
    ORDER BY created_at,id LIMIT 1`,[provider.id,packageId]);
  if (!assignment) throw new RecruitmentError(400,'Provider has no accepted sales assignment for this package');
  await db.query(`INSERT INTO public.provider_sale_attributions(purchase_id,application_id,assignment_id)
    VALUES($1,$2,$3)`,[purchaseId,provider.id,assignment.id]);
  await recruitmentAudit(db,provider.id,auth.userId,'sale.attributed',{purchaseId,assignmentId:assignment.id,rateBps:1700});
}

/** Caller holds the purchase row lock. The accounting delta is committed with payment reconciliation. */
export async function reconcileProviderCommission(db: DbExecutor, purchaseId: string) {
  const { rows: [sale] } = await db.query(`SELECT a.application_id,p.amount_cents,p.currency,p.status,
    p.refunded_amount_cents,p.payment_reconciled_at FROM public.provider_sale_attributions a
    JOIN public.purchases p ON p.id=a.purchase_id WHERE p.id=$1`,[purchaseId]);
  if (!sale || !sale.payment_reconciled_at) return; // Simulated/unverified payments never earn commission.
  await db.query('SELECT id FROM public.provider_applications WHERE id=$1 FOR UPDATE',[sale.application_id]);
  const target = commissionTarget(sale.amount_cents,totalWithVat(sale.amount_cents),sale.refunded_amount_cents,sale.status==='succeeded');
  const { rows: [previous] } = await db.query(`SELECT COALESCE(sum(delta_cents),0)::integer AS amount
    FROM public.provider_commission_entries WHERE purchase_id=$1`,[purchaseId]);
  const delta = target-previous.amount;
  if (delta) await db.query(`INSERT INTO public.provider_commission_entries
    (purchase_id,application_id,currency,delta_cents,target_cents,reason) VALUES($1,$2,$3,$4,$5,$6)`,
  [purchaseId,sale.application_id,sale.currency,delta,target,`${sale.status}; refunded=${sale.refunded_amount_cents}`]);
}

/** Lock the provider row before reading this balance when reserving/settling a payout. */
export async function providerBalance(db: DbExecutor, id: string, currency: string) {
  const { rows: [row] } = await db.query(`SELECT
    (SELECT COALESCE(sum(delta_cents),0)::integer FROM public.provider_commission_entries WHERE application_id=$1 AND currency=$2) AS earned,
    (SELECT COALESCE(sum(amount_cents),0)::integer FROM public.provider_payouts WHERE application_id=$1 AND currency=$2 AND status='recorded') AS recorded,
    (SELECT COALESCE(sum(amount_cents),0)::integer FROM public.provider_payouts WHERE application_id=$1 AND currency=$2 AND status IN ('prepared','approved')) AS reserved`,[id,currency]);
  return { ...row, available: row.earned-row.recorded-row.reserved } as {earned:number;recorded:number;reserved:number;available:number};
}

/** Refresh trusted payment state before staff authorise settlement; no money is moved here. */
export async function refreshProviderPayments(auth: AuthContext, id: string) {
  const { withTransaction } = await import('./db/transaction.js');
  const { recruitmentIdentity } = await import('./provider-recruitment.js');
  const ids = await withTransaction(async db => {
    await recruitmentIdentity(db,auth,true);
    const {rows:[a]}=await db.query('SELECT applicant_id FROM public.provider_applications WHERE id=$1',[id]);
    if(!a)throw new RecruitmentError(404,'Application not found');
    if(a.applicant_id===auth.userId)throw new RecruitmentError(403,'You cannot authorise your own payout');
    return (await db.query(`SELECT p.id FROM public.purchases p JOIN public.provider_sale_attributions a ON a.purchase_id=p.id
      WHERE a.application_id=$1 AND p.payment_intent_id IS NOT NULL AND p.status<>'refunded' ORDER BY p.id LIMIT 2001`,[id])).rows;
  });
  if(ids.length>2000)throw new RecruitmentError(409,'Payment reconciliation limit reached; finance review required');
  const { getStripe } = await import('./stripe.js');
  if(!getStripe())throw new RecruitmentError(409,'Verified payment reconciliation is unavailable');
  const { dbGetPurchaseById }=await import('./db/purchases.js');
  const { reconcilePaidPurchase }=await import('./payment-lifecycle.js');
  try {
    for(const {id:purchaseId} of ids){
      const p=await dbGetPurchaseById(purchaseId);
      if(p && p.paymentIntentId) await reconcilePaidPurchase(p,p.paymentIntentId,'provider_payout_review',auth);
    }
  }catch{
    throw new RecruitmentError(409,'Payment state could not be verified; no payout was authorised');
  }
}
