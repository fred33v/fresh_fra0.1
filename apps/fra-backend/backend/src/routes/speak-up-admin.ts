// ============================================================
// Speak-up case handling for the organisation — mounted inside the
// compliance router at /api/v1/compliance/speak-up, so the Enterprise
// package and employer/admin role checks already apply.
// Every view of a case is recorded in the audit trail.
// ============================================================

import crypto from 'node:crypto';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { hasDatabase, jsonError, requireAuth } from '../helpers.js';
import type { AuthContext } from '../helpers.js';
import { incidentsById, usersByEmail } from '../stores.js';
import { auditLog, dbListUsersByOrganisation } from '../db/index.js';
import { dbInsertIncident } from '../db/compliance.js';
import { csvResponse, wantsCsv } from '../csv.js';
import { getClientIp } from '../middleware.js';
import { INCIDENT_SEVERITIES, requireUUIDParam, type ComplianceIncident } from '../types.js';
import {
  REPORT_STATUSES, TRIAGE_DAYS, caseUpdateSchema, handlerView, intakeSettingsSchema, messageBodySchema, newIntakeToken,
  type SpeakUpReport,
} from '../speak-up.js';
import { addMessage, getIntakeByOrg, getReport, listMessages, listReports, saveIntake, updateReport } from '../speak-up-store.js';

const admin = new Hono();

const authOf = (c: Context) => requireAuth(c) as AuthContext; // the compliance middleware has checked it

async function log(c: Context, auth: AuthContext, action: string, resourceId?: string, details: Record<string, unknown> = {}) {
  await auditLog({
    eventType: `speak_up.${action}`, actorId: auth.userId, actorEmail: auth.email, organisationId: auth.organisationId,
    resourceType: 'speak_up_report', resourceId, details, ipAddress: getClientIp(c), userAgent: c.req.header('user-agent'),
  });
}

async function staffNames(orgId: string): Promise<Map<string, string>> {
  const users = hasDatabase()
    ? await dbListUsersByOrganisation(orgId)
    : Array.from(usersByEmail.values()).filter((u) => u.organisationId === orgId);
  return new Map(users.map((u) => [u.id, u.name]));
}

const DAY_MS = 24 * 60 * 60 * 1000;
const overdueForTriage = (r: SpeakUpReport, now = Date.now()) =>
  r.status === 'new' && now - new Date(r.receivedAt).getTime() > TRIAGE_DAYS * DAY_MS;

// ── Intake link ─────────────────────────────────────────────────

admin.get('/intake', async (c) => {
  const auth = authOf(c);
  const intake = await getIntakeByOrg(auth.organisationId);
  return c.json({ success: true, data: intake ? { enabled: intake.enabled, token: intake.token, intro: intake.intro ?? null } : { enabled: false, token: null, intro: null } });
});

admin.put('/intake', async (c) => {
  const auth = authOf(c);
  const parsed = intakeSettingsSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Send enabled, and optionally intro and regenerateLink');

  const existing = await getIntakeByOrg(auth.organisationId);
  const now = new Date().toISOString();
  const intake = {
    organisationId: auth.organisationId,
    // A new link stops the old one working at once, e.g. after it was shared too widely
    token: !existing || parsed.data.regenerateLink ? newIntakeToken() : existing.token,
    enabled: parsed.data.enabled,
    intro: parsed.data.intro !== undefined ? parsed.data.intro || undefined : existing?.intro,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  await saveIntake(intake);
  await log(c, auth, 'intake_updated', undefined, { enabled: intake.enabled, linkRegenerated: !!existing && !!parsed.data.regenerateLink });
  return c.json({ success: true, data: { enabled: intake.enabled, token: intake.token, intro: intake.intro ?? null } });
});

// ── Case log ────────────────────────────────────────────────────

admin.get('/reports', async (c) => {
  const auth = authOf(c);
  const status = c.req.query('status');
  if (status && !(REPORT_STATUSES as readonly string[]).includes(status)) {
    return jsonError(c, 400, 'INVALID_PARAM', `status must be one of ${REPORT_STATUSES.join(', ')}`);
  }
  const all = await listReports(auth.organisationId);
  const reports = status ? all.filter((r) => r.status === status) : all;
  const names = await staffNames(auth.organisationId);

  await log(c, auth, 'case_log_accessed', undefined, { format: wantsCsv(c) ? 'csv' : 'json' });
  if (wantsCsv(c)) {
    // The case log for auditors: no report text and no reporter identity
    return csvResponse(c, 'speak-up-case-log.csv', reports.map((r) => ({
      reference: r.reference, category: r.category, relationship: r.relationship, anonymous: r.anonymous, status: r.status,
      receivedAt: r.receivedAt, acknowledgedAt: r.acknowledgedAt ?? '', closedAt: r.closedAt ?? '',
      assignedTo: r.assignedUserId ? names.get(r.assignedUserId) ?? '' : '', referral: r.referral ?? '', incidentId: r.incidentId ?? '',
    })));
  }
  return c.json({
    success: true,
    data: reports.map((r) => ({ ...handlerView(r), assignedUserName: r.assignedUserId ? names.get(r.assignedUserId) : undefined, overdueForTriage: overdueForTriage(r) })),
    summary: {
      total: all.length,
      open: all.filter((r) => r.status !== 'closed').length,
      overdueForTriage: all.filter((r) => overdueForTriage(r)).length,
    },
  });
});

async function caseOr404(c: Context, auth: AuthContext): Promise<SpeakUpReport | Response> {
  const id = requireUUIDParam(c, 'id');
  if (id instanceof Response) return id;
  return (await getReport(id, auth.organisationId)) ?? jsonError(c, 404, 'NOT_FOUND', 'Case not found');
}

async function caseDetail(r: SpeakUpReport, orgId: string) {
  const names = await staffNames(orgId);
  return {
    ...handlerView(r),
    assignedUserName: r.assignedUserId ? names.get(r.assignedUserId) : undefined,
    overdueForTriage: overdueForTriage(r),
    messages: (await listMessages(r.id)).map((m) => ({
      id: m.id, author: m.author, authorName: m.authorUserId ? names.get(m.authorUserId) : undefined, body: m.body, createdAt: m.createdAt,
    })),
  };
}

admin.get('/reports/:id', async (c) => {
  const auth = authOf(c);
  const report = await caseOr404(c, auth);
  if (report instanceof Response) return report;
  await log(c, auth, 'case_viewed', report.id, { reference: report.reference });
  return c.json({ success: true, data: await caseDetail(report, auth.organisationId) });
});

admin.patch('/reports/:id', async (c) => {
  const auth = authOf(c);
  const report = await caseOr404(c, auth);
  if (report instanceof Response) return report;
  const parsed = caseUpdateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Invalid case update');

  const change = parsed.data;
  if (change.assignedUserId && !(await staffNames(auth.organisationId)).has(change.assignedUserId)) {
    return jsonError(c, 400, 'INVALID_USER', 'Assign the case to someone in your organisation');
  }

  const now = new Date().toISOString();
  const status = change.status ?? report.status;
  const updated: SpeakUpReport = {
    ...report,
    status,
    assignedUserId: change.assignedUserId === undefined ? report.assignedUserId : change.assignedUserId ?? undefined,
    referral: change.referral === undefined ? report.referral : change.referral ?? undefined,
    referralNotes: change.referralNotes === undefined ? report.referralNotes : change.referralNotes || undefined,
    outcome: change.outcome === undefined ? report.outcome : change.outcome || undefined,
    // Leaving "new" acknowledges the report; closing stamps it, reopening clears the stamp
    acknowledgedAt: report.acknowledgedAt ?? (status !== 'new' ? now : undefined),
    closedAt: status === 'closed' ? report.closedAt ?? now : undefined,
    updatedAt: now,
  };
  await updateReport(updated);
  await log(c, auth, 'case_updated', report.id, { reference: report.reference, fields: Object.keys(change), status });
  return c.json({ success: true, data: await caseDetail(updated, auth.organisationId) });
});

admin.post('/reports/:id/messages', async (c) => {
  const auth = authOf(c);
  const report = await caseOr404(c, auth);
  if (report instanceof Response) return report;
  const text = messageBodySchema.safeParse(((await c.req.json().catch(() => null)) as { message?: unknown } | null)?.message);
  if (!text.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Write a message of up to 5,000 characters');

  const now = new Date().toISOString();
  await addMessage({ id: crypto.randomUUID(), reportId: report.id, author: 'handler', authorUserId: auth.userId, body: text.data, createdAt: now });
  await log(c, auth, 'handler_message', report.id, { reference: report.reference });
  // Replying to a new report is reviewing it: acknowledge it and move it to triage
  if (report.status === 'new') {
    await updateReport({ ...report, status: 'triage', acknowledgedAt: report.acknowledgedAt ?? now, updatedAt: now });
    await log(c, auth, 'case_updated', report.id, { reference: report.reference, fields: ['status'], status: 'triage', reason: 'handler_reply' });
  }
  const fresh = await getReport(report.id, auth.organisationId);
  return c.json({ success: true, data: await caseDetail(fresh ?? report, auth.organisationId) }, 201);
});

// Turns a case into an incident, so it counts in the incident log and the response plan evidence
admin.post('/reports/:id/incident', async (c) => {
  const auth = authOf(c);
  const report = await caseOr404(c, auth);
  if (report instanceof Response) return report;
  if (report.incidentId) return jsonError(c, 409, 'ALREADY_LINKED', 'This case already has an incident');
  const parsed = z.object({ severity: z.enum(INCIDENT_SEVERITIES) }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Choose the incident severity');

  const incident: ComplianceIncident = {
    id: crypto.randomUUID(), organisationId: auth.organisationId, type: 'fraud_incident', severity: parsed.data.severity,
    description: `Speak-up case ${report.reference} (${report.category.replace(/_/g, ' ')}): ${report.description.slice(0, 1000)}`,
    reportedAt: report.receivedAt,
  };
  if (hasDatabase()) await dbInsertIncident(incident);
  else incidentsById.set(incident.id, incident);

  const updated = { ...report, incidentId: incident.id, updatedAt: new Date().toISOString() };
  await updateReport(updated);
  await log(c, auth, 'incident_created', report.id, { reference: report.reference, incidentId: incident.id });
  return c.json({ success: true, data: await caseDetail(updated, auth.organisationId) }, 201);
});

export default admin;
