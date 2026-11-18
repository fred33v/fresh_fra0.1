import { describe, expect, it } from '@jest/globals';
import { mitigationSchema, budgetReport } from '../src/budget-planning.js';
import type { BudgetPlanningPlan } from '@stopfra/types';
const item = {
  id: 'item',
  risk_level: 'high' as const,
  category: 'prevention' as const,
  description: '<script>alert("x")</script> & audit',
  budget: 125.55,
  timeline: '1-3 months' as const,
  status: 'planned' as const,
  created_at: '2026-11-13',
  updated_at: '2026-11-13',
};
describe('budget planning boundaries', () => {
  it.each([-1, 1.234, Infinity, NaN, 10000000.01])(
    'refuses invalid monetary amount %s',
    (budget) => {
      expect(mitigationSchema.safeParse({ ...item, budget }).success).toBe(false);
    }
  );
  it.each([0, 0.01, 125.55, 10000000])('accepts exact GBP amount %s', (budget) => {
    expect(mitigationSchema.safeParse({ ...item, budget }).success).toBe(true);
  });
  it('escapes stored text in the downloadable report and preserves pennies', () => {
    const plan: BudgetPlanningPlan = {
      id: 'plan',
      assessment_id: 'assessment',
      version: 3,
      riskAppetite: {
        level: 'low',
        justification: '<img src=x> & review',
        updated_at: '2026-11-13',
      },
      mitigations: [item],
      completed_at: null,
      updated_at: '2026-11-13',
    };
    const html = budgetReport(plan, '<b>Assessment</b>', 60);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img src=x>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;b&gt;Assessment&lt;/b&gt;');
    expect(html).toContain('£125.55');
    expect(html).toContain('Draft plan');
  });
});
