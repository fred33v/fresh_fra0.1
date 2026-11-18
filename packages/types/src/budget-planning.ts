/** Assessment-specific budget planning; distinct from budget-holder training progress. */
export interface BudgetPlanningAppetite {
  level: 'low' | 'medium' | 'high';
  justification: string;
  updated_at: string;
}
export interface BudgetPlanningMitigation {
  id: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  category: 'prevention' | 'detection' | 'response' | 'culture';
  description: string;
  budget: number;
  timeline: '1-3 months' | '3-6 months' | '6-12 months' | '12+ months';
  status: 'planned' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
}
export type BudgetPlanningMitigationInput = Omit<
  BudgetPlanningMitigation,
  'id' | 'created_at' | 'updated_at'
>;
export interface BudgetPlanningPlan {
  id: string;
  assessment_id: string;
  version: number;
  riskAppetite: BudgetPlanningAppetite | null;
  mitigations: BudgetPlanningMitigation[];
  completed_at: string | null;
  updated_at: string;
}
