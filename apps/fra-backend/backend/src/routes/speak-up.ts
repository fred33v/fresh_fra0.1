// ============================================================
// Public speak-up routes — no sign-in. Mounted at /api/v1/speak-up.
// Reporter IP addresses and user agents are never stored or logged
// here (the request log redacts these paths), and a wrong reference
// and a wrong access key get the same answer.
// ============================================================

import crypto from 'node:crypto';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { hasDatabase, hasPackageEntitlement, jsonError } from '../helpers.js';
import { organisationsById } from '../stores.js';
import { auditLog, dbGetOrganisationById } from '../db/index.js';
import { listOrgPurchases } from '../entitlements.js';
import { rateLimit } from '../middleware.js';
import {
  REPORT_CATEGORIES, REPORTER_RELATIONSHIPS, accessKeyMatches, buildReport, caseAccessSchema, messageBodySchema,
  reportSubmissionSchema, reporterView, type SpeakUpIntake, type SpeakUpReport,
} from '../speak-up.js';
import { addMessage, getIntakeByToken, getReportByReference, insertReport, listMessages } from '../speak-up-store.js';

const speakUp = new Hono();

const HOUR = 60 * 60 * 1000;

/** The intake behind a link, only while it is switched on and the organisation holds Enterprise. */
async function openIntake(token: string): Promise<SpeakUpIntake | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const intake = await getIntakeByToken(token);
  if (!intake?.enabled) return null;
  return hasPackageEntitlement(await listOrgPurchases(intake.organisationId), 'pkg_full') ? intake : null;
}

async function organisationName(orgId: string): Promise<string> {
  const org = hasDatabase() ? await dbGetOrganisationById(orgId) : organisationsById.get(orgId);
  return org?.name ?? 'this organisation';
}

const notFound = (c: Context) => jsonError(c, 404, 'NOT_FOUND', 'This reporting link is not available');
const unknownCase = (c: Context) => jsonError(c, 404, 'CASE_NOT_FOUND', 'Case reference or access key not recognised');

/** Resolves a reporter's case from its reference and access key. */
async function reporterCase(c: Context, body: unknown): Promise<SpeakUpReport | Response> {
  const parsed = caseAccessSchema.safeParse(body);
  if (!parsed.success) return unknownCase(c);
  const report = await getReportByReference(parsed.data.reference);
  // Hash the key even when the reference is unknown, so timing does not reveal which part was wrong
  const matches = accessKeyMatches(parsed.data.accessKey, report?.accessKeyHash ?? '0'.repeat(64));
  return report && matches ? report : unknownCase(c);
}

// ── GET /:token — what the reporting page needs to show ─────────
speakUp.get('/:token', async (c) => {
  const intake = await openIntake(c.req.param('token'));
  if (!intake) return notFound(c);
  return c.json({
    success: true,
    data: {
      organisationName: await organisationName(intake.organisationId),
      intro: intake.intro ?? null,
      categories: REPORT_CATEGORIES,
      relationships: REPORTER_RELATIONSHIPS,
    },
  });
});

// ── POST /:token/reports — make a report ────────────────────────
speakUp.post('/:token/reports', async (c) => {
  const limited = await rateLimit('speak-up:report', { windowMs: HOUR, max: 5 })(c);
  if (limited instanceof Response) return limited;

  const intake = await openIntake(c.req.param('token'));
  if (!intake) return notFound(c);

  const parsed = reportSubmissionSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return jsonError(c, 400, 'VALIDATION_ERROR', issue ? `${issue.path.join('.') || 'report'}: ${issue.message}` : 'Invalid report');
  }
  if (!parsed.data.anonymous && !parsed.data.email && !parsed.data.phone) {
    return jsonError(c, 400, 'VALIDATION_ERROR', 'Give an email or phone number, or report anonymously');
  }

  const { report, accessKey } = buildReport(intake.organisationId, parsed.data);
  await insertReport(report);

  // No actor, IP address or user agent: the audit trail records only that a report arrived
  await auditLog({
    eventType: 'speak_up.report_received', organisationId: intake.organisationId,
    resourceType: 'speak_up_report', resourceId: report.id,
    details: { reference: report.reference, category: report.category, anonymous: report.anonymous },
  });

  return c.json({
    success: true,
    data: {
      reference: report.reference,
      accessKey,
      message: 'Keep your case reference and access key safe. They are the only way to follow your report, and the access key cannot be shown again.',
    },
  }, 201);
});

// ── POST /status — the reporter checks their case ───────────────
// POST, not GET, so the access key never appears in a URL or a log
speakUp.post('/status', async (c) => {
  const limited = await rateLimit('speak-up:status', { windowMs: 15 * 60 * 1000, max: 30 })(c);
  if (limited instanceof Response) return limited;

  const report = await reporterCase(c, await c.req.json().catch(() => null));
  if (report instanceof Response) return report;
  return c.json({ success: true, data: reporterView(report, await listMessages(report.id)) });
});

// ── POST /messages — the reporter adds information ──────────────
speakUp.post('/messages', async (c) => {
  const limited = await rateLimit('speak-up:message', { windowMs: 15 * 60 * 1000, max: 20 })(c);
  if (limited instanceof Response) return limited;

  const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  const { message, ...access } = body ?? {};
  const report = await reporterCase(c, access);
  if (report instanceof Response) return report;
  if (report.status === 'closed') return jsonError(c, 409, 'CASE_CLOSED', 'This case is closed');

  const text = messageBodySchema.safeParse(message);
  if (!text.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Write a message of up to 5,000 characters');

  await addMessage({ id: crypto.randomUUID(), reportId: report.id, author: 'reporter', body: text.data, createdAt: new Date().toISOString() });
  await auditLog({
    eventType: 'speak_up.reporter_message', organisationId: report.organisationId,
    resourceType: 'speak_up_report', resourceId: report.id,
  });
  return c.json({ success: true, data: reporterView(report, await listMessages(report.id)) }, 201);
});

export default speakUp;
