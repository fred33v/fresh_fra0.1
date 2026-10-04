// ============================================================
// Card payments through Stripe Checkout (Stripe's hosted payment page).
// Card details are entered on Stripe's page and never reach this service or
// our apps (PCI DSS SAQ A). A purchase is marked paid only when the server
// sees a paid Checkout Session: fetched from Stripe when the buyer returns,
// or from the signed checkout.session.* webhook, whichever comes first.
//
// Configuration:
//   STRIPE_SECRET_KEY        sk_test_… or sk_live_… (unset: payments are
//                            simulated outside production, refused in it)
//   STRIPE_WEBHOOK_SECRET    whsec_… for /api/v1/webhooks/stripe
//   STRIPE_VAT_TAX_RATE_ID   optional txr_… for 20% UK VAT; without it VAT
//                            is charged as its own line item
//   WEB_APP_URL              where Stripe returns the buyer, e.g.
//                            https://app.fraud-risk.co.uk
// ============================================================

import Stripe from 'stripe';

export const VAT_RATE = 0.2;

/** Package prices are held before VAT; the buyer pays the price plus 20% VAT. */
export const totalWithVat = (netCents: number) => Math.round(netCents * (1 + VAT_RATE));

let client: Stripe | null | undefined;

/** The Stripe client, or null when STRIPE_SECRET_KEY is not set. */
export function getStripe(): Stripe | null {
  if (client === undefined) {
    const key = process.env.STRIPE_SECRET_KEY;
    client = key ? new Stripe(key) : null;
  }
  return client;
}

/** Tests swap in a fake client; null restores "not configured", undefined re-reads the environment. */
export function setStripeClient(fake: Stripe | null | undefined): void {
  client = fake;
}

export function webAppUrl(): string {
  return (process.env.WEB_APP_URL ?? 'http://localhost:8080').replace(/\/+$/, '');
}

export type CheckoutClient = 'web' | 'mobile';

export async function createCheckoutSession(stripe: Stripe, args: {
  purchaseId: string; organisationId: string; packageId: string; packageName: string; netCents: number;
  currency: string; email: string; client: CheckoutClient; checkoutPath: string;
}): Promise<Stripe.Checkout.Session> {
  const base = webAppUrl();
  const vatRateId = process.env.STRIPE_VAT_TAX_RATE_ID;
  const vatCents = totalWithVat(args.netCents) - args.netCents;
  const productLine: Stripe.Checkout.SessionCreateParams.LineItem = {
    quantity: 1,
    price_data: {
      currency: args.currency,
      unit_amount: args.netCents,
      product_data: { name: `FRAUD-RISK.CO.UK ${args.packageName}` },
    },
    ...(vatRateId ? { tax_rates: [vatRateId] } : {}),
  };
  const lineItems = vatRateId ? [productLine] : [productLine, {
    quantity: 1,
    price_data: { currency: args.currency, unit_amount: vatCents, product_data: { name: 'VAT (20%)' } },
  }];
  const metadata = { purchaseId: args.purchaseId, organisationId: args.organisationId, packageId: args.packageId };

  return stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: lineItems,
    client_reference_id: args.purchaseId,
    customer_email: args.email,
    metadata,
    payment_intent_data: { metadata },
    // Mobile buyers come back through a web page that hands them back to the app, whether they paid or not
    success_url: `${base}/checkout/complete?purchase=${args.purchaseId}${args.client === 'mobile' ? '&client=mobile' : ''}`,
    cancel_url: args.client === 'mobile'
      ? `${base}/checkout/complete?purchase=${args.purchaseId}&client=mobile&cancelled=1`
      : `${base}${args.checkoutPath}`,
    // An abandoned page stops working after an hour, so a stale session cannot be paid later
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
  }, { idempotencyKey: `checkout-${args.purchaseId}` });
}

export type SessionOutcome = 'paid' | 'open' | 'expired' | 'mismatch';

/** Whether a Checkout Session pays for this purchase, checking it is the right session for the right amount. */
export function sessionOutcome(session: Stripe.Checkout.Session, purchase: { id: string; amountCents: number; currency: string }): SessionOutcome {
  if (session.metadata?.purchaseId !== purchase.id && session.client_reference_id !== purchase.id) return 'mismatch';
  if (session.status === 'expired') return 'expired';
  if (session.payment_status !== 'paid') return 'open';
  if (session.amount_total !== totalWithVat(purchase.amountCents) || session.currency !== purchase.currency) return 'mismatch';
  return 'paid';
}

export const paymentIntentIdOf = (session: Stripe.Checkout.Session): string | null =>
  typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null;
