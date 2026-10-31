// ============================================================
// Budget holder programme rules, checked on the server so the employer's
// evidence (who completed it, with what score) cannot be claimed by a client.
//
// Mirrors packages/shared/src/data/budgetHolder.ts; __tests__/budget-holder.test.ts
// fails if the two drift apart.
// ============================================================

/** Every part, in the order it is taught. */
export const BUDGET_HOLDER_PART_IDS = [
  'legal', 'basics', 'myths', 'red-flags', 'scenarios', 'checklists', 'authority',
  'reporting', 'whistleblowing', 'commitment', 'resources',
] as const;

/** Parts that count towards completion: everything but the resources page, which is there for reference. */
export const REQUIRED_PARTS = BUDGET_HOLDER_PART_IDS.filter((p) => p !== 'resources');

/** Parts to read before signing the commitment (the commitment itself and the resources page are not). */
export const PARTS_BEFORE_COMMITMENT = BUDGET_HOLDER_PART_IDS.filter((p) => p !== 'commitment' && p !== 'resources');

/** Scenario id → index of the right option. */
export const SCENARIO_ANSWER_KEY: Record<string, number> = {
  'fake-supplier': 1,
  'email-impersonation': 1,
  'bank-detail-change': 2,
  'deepfake-executive': 1,
  'ghost-employees': 1,
  'false-expenses': 1,
  'contract-splitting': 1,
};

export const PASS_MARK = 80;
export const RENEWAL_MONTHS = 12;

export type ScenarioResult = { score: number; passed: boolean; results: Record<string, boolean>; missing: string[]; invalid: string[] };

/** Score a full set of answers ({ scenarioId: optionIndex }). Every scenario must be answered. */
export function scoreScenarios(answers: Record<string, number>): ScenarioResult {
  const ids = Object.keys(SCENARIO_ANSWER_KEY);
  const invalid = Object.keys(answers).filter((k) => !(k in SCENARIO_ANSWER_KEY));
  const missing = ids.filter((id) => typeof answers[id] !== 'number');
  const results = Object.fromEntries(ids.map((id) => [id, answers[id] === SCENARIO_ANSWER_KEY[id]]));
  const right = Object.values(results).filter(Boolean).length;
  const score = Math.round((right / ids.length) * 100);
  return { score, passed: score >= PASS_MARK && missing.length === 0 && invalid.length === 0, results, missing, invalid };
}

export function renewalDueAt(completedAt: string): string {
  const d = new Date(completedAt);
  d.setMonth(d.getMonth() + RENEWAL_MONTHS);
  return d.toISOString();
}

export type BudgetHolderStatus = 'not_started' | 'in_progress' | 'completed' | 'renewal_due';

export function memberStatus(m: { completedParts: string[]; completedAt: string | null } | null, now = Date.now()): BudgetHolderStatus {
  if (!m) return 'not_started';
  if (m.completedAt) return Date.parse(renewalDueAt(m.completedAt)) <= now ? 'renewal_due' : 'completed';
  return m.completedParts.length > 0 ? 'in_progress' : 'not_started';
}
