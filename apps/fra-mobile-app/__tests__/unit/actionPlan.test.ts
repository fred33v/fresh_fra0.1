/**
 * Action plan and sign-in return - Unit Tests
 */

import { buildActionPlan, calculateRiskScore, createEmptyAssessment, ACTION_TIMELINE } from '@/utils/assessment';
import { safeReturnTo } from '@/utils/navigation';
import type { RiskRegisterItem } from '@/types/assessment';

const risk = (overrides: Partial<RiskRegisterItem>): RiskRegisterItem => ({
  id: 'FRA-001', title: 'Supplier fraud', area: 'Procurement', description: '', inherentScore: 16,
  residualScore: 16, priority: 'high', suggestedOwner: 'Head of Procurement', ...overrides,
});

describe('buildActionPlan', () => {
  it('turns each risk into actions with its owner, priority and timeline', () => {
    const plan = buildActionPlan([risk({}), risk({ id: 'FRA-002', title: 'Unreported fraud', priority: 'medium', residualScore: 12, suggestedOwner: 'HR Director' })]);

    expect(plan.highPriority.map((a) => a.title)).toEqual([
      'Verify every new supplier (company registration, bank account, ownership) before first payment',
      'Introduce call-back verification for any supplier bank detail change',
    ]);
    expect(plan.highPriority.every((a) => a.owner === 'Head of Procurement' && a.timeline === ACTION_TIMELINE.high)).toBe(true);
    expect(plan.mediumPriority[0]).toMatchObject({ owner: 'HR Director', priority: 'medium', timeline: ACTION_TIMELINE.medium, status: 'not-started' });
  });

  it('always plans a reassessment within 12 months', () => {
    const plan = buildActionPlan([]);
    expect(plan.highPriority).toHaveLength(0);
    expect(plan.lowPriority.at(-1)?.title).toMatch(/Repeat this fraud risk assessment within 12 months/);
  });

  it('reflects the answers given, not a fixed list', () => {
    const weak = createEmptyAssessment();
    weak.procurement.q1 = 'rarely';
    weak.peopleCulture.whistleblowing = 'no-formal';
    const titles = Object.values(buildActionPlan(calculateRiskScore(weak))).flat().map((a) => a.title).join(' ');

    expect(titles).toMatch(/supplier/i);
    expect(titles).toMatch(/whistleblowing/i);
    expect(titles).not.toMatch(/ghost employees/i);
  });

  it('gives every action a unique id', () => {
    const ids = Object.values(buildActionPlan([risk({}), risk({ id: 'FRA-002', title: 'Cyber fraud' })])).flat().map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('safeReturnTo', () => {
  it('allows in-app paths', () => {
    expect(safeReturnTo('/payment')).toBe('/payment');
    expect(safeReturnTo(['/payment'])).toBe('/payment');
  });

  it('falls back to home for anything that could leave the app', () => {
    expect(safeReturnTo(undefined)).toBe('/');
    expect(safeReturnTo('https://evil.example')).toBe('/');
    expect(safeReturnTo('//evil.example')).toBe('/');
    expect(safeReturnTo('payment')).toBe('/');
  });
});
