import { Hono } from 'hono';
import { hasDatabase, jsonError, requireAuth } from '../helpers.js';
import { requireUUIDParam, RATE_LIMITS } from '../types.js';
import type { Assessment } from '../types.js';
import { assessmentsById, organisationsById } from '../stores.js';
import { dbGetAssessmentById, dbGetOrganisationById, dbListAssessmentsByOrganisation, auditLog } from '../db/index.js';
import { rateLimit, getClientIp } from '../middleware.js';
import { generateAssessmentPdf } from '../pdf-generator.js';
import { createLogger } from '../logger.js';
import { verifySignedPayload } from '../webhooks-out.js';
import { requireAnyPaidPurchase } from '../entitlements.js';

const logger = createLogger('reports-exports');

const reportsExports = new Hono();

/**
 * GET /assessments/:id/export-pdf
 * Export an assessment as a PDF file
 * Available to any organisation that has paid for a package (including pkg_basic)
 */
reportsExports.get('/assessments/:id/export-pdf', async (c) => {
  const limited = await rateLimit('reports:export-pdf', { windowMs: 60_000, max: 20 })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const id = requireUUIDParam(c, 'id');
  if (id instanceof Response) return id;

  // Paid customers keep access to their reports even after a subscription lapses
  const denied = await requireAnyPaidPurchase(c, auth);
  if (denied) return denied;

  // Fetch assessment
  let assessment: Assessment | null = null;
  if (!hasDatabase()) {
    assessment = assessmentsById.get(id) ?? null;
  } else {
    assessment = await dbGetAssessmentById(id);
  }

  // Verify assessment exists and belongs to user's organization
  if (!assessment || assessment.organisationId !== auth.organisationId) {
    return jsonError(c, 404, 'NOT_FOUND', 'Assessment not found');
  }

  // Only allow export if assessment is submitted/completed
  if (assessment.status !== 'submitted' && assessment.status !== 'completed') {
    return jsonError(c, 400, 'INVALID_STATUS', 'Assessment must be submitted or completed to export');
  }

  try {
    // The report names the organisation, not its id
    const org = hasDatabase() ? await dbGetOrganisationById(auth.organisationId) : organisationsById.get(auth.organisationId);
    const pdfBuffer = await generateAssessmentPdf({
      title: assessment.title ?? 'Fraud Risk Assessment',
      assessment,
      organizationName: org?.name ?? 'Your organisation',
    });

    // Set response headers
    c.header('Content-Type', 'application/pdf');
    c.header('Content-Disposition', `attachment; filename="assessment-${assessment.id}.pdf"`);
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate');

    // Audit log
    await auditLog({
      eventType: 'assessment.exported_pdf',
      actorId: auth.userId,
      actorEmail: auth.email,
      organisationId: auth.organisationId,
      resourceType: 'assessment',
      resourceId: assessment.id,
      details: { filename: `assessment-${assessment.id}.pdf` },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });

    return c.body(new Uint8Array(pdfBuffer), 200, { 'Content-Type': 'application/pdf' });
  } catch (error) {
    logger.error('PDF export failed', {
      assessmentId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonError(c, 500, 'PDF_GENERATION_FAILED', 'Failed to generate PDF');
  }
});

/**
 * POST /webhooks/assessment-submitted
 * Webhook endpoint for assessment submission events
 * Can be triggered by n8n or other automation systems.
 *
 * Callers must sign the raw body with INBOUND_WEBHOOK_SECRET and send it as
 * `X-StopFRA-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>">`
 * (the same format as our outgoing webhooks). Without the secret the endpoint is off.
 */
reportsExports.post('/webhooks/assessment-submitted', async (c) => {
  const limited = await rateLimit('webhooks:assessment-submitted', { windowMs: RATE_LIMITS.WEBHOOK_WINDOW_MS ?? 60_000, max: RATE_LIMITS.WEBHOOK_MAX ?? 100 })(c);
  if (limited instanceof Response) return limited;

  const secret = process.env.INBOUND_WEBHOOK_SECRET;
  if (!secret) return jsonError(c, 404, 'NOT_FOUND', 'Not found');

  const rawBody = await c.req.text();
  if (!verifySignedPayload(secret, rawBody, c.req.header('x-stopfra-signature'))) {
    return jsonError(c, 401, 'SIGNATURE_INVALID', 'Missing or invalid webhook signature');
  }

  try {
    const body = JSON.parse(rawBody);

    // Validate webhook payload
    if (!body.assessmentId || !body.organisationId) {
      return jsonError(c, 400, 'INVALID_PAYLOAD', 'Missing required fields: assessmentId, organisationId');
    }

    // Log webhook receipt
    logger.info('Assessment submitted webhook received', {
      assessmentId: body.assessmentId,
      organisationId: body.organisationId,
      source: body.source ?? 'unknown',
    });

    // Fetch assessment to verify it exists
    let assessment: Assessment | null = null;
    if (!hasDatabase()) {
      assessment = assessmentsById.get(body.assessmentId) ?? null;
    } else {
      assessment = await dbGetAssessmentById(body.assessmentId);
    }

    if (!assessment) {
      return jsonError(c, 404, 'NOT_FOUND', 'Assessment not found');
    }

    // Verify organization matches
    if (assessment.organisationId !== body.organisationId) {
      return jsonError(c, 403, 'FORBIDDEN', 'Organisation mismatch');
    }

    // Audit the webhook receipt
    await auditLog({
      eventType: 'webhook.assessment_submitted',
      actorEmail: 'webhook@system',
      organisationId: body.organisationId,
      resourceType: 'assessment',
      resourceId: body.assessmentId,
      details: {
        source: body.source ?? 'unknown',
        timestamp: body.timestamp ?? new Date().toISOString(),
      },
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });

    // Return success — actual processing can be async via job queue if needed
    return c.json(
      {
        success: true,
        data: {
          webhookId: `wh_${Date.now()}`,
          assessmentId: body.assessmentId,
          status: 'received',
          processedAt: new Date().toISOString(),
        },
      },
      200
    );
  } catch (error) {
    logger.error('Webhook processing error', {
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonError(c, 400, 'WEBHOOK_ERROR', 'Failed to process webhook');
  }
});

/**
 * GET /webhooks/test
 * Test endpoint to verify webhook connectivity
 */
reportsExports.get('/webhooks/test', async (c) => {
  return c.json(
    {
      success: true,
      message: 'Webhook endpoint is operational',
      timestamp: new Date().toISOString(),
    },
    200
  );
});

export default reportsExports;
