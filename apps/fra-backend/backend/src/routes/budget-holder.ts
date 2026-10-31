// ============================================================
// Enterprise budget holder programme: the Budget Guide on the web.
// Staff work through 11 parts, answer the scenarios (80% to pass), declare
// conflicts of interest and sign a commitment, every year. The employer says
// who must do it, sets its own approval limits and report contacts, and keeps
// the record as evidence of its fraud prevention procedures (ECCTA 2023).
// ============================================================

import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { type AuthContext, hasDatabase, isManagerRole, jsonError, requireAuth } from '../helpers.js';
import { requirePackage } from '../entitlements.js';
import { usersByEmail } from '../stores.js';
import { auditLog, dbListUsersByOrganisation } from '../db/index.js';
import { getClientIp } from '../middleware.js';
import { getIntakeByOrg } from '../speak-up-store.js';
import { csvResponse, wantsCsv } from '../csv.js';
import {
  BUDGET_HOLDER_PART_IDS, PARTS_BEFORE_COMMITMENT, REQUIRED_PARTS, memberStatus, renewalDueAt, scoreScenarios,
} from '../budget-holder-rules.js';
import {
  type BudgetHolderMember, emptyMember, getMember, getSettings, listMembers, saveMember, saveSettings,
} from '../budget-holder-store.js';

const budgetHolder = new Hono();

const CONTACT_KEYS = ['fraudRiskOwner', 'whistleblowingHotline', 'internalAudit', 'hrDepartment'] as const;
const cell = z.string().trim().max(80);
const settingsSchema = z.object({
  approvalLimits: z.object({
    bands: z.array(cell.min(1)).min(1).max(6),
    rows: z.array(z.object({ type: cell.min(1), approvers: z.array(cell).max(6) })).min(1).max(20),
  }).refine((l) => l.rows.every((r) => r.approvers.length === l.bands.length), { message: 'Each row needs one approver per band' }).nullable(),
  contacts: z.object(Object.fromEntries(CONTACT_KEYS.map((k) => [k, z.object({ name: z.string().trim().max(120), contact: z.string().trim().max(200) }).optional()]))),
});
const partSchema = z.object({ partId: z.enum(BUDGET_HOLDER_PART_IDS) });
const scenariosSchema = z.object({ answers: z.record(z.string(), z.number().int().min(0).max(9)) });
const commitmentSchema = z.object({
  name: z.string().trim().min(2, 'Type your full name to sign').max(120),
  conflictDeclared: z.boolean(),
  conflictDetails: z.string().trim().max(2000).optional(),
}).refine((d) => !d.conflictDeclared || (d.conflictDetails?.length ?? 0) >= 5, { message: 'Describe the interest you are declaring', path: ['conflictDetails'] });
const requiredSchema = z.object({ required: z.boolean() });

async function guard(c: Context, managerOnly = false): Promise<AuthContext | Response> {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (managerOnly && !isManagerRole(auth.role)) return jsonError(c, 403, 'FORBIDDEN', 'Requires employer or admin role');
  const denied = await requirePackage(c, auth, 'pkg_full');
  return denied ?? auth;
}

const orgUsers = async (orgId: string) => (hasDatabase()
  ? await dbListUsersByOrganisation(orgId)
  : [...usersByEmail.values()].filter((u) => u.organisationId === orgId));

const badRequest = (c: Context, error: z.ZodError) => jsonError(c, 400, 'VALIDATION_ERROR', error.issues[0]?.message ?? 'Invalid request');

function view(m: BudgetHolderMember | null) {
  return {
    required: !!m?.required,
    status: memberStatus(m),
    completedParts: m?.completedParts ?? [],
    requiredPartsDone: (m?.completedParts ?? []).filter((p) => (REQUIRED_PARTS as string[]).includes(p)).length,
    scenarioScore: m?.scenarioScore ?? null,
    scenarioPassed: !!m?.scenarioPassedAt,
    pledgeName: m?.pledgeName ?? null,
    pledgedAt: m?.pledgedAt ?? null,
    conflictDeclared: m?.conflictDeclared ?? null,
    conflictDetails: m?.conflictDetails ?? null,
    completedAt: m?.completedAt ?? null,
    renewalDueAt: m?.completedAt ? renewalDueAt(m.completedAt) : null,
    previousCompletedAt: m?.previousCompletedAt ?? null,
  };
}

async function loadOwn(auth: AuthContext) {
  const m = await getMember(auth.userId);
  // A person who moved organisation starts again
  return m && m.organisationId === auth.organisationId ? m : emptyMember(auth.userId, auth.organisationId);
}

const audit = (c: Context, auth: AuthContext, eventType: string, details: Record<string, unknown>, resourceId = auth.userId) => auditLog({
  eventType, actorId: auth.userId, actorEmail: auth.email, organisationId: auth.organisationId,
  resourceType: 'budget_holder', resourceId, details, ipAddress: getClientIp(c), userAgent: c.req.header('user-agent'),
});

// ── The person's own programme ──────────────────────────────────

budgetHolder.get('/budget-holder/me', async (c) => {
  const auth = await guard(c);
  if (auth instanceof Response) return auth;
  const [member, settings, intake] = await Promise.all([getMember(auth.userId), getSettings(auth.organisationId), getIntakeByOrg(auth.organisationId)]);
  const own = member && member.organisationId === auth.organisationId ? member : null;
  return c.json({
    success: true,
    data: {
      ...view(own),
      settings: { approvalLimits: settings.approvalLimits, contacts: settings.contacts },
      speakUpToken: intake?.enabled ? intake.token : null,
    },
  });
});

budgetHolder.post('/budget-holder/me/parts', async (c) => {
  const auth = await guard(c);
  if (auth instanceof Response) return auth;
  const parsed = partSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, parsed.error);
  const m = await loadOwn(auth);
  // The scenarios and the commitment are done by answering and signing, not by opening them
  if (parsed.data.partId === 'scenarios' || parsed.data.partId === 'commitment') {
    return jsonError(c, 400, 'VALIDATION_ERROR', 'This part is completed by answering it');
  }
  if (!m.completedParts.includes(parsed.data.partId)) m.completedParts = [...m.completedParts, parsed.data.partId];
  return c.json({ success: true, data: view(await saveMember(m)) });
});

budgetHolder.post('/budget-holder/me/scenarios', async (c) => {
  const auth = await guard(c);
  if (auth instanceof Response) return auth;
  const parsed = scenariosSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, parsed.error);
  const result = scoreScenarios(parsed.data.answers);
  if (result.invalid.length) return jsonError(c, 400, 'VALIDATION_ERROR', `Unknown scenario: ${result.invalid.join(', ')}`);
  if (result.missing.length) return jsonError(c, 400, 'VALIDATION_ERROR', 'Answer every scenario');

  const m = await loadOwn(auth);
  // Keep the best attempt
  if (m.scenarioScore === null || result.score >= m.scenarioScore) {
    m.scenarioScore = result.score;
    m.scenarioAnswers = parsed.data.answers;
  }
  if (result.passed) {
    m.scenarioPassedAt ??= new Date().toISOString();
    if (!m.completedParts.includes('scenarios')) m.completedParts = [...m.completedParts, 'scenarios'];
  }
  const saved = await saveMember(m);
  await audit(c, auth, 'budget_holder.scenarios_answered', { score: result.score, passed: result.passed });
  return c.json({ success: true, data: { ...view(saved), attempt: { score: result.score, passed: result.passed, results: result.results } } });
});

budgetHolder.post('/budget-holder/me/commitment', async (c) => {
  const auth = await guard(c);
  if (auth instanceof Response) return auth;
  const parsed = commitmentSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, parsed.error);
  const m = await loadOwn(auth);
  if (m.completedAt && memberStatus(m) === 'completed') return jsonError(c, 409, 'ALREADY_COMPLETED', 'You have already signed your commitment for this year');
  const missing = PARTS_BEFORE_COMMITMENT.filter((p) => !m.completedParts.includes(p));
  if (missing.length) return jsonError(c, 409, 'PARTS_MISSING', `Finish these parts first: ${missing.join(', ')}`);

  const now = new Date().toISOString();
  m.pledgeName = parsed.data.name;
  m.pledgedAt = now;
  m.conflictDeclared = parsed.data.conflictDeclared;
  m.conflictDetails = parsed.data.conflictDeclared ? parsed.data.conflictDetails ?? null : null;
  m.completedParts = [...new Set([...m.completedParts, 'commitment'])];
  m.completedAt = now;
  const saved = await saveMember(m);
  await audit(c, auth, 'budget_holder.completed', { score: m.scenarioScore, conflictDeclared: m.conflictDeclared });
  return c.json({ success: true, data: view(saved) });
});

budgetHolder.post('/budget-holder/me/renew', async (c) => {
  const auth = await guard(c);
  if (auth instanceof Response) return auth;
  const m = await loadOwn(auth);
  if (memberStatus(m) !== 'renewal_due') return jsonError(c, 409, 'NOT_DUE', 'Your renewal is not due yet');
  const fresh = { ...emptyMember(auth.userId, auth.organisationId), required: m.required, requiredAt: m.requiredAt, previousCompletedAt: m.completedAt, createdAt: m.createdAt };
  return c.json({ success: true, data: view(await saveMember(fresh)) });
});

// ── The employer ────────────────────────────────────────────────

budgetHolder.get('/budget-holder/team', async (c) => {
  const auth = await guard(c, true);
  if (auth instanceof Response) return auth;
  const [users, members] = await Promise.all([orgUsers(auth.organisationId), listMembers(auth.organisationId)]);
  const byUser = new Map(members.map((m) => [m.userId, m]));
  const people = users.map((u) => ({ userId: u.id, name: u.name, email: u.email, role: u.role, ...view(byUser.get(u.id) ?? null) }))
    .sort((a, b) => Number(b.required) - Number(a.required) || a.name.localeCompare(b.name));
  const required = people.filter((p) => p.required);

  if (wantsCsv(c)) {
    return csvResponse(c, 'budget-holders.csv', people.filter((p) => p.required || p.status !== 'not_started').map((p) => ({
      name: p.name, email: p.email, required: p.required, status: p.status, partsDone: `${p.completedParts.filter((x) => (REQUIRED_PARTS as string[]).includes(x)).length}/${REQUIRED_PARTS.length}`,
      scenarioScore: p.scenarioScore ?? '', signedBy: p.pledgeName ?? '', signedAt: p.pledgedAt ?? '',
      conflictDeclared: p.conflictDeclared === null ? '' : p.conflictDeclared, conflictDetails: p.conflictDetails ?? '',
      completedAt: p.completedAt ?? '', renewalDueAt: p.renewalDueAt ?? '',
    })));
  }

  return c.json({
    success: true,
    data: {
      summary: {
        required: required.length,
        completed: required.filter((p) => p.status === 'completed').length,
        renewalDue: people.filter((p) => p.status === 'renewal_due').length,
        conflictsDeclared: people.filter((p) => p.conflictDeclared && p.status !== 'not_started').length,
        totalParts: REQUIRED_PARTS.length,
      },
      people,
    },
  });
});

budgetHolder.put('/budget-holder/team/:userId', async (c) => {
  const auth = await guard(c, true);
  if (auth instanceof Response) return auth;
  const parsed = requiredSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, parsed.error);
  const userId = c.req.param('userId');
  const target = (await orgUsers(auth.organisationId)).find((u) => u.id === userId);
  if (!target) return jsonError(c, 404, 'NOT_FOUND', 'Person not found in your organisation');
  const existing = await getMember(userId);
  const m = existing && existing.organisationId === auth.organisationId ? existing : emptyMember(userId, auth.organisationId);
  m.required = parsed.data.required;
  m.requiredAt = parsed.data.required ? m.requiredAt ?? new Date().toISOString() : null;
  const saved = await saveMember(m);
  await audit(c, auth, parsed.data.required ? 'budget_holder.required' : 'budget_holder.not_required', { email: target.email }, userId);
  return c.json({ success: true, data: { userId, ...view(saved) } });
});

budgetHolder.get('/budget-holder/settings', async (c) => {
  const auth = await guard(c);
  if (auth instanceof Response) return auth;
  const s = await getSettings(auth.organisationId);
  return c.json({ success: true, data: { approvalLimits: s.approvalLimits, contacts: s.contacts, updatedAt: s.updatedAt } });
});

budgetHolder.put('/budget-holder/settings', async (c) => {
  const auth = await guard(c, true);
  if (auth instanceof Response) return auth;
  const parsed = settingsSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return badRequest(c, parsed.error);
  const contacts = Object.fromEntries(Object.entries(parsed.data.contacts)
    .filter((e): e is [string, { name: string; contact: string }] => !!e[1] && !!(e[1].name || e[1].contact)));
  const saved = await saveSettings({ organisationId: auth.organisationId, approvalLimits: parsed.data.approvalLimits, contacts, updatedBy: auth.userId, updatedAt: null });
  await audit(c, auth, 'budget_holder.settings_updated', { limits: !!saved.approvalLimits, contacts: Object.keys(contacts) }, auth.organisationId);
  return c.json({ success: true, data: { approvalLimits: saved.approvalLimits, contacts: saved.contacts, updatedAt: saved.updatedAt } });
});

export default budgetHolder;
