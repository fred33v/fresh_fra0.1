// ============================================================
// Enterprise compliance reporting — ECCTA 2023 and GovS 013.
// Every figure is derived from the organisation's own records
// (assessments, risk register, training, incidents, audit trail).
// Mounted at /api/v1/compliance.
// ============================================================

import crypto from 'node:crypto';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { requireAuth, hasPackageEntitlement, hasDatabase, isManagerRole, jsonError } from '../helpers.js';
import type { AuthContext } from '../helpers.js';
import { auditEvents, counterFraudRecordsById, incidentsById, seniorManagersById, usersByEmail } from '../stores.js';
import { csvResponse, wantsCsv } from '../csv.js';
import { auditLog, dbGetUserById } from '../db/index.js';
import {
  dbDeleteSeniorManager, dbInsertIncident, dbInsertSeniorManager, dbListAuditEvents, dbListIncidents,
  dbListSeniorManagers, dbResolveIncident, dbUpdateSeniorManager,
} from '../db/compliance.js';
import {
  dbDeleteCounterFraudRecord, dbGetCounterFraudRecord, dbInsertCounterFraudRecord, dbListCounterFraudRecords, dbUpdateCounterFraudRecord,
} from '../db/counter-fraud.js';
import {
  COUNTER_FRAUD_KINDS, dueDiligenceStatus, isCounterFraudKind, parseRecordData, type CounterFraudKind, type CounterFraudRecord,
  type RecordData,
} from '../counter-fraud.js';
import { listOrgPurchases } from '../entitlements.js';
import speakUpAdmin from './speak-up-admin.js';
import { buildEvidencePack } from '../evidence-pack.js';
import { rateLimit } from '../middleware.js';
import {
  AREA_TO_REGISTER, computeMetrics, employeeRisks, evaluateEccta, evaluateGovS013, loadComplianceData, riskByArea,
} from '../compliance-evidence.js';
import { scoreAssessment } from '../assessment-risk.js';
import { getClientIp } from '../middleware.js';
import {
  INCIDENT_SEVERITIES, INCIDENT_TYPES, SENIOR_ROLES, parsePagination, requireUUIDParam,
  type ComplianceIncident, type SeniorManager,
} from '../types.js';

const compliance = new Hono();

// ── Middleware: Require Enterprise package + employer/admin role ─
compliance.use('/*', async (c, next) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  // Audit trail and full data export are management-only, not for employees
  if (!isManagerRole(auth.role)) {
    return c.json(
      { success: false, error: { code: 'FORBIDDEN', message: 'Compliance reports require employer or admin role' } },
      403
    );
  }

  if (!hasPackageEntitlement(await listOrgPurchases(auth.organisationId), 'pkg_full')) {
    return c.json(
      { success: false, error: { code: 'PACKAGE_REQUIRED', message: 'Enterprise package required' } },
      403
    );
  }
  await next();
});

function authOf(c: Context): AuthContext {
  return requireAuth(c) as AuthContext; // middleware has already verified the token
}

async function logAccess(c: Context, auth: AuthContext, action: string, details: Record<string, unknown> = {}) {
  await auditLog({
    eventType: `compliance.${action}`, actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 'compliance', details,
    ipAddress: getClientIp(c), userAgent: c.req.header('user-agent'),
  });
}

async function userInOrg(userId: string, orgId: string): Promise<{ name: string } | null> {
  const user = hasDatabase()
    ? await dbGetUserById(userId)
    : Array.from(usersByEmail.values()).find((u) => u.id === userId) ?? null;
  return user && user.organisationId === orgId ? { name: user.name } : null;
}

// ── GET /report — board-ready compliance position ───────────────
compliance.get('/report', async (c) => {
  const auth = authOf(c);
  const data = await loadComplianceData(auth.organisationId);
  const metrics = computeMetrics(data);

  await logAccess(c, auth, 'report_generated');
  return c.json({
    success: true,
    data: {
      organisationId: auth.organisationId,
      generatedAt: new Date().toISOString(),
      eccta2023: evaluateEccta(data, metrics),
      govs013: evaluateGovS013(data, metrics),
      metrics,
      incidents: data.incidents.slice(0, 20),
      topRiskAreas: riskByArea(employeeRisks(data)).slice(0, 5),
      disclaimer: 'Self-assessment indicators derived from records held in Stop FRA. They support, but do not replace, legal advice on ECCTA 2023 or a formal GovS 013 assurance review.',
    },
  });
});

// ── GET /risk-assessment — assessment risks rolled up by area and employee ──
compliance.get('/risk-assessment', async (c) => {
  const auth = authOf(c);
  const data = await loadComplianceData(auth.organisationId);
  const employees = employeeRisks(data);
  const residuals = employees.flatMap((e) => e.risk.risks.map((r) => r.residualScore));

  await logAccess(c, auth, 'risk_assessment_accessed');
  return c.json({
    success: true,
    data: {
      totalAssessments: employees.length,
      averageRiskScore: residuals.length ? Math.round((residuals.reduce((s, n) => s + n, 0) / residuals.length) * 10) / 10 : 0,
      levelCounts: computeMetrics(data).riskLevels,
      topRisks: riskByArea(employees).map((a) => ({
        area: a.area, score: a.averageResidual, priority: a.highestPriority, employeesFlagged: a.employeesFlagged, risks: a.titles,
      })),
      employees: employees
        .map((e) => ({ userId: e.userId, name: e.name, department: e.department, level: e.risk.level, counts: e.risk.counts, submittedAt: e.submittedAt }))
        .sort((a, b) => (b.counts.high - a.counts.high) || (b.counts.medium - a.counts.medium)),
      generatedAt: new Date().toISOString(),
    },
  });
});

// ── GET /training — staff training evidence ─────────────────────
compliance.get('/training', async (c) => {
  const auth = authOf(c);
  const data = await loadComplianceData(auth.organisationId);
  const records = new Map(data.training.map((t) => [t.userId, t]));
  const staff = data.users.map((u) => {
    const t = records.get(u.id);
    return {
      userId: u.id, name: u.name, email: u.email, department: u.department ?? null,
      completedAt: t?.completedAt ?? null, certificateNumber: t?.certificateNumber ?? null,
      trained: !!(t?.completedAt || t?.certificateNumber),
    };
  });
  const completedTraining = staff.filter((s) => s.trained).length;

  await logAccess(c, auth, 'training_accessed');
  if (wantsCsv(c)) return csvResponse(c, 'training-evidence.csv', staff);
  return c.json({
    success: true,
    data: {
      totalUsers: staff.length,
      completedTraining,
      completionRate: staff.length ? Math.round((completedTraining / staff.length) * 100) : 0,
      staff,
      generatedAt: new Date().toISOString(),
    },
  });
});

// ── Incidents ───────────────────────────────────────────────────

async function listIncidents(orgId: string): Promise<ComplianceIncident[]> {
  return hasDatabase()
    ? dbListIncidents(orgId)
    : Array.from(incidentsById.values()).filter((i) => i.organisationId === orgId)
      .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt));
}

compliance.get('/incidents', async (c) => {
  const auth = authOf(c);
  const incidents = await listIncidents(auth.organisationId);
  await logAccess(c, auth, 'incidents_accessed');
  if (wantsCsv(c)) return csvResponse(c, 'incidents.csv', incidents);
  return c.json({
    success: true,
    data: incidents,
    summary: {
      total: incidents.length,
      open: incidents.filter((i) => !i.resolvedAt).length,
      openSerious: incidents.filter((i) => !i.resolvedAt && (i.severity === 'high' || i.severity === 'critical')).length,
    },
  });
});

const incidentSchema = z.object({
  type: z.enum(INCIDENT_TYPES),
  description: z.string().min(1).max(5000),
  severity: z.enum(INCIDENT_SEVERITIES),
  reportedAt: z.string().datetime().optional(),
});

compliance.post('/incidents', async (c) => {
  const auth = authOf(c);
  const parsed = incidentSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid incident');

  const incident: ComplianceIncident = {
    id: crypto.randomUUID(), organisationId: auth.organisationId,
    type: parsed.data.type, description: parsed.data.description, severity: parsed.data.severity,
    reportedAt: parsed.data.reportedAt ?? new Date().toISOString(),
  };
  if (hasDatabase()) await dbInsertIncident(incident);
  else incidentsById.set(incident.id, incident);

  await logAccess(c, auth, 'incident_recorded', { incidentId: incident.id, severity: incident.severity, type: incident.type });
  return c.json({ success: true, data: incident }, 201);
});

compliance.patch('/incidents/:id', async (c) => {
  const auth = authOf(c);
  const id = requireUUIDParam(c, 'id');
  if (id instanceof Response) return id;
  const parsed = z.object({ resolved: z.boolean(), resolutionNotes: z.string().max(5000).optional() })
    .safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Provide resolved (true/false) and optional resolutionNotes');

  const resolvedAt = parsed.data.resolved ? new Date().toISOString() : null;
  let incident: ComplianceIncident | null;
  if (hasDatabase()) {
    incident = await dbResolveIncident(id, auth.organisationId, resolvedAt, parsed.data.resolutionNotes ?? null);
  } else {
    const existing = incidentsById.get(id);
    incident = existing && existing.organisationId === auth.organisationId
      ? Object.assign(existing, { resolvedAt: resolvedAt ?? undefined, resolutionNotes: parsed.data.resolutionNotes })
      : null;
  }
  if (!incident) return jsonError(c, 404, 'NOT_FOUND', 'Incident not found');

  await logAccess(c, auth, parsed.data.resolved ? 'incident_resolved' : 'incident_reopened', { incidentId: id });
  return c.json({ success: true, data: incident });
});

// ── Senior management accountability ────────────────────────────

async function listSenior(orgId: string): Promise<SeniorManager[]> {
  if (hasDatabase()) return dbListSeniorManagers(orgId);
  const names = new Map(Array.from(usersByEmail.values()).map((u) => [u.id, u.name]));
  return Array.from(seniorManagersById.values())
    .filter((m) => m.organisationId === orgId)
    .map((m) => ({ ...m, userName: names.get(m.userId) }));
}

compliance.get('/senior-management', async (c) => {
  const auth = authOf(c);
  const managers = await listSenior(auth.organisationId);
  const yearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
  await logAccess(c, auth, 'senior_management_accessed');
  return c.json({
    success: true,
    data: managers,
    summary: {
      total: managers.length,
      reviewedInLastYear: managers.filter((m) => m.lastReviewed && new Date(m.lastReviewed).getTime() >= yearAgo).length,
    },
  });
});

const seniorSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(SENIOR_ROLES),
  complianceScore: z.number().int().min(0).max(100).optional(),
  lastReviewed: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
  reviewNotes: z.string().max(5000).optional(),
});

compliance.post('/senior-management', async (c) => {
  const auth = authOf(c);
  const parsed = seniorSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid senior manager record');

  const user = await userInOrg(parsed.data.userId, auth.organisationId);
  if (!user) return jsonError(c, 400, 'INVALID_USER', 'User must be a member of your organisation');

  const record: SeniorManager = {
    id: crypto.randomUUID(), organisationId: auth.organisationId, ...parsed.data,
    lastReviewed: parsed.data.lastReviewed ? new Date(parsed.data.lastReviewed).toISOString() : undefined,
  };
  if (hasDatabase()) await dbInsertSeniorManager(record);
  else seniorManagersById.set(record.id, record);

  await logAccess(c, auth, 'senior_manager_added', { recordId: record.id, role: record.role });
  return c.json({ success: true, data: { ...record, userName: user.name } }, 201);
});

compliance.patch('/senior-management/:id', async (c) => {
  const auth = authOf(c);
  const id = requireUUIDParam(c, 'id');
  if (id instanceof Response) return id;
  const parsed = seniorSchema.omit({ userId: true }).partial().safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid senior manager update');

  const existing = (await listSenior(auth.organisationId)).find((m) => m.id === id);
  if (!existing) return jsonError(c, 404, 'NOT_FOUND', 'Record not found');

  const updated: SeniorManager = {
    ...existing,
    ...Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined)),
    lastReviewed: parsed.data.lastReviewed ? new Date(parsed.data.lastReviewed).toISOString() : existing.lastReviewed,
  } as SeniorManager;
  if (hasDatabase()) await dbUpdateSeniorManager(updated);
  else seniorManagersById.set(id, updated);

  await logAccess(c, auth, 'senior_manager_reviewed', { recordId: id });
  return c.json({ success: true, data: updated });
});

compliance.delete('/senior-management/:id', async (c) => {
  const auth = authOf(c);
  const id = requireUUIDParam(c, 'id');
  if (id instanceof Response) return id;

  let deleted = 0;
  if (hasDatabase()) {
    deleted = await dbDeleteSeniorManager(id, auth.organisationId);
  } else if (seniorManagersById.get(id)?.organisationId === auth.organisationId) {
    seniorManagersById.delete(id);
    deleted = 1;
  }
  if (!deleted) return jsonError(c, 404, 'NOT_FOUND', 'Record not found');
  await logAccess(c, auth, 'senior_manager_removed', { recordId: id });
  return c.json({ success: true, data: { id, deleted: true } });
});

// ── Counter-fraud records (GovS 013 components 2, 8, 9, 10, 12) ─
// Strategy, identified losses, investigator access, detection activity,
// gifts and hospitality, conflicts of interest and the related policies.

async function listRecords(orgId: string, kind?: CounterFraudKind): Promise<CounterFraudRecord[]> {
  if (hasDatabase()) return dbListCounterFraudRecords(orgId, kind);
  return Array.from(counterFraudRecordsById.values())
    .filter((r) => r.organisationId === orgId && (!kind || r.kind === kind))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function getRecord(id: string, orgId: string): Promise<CounterFraudRecord | null> {
  if (hasDatabase()) return dbGetCounterFraudRecord(id, orgId);
  const r = counterFraudRecordsById.get(id);
  return r && r.organisationId === orgId ? r : null;
}

/** Associated persons carry their due-diligence status, worked out here so every client agrees. */
function withDerived(r: CounterFraudRecord) {
  return r.kind === 'associated_person'
    ? { ...r, derived: { dueDiligence: dueDiligenceStatus(r.data as RecordData<'associated_person'>) } }
    : r;
}

/** A loss may point at an incident; it must be one of this organisation's. */
async function incidentBelongsToOrg(incidentId: string | undefined, orgId: string): Promise<boolean> {
  if (!incidentId) return true;
  return (await listIncidents(orgId)).some((i) => i.id === incidentId);
}

compliance.get('/records', async (c) => {
  const auth = authOf(c);
  const kind = c.req.query('kind');
  if (kind && !isCounterFraudKind(kind)) {
    return jsonError(c, 400, 'INVALID_PARAM', `kind must be one of ${COUNTER_FRAUD_KINDS.join(', ')}`);
  }
  const records = await listRecords(auth.organisationId, kind as CounterFraudKind | undefined);

  await logAccess(c, auth, 'records_accessed', { kind: kind ?? 'all' });
  if (wantsCsv(c)) {
    if (!kind) return jsonError(c, 400, 'INVALID_PARAM', 'Choose a kind to download as CSV');
    // One column per field, so the register opens cleanly in a spreadsheet
    return csvResponse(c, `${kind.replace(/_/g, '-')}-register.csv`,
      records.map((r) => ({ id: r.id, ...r.data, createdAt: r.createdAt, updatedAt: r.updatedAt })));
  }
  return c.json({ success: true, data: records.map(withDerived) });
});

compliance.post('/records', async (c) => {
  const auth = authOf(c);
  const body = (await c.req.json().catch(() => null)) as { kind?: unknown; data?: unknown } | null;
  if (!body || typeof body.kind !== 'string' || !isCounterFraudKind(body.kind)) {
    return jsonError(c, 400, 'VALIDATION_ERROR', `kind must be one of ${COUNTER_FRAUD_KINDS.join(', ')}`);
  }
  const parsed = parseRecordData(body.kind, body.data);
  if (!parsed.ok) return jsonError(c, 400, 'VALIDATION_ERROR', parsed.message);
  if (body.kind === 'loss' && !(await incidentBelongsToOrg((parsed.data as { incidentId?: string }).incidentId, auth.organisationId))) {
    return jsonError(c, 400, 'INVALID_INCIDENT', 'The linked incident is not one of your organisation\'s');
  }

  const now = new Date().toISOString();
  const record: CounterFraudRecord = {
    id: crypto.randomUUID(), organisationId: auth.organisationId, kind: body.kind, data: parsed.data,
    createdByUserId: auth.userId, createdAt: now, updatedAt: now,
  };
  if (hasDatabase()) await dbInsertCounterFraudRecord(record);
  else counterFraudRecordsById.set(record.id, record);

  await logAccess(c, auth, 'record_added', { recordId: record.id, kind: record.kind });
  return c.json({ success: true, data: withDerived(record) }, 201);
});

// Changes merge into the record's fields; the result is validated as a whole
compliance.patch('/records/:id', async (c) => {
  const auth = authOf(c);
  const id = requireUUIDParam(c, 'id');
  if (id instanceof Response) return id;
  const body = (await c.req.json().catch(() => null)) as { data?: unknown } | null;
  if (!body || typeof body.data !== 'object' || body.data === null || Array.isArray(body.data)) {
    return jsonError(c, 400, 'VALIDATION_ERROR', 'Send the fields to change as data');
  }

  const existing = await getRecord(id, auth.organisationId);
  if (!existing) return jsonError(c, 404, 'NOT_FOUND', 'Record not found');
  const parsed = parseRecordData(existing.kind, { ...existing.data, ...body.data });
  if (!parsed.ok) return jsonError(c, 400, 'VALIDATION_ERROR', parsed.message);
  if (existing.kind === 'loss' && !(await incidentBelongsToOrg((parsed.data as { incidentId?: string }).incidentId, auth.organisationId))) {
    return jsonError(c, 400, 'INVALID_INCIDENT', 'The linked incident is not one of your organisation\'s');
  }

  const updated: CounterFraudRecord = { ...existing, data: parsed.data, updatedAt: new Date().toISOString() };
  if (hasDatabase()) await dbUpdateCounterFraudRecord(updated);
  else counterFraudRecordsById.set(id, updated);

  await logAccess(c, auth, 'record_updated', { recordId: id, kind: existing.kind, fields: Object.keys(body.data) });
  return c.json({ success: true, data: withDerived(updated) });
});

compliance.delete('/records/:id', async (c) => {
  const auth = authOf(c);
  const id = requireUUIDParam(c, 'id');
  if (id instanceof Response) return id;
  const existing = await getRecord(id, auth.organisationId);
  if (!existing) return jsonError(c, 404, 'NOT_FOUND', 'Record not found');

  if (hasDatabase()) await dbDeleteCounterFraudRecord(id, auth.organisationId);
  else counterFraudRecordsById.delete(id);

  await logAccess(c, auth, 'record_removed', { recordId: id, kind: existing.kind });
  return c.json({ success: true, data: { id, deleted: true } });
});

// ── Speak-up case handling (GovS 013 component 7) ───────────────
compliance.route('/speak-up', speakUpAdmin);

// ── GET /audit-trail — who did what, when ───────────────────────
compliance.get('/audit-trail', async (c) => {
  const auth = authOf(c);
  const { page, pageSize, offset } = parsePagination(c.req.query());
  const eventType = c.req.query('eventType') || undefined;
  const csv = wantsCsv(c);
  const limit = csv ? 5000 : pageSize;
  const start = csv ? 0 : offset;

  let events;
  let total;
  if (hasDatabase()) {
    ({ events, total } = await dbListAuditEvents(auth.organisationId, limit, start, eventType));
  } else {
    const all = auditEvents
      .filter((e) => e.organisationId === auth.organisationId && (!eventType || e.eventType.startsWith(eventType)))
      .slice()
      .reverse();
    total = all.length;
    events = all.slice(start, start + limit);
  }

  // Logged after the read so the listing does not include its own access event
  await logAccess(c, auth, 'audit_trail_accessed', { format: csv ? 'csv' : 'json' });
  if (csv) {
    return csvResponse(c, 'audit-trail.csv', events, ['createdAt', 'eventType', 'actorEmail', 'resourceType', 'resourceId', 'ipAddress', 'details']);
  }
  return c.json({
    success: true,
    data: events,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
});

// ── GET /export — full data export (GDPR / auditor pack) ────────
// ?format=csv&dataset=<name> returns one dataset as CSV
const EXPORT_DATASETS = [
  'assessments', 'keypasses', 'incidents', 'risk_register', 'training', 'senior_management', ...COUNTER_FRAUD_KINDS,
] as const;
type ExportDataset = (typeof EXPORT_DATASETS)[number];

/** One flat dataset per counter-fraud record kind, a column per field. */
function recordDatasets(records: CounterFraudRecord[]): Record<CounterFraudKind, Record<string, unknown>[]> {
  const out = {} as Record<CounterFraudKind, Record<string, unknown>[]>;
  for (const kind of COUNTER_FRAUD_KINDS) {
    out[kind] = records.filter((r) => r.kind === kind)
      .map((r) => ({ id: r.id, ...(r.data as Record<string, unknown>), createdAt: r.createdAt, updatedAt: r.updatedAt }));
  }
  return out;
}

compliance.get('/export', async (c) => {
  const auth = authOf(c);
  const csvDataset = wantsCsv(c) ? (c.req.query('dataset') ?? 'assessments') : null;
  if (csvDataset && !EXPORT_DATASETS.includes(csvDataset as ExportDataset)) {
    return jsonError(c, 400, 'INVALID_PARAM', `dataset must be one of ${EXPORT_DATASETS.join(', ')}`);
  }

  const data = await loadComplianceData(auth.organisationId);
  const trainingByUser = new Map(data.training.map((t) => [t.userId, t]));
  const datasets: Record<ExportDataset, Record<string, unknown>[]> = {
    // Answers are summarised; the full responses stay in the assessment record
    assessments: data.assessments.map((a) => {
      const { answers, ...rest } = a;
      return { ...rest, answerCount: Object.keys(answers).length, riskLevel: scoreAssessment(a).level };
    }),
    // Unused key-pass codes still grant sign-up, so only the last 4 characters are exported
    keypasses: data.keypasses.map((k) => ({ ...k, code: `****${k.code.slice(-4)}` })),
    incidents: data.incidents,
    risk_register: data.risks,
    training: data.users.map((u) => ({
      userId: u.id, name: u.name, email: u.email,
      completedAt: trainingByUser.get(u.id)?.completedAt ?? null,
      certificateNumber: trainingByUser.get(u.id)?.certificateNumber ?? null,
    })),
    senior_management: data.seniorManagers,
    ...recordDatasets(data.records),
  };

  await logAccess(c, auth, 'compliance_data_exported', { dataset: csvDataset ?? 'all' });
  if (csvDataset) return csvResponse(c, `compliance-${csvDataset}.csv`, datasets[csvDataset as ExportDataset]);
  return c.json({
    success: true,
    data: { organisationId: auth.organisationId, exportedAt: new Date().toISOString(), ...datasets },
  });
});

// ── GET /evidence-pack — ECCTA 2023 evidence pack as one ZIP ────
compliance.get('/evidence-pack', async (c) => {
  const limited = await rateLimit('compliance:evidence-pack', { windowMs: 60_000, max: 5 })(c);
  if (limited instanceof Response) return limited;
  const auth = authOf(c);
  // The PDF summary needs a browser; tests take the HTML summary only
  const pack = await buildEvidencePack(auth.organisationId, auth.email, { includePdf: process.env.NODE_ENV !== 'test' });

  await logAccess(c, auth, 'evidence_pack_exported', { files: pack.files.length, pdf: pack.pdf });
  return c.body(new Uint8Array(pack.zip), 200, {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${pack.filename}"`,
    'Cache-Control': 'no-store',
  });
});

// ── GET /gap-analysis — what is missing, most urgent first ──────
compliance.get('/gap-analysis', async (c) => {
  const auth = authOf(c);
  const data = await loadComplianceData(auth.organisationId);
  const metrics = computeMetrics(data);
  const frameworks = [
    { framework: 'ECCTA 2023', result: evaluateEccta(data, metrics) },
    { framework: 'GovS 013', result: evaluateGovS013(data, metrics) },
  ];

  const requirementGaps = frameworks.flatMap(({ framework, result }) => result.requirements
    .filter((r) => r.status !== 'met')
    .map((r) => ({
      framework, requirementId: r.id, requirement: r.name, status: r.status,
      priority: r.status === 'not_met' ? 'CRITICAL' : 'HIGH',
      evidence: r.evidence, recommendation: r.recommendation ?? '',
    })));

  // Assessed risk areas (medium or high) where the register records no controls
  const areasWithControls = new Set(data.risks.filter((r) => r.controls).map((r) => r.riskArea));
  const areaGaps = riskByArea(employeeRisks(data))
    .filter((a) => a.highestPriority !== 'low' && AREA_TO_REGISTER[a.area] && !areasWithControls.has(AREA_TO_REGISTER[a.area]))
    .map((a) => ({
      framework: 'Risk controls', requirementId: `area-${AREA_TO_REGISTER[a.area]}`, requirement: a.area, status: 'not_met',
      priority: a.highestPriority === 'high' ? 'HIGH' : 'MEDIUM',
      evidence: `${a.employeesFlagged} assessment(s) flag ${a.titles.join(', ').toLowerCase()}; no controls are recorded in the risk register.`,
      recommendation: `Record the controls that address ${a.area.toLowerCase()} risk in the risk register.`,
    }));

  const gaps = [...requirementGaps, ...areaGaps];
  await logAccess(c, auth, 'gap_analysis_performed');
  return c.json({
    success: true,
    data: {
      totalGaps: gaps.length,
      criticalGaps: gaps.filter((g) => g.priority === 'CRITICAL').length,
      highGaps: gaps.filter((g) => g.priority === 'HIGH').length,
      gaps,
      recommendations: gaps.map((g) => g.recommendation).filter(Boolean),
      generatedAt: new Date().toISOString(),
    },
  });
});

export default compliance;
