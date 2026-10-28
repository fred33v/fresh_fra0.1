import crypto from 'node:crypto';
import { Hono } from 'hono';
import { blocksRepurchase, getAuth, hasDatabase, jsonError, requireAuth } from '../helpers.js';
import { getEntitlementSummary } from '../entitlements.js';
import { createLogger } from '../logger.js';
import {
  paymentCreateIntentSchema, purchasesCreateSchema, purchasesConfirmSchema,
  stripeWebhookSchema, FALLBACK_PACKAGES, RISK_THRESHOLDS, RATE_LIMITS,
  parsePagination, paginate, requireUUIDParam,
} from '../types.js';

const logger = createLogger('payments');
import type { Assessment, Purchase } from '../types.js';
import { assessmentsById, purchasesById } from '../stores.js';
import { getClientIp, rateLimit } from '../middleware.js';
import { createCheckoutSession, getStripe, paymentIntentIdOf, sessionOutcome, totalWithVat } from '../stripe.js';
import type Stripe from 'stripe';
import {
  dbInsertPurchase, dbGetPurchaseById, dbUpdatePurchaseStatus, dbSetPurchaseCheckoutSession, dbMarkPurchasePaid,
  dbListPurchasesByOrganisation, dbListPackages, dbGetPackageById,
  dbListAssessmentsByOrganisation,
  auditLog,
} from '../db/index.js';

const payments = new Hono();

// Track processed webhook event IDs for idempotency
const processedWebhookIds = new Set<string>();

/** Without Stripe, payments are simulated for local development and tests; production refuses them. */
const paymentsUnavailable = () => !getStripe() && process.env.NODE_ENV === 'production';

const loadPurchase = async (id: string): Promise<Purchase | null> =>
  hasDatabase() ? dbGetPurchaseById(id) : purchasesById.get(id) ?? null;

const orgPurchasesOf = async (orgId: string): Promise<Purchase[]> =>
  hasDatabase() ? dbListPurchasesByOrganisation(orgId) : Array.from(purchasesById.values()).filter((p) => p.organisationId === orgId);

async function setPurchaseStatus(purchase: Purchase, status: 'failed'): Promise<void> {
  if (hasDatabase()) await dbUpdatePurchaseStatus(purchase.id, status, undefined, 'requires_confirmation');
  else if (purchase.status === 'requires_confirmation') purchase.status = status;
}

/**
 * Marks a pending purchase paid once Stripe shows it paid. Safe to call from both the buyer's return
 * and the webhook: only the first call changes anything. Returns whether this call did.
 */
async function settlePaid(purchase: Purchase, paymentIntentId: string | null, source: 'checkout_return' | 'webhook',
  actor?: { userId: string; email: string; ip?: string; userAgent?: string }): Promise<boolean> {
  const now = new Date().toISOString();
  let changed = false;
  if (hasDatabase()) {
    changed = (await dbMarkPurchasePaid(purchase.id, now, paymentIntentId)) > 0;
  } else {
    const stored = purchasesById.get(purchase.id);
    if (stored && stored.status === 'requires_confirmation') {
      stored.status = 'succeeded';
      stored.confirmedAt = now;
      if (paymentIntentId) stored.paymentIntentId = paymentIntentId;
      changed = true;
    }
  }
  if (changed) {
    await auditLog({
      eventType: 'purchase.confirmed', actorId: actor?.userId, actorEmail: actor?.email,
      organisationId: purchase.organisationId, resourceType: 'purchase', resourceId: purchase.id,
      details: { source, paymentIntentId, amountCents: totalWithVat(purchase.amountCents), packageId: purchase.packageId },
      ipAddress: actor?.ip, userAgent: actor?.userAgent,
    });
  }
  return changed;
}

payments.post('/payments/create-intent', async (c) => {
  const limited = await rateLimit('payments:intent', { windowMs: RATE_LIMITS.PAYMENT_INTENT_WINDOW_MS, max: RATE_LIMITS.PAYMENT_INTENT_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  // Real payments go through POST /purchases, which returns a Stripe Checkout link
  if (getStripe() || paymentsUnavailable()) {
    return jsonError(c, 410, 'GONE', 'Create a purchase with POST /api/v1/purchases and pay through its checkoutUrl');
  }

  const parsed = paymentCreateIntentSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid payment intent payload');

  const paymentIntentId = `pi_${crypto.randomUUID().replace(/-/g, '')}`;
  const clientSecret = `${paymentIntentId}_secret_${crypto.randomUUID().replace(/-/g, '')}`;

  return c.json({
    success: true,
    data: {
      paymentIntentId,
      clientSecret,
      currency: parsed.data.currency,
      packageId: parsed.data.packageId,
      organisationId: auth.organisationId,
    },
  });
});

payments.get('/packages', async (c) => {
  c.header('Cache-Control', 'public, max-age=300');

  if (hasDatabase()) {
    const packages = await dbListPackages();
    const data = packages.map((p) => ({
      id: p.id, name: p.name, description: p.description, price: p.priceCents,
      currency: p.currency, keypassAllowance: p.keypassAllowance, features: p.features,
    }));
    return c.json({ success: true, data });
  }

  return c.json({
    success: true,
    data: FALLBACK_PACKAGES.map((p) => ({
      id: p.id, name: p.name, description: p.description, price: p.priceCents,
      currency: p.currency, keypassAllowance: p.keypassAllowance, features: p.features,
    })),
  });
});

payments.get('/packages/recommended', async (c) => {
  const auth = getAuth(c);

  // No auth/org info available: recommend professional (most popular)
  if (!auth) {
    return c.json({ success: true, data: { packageId: 'pkg_training', reason: 'most_popular' } });
  }

  // Fetch the user's assessments
  const orgAssessments: Assessment[] = hasDatabase()
    ? await dbListAssessmentsByOrganisation(auth.organisationId)
    : Array.from(assessmentsById.values()).filter((a) => a.organisationId === auth.organisationId);

  // No assessments: recommend starter
  if (orgAssessments.length === 0) {
    return c.json({ success: true, data: { packageId: 'pkg_basic', reason: 'no_assessment' } });
  }

  // Check completed/submitted assessments for risk indicators
  const completedAssessments = orgAssessments.filter((a) => a.status === 'completed' || a.status === 'submitted');

  if (completedAssessments.length === 0) {
    // Has assessments but none completed yet: recommend starter
    return c.json({ success: true, data: { packageId: 'pkg_basic', reason: 'assessment_in_progress' } });
  }

  // Derive a simple risk score from the most recent completed assessment's answers.
  // Count the number of answered questions as a proxy for complexity/risk.
  const latest = completedAssessments.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const answerCount = Object.keys(latest.answers).length;

  // Simple heuristic: more answers filled in suggests higher risk awareness needed
  // High risk (many answers / flags): recommend enterprise (pkg_full)
  // Medium risk: recommend professional (pkg_training)
  // Low risk: recommend starter (pkg_basic)
  if (answerCount >= RISK_THRESHOLDS.HIGH_ANSWER_COUNT) {
    return c.json({ success: true, data: { packageId: 'pkg_full', reason: 'high_risk_score' } });
  }
  if (answerCount >= RISK_THRESHOLDS.MEDIUM_ANSWER_COUNT) {
    return c.json({ success: true, data: { packageId: 'pkg_training', reason: 'medium_risk_score' } });
  }

  return c.json({ success: true, data: { packageId: 'pkg_basic', reason: 'low_risk_score' } });
});

payments.post('/purchases', async (c) => {
  const limited = await rateLimit('purchases:create', { windowMs: RATE_LIMITS.PURCHASE_WINDOW_MS, max: RATE_LIMITS.PURCHASE_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const parsed = purchasesCreateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid purchase payload');

  if (paymentsUnavailable()) {
    logger.error('STRIPE_SECRET_KEY is not set — refusing purchases in production');
    return jsonError(c, 503, 'PAYMENTS_UNAVAILABLE', 'Card payments are not available at the moment. Please try again later.');
  }
  const stripe = getStripe();

  // Look up the package — reject if not found or inactive
  let pkg: { name: string; priceCents: number; currency: string; isActive?: boolean } | null = null;
  if (hasDatabase()) {
    pkg = await dbGetPackageById(parsed.data.packageId);
  } else {
    pkg = FALLBACK_PACKAGES.find((p) => p.id === parsed.data.packageId) ?? null;
  }

  if (!pkg) {
    return jsonError(c, 400, 'INVALID_PACKAGE', 'Package not found');
  }
  if ('isActive' in pkg && pkg.isActive === false) {
    return jsonError(c, 400, 'INVALID_PACKAGE', 'Package is no longer available');
  }

  const orgPurchases = await orgPurchasesOf(auth.organisationId);

  // Subscriptions can be renewed in the last 30 days of their term; one-time packages cannot be re-bought
  if (blocksRepurchase(orgPurchases, parsed.data.packageId)) {
    return jsonError(c, 409, 'DUPLICATE_PURCHASE', 'An active purchase for this package already exists');
  }
  const pending = orgPurchases.find((p) => p.packageId === parsed.data.packageId && p.status === 'requires_confirmation');
  if (pending) {
    if (!stripe || !pending.checkoutSessionId) {
      return jsonError(c, 409, 'DUPLICATE_PURCHASE', 'An active purchase for this package already exists');
    }
    // A buyer who left Stripe's page comes back to the same payment while it is open
    const session = await stripe.checkout.sessions.retrieve(pending.checkoutSessionId);
    const outcome = sessionOutcome(session, pending);
    if (outcome === 'paid') {
      await settlePaid(pending, paymentIntentIdOf(session), 'checkout_return', { userId: auth.userId, email: auth.email, ip: getClientIp(c), userAgent: c.req.header('user-agent') });
      return jsonError(c, 409, 'DUPLICATE_PURCHASE', 'This package has already been paid for');
    }
    if (outcome === 'open' && session.url) {
      return c.json({
        success: true,
        data: {
          purchaseId: pending.id, packageId: pending.packageId, organisationId: auth.organisationId,
          status: 'requires_confirmation', checkoutUrl: session.url, amountCents: totalWithVat(pending.amountCents), resumed: true,
        },
      });
    }
    await setPurchaseStatus(pending, 'failed');
  }

  const amountCents = pkg.priceCents;
  const currency = pkg.currency;
  const purchaseId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Simulated payments (no Stripe outside production) keep a placeholder intent for the old confirm flow
  const placeholderIntent = `pi_${crypto.randomUUID().replace(/-/g, '')}`;
  const purchase: Purchase = {
    id: purchaseId, organisationId: auth.organisationId, userId: auth.userId,
    packageId: parsed.data.packageId, status: 'requires_confirmation',
    ...(stripe ? {} : { paymentIntentId: placeholderIntent, clientSecret: `${placeholderIntent}_secret_${crypto.randomUUID().replace(/-/g, '')}` }),
    amountCents, currency, createdAt: now,
  };

  if (hasDatabase()) {
    await dbInsertPurchase(purchase);
  } else {
    purchasesById.set(purchaseId, purchase);
  }

  let checkoutUrl: string | null = null;
  if (stripe) {
    try {
      const session = await createCheckoutSession(stripe, {
        purchaseId, organisationId: auth.organisationId, packageId: parsed.data.packageId, packageName: pkg.name,
        netCents: amountCents, currency, email: auth.email, client: parsed.data.client ?? 'web',
        checkoutPath: `/checkout?package=${encodeURIComponent(pkg.name)}&cancelled=1`,
      });
      if (hasDatabase()) await dbSetPurchaseCheckoutSession(purchaseId, session.id);
      else purchase.checkoutSessionId = session.id;
      checkoutUrl = session.url;
    } catch (err: unknown) {
      logger.error('Stripe Checkout Session could not be created', { purchaseId, error: err instanceof Error ? err.message : String(err) });
      await setPurchaseStatus(purchase, 'failed');
      return jsonError(c, 502, 'PAYMENT_PROVIDER_ERROR', 'The payment page could not be opened. Please try again.');
    }
  }

  const previousPurchase = orgPurchases.find((p) => p.status === 'succeeded');
  const previousPackageId = previousPurchase?.packageId ?? null;
  const transitionType = !previousPackageId ? 'new_customer'
    : previousPackageId === parsed.data.packageId ? 'renewal'
    : 'upgrade';

  await auditLog({
    eventType: 'purchase.created', actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 'purchase', resourceId: purchaseId,
    details: { packageId: parsed.data.packageId, amountCents, previousPackageId, transitionType, provider: stripe ? 'stripe' : 'simulated' },
    ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent'),
  });

  return c.json({
    success: true,
    data: {
      purchaseId, packageId: parsed.data.packageId,
      organisationId: auth.organisationId, status: 'requires_confirmation',
      amountCents: totalWithVat(amountCents),
      ...(stripe
        ? { checkoutUrl }
        : { checkoutUrl: null, simulated: true, paymentIntentId: purchase.paymentIntentId, clientSecret: purchase.clientSecret }),
    },
  });
});

payments.post('/purchases/:id/confirm', async (c) => {
  const limited = await rateLimit('purchases:confirm', { windowMs: RATE_LIMITS.PURCHASE_WINDOW_MS, max: RATE_LIMITS.PURCHASE_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const parsed = purchasesConfirmSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid purchase confirmation payload');

  const purchaseId = requireUUIDParam(c, 'id');
  if (purchaseId instanceof Response) return purchaseId;

  // Verify purchase exists and belongs to the authenticated user's organisation
  const purchase = await loadPurchase(purchaseId);

  if (!purchase || purchase.organisationId !== auth.organisationId) {
    return jsonError(c, 404, 'NOT_FOUND', 'Purchase not found');
  }

  if (paymentsUnavailable()) {
    return jsonError(c, 503, 'PAYMENTS_UNAVAILABLE', 'Card payments are not available at the moment. Please try again later.');
  }

  // With Stripe, the buyer's word is not enough: the Checkout Session must show the purchase paid
  const stripe = getStripe();
  if (stripe) {
    const paid = { purchaseId, organisationId: auth.organisationId, status: 'succeeded' as const };
    if (purchase.status === 'succeeded') return c.json({ success: true, data: { ...paid, paymentIntentId: purchase.paymentIntentId ?? null } });
    if (purchase.status !== 'requires_confirmation' || !purchase.checkoutSessionId) {
      return jsonError(c, 409, 'PAYMENT_NOT_COMPLETED', 'This payment was not completed. Please start a new checkout.');
    }
    const session = await stripe.checkout.sessions.retrieve(purchase.checkoutSessionId);
    const outcome = sessionOutcome(session, purchase);
    if (outcome === 'paid') {
      const paymentIntentId = paymentIntentIdOf(session);
      await settlePaid(purchase, paymentIntentId, 'checkout_return', { userId: auth.userId, email: auth.email, ip: getClientIp(c), userAgent: c.req.header('user-agent') });
      return c.json({ success: true, data: { ...paid, paymentIntentId } });
    }
    if (outcome === 'expired') await setPurchaseStatus(purchase, 'failed');
    if (outcome === 'mismatch') logger.error('Checkout Session does not match purchase', { purchaseId, sessionId: session.id });
    return jsonError(c, 409, outcome === 'open' ? 'PAYMENT_PENDING' : 'PAYMENT_NOT_COMPLETED',
      outcome === 'open' ? 'Payment has not been completed yet.' : 'This payment was not completed. Please start a new checkout.');
  }

  if (purchase.status !== 'requires_confirmation') {
    return jsonError(c, 409, 'ALREADY_CONFIRMED', `Purchase cannot be confirmed (status: ${purchase.status})`);
  }

  // Re-check for duplicate active purchases to prevent double-spend race condition
  const orgPurchases = hasDatabase()
    ? await dbListPurchasesByOrganisation(auth.organisationId)
    : Array.from(purchasesById.values()).filter((p) => p.organisationId === auth.organisationId);

  if (blocksRepurchase(orgPurchases, purchase.packageId)) {
    return jsonError(c, 409, 'DUPLICATE_PURCHASE', 'An active purchase for this package already exists');
  }

  const now = new Date().toISOString();

  if (hasDatabase()) {
    const updated = await dbUpdatePurchaseStatus(purchaseId, 'succeeded', now, 'requires_confirmation');
    if (updated === 0) {
      return jsonError(c, 409, 'ALREADY_CONFIRMED', 'Purchase was already confirmed by another request');
    }
  } else {
    if (purchase.status !== 'requires_confirmation') {
      return jsonError(c, 409, 'ALREADY_CONFIRMED', 'Purchase was already confirmed by another request');
    }
    purchase.status = 'succeeded';
    purchase.confirmedAt = now;
  }

  await auditLog({
    eventType: 'purchase.confirmed', actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 'purchase', resourceId: purchaseId,
    ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent'),
  });

  return c.json({
    success: true,
    data: {
      purchaseId, organisationId: auth.organisationId,
      status: 'succeeded', paymentIntentId: parsed.data.paymentIntentId ?? null,
    },
  });
});

payments.get('/entitlements', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  return c.json({ success: true, data: await getEntitlementSummary(auth) });
});

payments.get('/purchases/:id', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const purchaseId = requireUUIDParam(c, 'id');
  if (purchaseId instanceof Response) return purchaseId;

  if (hasDatabase()) {
    const purchase = await dbGetPurchaseById(purchaseId);
    if (!purchase || purchase.organisationId !== auth.organisationId) {
      return jsonError(c, 404, 'NOT_FOUND', 'Purchase not found');
    }
    const { clientSecret: _, ...safePurchase } = purchase;
    return c.json({ success: true, data: safePurchase });
  }

  const purchase = purchasesById.get(purchaseId);
  if (!purchase || purchase.organisationId !== auth.organisationId) {
    return jsonError(c, 404, 'NOT_FOUND', 'Purchase not found');
  }
  const { clientSecret: _, ...safePurchase } = purchase;
  return c.json({ success: true, data: safePurchase });
});

payments.get('/purchases/organisation/:orgId', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const orgId = requireUUIDParam(c, 'orgId');
  if (orgId instanceof Response) return orgId;
  if (orgId !== auth.organisationId) return jsonError(c, 403, 'FORBIDDEN', 'Forbidden');

  const statusFilter = c.req.query('status');
  const validStatuses = new Set(['requires_confirmation', 'succeeded', 'failed', 'refunded']);
  if (statusFilter && !validStatuses.has(statusFilter)) {
    return jsonError(c, 400, 'INVALID_PARAM', 'Invalid status filter');
  }

  let allPurchases = hasDatabase()
    ? await dbListPurchasesByOrganisation(orgId)
    : Array.from(purchasesById.values()).filter((p) => p.organisationId === orgId);

  if (statusFilter) {
    allPurchases = allPurchases.filter((p) => p.status === statusFilter);
  }

  const { page, pageSize } = parsePagination(c.req.query());
  const result = paginate(allPurchases, page, pageSize);
  const safeItems = result.items.map(({ clientSecret: _, ...rest }) => rest);

  return c.json({ success: true, data: safeItems, pagination: { page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages } });
});

function verifyStripeSignature(payload: string, sigHeader: string, secret: string): boolean {
  // While a webhook secret is being rotated Stripe sends one v1 signature per secret,
  // so the header can carry several; any one of them matching is enough.
  let timestamp: string | undefined;
  const signatures: string[] = [];
  for (const part of sigHeader.split(',')) {
    const [key, value] = part.split('=');
    if (key === 't') timestamp = value;
    else if (key === 'v1' && value) signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) return false;

  // Check timestamp is within 5 minutes
  const tolerance = 300; // 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > tolerance) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expectedBuf = Buffer.from(crypto.createHmac('sha256', secret).update(signedPayload).digest('hex'));

  return signatures.some((signature) => {
    const sigBuf = Buffer.from(signature);
    return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
  });
}

payments.post('/webhooks/stripe', async (c) => {
  // Read the raw body text for signature verification before JSON parsing
  const rawBody = await c.req.text();

  // Stripe webhook signature verification
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (webhookSecret) {
    const sigHeader = c.req.header('stripe-signature');
    if (!sigHeader) {
      return jsonError(c, 400, 'SIGNATURE_MISSING', 'Missing stripe-signature header');
    }
    if (!verifyStripeSignature(rawBody, sigHeader, webhookSecret)) {
      return jsonError(c, 400, 'SIGNATURE_INVALID', 'Invalid Stripe webhook signature');
    }
  } else if (process.env.NODE_ENV === 'production') {
    logger.error('STRIPE_WEBHOOK_SECRET is not set — rejecting webhook in production');
    return jsonError(c, 500, 'CONFIGURATION_ERROR', 'Webhook signature verification is not configured');
  } else {
    logger.warn('STRIPE_WEBHOOK_SECRET is not set — skipping webhook signature verification');
  }

  let body: unknown;
  try { body = JSON.parse(rawBody); } catch { return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid JSON body'); }

  const parsed = stripeWebhookSchema.safeParse(body);
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid stripe webhook payload');

  const eventId = parsed.data.id;
  const eventType = parsed.data.type;
  const eventData = parsed.data.data as Record<string, unknown> | undefined;

  // Simple in-memory idempotency check to prevent duplicate processing
  if (eventId && processedWebhookIds.has(eventId)) {
    logger.info('Duplicate webhook event ignored', { eventId, type: eventType });
    return c.json({ success: true, data: { received: true, type: eventType, duplicate: true } });
  }

  logger.info('Stripe webhook received', { eventId, type: eventType });

  // Mark as processed BEFORE handling to prevent duplicate processing on retry
  if (eventId) {
    processedWebhookIds.add(eventId);
    // Prevent unbounded memory growth — keep last 10 000 event IDs
    if (processedWebhookIds.size > 10_000) {
      const first = processedWebhookIds.values().next().value;
      if (first) processedWebhookIds.delete(first);
    }
  }

  try {
    switch (eventType) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed': {
        const session = (eventData as { object?: Stripe.Checkout.Session } | undefined)?.object;
        const purchaseId = session?.metadata?.purchaseId ?? session?.client_reference_id ?? undefined;
        const purchase = purchaseId && /^[0-9a-f-]{36}$/i.test(purchaseId) ? await loadPurchase(purchaseId) : null;
        if (!session || !purchase) {
          logger.warn('Checkout webhook for an unknown purchase', { eventId, purchaseId });
          break;
        }
        if (purchase.checkoutSessionId && session.id !== purchase.checkoutSessionId) {
          logger.error('Checkout webhook session does not match purchase', { eventId, purchaseId });
          break;
        }
        if (eventType === 'checkout.session.expired' || eventType === 'checkout.session.async_payment_failed') {
          await setPurchaseStatus(purchase, 'failed');
          logger.info('Purchase payment not completed', { purchaseId, eventType });
          break;
        }
        const outcome = sessionOutcome(session, purchase);
        if (outcome === 'paid') {
          const changed = await settlePaid(purchase, paymentIntentIdOf(session), 'webhook');
          logger.info('Purchase paid', { purchaseId, alreadySettled: !changed });
        } else if (outcome === 'mismatch') {
          logger.error('Checkout webhook amount or purchase mismatch', { eventId, purchaseId, amountTotal: session.amount_total });
        }
        break;
      }

      case 'payment_intent.succeeded': {
        // Purchases are settled from their Checkout Session, which carries the amount and purchase
        logger.info('Payment intent succeeded', { eventId });
        break;
      }

      default: {
        logger.info('Unhandled Stripe webhook event', { type: eventType });
        break;
      }
    }
  } catch (err: unknown) {
    // Let Stripe's retry be processed rather than ignored as a duplicate
    if (eventId) processedWebhookIds.delete(eventId);
    logger.error('Webhook processing error', { eventId, type: eventType, error: String(err) });
    return jsonError(c, 500, 'WEBHOOK_ERROR', 'Failed to process webhook event');
  }

  return c.json({ success: true, data: { received: true, type: eventType } });
});

export default payments;
