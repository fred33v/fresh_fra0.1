import { z } from 'zod';
// ============================================================
// Certificate routes
//   GET /certificates/verify/:number   public: is this certificate genuine, and what does it certify
//   GET /certificates/:number/pdf      the certificate as a PDF (holder, or the organisation's employer/admin)
//   GET /assessments/:id/certificate   the certificate of a submitted assessment
// ============================================================

import { Hono } from 'hono';
import { hasDatabase, jsonError, requireAuth } from '../helpers.js';
import { requireUUIDParam } from '../types.js';
import { rateLimit, getClientIp } from '../middleware.js';
import { assessmentsById } from '../stores.js';
import { auditLog, dbGetAssessmentById } from '../db/index.js';
import { createLogger } from '../logger.js';
import {
  canDownload, certificatePdf, findCertificate, issueAssessmentCertificate, normaliseCertificateNumber,
  publicDetails, revokeCertificate, verifyUrl,
} from '../certificates.js';

const logger = createLogger('certificates');
const certificatesRoutes = new Hono();

certificatesRoutes.get('/certificates/verify/:number', async (c) => {
  // Public, so limited per address: numbers have 48 random bits, and this stops anyone trying them in bulk
  const limited = await rateLimit('certificates:verify', { windowMs: 60_000, max: 30 })(c);
  if (limited instanceof Response) return limited;

  c.header('Cache-Control', 'no-store');
  const number = normaliseCertificateNumber(c.req.param('number'));
  if (!number) return jsonError(c, 400, 'INVALID_NUMBER', 'That is not a certificate number');

  const record = await findCertificate(number);
  if (!record) return jsonError(c, 404, 'NOT_FOUND', 'No certificate has this number');

  c.header('Cache-Control', 'no-store');
  return c.json({ success: true, data: { valid: record.status === 'valid', status: record.status, ...publicDetails(record), verifyUrl: verifyUrl(record.certificateNumber) } });
});

certificatesRoutes.get('/certificates/:number/pdf', async (c) => {
  const limited = await rateLimit('certificates:pdf', { windowMs: 60_000, max: 10 })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const number = normaliseCertificateNumber(c.req.param('number'));
  if (!number) return jsonError(c, 400, 'INVALID_NUMBER', 'That is not a certificate number');

  const record = await findCertificate(number);
  // Someone else's certificate looks the same as no certificate
  if (!record || !canDownload(record, auth)) return jsonError(c, 404, 'NOT_FOUND', 'Certificate not found');

  if (record.status === 'revoked') return jsonError(c, 409, 'CERTIFICATE_REVOKED', 'This certificate has been revoked');

  try {
    const pdf = await certificatePdf(publicDetails(record));
    await auditLog({
      eventType: 'certificate.downloaded', actorId: auth.userId, actorEmail: auth.email,
      organisationId: auth.organisationId, resourceType: 'certificate', resourceId: record.certificateNumber,
      details: { kind: record.kind }, ipAddress: getClientIp(c), userAgent: c.req.header('user-agent'),
    });
    return c.body(new Uint8Array(pdf), 200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="certificate-${record.certificateNumber}.pdf"`,
      'Cache-Control': 'no-store',
    });
  } catch (error) {
    logger.error('Certificate PDF failed', { error: error instanceof Error ? error.message : String(error) });
    return jsonError(c, 500, 'PDF_GENERATION_FAILED', 'The certificate PDF could not be made just now');
  }
});

certificatesRoutes.get('/assessments/:id/certificate', async (c) => {
  const limited = await rateLimit('certificates:assessment', { windowMs: 60_000, max: 30 })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const id = requireUUIDParam(c, 'id');
  if (id instanceof Response) return id;

  const assessment = hasDatabase() ? await dbGetAssessmentById(id) : assessmentsById.get(id);
  if (!assessment || assessment.organisationId !== auth.organisationId) {
    return jsonError(c, 404, 'NOT_FOUND', 'Assessment not found');
  }
  if (assessment.createdByUserId !== auth.userId && auth.role !== 'employer' && auth.role !== 'admin') {
    return jsonError(c, 404, 'NOT_FOUND', 'Assessment not found');
  }
  if (assessment.status !== 'submitted' && assessment.status !== 'completed') {
    return jsonError(c, 409, 'NOT_SUBMITTED', 'The certificate is issued once the assessment has been submitted');
  }

  // Normally issued on submission; issuing here as well covers a submission whose issue failed
  const row = await issueAssessmentCertificate(assessment);
  const record = await findCertificate(row.certificate_number);
  if (!record) return jsonError(c, 500, 'CERTIFICATE_UNAVAILABLE', 'Certificate is temporarily unavailable');
  return c.json({ success: true, data: {
    ...publicDetails(record), status: record.status, assessmentId: assessment.id,
    verifyUrl: verifyUrl(row.certificate_number),
  } });
});

// Admins act only within their own organisation. Private reasons stay in the audit.
certificatesRoutes.post('/certificates/:number/revoke', async (c) => {
  c.header('Cache-Control', 'no-store');
  const limited = await rateLimit('certificates:revoke', { windowMs: 60_000, max: 20 })(c);
  if (limited instanceof Response) return limited;
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (auth.role !== 'admin') return jsonError(c, 403, 'FORBIDDEN', 'Requires admin role');
  const number = normaliseCertificateNumber(c.req.param('number'));
  if (!number) return jsonError(c, 400, 'INVALID_NUMBER', 'That is not a certificate number');
  const parsed = z.object({ reason: z.string().trim().min(1).max(1000) }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Enter a reason of 1 to 1000 characters');
  const result = await revokeCertificate(number, auth, parsed.data.reason, {
    ipAddress: getClientIp(c), userAgent: c.req.header('user-agent'),
  });
  if (!result) return jsonError(c, 404, 'NOT_FOUND', 'Certificate not found');
  return c.json({ success: true, data: { certificateNumber: number, status: 'revoked',
    revokedAt: result.record.revokedAt, changed: result.changed } });
});

export default certificatesRoutes;
