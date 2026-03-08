/** Tracks progress through the Budget Guide workflow. */
export interface BudgetGuideProgress {
  id: string;
  userId: string;
  organisationId: string;
  currentScreen: number;
  totalScreens: number;
  completionPercentage: number;
  isCompleted: boolean;
  startedAt: string;
  completedAt?: string;
  lastActivityAt: string;
}

/** Risk appetite assessment within the Budget Guide. */
export interface BudgetGuideRiskAppetite {
  id: string;
  userId: string;
  progressId: string;
  overallRiskTolerance: number; // 1-5 scale
  fraudImpactTolerance: number; // 1-5 scale
  reputationRiskTolerance: number; // 1-5 scale
  financialLossTolerance: number; // 1-5 scale
  riskProfile: 'conservative' | 'moderate' | 'aggressive';
  assessedAt: string;
}

/** Mitigation strategy and action plan from Budget Guide. */
export interface BudgetGuideMitigationStrategy {
  id: string;
  userId: string;
  progressId: string;
  immediateActions: string[];
  thirtyDayActions: string[];
  ninetyDayActions: string[];
  ownerName?: string;
  ownerEmail?: string;
  targetCompletionDate?: string;
  createdAt: string;
  updatedAt: string;
}

/** Risk appetite request payload for Budget Guide assessment. */
export interface BudgetGuideRiskAppetiteRequest {
  overallRiskTolerance: number;
  fraudImpactTolerance: number;
  reputationRiskTolerance: number;
  financialLossTolerance: number;
}

/** Mitigation strategy request payload for Budget Guide completion. */
export interface BudgetGuideMitigationRequest {
  immediateActions: string[];
  thirtyDayActions: string[];
  ninetyDayActions: string[];
  ownerName?: string;
  ownerEmail?: string;
  targetCompletionDate?: string;
}
