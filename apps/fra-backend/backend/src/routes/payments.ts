import crypto from 'node:crypto';
import { Hono } from 'hono';
import { getAuth, hasDatabase, jsonError, requireAuth } from '../helpers.js';
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
import {
  dbInsertPurchase, dbGetPurchaseById, dbUpdatePurchaseStatus,
  dbListPurchasesByOrganisation, dbListPackages, dbGetPackageById,
  dbListAssessmentsByOrganisation,
  auditLog,
} from '../db/index.js';

const payments = new Hono();

// Track processed webhook event IDs for idempotency
const processedWebhookIds = new Set<string>();

payments.post('/payments/create-intent', async (c) => {
  const limited = await rateLimit('payments:intent', { windowMs: RATE_LIMITS.PAYMENT_INTENT_WINDOW_MS, max: RATE_LIMITS.PAYMENT_INTENT_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

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

  // Look up the package — reject if not found or inactive
  let pkg: { priceCents: number; currency: string; isActive?: boolean } | null = null;
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

  // Prevent duplicate active purchase for the same package
  const orgPurchases = hasDatabase()
    ? await dbListPurchasesByOrganisation(auth.organisationId)
    : Array.from(purchasesById.values()).filter((p) => p.organisationId === auth.organisationId);

  const existingActive = orgPurchases.find(
    (p) => p.packageId === parsed.data.packageId && (p.status === 'succeeded' || p.status === 'requires_confirmation')
  );
  if (existingActive) {
    return jsonError(c, 409, 'DUPLICATE_PURCHASE', 'An active purchase for this package already exists');
  }

  const amountCents = pkg.priceCents;
  const currency = pkg.currency;

  const paymentIntentId = `pi_${crypto.randomUUID().replace(/-/g, '')}`;
  const clientSecret = `${paymentIntentId}_secret_${crypto.randomUUID().replace(/-/g, '')}`;
  const purchaseId = crypto.randomUUID();
  const now = new Date().toISOString();

  const purchase: Purchase = {
    id: purchaseId, organisationId: auth.organisationId, userId: auth.userId,
    packageId: parsed.data.packageId, status: 'requires_confirmation',
    paymentIntentId, clientSecret, amountCents, currency, createdAt: now,
  };

  if (hasDatabase()) {
    await dbInsertPurchase(purchase);
  } else {
    purchasesById.set(purchaseId, purchase);
  }

  const previousPurchase = orgPurchases.find((p) => p.status === 'succeeded');
  const previousPackageId = previousPurchase?.packageId ?? null;
  const transitionType = !previousPackageId ? 'new_customer'
    : previousPackageId === parsed.data.packageId ? 'renewal'
    : 'upgrade';

  await auditLog({
    eventType: 'purchase.created', actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 'purchase', resourceId: purchaseId,
    details: { packageId: parsed.data.packageId, amountCents, previousPackageId, transitionType },
    ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent'),
  });

  return c.json({
    success: true,
    data: {
      purchaseId, packageId: parsed.data.packageId,
      organisationId: auth.organisationId,
      paymentIntentId, clientSecret, status: 'requires_confirmation',
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
  const purchase = hasDatabase()
    ? await dbGetPurchaseById(purchaseId)
    : purchasesById.get(purchaseId) ?? null;

  if (!purchase || purchase.organisationId !== auth.organisationId) {
    return jsonError(c, 404, 'NOT_FOUND', 'Purchase not found');
  }

  if (purchase.status !== 'requires_confirmation') {
    return jsonError(c, 409, 'ALREADY_CONFIRMED', `Purchase cannot be confirmed (status: ${purchase.status})`);
  }

  // Re-check for duplicate active purchases to prevent double-spend race condition
  const orgPurchases = hasDatabase()
    ? await dbListPurchasesByOrganisation(auth.organisationId)
    : Array.from(purchasesById.values()).filter((p) => p.organisationId === auth.organisationId);

  const alreadySucceeded = orgPurchases.find(
    (p) => p.packageId === purchase.packageId && p.status === 'succeeded'
  );
  if (alreadySucceeded) {
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
  const parts = sigHeader.split(',').reduce((acc, part) => {
    const [key, value] = part.split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);

  const timestamp = parts['t'];
  const signature = parts['v1'];

  if (!timestamp || !signature) return false;

  // Check timestamp is within 5 minutes
  const tolerance = 300; // 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > tolerance) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expectedSig = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(sigBuf, expectedBuf);
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
  const now = new Date().toISOString();

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
      case 'checkout.session.completed': {
        const sessionObj = (eventData as Record<string, unknown> | undefined)?.object as Record<string, unknown> | undefined;
        const paymentIntentId = (sessionObj?.payment_intent as string) ?? null;
        const metadata = sessionObj?.metadata as Record<string, string> | undefined;
        const purchaseId = metadata?.purchaseId;

        if (purchaseId) {
          if (hasDatabase()) {
            await dbUpdatePurchaseStatus(purchaseId, 'succeeded', now, 'requires_confirmation');
          } else {
            const existing = purchasesById.get(purchaseId);
            if (existing && existing.status === 'requires_confirmation') { existing.status = 'succeeded'; existing.confirmedAt = now; }
          }
          logger.info('Purchase status updated', { purchaseId, status: 'succeeded', paymentIntentId });
        }
        break;
      }

      case 'payment_intent.succeeded': {
        const intentObj = (eventData as Record<string, unknown> | undefined)?.object as Record<string, unknown> | undefined;
        const piId = (intentObj?.id as string) ?? null;

        if (piId) {
          if (hasDatabase()) {
            logger.info('Payment intent confirmed', { paymentIntentId: piId });
          } else {
            const purchase = Array.from(purchasesById.values()).find((p) => p.paymentIntentId === piId);
            if (purchase && purchase.status !== 'succeeded') {
              purchase.status = 'succeeded';
              purchase.confirmedAt = now;
              logger.info('Purchase confirmed via intent', { purchaseId: purchase.id, paymentIntentId: piId });
            }
          }
        }
        break;
      }

      default: {
        logger.info('Unhandled Stripe webhook event', { type: eventType });
        break;
      }
    }
  } catch (err: unknown) {
    logger.error('Webhook processing error', { eventId, type: eventType, error: String(err) });
    return jsonError(c, 500, 'WEBHOOK_ERROR', 'Failed to process webhook event');
  }

  return c.json({ success: true, data: { received: true, type: eventType } });
});

export default payments;
