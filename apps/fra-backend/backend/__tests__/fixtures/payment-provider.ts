import type Stripe from 'stripe';
import type { Purchase } from '../../src/types';
import { totalWithVat } from '../../src/stripe';
/** Mutable provider snapshots for isolated tests. No external requests or money movement. */
export function paymentProvider(p: Purchase) {
  const id = p.paymentIntentId ?? `pi_${p.id}`;
  const state = {
    refunds: [] as Array<{
      id: string;
      payment_intent: string;
      currency: string;
      amount: number;
      status: string;
    }>,
    disputes: [] as Array<{ id: string; payment_intent: string; currency: string; status: string }>,
    pi: {
      id,
      amount: totalWithVat(p.amountCents),
      amount_received: totalWithVat(p.amountCents),
      currency: p.currency,
      status: 'succeeded',
      metadata: { purchaseId: p.id, organisationId: p.organisationId, packageId: p.packageId },
      latest_charge: {
        id: `ch_${p.id}`,
        payment_intent: id,
        paid: true,
        amount_captured: totalWithVat(p.amountCents),
        currency: p.currency,
        created: Math.floor(Date.now() / 1000),
        disputed: false,
      },
    },
    unavailable: false,
  };
  const client = {
    paymentIntents: {
      retrieve: async () => {
        if (state.unavailable) throw new Error('Fixture unavailable');
        return state.pi;
      },
    },
    refunds: { list: () => ({ autoPagingToArray: async () => state.refunds }) },
    disputes: { list: () => ({ autoPagingToArray: async () => state.disputes }) },
  } as unknown as Stripe;
  const refund = (amount: number, status = 'succeeded') =>
    state.refunds.push({
      id: `re_${state.refunds.length}`,
      payment_intent: id,
      currency: p.currency,
      amount,
      status,
    });
  const dispute = (status: string) => {
    state.pi.latest_charge.disputed = true;
    state.disputes = [{ id: 'dp_fixture', payment_intent: id, currency: p.currency, status }];
  };
  return { client, state, refund, dispute, paymentIntentId: id };
}
