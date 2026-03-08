/** Risk severity level. One of 'HIGH', 'MEDIUM', or 'LOW'. */
export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

/** Strength rating for an internal control. One of 'VERY_STRONG', 'REASONABLY_STRONG', 'SOME_GAPS', or 'WEAK'. */
export type ControlStrength =
  | 'VERY_STRONG'
  | 'REASONABLY_STRONG'
  | 'SOME_GAPS'
  | 'WEAK';

/** Identifier for each of the 13 fraud risk assessment modules. */
export type AssessmentModule =
  | 'risk-appetite'
  | 'fraud-triangle'
  | 'people-culture'
  | 'controls-technology'
  | 'procurement'
  | 'payroll-hr'
  | 'revenue'
  | 'cash-banking'
  | 'it-systems'
  | 'monitoring-evaluation'
  | 'fraud-response'
  | 'training-awareness'
  | 'compliance-mapping';

/** Lifecycle status of an assessment. One of 'draft', 'in_progress', 'submitted', or 'completed'. */
export type AssessmentStatus =
  | 'draft'
  | 'in_progress'
  | 'submitted'
  | 'completed';

/** An individual risk entry in the risk register, capturing impact, likelihood, control strength, and mitigation details. */
export interface RiskRegisterItem {
  id: string;
  assessmentId: string;
  module: AssessmentModule;
  riskDescription: string;
  impact: number;
  likelihood: number;
  inherentRiskScore: number;
  controlStrength: ControlStrength;
  residualRiskScore: number;
  priority: RiskLevel;
  mitigationAction?: string;
  owner?: string;
  targetDate?: string;
  createdAt: string;
  updatedAt: string;
}

/** A single answer to an assessment question, associated with a specific module. */
export interface AssessmentAnswer {
  id: string;
  assessmentId: string;
  module: AssessmentModule;
  questionId: string;
  answer: string | number | boolean | string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

/** A fraud risk assessment belonging to an organisation, tracking status, risk scoring, and report generation. */
export interface Assessment {
  id: string;
  organisationId: string;
  userId: string;
  packageId: number;
  status: AssessmentStatus;
  startedAt: string;
  completedAt?: string;
  signedAt?: string;
  signatureUrl?: string;
  overallRiskScore?: number;
  overallRiskLevel?: RiskLevel;
  reportUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/** Tracks module-level completion progress for an assessment. */
export interface AssessmentProgress {
  assessmentId: string;
  completedModules: AssessmentModule[];
  currentModule?: AssessmentModule;
  percentComplete: number;
}
