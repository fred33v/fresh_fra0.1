import { describe, it, expect } from 'vitest';
import type {
  BudgetGuideProgress,
  BudgetGuideRiskAppetite,
  BudgetGuideMitigationStrategy,
} from '../budget-guide';

describe('Budget Guide Types', () => {
  describe('BudgetGuideProgress', () => {
    it('tracks progress through screens', () => {
      const progress: BudgetGuideProgress = {
        id: 'bgp123',
        userId: 'user123',
        organisationId: 'org123',
        currentScreen: 3,
        totalScreens: 10,
        completionPercentage: 30,
        isCompleted: false,
        startedAt: '2026-03-08T00:00:00Z',
        lastActivityAt: '2026-03-08T01:00:00Z',
      };

      expect(progress.currentScreen).toBeLessThanOrEqual(progress.totalScreens);
      expect(progress.completionPercentage).toBeLessThanOrEqual(100);
      expect(progress.completionPercentage).toBeGreaterThanOrEqual(0);
    });

    it('has optional completedAt for finished workflows', () => {
      const progress: BudgetGuideProgress = {
        id: 'bgp123',
        userId: 'user123',
        organisationId: 'org123',
        currentScreen: 10,
        totalScreens: 10,
        completionPercentage: 100,
        isCompleted: true,
        startedAt: '2026-03-08T00:00:00Z',
        completedAt: '2026-03-08T02:00:00Z',
        lastActivityAt: '2026-03-08T02:00:00Z',
      };

      expect(progress.isCompleted).toBe(true);
      expect(progress.completedAt).toBeDefined();
    });
  });

  describe('BudgetGuideRiskAppetite', () => {
    it('captures all tolerance dimensions', () => {
      const appetite: BudgetGuideRiskAppetite = {
        id: 'bgra123',
        userId: 'user123',
        progressId: 'bgp123',
        overallRiskTolerance: 3,
        fraudImpactTolerance: 2,
        reputationRiskTolerance: 4,
        financialLossTolerance: 3,
        riskProfile: 'moderate',
        assessedAt: '2026-03-08T00:00:00Z',
      };

      expect(appetite.overallRiskTolerance).toBeGreaterThanOrEqual(1);
      expect(appetite.overallRiskTolerance).toBeLessThanOrEqual(5);
      expect(['conservative', 'moderate', 'aggressive']).toContain(appetite.riskProfile);
    });

    it('supports all risk profiles', () => {
      const profiles = ['conservative', 'moderate', 'aggressive'] as const;

      profiles.forEach((profile) => {
        const appetite: BudgetGuideRiskAppetite = {
          id: 'bgra123',
          userId: 'user123',
          progressId: 'bgp123',
          overallRiskTolerance: 3,
          fraudImpactTolerance: 3,
          reputationRiskTolerance: 3,
          financialLossTolerance: 3,
          riskProfile: profile,
          assessedAt: '2026-03-08T00:00:00Z',
        };

        expect(appetite.riskProfile).toBe(profile);
      });
    });
  });

  describe('BudgetGuideMitigationStrategy', () => {
    it('captures action plans across three timelines', () => {
      const strategy: BudgetGuideMitigationStrategy = {
        id: 'bgms123',
        userId: 'user123',
        progressId: 'bgp123',
        immediateActions: ['Review vendor controls', 'Implement segregation of duties'],
        thirtyDayActions: ['Deploy monitoring system', 'Train staff on fraud awareness'],
        ninetyDayActions: ['Complete security audit', 'Establish fraud response team'],
        createdAt: '2026-03-08T00:00:00Z',
        updatedAt: '2026-03-08T00:00:00Z',
      };

      expect(strategy.immediateActions.length).toBeGreaterThan(0);
      expect(strategy.thirtyDayActions.length).toBeGreaterThan(0);
      expect(strategy.ninetyDayActions.length).toBeGreaterThan(0);
    });

    it('has optional owner details', () => {
      const strategy: BudgetGuideMitigationStrategy = {
        id: 'bgms123',
        userId: 'user123',
        progressId: 'bgp123',
        immediateActions: [],
        thirtyDayActions: [],
        ninetyDayActions: [],
        ownerName: 'John Doe',
        ownerEmail: 'john@company.com',
        targetCompletionDate: '2026-09-08',
        createdAt: '2026-03-08T00:00:00Z',
        updatedAt: '2026-03-08T00:00:00Z',
      };

      expect(strategy.ownerName).toBeDefined();
      expect(strategy.ownerEmail).toBeDefined();
      expect(strategy.targetCompletionDate).toBeDefined();
    });
  });
});
