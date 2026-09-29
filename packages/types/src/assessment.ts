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

/** Frequency response scale for assessment questions. One of 'always', 'usually', 'sometimes', 'rarely', or 'never'. */
export type Frequency = 'always' | 'usually' | 'sometimes' | 'rarely' | 'never';

/** Yes/No/Unsure response for assessment questions. */
export type YesNoUnsure = 'yes' | 'no' | 'unsure';

/** Numeric scale value for control/maturity assessments (1-5). */
export type ScaleValue = 1 | 2 | 3 | 4 | 5;

/** Currency value in British pounds. */
export type CurrencyValue = number;

// Module 1: Risk Appetite Assessment
export interface RiskAppetiteModule {
  tolerance: ScaleValue;
  fraudSeriousness: 'critical' | 'serious' | 'moderate' | 'minor';
  reputationImportance: ScaleValue;
}

// Module 2: Fraud Triangle
export interface FraudTriangleModule {
  pressure: 'high' | 'medium' | 'low' | 'none';
  opportunity: 'high' | 'medium' | 'low' | 'none';
  rationalization: ScaleValue;
  estimatedLossExposure: CurrencyValue;
}

// Module 3: People & Culture
export interface PeopleCultureModule {
  fraudAwarenessFrequency: Frequency;
  whistleblowingConfidence: ScaleValue;
  codeOfConductCommunication: ScaleValue;
  fraudCasesDetected: YesNoUnsure;
  caseDescription?: string;
  fraudCaseCount?: number;
}

// Module 4: Controls & Technology
export interface ControlsTechnologyModule {
  segregationOfDutiesMaturity: ScaleValue;
  systemAccessControls: ScaleValue;
  dataMonitoringMaturity: ScaleValue;
  implementationPercentage: number;
  softwareLicenseCount?: number;
}

// Module 5: Procurement
export interface ProcurementModule {
  supplierDueDiligenceMaturity: ScaleValue;
  monthlySpend: CurrencyValue;
  recentFraud: YesNoUnsure;
  fraudDescription?: string;
  controlMaturity: ScaleValue;
  supplierCount?: number;
}

// Module 6: Payroll & HR
export interface PayrollHRModule {
  totalEmployeeCount: number;
  payrollFrequency: Frequency;
  unauthorizedChangesDetected: YesNoUnsure;
  changeDescription?: string;
  controlMaturity: ScaleValue;
}

// Module 7: Revenue & Income
export interface RevenueModule {
  monthlyRevenueVolume: CurrencyValue;
  unpaidInvoicesPercentage: number;
  writeOffsOccurred: YesNoUnsure;
  writeOffDescription?: string;
  collectionEffectiveness: ScaleValue;
}

// Module 8: Cash & Banking
export interface CashBankingModule {
  dailyCashVolume: CurrencyValue;
  bankAccountCount: number;
  fraudIncidents: YesNoUnsure;
  fraudDescription?: string;
  controlEffectiveness: ScaleValue;
}

// Module 9: IT Systems & Cybersecurity
export interface ITSystemsModule {
  cybersecurityMaturity: ScaleValue;
  securityIncidentCount: number;
  criticalSystemsIdentified: boolean;
  backupTestingFrequency: ScaleValue;
  mfaAdoption: ScaleValue;
}

// Module 10: Monitoring & Evaluation
export interface MonitoringEvaluationModule {
  incidentsDetectedFrequency: Frequency;
  internalAuditFrequency: Frequency;
  anomalyMonitoringMaturity: ScaleValue;
  anomalyCount?: number;
  investigationCompletionRate: ScaleValue;
}

// Module 11: Fraud Response Plan
export interface FraudResponsePlanModule {
  responsePlanExists: boolean;
  communicationProtocolMaturity: ScaleValue;
  detectedLossValue: CurrencyValue;
  responseTimeHours?: number;
  recoveryRate: ScaleValue;
}

// Module 12: Training & Awareness
export interface TrainingAwarenessModule {
  trainingCompletionPercentage: number;
  staffCount: number;
  trainingFrequency: Frequency;
  complianceCertificationExists: boolean;
  knowledgeAssessmentScore?: number;
}

// Module 13: Compliance Mapping
export interface ComplianceMappingModule {
  govs013Compliance: ScaleValue;
  eccta2023Alignment: ScaleValue;
  failureToPreventsReadiness: ScaleValue;
  auditTrailRetentionYears: number;
  regulatoryDocumentsUpToDate: boolean;
}
