import crypto from 'node:crypto';
import { beforeEach, afterEach, describe, it, expect } from '@jest/globals';
import { app } from './helpers';
import { purchasesById, auditEvents } from '../src/stores';
import { setStripeClient, totalWithVat } from '../src/stripe';
import { getActiveTier } from '../src/helpers';
import type { Purchase } from '../src/types';
import { paymentProvider } from './fixtures/payment-provider';
const secret = 'whsec_disposable_lifecycle';
function signed(id: string, type: string, object: unknown) {
  const body = JSON.stringify({ id, type, data: { object } }),
    t = Math.floor(Date.now() / 1000);
  return app.request('http://localhost/api/v1/webhooks/stripe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': `t=${t},v1=${crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`,
    },
    body,
  });
}
let purchase: Purchase, provider: ReturnType<typeof paymentProvider>;
const event = (type = 'charge.refunded', id = `evt_${crypto.randomUUID()}`) =>
  signed(id, type, { payment_intent: provider.paymentIntentId });
beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  purchase = {
    id: crypto.randomUUID(),
    organisationId: crypto.randomUUID(),
    userId: crypto.randomUUID(),
    packageId: 'pkg_training',
    status: 'succeeded',
    paymentIntentId: `pi_${crypto.randomUUID()}`,
    amountCents: 1000,
    currency: 'gbp',
    createdAt: new Date().toISOString(),
    confirmedAt: new Date().toISOString(),
  };
  purchasesById.set(purchase.id, purchase);
  provider = paymentProvider(purchase);
  setStripeClient(provider.client);
});
afterEach(() => {
  setStripeClient(undefined);
  delete process.env.STRIPE_WEBHOOK_SECRET;
});
describe('payment reversal lifecycle', () => {
  it('records a partial refund but removes access only after successful full refunds', async () => {
    provider.refund(400);
    expect((await event()).status).toBe(200);
    expect(purchase.status).toBe('succeeded');
    expect(purchase.refundedAmountCents).toBe(400);
    provider.refund(800, 'pending');
    await event('refund.updated');
    expect(purchase.status).toBe('succeeded');
    provider.state.refunds[1].status = 'succeeded';
    await event('refund.updated');
    expect(purchase.status).toBe('refunded');
    expect(getActiveTier([purchase])).toBe(0);
  });
  it('suspends active/lost disputes and restores won disputes without extending the term', async () => {
    const date = purchase.confirmedAt;
    provider.dispute('needs_response');
    await event('charge.dispute.created');
    expect(purchase.status).toBe('disputed');
    expect(getActiveTier([purchase])).toBe(0);
    provider.dispute('lost');
    await event('charge.dispute.closed');
    expect(purchase.status).toBe('disputed');
    provider.dispute('won');
    await event('charge.dispute.closed');
    expect(purchase.status).toBe('succeeded');
    expect(purchase.confirmedAt).toBe(date);
  });
  it('does not block an inquiry, or reactivate a refund after a won dispute', async () => {
    provider.dispute('warning_needs_response');
    await event('charge.dispute.created');
    expect(purchase.status).toBe('succeeded');
    provider.refund(totalWithVat(purchase.amountCents));
    await event();
    provider.dispute('won');
    await event('charge.dispute.closed');
    expect(purchase.status).toBe('refunded');
  });
  it('uses current state when a stale created event arrives after a won dispute', async () => {
    provider.dispute('won');
    await event('charge.dispute.created');
    expect(purchase.status).toBe('succeeded');
  });
  it('accepts concurrent duplicates once and audits only one transition', async () => {
    provider.refund(1200);
    const id = `evt_${crypto.randomUUID()}`;
    const responses = await Promise.all([
      event('charge.refunded', id),
      event('charge.refunded', id),
    ]);
    expect(responses.map((x) => x.status)).toEqual([200, 200]);
    expect(((await responses[1].json()) as { data: { duplicate: boolean } }).data.duplicate).toBe(
      true
    );
    expect(
      auditEvents.filter(
        (a) => a.resourceId === purchase.id && a.eventType === 'purchase.payment_reconciled'
      )
    ).toHaveLength(1);
  });
  it('retries the same event after a provider failure instead of acknowledging it early', async () => {
    const id = `evt_${crypto.randomUUID()}`;
    provider.state.unavailable = true;
    expect((await event('refund.updated', id)).status).toBe(500);
    provider.state.unavailable = false;
    provider.refund(1200);
    expect((await event('refund.updated', id)).status).toBe(200);
    expect(purchase.status).toBe('refunded');
  });
  it('handles reversal before checkout has recorded the payment identifier', async () => {
    delete purchase.paymentIntentId;
    purchase.status = 'requires_confirmation';
    provider.refund(1200);
    expect((await event()).status).toBe(200);
    expect(purchase.status).toBe('refunded');
    expect(purchase.paymentIntentId).toBe(provider.paymentIntentId);
  });
  it('refuses mismatched or incomplete provider data without changing access', async () => {
    provider.state.pi.metadata.organisationId = crypto.randomUUID();
    expect((await event()).status).toBe(500);
    expect(purchase.status).toBe('succeeded');
    provider.state.pi.metadata.organisationId = purchase.organisationId;
    provider.state.pi.amount = 1;
    expect((await event()).status).toBe(500);
    expect(purchase.status).toBe('succeeded');
    provider.state.pi.amount = 1200;
    provider.refund(0, 'pending');
    provider.state.refunds = Array.from({ length: 10000 }, (_, i) => ({
      ...provider.state.refunds[0],
      id: `re_${i}`,
    }));
    expect((await event()).status).toBe(500);
    provider.state.refunds = [];
    provider.dispute('won');
    provider.state.disputes = Array.from({ length: 10000 }, (_, i) => ({
      ...provider.state.disputes[0],
      id: `dp_${i}`,
    }));
    expect((await event('charge.dispute.closed')).status).toBe(500);
    expect(purchase.status).toBe('succeeded');
  });
  it('does not remove another valid purchase', async () => {
    const other = { ...purchase, id: crypto.randomUUID() };
    provider.refund(1200);
    await event();
    expect(getActiveTier([purchase, other])).toBe(2);
  });
  it('does not reactivate a refund when a late paid checkout event arrives', async () => {
    purchase.checkoutSessionId = 'cs_fixture';
    provider.refund(1200);
    await event();
    const session = {
      id: 'cs_fixture',
      status: 'complete',
      payment_status: 'paid',
      metadata: { purchaseId: purchase.id },
      amount_total: 1200,
      currency: 'gbp',
      payment_intent: provider.paymentIntentId,
    };
    expect(
      (await signed(`evt_${crypto.randomUUID()}`, 'checkout.session.completed', session)).status
    ).toBe(200);
    expect(purchase.status).toBe('refunded');
  });
  it('recovers a paid purchase after an earlier expired event without trusting event ordering', async () => {
    purchase.status = 'failed';
    delete purchase.confirmedAt;
    purchase.checkoutSessionId = 'cs_fixture';
    const session = {
      id: 'cs_fixture',
      status: 'complete',
      payment_status: 'paid',
      metadata: { purchaseId: purchase.id },
      amount_total: 1200,
      currency: 'gbp',
      payment_intent: provider.paymentIntentId,
    };
    expect(
      (await signed(`evt_${crypto.randomUUID()}`, 'checkout.session.completed', session)).status
    ).toBe(200);
    expect(purchase.status).toBe('succeeded');
  });
  it('rejects unsigned reversal payloads', async () => {
    provider.refund(1200);
    const res = await app.request('http://localhost/api/v1/webhooks/stripe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'evt_unsigned',
        type: 'charge.refunded',
        data: { object: { payment_intent: provider.paymentIntentId } },
      }),
    });
    expect(res.status).toBe(400);
    expect(purchase.status).toBe('succeeded');
  });
});
