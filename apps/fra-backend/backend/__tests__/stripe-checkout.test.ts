/// <reference types="jest" />

import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import type Stripe from 'stripe';
import { app, authHeaders, createAuthenticatedUser } from './helpers';
import { auditEvents, purchasesById } from '../src/stores';
import { setStripeClient, totalWithVat } from '../src/stripe';

const API = 'http://localhost/api/v1';
const send = (method: string, path: string, token: string, body: unknown = {}) =>
  app.request(`${API}${path}`, { method, headers: authHeaders(token), body: JSON.stringify(body) });
const get = (path: string, token: string) => app.request(`${API}${path}`, { headers: authHeaders(token) });

type Session = Partial<Stripe.Checkout.Session> & { id: string };

/** A stand-in for the Stripe client: sessions live in a map the test can change, like a buyer paying. */
function fakeStripe() {
  const sessions = new Map<string, Session>();
  const create = jest.fn(async (params: Stripe.Checkout.SessionCreateParams, _opts?: unknown) => {
    const id = `cs_test_${crypto.randomUUID().replace(/-/g, '')}`;
    const amount = params.line_items!.reduce((n, li) => n + (li.price_data!.unit_amount ?? 0) * (li.quantity ?? 1), 0);
    const session: Session = {
      id, url: `https://checkout.stripe.com/c/pay/${id}`, status: 'open', payment_status: 'unpaid',
      amount_total: amount, currency: params.line_items![0].price_data!.currency,
      metadata: params.metadata as Record<string, string>, client_reference_id: params.client_reference_id ?? null, payment_intent: null,
    };
    sessions.set(id, session);
    return session;
  });
  const retrieve = jest.fn(async (id: string) => sessions.get(id)!);
  const client = { checkout: { sessions: { create, retrieve } } } as unknown as Stripe;
  const pay = (id: string) => Object.assign(sessions.get(id)!, { status: 'complete', payment_status: 'paid', payment_intent: 'pi_test_paid' });
  return { client, sessions, create, retrieve, pay };
}

const sessionIdOf = (purchaseId: string) => purchasesById.get(purchaseId)!.checkoutSessionId!;

let stripe: ReturnType<typeof fakeStripe>;
beforeEach(() => { stripe = fakeStripe(); setStripeClient(stripe.client); });
afterEach(() => { setStripeClient(undefined); delete process.env.STRIPE_WEBHOOK_SECRET; });

async function startCheckout(packageId = 'pkg_training', body: Record<string, unknown> = {}) {
  const user = await createAuthenticatedUser();
  const res = await send('POST', '/purchases', user.accessToken, { packageId, ...body });
  const parsed = (await res.json()) as any;
  return { ...user, res, data: parsed.data, error: parsed.error };
}

describe('Stripe Checkout purchases', () => {
  it('opens a Stripe-hosted payment page for the package plus VAT, with no card details or secrets returned', async () => {
    const { data, email, organisationId } = await startCheckout('pkg_training');
    expect(data).toMatchObject({ status: 'requires_confirmation', checkoutUrl: expect.stringMatching(/^https:\/\/checkout\.stripe\.com\//), amountCents: 215880 });
    expect(data.clientSecret).toBeUndefined();
    expect(data.paymentIntentId).toBeUndefined();

    const [params, opts] = stripe.create.mock.calls[0];
    expect(params).toMatchObject({
      mode: 'payment', customer_email: email, client_reference_id: data.purchaseId,
      metadata: { purchaseId: data.purchaseId, organisationId, packageId: 'pkg_training' },
      success_url: `http://localhost:8080/checkout/complete?purchase=${data.purchaseId}`,
      cancel_url: 'http://localhost:8080/checkout?package=Professional&cancelled=1',
    });
    expect(params.line_items!.map((li) => [li.price_data!.product_data!.name, li.price_data!.unit_amount])).toEqual([
      ['FRAUD-RISK.CO.UK Professional', 179900], ['VAT (20%)', 35980],
    ]);
    expect(opts).toEqual({ idempotencyKey: `checkout-${data.purchaseId}` });
    expect(totalWithVat(179900)).toBe(215880);
  });

  it('sends mobile buyers back to a page that tells them to return to the app', async () => {
    const { data } = await startCheckout('pkg_basic', { client: 'mobile' });
    expect(stripe.create.mock.calls[0][0].success_url).toBe(`http://localhost:8080/checkout/complete?purchase=${data.purchaseId}&client=mobile`);
    expect(stripe.create.mock.calls[0][0].cancel_url).toBe(`http://localhost:8080/checkout/complete?purchase=${data.purchaseId}&client=mobile&cancelled=1`);
  });

  it('does not grant access until Stripe shows the payment as paid', async () => {
    const { data, accessToken } = await startCheckout('pkg_full');
    const confirm = () => send('POST', `/purchases/${data.purchaseId}/confirm`, accessToken);

    const early = await confirm();
    expect(early.status).toBe(409);
    expect(((await early.json()) as any).error.code).toBe('PAYMENT_PENDING');
    expect(purchasesById.get(data.purchaseId)!.status).toBe('requires_confirmation');
    expect(((await (await get('/entitlements', accessToken)).json()) as any).data.packageId ?? null).not.toBe('pkg_full');

    stripe.pay(sessionIdOf(data.purchaseId));
    const paid = await confirm();
    expect(paid.status).toBe(200);
    expect(((await paid.json()) as any).data).toMatchObject({ status: 'succeeded', paymentIntentId: 'pi_test_paid' });
    expect(purchasesById.get(data.purchaseId)).toMatchObject({ status: 'succeeded', paymentIntentId: 'pi_test_paid' });

    // Returning twice (or after the webhook) is harmless and logged once
    expect((await confirm()).status).toBe(200);
    expect(auditEvents.filter((e) => e.resourceId === data.purchaseId && e.eventType === 'purchase.confirmed')).toHaveLength(1);
  });

  it('refuses a session paid for a different amount', async () => {
    const { data, accessToken } = await startCheckout('pkg_full');
    Object.assign(stripe.pay(sessionIdOf(data.purchaseId)), { amount_total: 100 });
    const res = await send('POST', `/purchases/${data.purchaseId}/confirm`, accessToken);
    expect(res.status).toBe(409);
    expect(purchasesById.get(data.purchaseId)!.status).toBe('requires_confirmation');
  });

  it('takes the buyer back to the open payment page instead of starting a second one', async () => {
    const { data, accessToken } = await startCheckout('pkg_training');
    const again = ((await (await send('POST', '/purchases', accessToken, { packageId: 'pkg_training' })).json()) as any).data;
    expect(again).toMatchObject({ purchaseId: data.purchaseId, checkoutUrl: data.checkoutUrl, resumed: true });
    expect(stripe.create).toHaveBeenCalledTimes(1);

    // Once that page has expired, a fresh one is made and the old purchase is closed
    Object.assign(stripe.sessions.get(sessionIdOf(data.purchaseId))!, { status: 'expired' });
    const fresh = ((await (await send('POST', '/purchases', accessToken, { packageId: 'pkg_training' })).json()) as any).data;
    expect(fresh.purchaseId).not.toBe(data.purchaseId);
    expect(purchasesById.get(data.purchaseId)!.status).toBe('failed');
  });

  it('reports a Stripe outage without leaving a purchase pending', async () => {
    stripe.create.mockRejectedValueOnce(new Error('connection reset'));
    const { res, error, accessToken } = await startCheckout('pkg_basic');
    expect(res.status).toBe(502);
    expect(error.code).toBe('PAYMENT_PROVIDER_ERROR');
    // The buyer can try again straight away
    const retry = await send('POST', '/purchases', accessToken, { packageId: 'pkg_basic' });
    expect([retry.status, ((await retry.json()) as any).error?.code]).toEqual([200, undefined]);
  });

  it('retires the simulated payment-intent endpoint', async () => {
    const { accessToken } = await createAuthenticatedUser();
    expect((await send('POST', '/payments/create-intent', accessToken, { packageId: 'pkg_basic' })).status).toBe(410);
  });
});

describe('Stripe webhook', () => {
  const SECRET = 'whsec_test_only';
  const signed = (event: unknown) => {
    const body = JSON.stringify(event);
    const t = Math.floor(Date.now() / 1000);
    const v1 = crypto.createHmac('sha256', SECRET).update(`${t}.${body}`).digest('hex');
    return app.request(`${API}/webhooks/stripe`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': `t=${t},v1=${v1}` }, body });
  };
  const event = (type: string, object: unknown) => ({ id: `evt_${crypto.randomUUID()}`, type, data: { object } });

  beforeEach(() => { process.env.STRIPE_WEBHOOK_SECRET = SECRET; });

  it('settles a paid session even if the buyer never comes back', async () => {
    const { data } = await startCheckout('pkg_full');
    const session = stripe.pay(sessionIdOf(data.purchaseId));
    expect((await signed(event('checkout.session.completed', session))).status).toBe(200);
    expect(purchasesById.get(data.purchaseId)).toMatchObject({ status: 'succeeded', paymentIntentId: 'pi_test_paid' });
    const audit = auditEvents.find((e) => e.resourceId === data.purchaseId && e.eventType === 'purchase.confirmed');
    expect(audit?.details).toMatchObject({ source: 'webhook', amountCents: 599400 });
  });

  it('ignores an unpaid, mismatched or unsigned session', async () => {
    const { data } = await startCheckout('pkg_full');
    const session = stripe.sessions.get(sessionIdOf(data.purchaseId))!;
    await signed(event('checkout.session.completed', session)); // still unpaid
    await signed(event('checkout.session.completed', { ...session, payment_status: 'paid', amount_total: 1 }));
    await signed(event('checkout.session.completed', { ...session, id: 'cs_test_other', payment_status: 'paid' }));
    expect(purchasesById.get(data.purchaseId)!.status).toBe('requires_confirmation');

    const forged = await app.request(`${API}/webhooks/stripe`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'stripe-signature': `t=${Math.floor(Date.now() / 1000)},v1=${'0'.repeat(64)}` },
      body: JSON.stringify(event('checkout.session.completed', { ...session, payment_status: 'paid', status: 'complete' })),
    });
    expect(forged.status).toBe(400);
    expect(purchasesById.get(data.purchaseId)!.status).toBe('requires_confirmation');
  });

  it('closes the purchase when the payment page expires', async () => {
    const { data } = await startCheckout('pkg_basic');
    const session = { ...stripe.sessions.get(sessionIdOf(data.purchaseId))!, status: 'expired' };
    await signed(event('checkout.session.expired', session));
    expect(purchasesById.get(data.purchaseId)!.status).toBe('failed');
  });
});

describe('Without Stripe in production', () => {
  const env = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = env; });

  it('refuses to take or confirm purchases rather than simulating payment', async () => {
    setStripeClient(null);
    const { accessToken } = await createAuthenticatedUser();
    process.env.NODE_ENV = 'production';
    const res = await send('POST', '/purchases', accessToken, { packageId: 'pkg_basic' });
    expect(res.status).toBe(503);
    expect(((await res.json()) as any).error.code).toBe('PAYMENTS_UNAVAILABLE');
  });
});
