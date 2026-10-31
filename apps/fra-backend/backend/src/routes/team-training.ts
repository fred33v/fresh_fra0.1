// ============================================================
// Team training (Professional and Enterprise): who has joined, how far each
// person is through the workshop, their certificate and their action plan.
// This is the employer's evidence that staff were trained (ECCTA 2023).
// ============================================================

import { Hono } from 'hono';
import { hasDatabase, hasPackageEntitlement, isManagerRole, jsonError, requireAuth } from '../helpers.js';
import { listOrgPurchases, requirePackage } from '../entitlements.js';
import { keypassesByCode, usersByEmail } from '../stores.js';
import { dbListKeypassesByOrganisation, dbListUsersByOrganisation } from '../db/index.js';
import { getDbPool } from '../db.js';
import { actionPlans, certificates, workshopProgress } from '../workshop-store.js';
import { WORKSHOP_SECTION_IDS } from '../workshop-quiz.js';
import { csvResponse, wantsCsv } from '../csv.js';
import { listMembers } from '../budget-holder-store.js';
import { memberStatus } from '../budget-holder-rules.js';

type Progress = { user_id: string; completed_sections: number[]; quiz_scores: Record<string, number>; completed_at: string | null; updated_at: string };
type Plan = { user_id: string; action_items: unknown; generated_at: string };
type Cert = { user_id: string; certificate_number: string; issued_at: string };

const iso = (v: string | Date | null | undefined) => (v ? new Date(v).toISOString() : null);

/** A person can have progress from several live sessions and on their own: count the furthest. */
function bestProgress(rows: Progress[]): Progress | undefined {
  return [...rows].sort((a, b) =>
    Number(!!b.completed_at) - Number(!!a.completed_at)
    || (b.completed_sections?.length ?? 0) - (a.completed_sections?.length ?? 0)
    || Date.parse(b.updated_at) - Date.parse(a.updated_at))[0];
}

function planCounts(items: unknown): { done: number; total: number } {
  if (!Array.isArray(items)) return { done: 0, total: 0 };
  const list = items as Array<{ completed?: unknown }>;
  return { done: list.filter((i) => i?.completed === true).length, total: list.length };
}

async function loadTraining(userIds: string[]) {
  if (userIds.length === 0) return { progress: [] as Progress[], plans: [] as Plan[], certs: [] as Cert[] };
  if (!hasDatabase()) {
    const ids = new Set(userIds);
    return {
      progress: [...workshopProgress.values()].filter((p) => ids.has(p.user_id)),
      plans: [...actionPlans.values()].filter((p) => ids.has(p.user_id)),
      certs: [...certificates.values()].filter((p) => ids.has(p.user_id)),
    };
  }
  const pool = getDbPool();
  const [progress, plans, certs] = await Promise.all([
    pool.query<Progress>('select user_id, completed_sections, quiz_scores, completed_at, updated_at from public.workshop_progress where user_id = any($1::uuid[])', [userIds]),
    // Each person's latest plan only
    pool.query<Plan>(`select distinct on (user_id) user_id, action_items, generated_at from public.action_plans
      where user_id = any($1::uuid[]) order by user_id, generated_at desc`, [userIds]),
    pool.query<Cert>(`select distinct on (user_id) user_id, certificate_number, issued_at from public.certificates
      where user_id = any($1::uuid[]) order by user_id, issued_at desc`, [userIds]),
  ]);
  return { progress: progress.rows, plans: plans.rows, certs: certs.rows };
}

const teamTraining = new Hono();

teamTraining.get('/team/training', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (!isManagerRole(auth.role)) return jsonError(c, 403, 'FORBIDDEN', 'Requires employer or admin role');
  const denied = await requirePackage(c, auth, 'pkg_training');
  if (denied) return denied;

  const users = (hasDatabase()
    ? await dbListUsersByOrganisation(auth.organisationId)
    : [...usersByEmail.values()].filter((u) => u.organisationId === auth.organisationId))
    .filter((u) => u.id !== auth.userId);
  const { progress, plans, certs } = await loadTraining(users.map((u) => u.id));
  // Enterprise: the budget holder programme, next to the training
  const enterprise = hasPackageEntitlement(await listOrgPurchases(auth.organisationId), 'pkg_full');
  const budgetHolders = enterprise ? new Map((await listMembers(auth.organisationId)).map((m) => [m.userId, m])) : null;
  const totalSections = WORKSHOP_SECTION_IDS.length;

  const people = users.map((u) => {
    const p = bestProgress(progress.filter((r) => r.user_id === u.id));
    const plan = plans.filter((r) => r.user_id === u.id).sort((a, b) => Date.parse(b.generated_at) - Date.parse(a.generated_at))[0];
    const cert = certs.filter((r) => r.user_id === u.id).sort((a, b) => Date.parse(b.issued_at) - Date.parse(a.issued_at))[0];
    const scores = Object.values(p?.quiz_scores ?? {});
    const modulesDone = (p?.completed_sections ?? []).filter((s) => (WORKSHOP_SECTION_IDS as readonly number[]).includes(s)).length;
    const counts = planCounts(plan?.action_items);
    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      joinedAt: u.createdAt,
      emailConfirmed: u.emailVerifiedAt !== null,
      training: {
        status: p?.completed_at ? 'completed' : modulesDone > 0 ? 'in_progress' : 'not_started',
        modulesDone,
        totalModules: totalSections,
        quizAverage: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
        completedAt: iso(p?.completed_at),
        lastActivityAt: iso(p?.updated_at),
      },
      certificate: cert ? { number: cert.certificate_number, issuedAt: iso(cert.issued_at) } : null,
      actionPlan: plan ? counts : null,
      budgetHolder: budgetHolders
        ? { required: !!budgetHolders.get(u.id)?.required, status: memberStatus(budgetHolders.get(u.id) ?? null) }
        : null,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  // Invitations sent by email that nobody has used yet
  const codes = hasDatabase()
    ? await dbListKeypassesByOrganisation(auth.organisationId)
    : [...keypassesByCode.values()].filter((k) => k.organisationId === auth.organisationId);
  const now = Date.now();
  const invitations = codes
    .filter((k) => k.invitedEmail && k.status === 'available')
    .map((k) => ({ code: k.code, email: k.invitedEmail as string, invitedAt: k.invitedAt ?? k.createdAt, expiresAt: k.expiresAt, expired: Date.parse(k.expiresAt) < now }));

  if (wantsCsv(c)) {
    return csvResponse(c, 'team-training.csv', people.map((p) => ({
      name: p.name, email: p.email, joinedAt: p.joinedAt, emailConfirmed: p.emailConfirmed,
      training: p.training.status, modulesDone: `${p.training.modulesDone}/${p.training.totalModules}`,
      quizAverage: p.training.quizAverage, completedAt: p.training.completedAt,
      certificateNumber: p.certificate?.number ?? '', certificateIssuedAt: p.certificate?.issuedAt ?? '',
      actionsDone: p.actionPlan ? `${p.actionPlan.done}/${p.actionPlan.total}` : '',
      ...(p.budgetHolder ? { budgetHolderRequired: p.budgetHolder.required, budgetHolderProgramme: p.budgetHolder.status } : {}),
    })));
  }

  return c.json({
    success: true,
    data: {
      summary: {
        people: people.length,
        trained: people.filter((p) => p.training.status === 'completed').length,
        certificates: people.filter((p) => p.certificate).length,
        pendingInvitations: invitations.filter((i) => !i.expired).length,
      },
      people,
      invitations,
    },
  });
});

export default teamTraining;
