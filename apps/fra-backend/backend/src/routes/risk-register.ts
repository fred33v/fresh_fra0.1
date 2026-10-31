// ============================================================
// Enterprise risk register — organisation-level fraud risks with
// inherent/residual scoring, owners, action plans and status tracking.
// Scoring follows the project methodology:
//   inherent = impact × likelihood (1–25)
//   residual = round(inherent × (1 − control reduction))
//   priority: HIGH ≥ 15, MEDIUM ≥ 8, LOW < 8
// ============================================================

import crypto from 'node:crypto';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { type AuthContext, hasDatabase, isManagerRole, jsonError, requireAuth } from '../helpers.js';
import { requirePackage } from '../entitlements.js';
import { assessmentsById, riskRegisterById, usersByEmail } from '../stores.js';
import {
  requireUUIDParam, type ControlEffectiveness, type RiskPriority, type RiskRegisterEntry,
} from '../types.js';
import { getClientIp } from '../middleware.js';
import {
  auditLog, dbDeleteRisk, dbListAssessmentsByOrganisation, dbGetRisk, dbGetUserById, dbInsertRisk, dbListRisks, dbListRisksByOwner, dbUpdateRisk,
} from '../db/index.js';
import { getIntakeByOrg } from '../speak-up-store.js';
import { csvResponse, wantsCsv } from '../csv.js';
import { emitOrgEvent } from '../webhooks-out.js';
import { registerSuggestions } from '../assessment-to-register.js';

const CONTROL_REDUCTION: Record<ControlEffectiveness, number> = {
  very_strong: 0.4,
  reasonably_strong: 0.2,
  some_gaps: 0,
  weak: 0,
  none: 0,
};

export function scoreRisk(impact: number, likelihood: number, control: ControlEffectiveness) {
  const inherentScore = impact * likelihood;
  const residualScore = Math.round(inherentScore * (1 - CONTROL_REDUCTION[control]));
  const priority: RiskPriority = residualScore >= 15 ? 'HIGH' : residualScore >= 8 ? 'MEDIUM' : 'LOW';
  return { inherentScore, residualScore, priority };
}

const scale = z.number().int().min(1).max(5);
const controlEnum = z.enum(['very_strong', 'reasonably_strong', 'some_gaps', 'weak', 'none']);
const statusEnum = z.enum(['open', 'in_progress', 'mitigated', 'accepted', 'closed']);

const createSchema = z.object({
  title: z.string().min(1).max(200),
  riskArea: z.string().min(1).max(100),
  description: z.string().max(5000).optional(),
  impact: scale,
  likelihood: scale,
  controlEffectiveness: controlEnum,
  controls: z.string().max(5000).optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
  actionPlan: z.string().max(5000).optional(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: statusEnum.optional(),
});

const patchSchema = createSchema.partial();

const progressSchema = z.object({
  // What the owner can say about their own action; 'done' still needs the employer's review
  status: z.enum(['open', 'in_progress', 'done']),
  note: z.string().trim().max(1000).optional(),
});

const reviewSchema = z.object({ decision: z.enum(['approve', 'reopen']) });

const riskRegister = new Hono();

async function requireRiskAccess(c: Context): Promise<AuthContext | Response> {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (!isManagerRole(auth.role)) return jsonError(c, 403, 'FORBIDDEN', 'Risk register requires employer or admin role');
  const denied = await requirePackage(c, auth, 'pkg_full');
  return denied ?? auth;
}

/** Any signed-in member of an Enterprise organisation: for the actions they own. */
async function requireEnterpriseMember(c: Context): Promise<AuthContext | Response> {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  const denied = await requirePackage(c, auth, 'pkg_full');
  return denied ?? auth;
}

async function saveRisk(entry: RiskRegisterEntry): Promise<void> {
  if (hasDatabase()) await dbUpdateRisk(entry);
  else riskRegisterById.set(entry.id, entry);
}

async function ownerInOrg(userId: string, orgId: string): Promise<boolean> {
  if (hasDatabase()) {
    const user = await dbGetUserById(userId);
    return !!user && user.organisationId === orgId;
  }
  return Array.from(usersByEmail.values()).some((u) => u.id === userId && u.organisationId === orgId);
}

async function listRisks(orgId: string): Promise<RiskRegisterEntry[]> {
  if (hasDatabase()) return dbListRisks(orgId);
  return Array.from(riskRegisterById.values())
    .filter((r) => r.organisationId === orgId)
    .sort((a, b) => b.residualScore - a.residualScore || b.createdAt.localeCompare(a.createdAt));
}

async function getRisk(id: string, orgId: string): Promise<RiskRegisterEntry | null> {
  if (hasDatabase()) return dbGetRisk(id, orgId);
  const r = riskRegisterById.get(id);
  return r && r.organisationId === orgId ? r : null;
}

function notifyRiskChange(entry: RiskRegisterEntry, event: 'risk.created' | 'risk.updated', previousPriority?: RiskPriority) {
  void emitOrgEvent(entry.organisationId, event, { risk: entry });
  if (entry.priority === 'HIGH' && previousPriority !== 'HIGH') {
    void emitOrgEvent(entry.organisationId, 'risk.high_priority', { risk: entry });
  }
}

const CSV_COLUMNS = [
  'id', 'title', 'riskArea', 'impact', 'likelihood', 'inherentScore', 'controlEffectiveness',
  'residualScore', 'priority', 'status', 'ownerUserId', 'dueDate', 'actionPlan', 'controls',
  'description', 'ownerNote', 'ownerUpdatedAt', 'reviewPending', 'createdAt', 'updatedAt',
];

// ── The actions a member owns (Enterprise employees and managers alike) ──

riskRegister.get('/my-actions', async (c) => {
  const auth = await requireEnterpriseMember(c);
  if (auth instanceof Response) return auth;

  const risks = (hasDatabase()
    ? await dbListRisksByOwner(auth.userId, auth.organisationId)
    : Array.from(riskRegisterById.values())
      .filter((r) => r.organisationId === auth.organisationId && r.ownerUserId === auth.userId)
      .sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || b.residualScore - a.residualScore))
    .filter((r) => r.status !== 'closed');

  // Staff need the organisation's reporting route, not only the employer who set it up
  const intake = await getIntakeByOrg(auth.organisationId);

  return c.json({
    success: true,
    data: {
      risks: risks.map((r) => ({
        id: r.id, title: r.title, riskArea: r.riskArea, description: r.description, priority: r.priority,
        actionPlan: r.actionPlan, dueDate: r.dueDate, status: r.status, ownerNote: r.ownerNote,
        ownerUpdatedAt: r.ownerUpdatedAt, reviewPending: !!r.reviewPending,
      })),
      speakUpToken: intake?.enabled ? intake.token : null,
    },
  });
});

riskRegister.post('/my-actions/:id/progress', async (c) => {
  const auth = await requireEnterpriseMember(c);
  if (auth instanceof Response) return auth;
  const id = requireUUIDParam(c, 'id');
  if (id instanceof Response) return id;

  const parsed = progressSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid progress update');

  const existing = await getRisk(id, auth.organisationId);
  // Someone else's risk looks the same as a missing one
  if (!existing || existing.ownerUserId !== auth.userId) return jsonError(c, 404, 'NOT_FOUND', 'Action not found');
  if (existing.status === 'closed' || existing.status === 'accepted') {
    return jsonError(c, 409, 'ACTION_CLOSED', 'This action has been closed by your organisation');
  }

  const now = new Date().toISOString();
  const { status, note } = parsed.data;
  const updated: RiskRegisterEntry = {
    ...existing,
    status: status === 'done' ? 'mitigated' : status,
    reviewPending: status === 'done',
    ownerNote: note === undefined ? existing.ownerNote : (note || undefined),
    ownerUpdatedAt: now,
    updatedAt: now,
  };
  await saveRisk(updated);

  await auditLog({
    eventType: 'risk_register.owner_update', actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 'risk_register', resourceId: id,
    details: { status, note: updated.ownerNote ?? null }, ipAddress: getClientIp(c), userAgent: c.req.header('user-agent'),
  });
  notifyRiskChange(updated, 'risk.updated', existing.priority);

  return c.json({ success: true, data: updated });
});

// The employer confirms an action its owner marked done, or sends it back
riskRegister.post('/risk-register/:id/review', async (c) => {
  const auth = await requireRiskAccess(c);
  if (auth instanceof Response) return auth;
  const id = requireUUIDParam(c, 'id');
  if (id instanceof Response) return id;

  const parsed = reviewSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid review');

  const existing = await getRisk(id, auth.organisationId);
  if (!existing) return jsonError(c, 404, 'NOT_FOUND', 'Risk not found');
  if (!existing.reviewPending) return jsonError(c, 409, 'NOTHING_TO_REVIEW', 'This risk has no update waiting for review');

  const updated: RiskRegisterEntry = {
    ...existing,
    status: parsed.data.decision === 'approve' ? 'mitigated' : 'in_progress',
    reviewPending: false,
    updatedAt: new Date().toISOString(),
  };
  await saveRisk(updated);

  await auditLog({
    eventType: `risk_register.owner_update_${parsed.data.decision === 'approve' ? 'approved' : 'reopened'}`,
    actorId: auth.userId, actorEmail: auth.email, organisationId: auth.organisationId,
    resourceType: 'risk_register', resourceId: id, details: { ownerUserId: existing.ownerUserId ?? null },
    ipAddress: getClientIp(c), userAgent: c.req.header('user-agent'),
  });
  notifyRiskChange(updated, 'risk.updated', existing.priority);

  return c.json({ success: true, data: updated });
});

// ── From the fraud risk assessment ──────────────────────────────

async function suggestionsFor(orgId: string) {
  const [assessments, register] = await Promise.all([
    hasDatabase() ? dbListAssessmentsByOrganisation(orgId) : Promise.resolve([...assessmentsById.values()].filter((a) => a.organisationId === orgId)),
    listRisks(orgId),
  ]);
  return registerSuggestions(assessments, register);
}

/** What the assessments found that is not in the register yet. */
riskRegister.get('/risk-register/from-assessment', async (c) => {
  const auth = await requireRiskAccess(c);
  if (auth instanceof Response) return auth;
  return c.json({ success: true, data: await suggestionsFor(auth.organisationId) });
});

/** Adds them as open risks with no owner, for the employer to review and assign. */
riskRegister.post('/risk-register/from-assessment', async (c) => {
  const auth = await requireRiskAccess(c);
  if (auth instanceof Response) return auth;
  const body = (await c.req.json().catch(() => ({}))) as { titles?: unknown };
  const wanted = Array.isArray(body.titles) ? new Set(body.titles.filter((t): t is string => typeof t === 'string')) : null;
  const picked = (await suggestionsFor(auth.organisationId)).filter((s) => !wanted || wanted.has(s.title));

  const now = new Date().toISOString();
  const created: RiskRegisterEntry[] = [];
  for (const s of picked) {
    const entry: RiskRegisterEntry = {
      id: crypto.randomUUID(), organisationId: auth.organisationId, title: s.title, riskArea: s.riskArea, description: s.description,
      impact: s.impact, likelihood: s.likelihood, controlEffectiveness: s.controlEffectiveness,
      ...scoreRisk(s.impact, s.likelihood, s.controlEffectiveness),
      status: 'open', createdByUserId: auth.userId, createdAt: now, updatedAt: now,
    };
    if (hasDatabase()) await dbInsertRisk(entry);
    else riskRegisterById.set(entry.id, entry);
    notifyRiskChange(entry, 'risk.created');
    created.push(entry);
  }
  await auditLog({
    eventType: 'risk_register.imported_from_assessment', actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 'risk_register', details: { count: created.length, titles: created.map((r) => r.title) },
    ipAddress: getClientIp(c), userAgent: c.req.header('user-agent'),
  });
  return c.json({ success: true, data: created }, 201);
});

riskRegister.get('/risk-register', async (c) => {
  const auth = await requireRiskAccess(c);
  if (auth instanceof Response) return auth;

  let risks = await listRisks(auth.organisationId);
  const priority = c.req.query('priority');
  const status = c.req.query('status');
  if (priority) risks = risks.filter((r) => r.priority === priority.toUpperCase());
  if (status) risks = risks.filter((r) => r.status === status);

  if (wantsCsv(c)) return csvResponse(c, 'risk-register.csv', risks, CSV_COLUMNS);
  return c.json({ success: true, data: risks });
});

// Heat map (impact × likelihood counts) and totals for the dashboard
riskRegister.get('/risk-register/summary', async (c) => {
  const auth = await requireRiskAccess(c);
  if (auth instanceof Response) return auth;

  const risks = (await listRisks(auth.organisationId)).filter((r) => r.status !== 'closed');
  const heatMap = Array.from({ length: 5 }, () => Array(5).fill(0) as number[]);
  for (const r of risks) heatMap[r.impact - 1][r.likelihood - 1] += 1;

  const today = new Date().toISOString().slice(0, 10);
  return c.json({
    success: true,
    data: {
      total: risks.length,
      byPriority: { HIGH: 0, MEDIUM: 0, LOW: 0, ...Object.fromEntries(
        (['HIGH', 'MEDIUM', 'LOW'] as const).map((p) => [p, risks.filter((r) => r.priority === p).length])
      ) },
      byStatus: risks.reduce<Record<string, number>>((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {}),
      overdue: risks.filter((r) => r.dueDate && r.dueDate < today && !['mitigated', 'accepted'].includes(r.status)).length,
      unowned: risks.filter((r) => !r.ownerUserId).length,
      awaitingReview: risks.filter((r) => r.reviewPending).length,
      heatMap, // heatMap[impact-1][likelihood-1]
    },
  });
});

riskRegister.get('/risk-register/:id', async (c) => {
  const auth = await requireRiskAccess(c);
  if (auth instanceof Response) return auth;
  const id = requireUUIDParam(c, 'id');
  if (id instanceof Response) return id;

  const risk = await getRisk(id, auth.organisationId);
  if (!risk) return jsonError(c, 404, 'NOT_FOUND', 'Risk not found');
  return c.json({ success: true, data: risk });
});

riskRegister.post('/risk-register', async (c) => {
  const auth = await requireRiskAccess(c);
  if (auth instanceof Response) return auth;

  const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid risk register entry');
  const d = parsed.data;

  if (d.ownerUserId && !(await ownerInOrg(d.ownerUserId, auth.organisationId))) {
    return jsonError(c, 400, 'INVALID_OWNER', 'Owner must be a member of your organisation');
  }

  const now = new Date().toISOString();
  const entry: RiskRegisterEntry = {
    id: crypto.randomUUID(),
    organisationId: auth.organisationId,
    title: d.title,
    riskArea: d.riskArea,
    description: d.description,
    impact: d.impact,
    likelihood: d.likelihood,
    controlEffectiveness: d.controlEffectiveness,
    controls: d.controls,
    ...scoreRisk(d.impact, d.likelihood, d.controlEffectiveness),
    ownerUserId: d.ownerUserId ?? undefined,
    actionPlan: d.actionPlan,
    dueDate: d.dueDate ?? undefined,
    status: d.status ?? 'open',
    createdByUserId: auth.userId,
    createdAt: now,
    updatedAt: now,
  };

  if (hasDatabase()) await dbInsertRisk(entry);
  else riskRegisterById.set(entry.id, entry);

  await auditLog({
    eventType: 'risk_register.created', actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 'risk_register', resourceId: entry.id,
    details: { title: entry.title, residualScore: entry.residualScore, priority: entry.priority },
    ipAddress: getClientIp(c), userAgent: c.req.header('user-agent'),
  });
  notifyRiskChange(entry, 'risk.created');

  return c.json({ success: true, data: entry }, 201);
});

riskRegister.patch('/risk-register/:id', async (c) => {
  const auth = await requireRiskAccess(c);
  if (auth instanceof Response) return auth;
  const id = requireUUIDParam(c, 'id');
  if (id instanceof Response) return id;

  const parsed = patchSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid risk register update');
  const d = parsed.data;

  const existing = await getRisk(id, auth.organisationId);
  if (!existing) return jsonError(c, 404, 'NOT_FOUND', 'Risk not found');

  if (d.ownerUserId && !(await ownerInOrg(d.ownerUserId, auth.organisationId))) {
    return jsonError(c, 400, 'INVALID_OWNER', 'Owner must be a member of your organisation');
  }

  const merged: RiskRegisterEntry = {
    ...existing,
    ...Object.fromEntries(Object.entries(d).filter(([, v]) => v !== undefined)),
    ownerUserId: d.ownerUserId === null ? undefined : (d.ownerUserId ?? existing.ownerUserId),
    dueDate: d.dueDate === null ? undefined : (d.dueDate ?? existing.dueDate),
    updatedAt: new Date().toISOString(),
  } as RiskRegisterEntry;
  // An employer who changes the status themselves has dealt with the owner's update.
  // The edit form always sends the status, so an unchanged one leaves the update waiting.
  if (d.status !== undefined && d.status !== existing.status) merged.reviewPending = false;
  Object.assign(merged, scoreRisk(merged.impact, merged.likelihood, merged.controlEffectiveness));

  if (hasDatabase()) await dbUpdateRisk(merged);
  else riskRegisterById.set(id, merged);

  await auditLog({
    eventType: 'risk_register.updated', actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 'risk_register', resourceId: id,
    details: { changes: Object.keys(d), residualScore: merged.residualScore, priority: merged.priority },
    ipAddress: getClientIp(c), userAgent: c.req.header('user-agent'),
  });
  notifyRiskChange(merged, 'risk.updated', existing.priority);

  return c.json({ success: true, data: merged });
});

riskRegister.delete('/risk-register/:id', async (c) => {
  const auth = await requireRiskAccess(c);
  if (auth instanceof Response) return auth;
  const id = requireUUIDParam(c, 'id');
  if (id instanceof Response) return id;

  let deleted = 0;
  if (hasDatabase()) {
    deleted = await dbDeleteRisk(id, auth.organisationId);
  } else if (riskRegisterById.get(id)?.organisationId === auth.organisationId) {
    riskRegisterById.delete(id);
    deleted = 1;
  }
  if (!deleted) return jsonError(c, 404, 'NOT_FOUND', 'Risk not found');

  await auditLog({
    eventType: 'risk_register.deleted', actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 'risk_register', resourceId: id,
    ipAddress: getClientIp(c), userAgent: c.req.header('user-agent'),
  });
  return c.json({ success: true, data: { id, deleted: true } });
});

export default riskRegister;
