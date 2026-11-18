import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type {
  BudgetPlanningPlan,
  BudgetPlanningMitigation,
  BudgetPlanningAppetite,
} from '@stopfra/types';
import { domainWrite } from './domain-write.js';
import { withTransaction, type DbExecutor } from './db/transaction.js';
import { hasDatabase, requireAuth, jsonError, isManagerRole } from './helpers.js';
import { requireUUIDParam } from './types.js';
import { rateLimit } from './middleware.js';
import { dbGetAssessmentById, dbGetUserById, auditLog } from './db/index.js';
import { requirePackage } from './entitlements.js';
import { isSubmitted, resultsOf } from './assessment-result.js';
export const mitigationSchema = z.object({
  risk_level: z.enum(['low', 'medium', 'high', 'critical']),
  category: z.enum(['prevention', 'detection', 'response', 'culture']),
  description: z.string().trim().min(1).max(2000),
  budget: z
    .number()
    .finite()
    .min(0)
    .max(10000000)
    .refine(
      (n) => Math.abs(n * 100 - Math.round(n * 100)) < 0.000001,
      'Use at most two decimal places'
    ),
  timeline: z.enum(['1-3 months', '3-6 months', '6-12 months', '12+ months']),
  status: z.enum(['planned', 'in_progress', 'completed']),
});
const expectedVersion = z.number().int().min(1).max(2147483646);
const appetiteSchema = z
  .object({
    expectedVersion,
    level: z.enum(['low', 'medium', 'high']),
    justification: z.string().trim().min(1).max(2000),
  })
  .strict();
const createItemSchema = mitigationSchema.extend({ expectedVersion }).strict();
const updateItemSchema = mitigationSchema
  .partial()
  .extend({ expectedVersion })
  .strict()
  .refine((v) => Object.keys(v).length > 1, 'Provide a change');
const versionSchema = z.object({ expectedVersion }).strict();
const planning = new Hono();

async function authorize(c: Context, db: DbExecutor, write: boolean) {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  const id = requireUUIDParam(c, 'assessmentId');
  if (id instanceof Response) return id;
  const current = await dbGetUserById(auth.userId, db);
  if (!current || current.organisationId !== auth.organisationId)
    return jsonError(c, 403, 'FORBIDDEN', 'Account authority changed. Sign in again.');
  const assessment = await dbGetAssessmentById(id, db);
  if (
    !assessment ||
    assessment.organisationId !== auth.organisationId ||
    (!isManagerRole(current.role) && assessment.createdByUserId !== auth.userId)
  )
    return jsonError(c, 404, 'NOT_FOUND', 'Assessment not found');
  if (!isSubmitted(assessment))
    return jsonError(c, 409, 'NOT_SUBMITTED', 'Submit the assessment before planning its budget');
  const actor = { ...auth, email: current.email, role: current.role };
  if (write) {
    const denied = await requirePackage(c, actor, 'pkg_basic', db);
    if (denied) return denied;
  }
  return { auth: actor, assessment };
}
export async function loadBudgetPlan(
  db: DbExecutor,
  assessmentId: string,
  orgId: string,
  write = false
): Promise<BudgetPlanningPlan | null> {
  const row = (
    await db.query<{
      id: string;
      assessment_id: string;
      version: number;
      risk_appetite: BudgetPlanningAppetite | null;
      completed_at: Date | null;
      updated_at: Date;
    }>(
      `SELECT * FROM public.budget_plans WHERE assessment_id=$1 AND organisation_id=$2 ${write ? 'FOR UPDATE' : 'FOR SHARE'}`,
      [assessmentId, orgId]
    )
  ).rows[0];
  if (!row) return null;
  const items = await db.query<
    Omit<BudgetPlanningMitigation, 'created_at' | 'updated_at'> & {
      created_at: Date;
      updated_at: Date;
    }
  >(
    `SELECT id,risk_level,category,description,budget_cents::float8/100 AS budget,timeline,status,created_at,updated_at FROM public.budget_plan_mitigations WHERE plan_id=$1 AND archived_at IS NULL ORDER BY created_at,id`,
    [row.id]
  );
  return {
    id: row.id,
    assessment_id: row.assessment_id,
    version: row.version,
    riskAppetite: row.risk_appetite,
    completed_at: row.completed_at?.toISOString() ?? null,
    updated_at: row.updated_at.toISOString(),
    mitigations: items.rows.map((item) => ({
      ...item,
      created_at: item.created_at.toISOString(),
      updated_at: item.updated_at.toISOString(),
    })),
  };
}
planning.use('*', async (c, next) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (!hasDatabase()) return jsonError(c, 503, 'NO_DB', 'Database not configured');
  const limited = await rateLimit(`budget-planning:${auth.userId}`, { windowMs: 60_000, max: 60 })(
    c
  );
  if (limited instanceof Response) return limited;
  c.header('Cache-Control', 'no-store');
  await next();
});
planning.get('/:assessmentId', (c) =>
  withTransaction(async (db) => {
    const access = await authorize(c, db, false);
    if (access instanceof Response) return access;
    return c.json({
      success: true,
      data: await loadBudgetPlan(db, access.assessment.id, access.auth.organisationId),
    });
  })
);
planning.post(
  '/:assessmentId',
  domainWrite(async (c, db) => {
    if (!db) return jsonError(c, 503, 'NO_DB', 'Database not configured');
    const access = await authorize(c, db, true);
    if (access instanceof Response) return access;
    const parsed = z
      .object({})
      .strict()
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return jsonError(c, 400, 'VALIDATION', 'Invalid plan request');
    const inserted = await db.query(
      `INSERT INTO public.budget_plans(assessment_id,organisation_id) VALUES($1,$2) ON CONFLICT(assessment_id) DO NOTHING RETURNING id`,
      [access.assessment.id, access.auth.organisationId]
    );
    if (inserted.rowCount)
      await auditLog(
        {
          eventType: 'budget_plan.created',
          actorId: access.auth.userId,
          actorEmail: access.auth.email,
          organisationId: access.auth.organisationId,
          resourceType: 'assessment',
          resourceId: access.assessment.id,
        },
        db
      );
    const plan = await loadBudgetPlan(db, access.assessment.id, access.auth.organisationId, true);
    if (!plan)
      return jsonError(
        c,
        409,
        'PLAN_CONFLICT',
        'The saved plan cannot be loaded for this organisation.'
      );
    return c.json({ success: true, data: plan }, inserted.rowCount ? 201 : 200);
  })
);
async function mutate(
  c: Context,
  db: DbExecutor,
  version: number,
  event: string,
  apply: (plan: BudgetPlanningPlan) => Promise<Response | void>,
  complete = false
) {
  const access = await authorize(c, db, true);
  if (access instanceof Response) return access;
  const plan = await loadBudgetPlan(db, access.assessment.id, access.auth.organisationId, true);
  if (!plan) return jsonError(c, 404, 'NOT_FOUND', 'Budget plan not found');
  if (plan.version !== version)
    return jsonError(
      c,
      409,
      'PLAN_CONFLICT',
      'This plan changed in another session. Reload the saved plan before retrying.'
    );
  const refused = await apply(plan);
  if (refused instanceof Response) return refused;
  await db.query(
    `UPDATE public.budget_plans SET version=version+1,updated_at=now(),completed_at=${complete ? 'now()' : 'NULL'} WHERE id=$1`,
    [plan.id]
  );
  await auditLog(
    {
      eventType: event,
      actorId: access.auth.userId,
      actorEmail: access.auth.email,
      organisationId: access.auth.organisationId,
      resourceType: 'budget_plan',
      resourceId: plan.id,
      details: { assessmentId: plan.assessment_id, previousVersion: version },
    },
    db
  );
  return c.json({
    success: true,
    data: await loadBudgetPlan(db, plan.assessment_id, access.auth.organisationId, true),
  });
}
planning.patch(
  '/:assessmentId/risk-appetite',
  domainWrite(async (c, db) => {
    if (!db) return jsonError(c, 503, 'NO_DB', 'Database not configured');
    const parsed = appetiteSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success)
      return jsonError(c, 400, 'VALIDATION', 'Provide a risk appetite and justification');
    const { expectedVersion, level, justification } = parsed.data;
    return mutate(c, db, expectedVersion, 'budget_plan.appetite_updated', async (plan) => {
      await db.query('UPDATE public.budget_plans SET risk_appetite=$2 WHERE id=$1', [
        plan.id,
        { level, justification, updated_at: new Date().toISOString() },
      ]);
    });
  })
);
planning.post(
  '/:assessmentId/mitigations',
  domainWrite(async (c, db) => {
    if (!db) return jsonError(c, 503, 'NO_DB', 'Database not configured');
    const parsed = createItemSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success)
      return jsonError(
        c,
        400,
        'VALIDATION',
        'Provide a valid mitigation and a budget with at most two decimal places'
      );
    const d = parsed.data;
    return mutate(c, db, d.expectedVersion, 'budget_plan.mitigation_created', async (plan) => {
      const count = await db.query<{ count: string }>(
        'SELECT count(*) FROM public.budget_plan_mitigations WHERE plan_id=$1 AND archived_at IS NULL',
        [plan.id]
      );
      if (Number(count.rows[0].count) >= 100)
        return jsonError(c, 400, 'PLAN_LIMIT', 'A plan can contain at most 100 active strategies');
      await db.query(
        `INSERT INTO public.budget_plan_mitigations(plan_id,risk_level,category,description,budget_cents,timeline,status) VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [
          plan.id,
          d.risk_level,
          d.category,
          d.description,
          Math.round(d.budget * 100),
          d.timeline,
          d.status,
        ]
      );
    });
  })
);
planning.patch(
  '/:assessmentId/mitigations/:mitigationId',
  domainWrite(async (c, db) => {
    if (!db) return jsonError(c, 503, 'NO_DB', 'Database not configured');
    const id = requireUUIDParam(c, 'mitigationId');
    if (id instanceof Response) return id;
    const parsed = updateItemSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return jsonError(c, 400, 'VALIDATION', 'Provide valid strategy changes');
    return mutate(
      c,
      db,
      parsed.data.expectedVersion,
      'budget_plan.mitigation_updated',
      async (plan) => {
        const item = plan.mitigations.find((m) => m.id === id);
        if (!item) return jsonError(c, 404, 'NOT_FOUND', 'Strategy not found');
        const d = { ...item, ...parsed.data };
        await db.query(
          `UPDATE public.budget_plan_mitigations SET risk_level=$3,category=$4,description=$5,budget_cents=$6,timeline=$7,status=$8,updated_at=now() WHERE id=$1 AND plan_id=$2 AND archived_at IS NULL`,
          [
            id,
            plan.id,
            d.risk_level,
            d.category,
            d.description,
            Math.round(d.budget * 100),
            d.timeline,
            d.status,
          ]
        );
      }
    );
  })
);
planning.delete(
  '/:assessmentId/mitigations/:mitigationId',
  domainWrite(async (c, db) => {
    if (!db) return jsonError(c, 503, 'NO_DB', 'Database not configured');
    const id = requireUUIDParam(c, 'mitigationId');
    if (id instanceof Response) return id;
    const parsed = versionSchema.safeParse({
      expectedVersion: Number(c.req.query('expectedVersion')),
    });
    if (!parsed.success) return jsonError(c, 400, 'VALIDATION', 'Provide the saved plan version');
    return mutate(
      c,
      db,
      parsed.data.expectedVersion,
      'budget_plan.mitigation_archived',
      async (plan) => {
        if (!plan.mitigations.some((m) => m.id === id))
          return jsonError(c, 404, 'NOT_FOUND', 'Strategy not found');
        await db.query(
          'UPDATE public.budget_plan_mitigations SET archived_at=now(),updated_at=now() WHERE id=$1 AND plan_id=$2',
          [id, plan.id]
        );
      }
    );
  })
);
planning.post(
  '/:assessmentId/complete',
  domainWrite(async (c, db) => {
    if (!db) return jsonError(c, 503, 'NO_DB', 'Database not configured');
    const parsed = versionSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return jsonError(c, 400, 'VALIDATION', 'Provide the saved plan version');
    return mutate(
      c,
      db,
      parsed.data.expectedVersion,
      'budget_plan.completed',
      async (plan) => {
        if (
          !plan.riskAppetite ||
          !plan.mitigations.length ||
          !plan.mitigations.some((m) => m.budget > 0)
        )
          return jsonError(
            c,
            409,
            'PLAN_INCOMPLETE',
            'Set risk appetite and add at least one funded strategy before completing the plan'
          );
      },
      true
    );
  })
);
const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
export function budgetReport(plan: BudgetPlanningPlan, title: string, riskScore: number): string {
  const money = (n: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
  const total = plan.mitigations.reduce((sum, m) => sum + Math.round(m.budget * 100), 0) / 100;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Budget implementation plan</title><style>body{font:16px system-ui;max-width:1100px;margin:40px auto;padding:24px;color:#16253c}table{width:100%;border-collapse:collapse}th,td{padding:10px;border:1px solid #ccc;text-align:left;vertical-align:top}h1{font-size:28px}@media print{body{margin:0;padding:12px;font-size:12px}thead{display:table-header-group}tr{break-inside:avoid}}</style></head><body><h1>Fraud prevention budget implementation plan</h1><p>Assessment: ${escapeHtml(title)}</p><p>Risk score: ${escapeHtml(riskScore)} / 100 · Plan version: ${plan.version}</p><p>Risk appetite: ${escapeHtml(plan.riskAppetite?.level ?? 'Not set')}</p><p>${escapeHtml(plan.riskAppetite?.justification ?? '')}</p><p>Total allocated: <strong>${money(total)}</strong></p><p>${plan.completed_at ? 'Completed: ' + escapeHtml(plan.completed_at) : 'Draft plan'}</p><table><thead><tr><th>Strategy</th><th>Category / risk</th><th>Budget</th><th>Timeline</th><th>Status</th></tr></thead><tbody>${plan.mitigations.map((m) => `<tr><td>${escapeHtml(m.description)}</td><td>${escapeHtml(m.category)} / ${escapeHtml(m.risk_level)}</td><td>${money(m.budget)}</td><td>${escapeHtml(m.timeline)}</td><td>${escapeHtml(m.status)}</td></tr>`).join('')}</tbody></table><p>Generated: ${escapeHtml(new Date().toISOString())}</p></body></html>`;
}
planning.get('/:assessmentId/report', (c) =>
  withTransaction(async (db) => {
    const access = await authorize(c, db, false);
    if (access instanceof Response) return access;
    const plan = await loadBudgetPlan(db, access.assessment.id, access.auth.organisationId);
    if (!plan) return jsonError(c, 404, 'NOT_FOUND', 'Budget plan not found');
    c.header('Content-Type', 'text/html; charset=utf-8');
    c.header(
      'Content-Disposition',
      `attachment; filename="budget-plan-${plan.assessment_id}.html"`
    );
    return c.body(
      budgetReport(plan, access.assessment.title, resultsOf(access.assessment).overallScore)
    );
  })
);
export default planning;
