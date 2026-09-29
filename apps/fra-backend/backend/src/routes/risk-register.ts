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
import { riskRegisterById, usersByEmail } from '../stores.js';
import {
  requireUUIDParam, type ControlEffectiveness, type RiskPriority, type RiskRegisterEntry,
} from '../types.js';
import { getClientIp } from '../middleware.js';
import {
  auditLog, dbDeleteRisk, dbGetRisk, dbGetUserById, dbInsertRisk, dbListRisks, dbUpdateRisk,
} from '../db/index.js';
import { csvResponse, wantsCsv } from '../csv.js';
import { emitOrgEvent } from '../webhooks-out.js';

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

const riskRegister = new Hono();

async function requireRiskAccess(c: Context): Promise<AuthContext | Response> {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (!isManagerRole(auth.role)) return jsonError(c, 403, 'FORBIDDEN', 'Risk register requires employer or admin role');
  const denied = await requirePackage(c, auth, 'pkg_full');
  return denied ?? auth;
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
  'description', 'createdAt', 'updatedAt',
];

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
