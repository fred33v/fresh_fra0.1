// Enterprise budget holder programme: shapes returned by /api/v1/budget-holder.

export type BudgetHolderStatus = 'not_started' | 'in_progress' | 'completed' | 'renewal_due';

export interface BudgetHolderProgress {
  required: boolean;
  status: BudgetHolderStatus;
  completedParts: string[];
  /** Parts done that count towards completion (all but the resources page) */
  requiredPartsDone: number;
  scenarioScore: number | null;
  scenarioPassed: boolean;
  pledgeName: string | null;
  pledgedAt: string | null;
  conflictDeclared: boolean | null;
  conflictDetails: string | null;
  completedAt: string | null;
  renewalDueAt: string | null;
  previousCompletedAt: string | null;
}

/** Every part except the resources page, which is for reference. */
export const BUDGET_HOLDER_REQUIRED_PARTS = 10;

export const BUDGET_HOLDER_STATUS_LABEL: Record<BudgetHolderStatus, string> = {
  not_started: 'Not started', in_progress: 'In progress', completed: 'Completed', renewal_due: 'Renewal due',
};
