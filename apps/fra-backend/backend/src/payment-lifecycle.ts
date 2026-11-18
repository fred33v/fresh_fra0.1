import { hasDatabase } from './helpers.js';
import { withKeypassLock } from './keypass-lock.js';
import { withTransaction, type DbExecutor } from './db/transaction.js';
import { dbGetPurchaseById, auditLog } from './db/index.js';
import { purchasesById } from './stores.js';
import { getStripe, totalWithVat } from './stripe.js';
import type { Purchase, PurchaseStatus } from './types.js';

const receipts = new Map<string, string>();
let queue: Promise<unknown> = Promise.resolve();
/** A receipt is committed only with all local effects. Stripe retries failures/disconnects. */
export async function processPaymentEvent(
  id: string,
  type: string,
  work: (db?: DbExecutor) => Promise<void>
): Promise<boolean> {
  const run = async (db?: DbExecutor) => {
    if (db) await db.query('SELECT pg_advisory_xact_lock(193480,hashtext($1))', [id]);
    const previous = db
      ? (
          await db.query<{ event_type: string }>(
            'SELECT event_type FROM public.payment_events WHERE event_id=$1',
            [id]
          )
        ).rows[0]?.event_type
      : receipts.get(id);
    if (previous) {
      if (previous !== type) throw new Error('Payment event identity conflict');
      return false;
    }
    await work(db);
    if (db)
      await db.query('INSERT INTO public.payment_events(event_id,event_type) VALUES($1,$2)', [
        id,
        type,
      ]);
    else receipts.set(id, type);
    return true;
  };
  if (hasDatabase()) return withTransaction(run);
  const result = queue.then(() => run());
  queue = result.catch(() => undefined);
  return result;
}
const objectId = (value: string | { id: string } | null | undefined): string | null =>
  typeof value === 'string' ? value : (value?.id ?? null);
const requestOptions = { timeout: 10_000, maxNetworkRetries: 1 };

/** Read current provider state, not event order. No refund, dispute or charge is created here. */
async function currentState(purchase: Purchase, paymentIntentId: string) {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe reconciliation unavailable');
  const pi = await stripe.paymentIntents.retrieve(
    paymentIntentId,
    { expand: ['latest_charge'] },
    requestOptions
  );
  const expected = totalWithVat(purchase.amountCents);
  const linked = purchase.paymentIntentId === pi.id;
  if (
    pi.id !== paymentIntentId ||
    (purchase.paymentIntentId && !linked) ||
    (!linked &&
      (pi.metadata.purchaseId !== purchase.id ||
        pi.metadata.organisationId !== purchase.organisationId ||
        pi.metadata.packageId !== purchase.packageId)) ||
    (pi.metadata.purchaseId && pi.metadata.purchaseId !== purchase.id) ||
    (pi.metadata.organisationId && pi.metadata.organisationId !== purchase.organisationId) ||
    (pi.metadata.packageId && pi.metadata.packageId !== purchase.packageId) ||
    pi.amount !== expected ||
    pi.currency !== purchase.currency ||
    pi.amount_received !== expected ||
    pi.status !== 'succeeded'
  ) {
    throw new Error('Payment does not match purchase');
  }
  const charge = pi.latest_charge;
  if (
    !charge ||
    typeof charge === 'string' ||
    objectId(charge.payment_intent) !== pi.id ||
    !charge.paid ||
    charge.amount_captured !== expected ||
    charge.currency !== purchase.currency ||
    !Number.isFinite(charge.created) ||
    charge.created <= 0
  ) {
    throw new Error('Payment charge cannot be verified');
  }
  const refunds = await stripe.refunds
    .list({ payment_intent: pi.id, limit: 100 }, requestOptions)
    .autoPagingToArray({ limit: 10000 });
  if (refunds.length >= 10000) throw new Error('Refund reconciliation limit reached');
  let refunded = 0;
  for (const refund of refunds) {
    if (
      objectId(refund.payment_intent) !== pi.id ||
      refund.currency !== purchase.currency ||
      !Number.isSafeInteger(refund.amount) ||
      refund.amount < 0
    )
      throw new Error('Refund does not match payment');
    if (refund.status === 'succeeded') refunded += refund.amount;
  }
  if (refunded > expected) throw new Error('Refund exceeds payment');
  const disputes = await stripe.disputes
    .list({ payment_intent: pi.id, limit: 100 }, requestOptions)
    .autoPagingToArray({ limit: 10000 });
  if (disputes.length >= 10000) throw new Error('Dispute reconciliation limit reached');
  if (
    disputes.some((d) => objectId(d.payment_intent) !== pi.id || d.currency !== purchase.currency)
  )
    throw new Error('Dispute does not match payment');
  const statuses = [...new Set(disputes.map((d) => d.status))].sort();
  if (charge.disputed && !statuses.length) statuses.push('unknown');
  const nonBlocking = new Set([
    'won',
    'prevented',
    'warning_closed',
    'warning_needs_response',
    'warning_under_review',
  ]);
  const held = statuses.some((status) => !nonBlocking.has(status));
  const status: PurchaseStatus =
    refunded === expected ? 'refunded' : held ? 'disputed' : 'succeeded';
  return {
    status,
    refunded,
    disputes: statuses.join(',') || null,
    paidAt: new Date(charge.created * 1000).toISOString(),
  };
}

export type PaymentActor = { userId: string; email: string; ip?: string; userAgent?: string };
export async function reconcilePaidPurchase(
  purchase: Purchase,
  paymentIntentId: string | null,
  source: string,
  actor?: PaymentActor,
  db?: DbExecutor
): Promise<boolean> {
  if (!paymentIntentId) throw new Error('Payment identifier missing');
  const work = async (client?: DbExecutor) => {
    if (client) {
      // Share the membership/quota lock so reversal cannot race a key-pass join.
      await client.query('SELECT pg_advisory_xact_lock(193478,hashtext($1))', [
        purchase.organisationId,
      ]);
      await client.query('SELECT id FROM public.purchases WHERE id=$1 FOR UPDATE', [purchase.id]);
    }
    const current = client
      ? await dbGetPurchaseById(purchase.id, client)
      : purchasesById.get(purchase.id);
    if (!current) throw new Error('Purchase no longer exists');
    const state = await currentState(current, paymentIntentId);
    // A completed full refund is terminal, including across stale provider reads.
    if (current.status === 'refunded' && state.status !== 'refunded')
      throw new Error('Refunded purchase cannot be reactivated');
    const changed =
      current.status !== state.status ||
      (current.refundedAmountCents ?? 0) !== state.refunded ||
      (current.disputeStatus ?? null) !== state.disputes;
    const confirmedAt = current.confirmedAt ?? state.paidAt;
    if (changed)
      await auditLog(
        {
          eventType:
            current.status === 'requires_confirmation' && state.status === 'succeeded'
              ? 'purchase.confirmed'
              : 'purchase.payment_reconciled',
          actorId: actor?.userId,
          actorEmail: actor?.email,
          organisationId: current.organisationId,
          resourceType: 'purchase',
          resourceId: current.id,
          details: {
            source,
            paymentIntentId,
            amountCents: totalWithVat(current.amountCents),
            packageId: current.packageId,
            previousStatus: current.status,
            status: state.status,
            refundedAmountCents: state.refunded,
            disputeStatus: state.disputes,
          },
          ipAddress: actor?.ip,
          userAgent: actor?.userAgent,
        },
        client
      );
    if (client)
      await client.query(
        `UPDATE public.purchases SET status=$2,payment_intent_id=$3,confirmed_at=$4,
      refunded_amount_cents=$5,dispute_status=$6,payment_reconciled_at=now() WHERE id=$1`,
        [current.id, state.status, paymentIntentId, confirmedAt, state.refunded, state.disputes]
      );
    else
      Object.assign(current, {
        status: state.status,
        paymentIntentId,
        confirmedAt,
        refundedAmountCents: state.refunded,
        disputeStatus: state.disputes ?? undefined,
        paymentReconciledAt: new Date().toISOString(),
      });
    return changed;
  };
  return db ? work(db) : withKeypassLock(purchase.organisationId, (client) => work(client));
}

/** Resolve only a provider-linked purchase, including reversal-before-checkout delivery. */
export async function purchaseForReversal(
  object: { payment_intent?: string | { id: string } | null },
  db?: DbExecutor
): Promise<{ purchase: Purchase; paymentIntentId: string } | null> {
  const paymentIntentId = objectId(object.payment_intent);
  if (!paymentIntentId) return null;
  const found = db
    ? (
        await db.query<{ id: string }>(
          'SELECT id FROM public.purchases WHERE payment_intent_id=$1',
          [paymentIntentId]
        )
      ).rows
    : [...purchasesById.values()]
        .filter((p) => p.paymentIntentId === paymentIntentId)
        .map((p) => ({ id: p.id }));
  if (found.length > 1) throw new Error('Ambiguous payment linkage');
  let id = found[0]?.id;
  if (!id) {
    const stripe = getStripe();
    if (!stripe) throw new Error('Stripe reconciliation unavailable');
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {}, requestOptions);
    id = pi.metadata.purchaseId;
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
      return null;
  }
  const purchase = db ? await dbGetPurchaseById(id, db) : purchasesById.get(id);
  if (!purchase) throw new Error('Linked purchase not available yet');
  return { purchase, paymentIntentId };
}
