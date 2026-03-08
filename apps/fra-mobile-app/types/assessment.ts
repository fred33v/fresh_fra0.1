export type OrganisationType = 'charity' | 'public-sector' | 'private-sme' | 'large-corporate';
export type EmployeeCount = '1-10' | '11-50' | '51-100' | '101-250' | '251-1000' | '1001+';
export type RiskTolerance = 'low' | 'medium' | 'high';
export type FraudSeriousness = 'very-serious' | 'quite-serious' | 'manageable' | 'not-serious';
export type ReputationImportance = 'critical' | 'important' | 'somewhat' | 'low';
export type Pressure = 'very-high' | 'high' | 'moderate' | 'low';
export type ControlStrength = 'very-strong' | 'reasonably-strong' | 'some-gaps' | 'weak';
export type SpeakUpCulture = 'very-confident' | 'quite-confident' | 'not-sure' | 'not-confident';
export type Frequency = 'always' | 'usually' | 'sometimes' | 'rarely' | 'never';
export type YesNoUnsure = 'yes' | 'no' | 'not-sure';
export type SegregationLevel = 'well-separated' | 'partly' | 'one-person' | 'not-sure';
export type ConfidenceLevel = 'very-confident' | 'quite-confident' | 'some-gaps' | 'not-confident';
export type MonitoringLevel = 'regularly' | 'some-basic' | 'very-limited' | 'none';
export type WhistleblowingRoute = 'well-communicated' | 'exists-not-known' | 'no-formal';
export type LeadershipMessage = 'very-clear' | 'quite-clear' | 'occasionally' | 'not-discussed';
export type PackageType = 'health-check' | 'with-awareness' | 'with-dashboard';
export type PaymentStatus = 'pending' | 'success' | 'failed';
export type AssessmentStatus = 'draft' | 'submitted' | 'paid' | 'signed';
export type RiskPriority = 'high' | 'medium' | 'low';
export type UserRole = 'employer' | 'employee' | 'admin';
export type KeyPassStatus = 'unused' | 'used' | 'expired';
export type OrganisationSize = 'small' | 'medium' | 'large';
export type PaymentRiskArea = 'supplier' | 'payroll' | 'refunds' | 'treasury' | 'high-value';
export type ControlEffectiveness = 'strong' | 'adequate' | 'weak' | 'not-assessed';
export type TrainingStatus = 'completed' | 'in-progress' | 'not-started' | 'overdue';
export type MonitoringFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ComplianceStatus = 'compliant' | 'partially-compliant' | 'non-compliant' | 'not-assessed';

// Phase 2: Enhanced Question Types
export type QuestionType = 'frequency' | 'scale' | 'yesno' | 'multichoice' | 'currency' | 'percentage' | 'text';
export type ScaleValue = 1 | 2 | 3 | 4 | 5;
export type CurrencyValue = number; // Amount in GBP
export type PercentageValue = number; // 0-100

export interface ScaleQuestion {
  type: 'scale';
  question: string;
  minLabel: string;
  maxLabel: string;
  value: ScaleValue | null;
}

export interface FrequencyQuestion {
  type: 'frequency';
  question: string;
  value: Frequency | null;
}

export interface YesNoQuestion {
  type: 'yesno';
  question: string;
  followUp?: string; // Question to ask if "yes"
  value: YesNoUnsure | null;
  followUpValue?: string;
}

export interface MultiChoiceQuestion {
  type: 'multichoice';
  question: string;
  options: { value: string; label: string; riskWeight: number }[];
  value: string[] | null;
}

export interface CurrencyQuestion {
  type: 'currency';
  question: string;
  hint?: string;
  value: CurrencyValue | null;
}

export interface PercentageQuestion {
  type: 'percentage';
  question: string;
  hint?: string;
  value: PercentageValue | null;
}

export interface TextQuestion {
  type: 'text';
  question: string;
  placeholder?: string;
  value: string;
}

export type EnhancedQuestion =
  | ScaleQuestion
  | FrequencyQuestion
  | YesNoQuestion
  | MultiChoiceQuestion
  | CurrencyQuestion
  | PercentageQuestion
  | TextQuestion;

export interface OrganisationInfo {
  name: string;
  type: OrganisationType | null;
  employeeCount: EmployeeCount | null;
  region: string;
  activities: string;
}

export interface RiskAppetite {
  tolerance: RiskTolerance | ScaleValue | null;
  fraudSeriousness: FraudSeriousness | null;
  reputationImportance: ReputationImportance | ScaleValue | null;
}

export interface FraudTriangle {
  pressure: Pressure | null;
  controlStrength: ControlStrength | null;
  speakUpCulture: SpeakUpCulture | null;
  estimatedLossExposure: CurrencyValue | null;
  rationalizationRisk: ScaleValue | null;
}

export interface ProcessRiskAnswers {
  q1: Frequency | YesNoUnsure | null;
  q2: Frequency | YesNoUnsure | null;
  q3?: Frequency | YesNoUnsure | null;
  notes: string;
}

export interface EnhancedProcurementAnswers extends ProcessRiskAnswers {
  dueDiligenceLevel: ScaleValue | null;
  monthlySpend: CurrencyValue | null;
  recentFraud: YesNoUnsure | null;
  fraudDescription: string;
  controlMaturity: ScaleValue | null;
}

export interface EnhancedITSystemsAnswers extends ProcessRiskAnswers {
  cybersecurityMaturity: ScaleValue | null;
  securityIncidentsCount: CurrencyValue | null;
  hasCriticalSystems: YesNoUnsure | null;
  criticalSystemsDescription: string;
  backupTestingFrequency: ScaleValue | null;
  mfaAdoption: ScaleValue | null;
}

export interface EnhancedCashBankingAnswers extends ProcessRiskAnswers {
  dailyCashVolume: CurrencyValue | null;
  bankAccountCount: CurrencyValue | null;
  fraudIncidents: YesNoUnsure | null;
  fraudDescription: string;
  controlEffectiveness: ScaleValue | null;
}

export interface EnhancedPayrollHRAnswers extends ProcessRiskAnswers {
  totalEmployeeCount: CurrencyValue | null;
  payrollFrequency: Frequency | null;
  unauthorizedChangesDetected: YesNoUnsure | null;
  changeDescription: string;
  controlMaturity: ScaleValue | null;
}

export interface EnhancedRevenueAnswers extends ProcessRiskAnswers {
  monthlyRevenueVolume: CurrencyValue | null;
  unpaidInvoicesPercentage: CurrencyValue | null;
  writeOffsOccurred: YesNoUnsure | null;
  writeOffDescription: string;
  collectionEffectiveness: ScaleValue | null;
}

export interface EnhancedPeopleCultureAnswers {
  staffChecks: Frequency | null;
  staffCheckMaturity: ScaleValue | null;
  whistleblowing: WhistleblowingRoute | null;
  whistleblowingUsed: YesNoUnsure | null;
  whistleblowingDetails: string;
  leadershipMessage: LeadershipMessage | null;
  leadershipMessagingIntensity: ScaleValue | null;
}

export interface EnhancedControlsTechnologyAnswers {
  segregation: SegregationLevel | null;
  segregationMaturity: ScaleValue | null;
  accessManagement: ConfidenceLevel | null;
  accessMaturity: ScaleValue | null;
  monitoring: MonitoringLevel | null;
  automatedMonitoring: YesNoUnsure | null;
  automatedMonitoringDetails: string;
}

export interface PeopleCulture {
  staffChecks: Frequency | null;
  whistleblowing: WhistleblowingRoute | null;
  leadershipMessage: LeadershipMessage | null;
}

export interface ControlsTechnology {
  segregation: SegregationLevel | null;
  accessManagement: ConfidenceLevel | null;
  monitoring: MonitoringLevel | null;
}

export interface RiskRegisterItem {
  id: string;
  title: string;
  area: string;
  description: string;
  inherentScore: number;
  residualScore: number;
  priority: RiskPriority;
  suggestedOwner: string;
}

export interface Package {
  id: PackageType;
  name: string;
  description: string;
  price: number;
  features: string[];
}

export interface PaymentDetails {
  packageType: PackageType | null;
  price: number;
  transactionId: string | null;
  status: PaymentStatus;
  date: string | null;
}

export interface FeedbackData {
  id: string;
  assessmentId: string;
  rating: number | null;
  whatWorkedWell: string;
  improvements: string;
  consentFollowUp: boolean;
  date: string;
}

export interface UserData {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  organisationId: string | null;
  createdAt: string;
  lastLogin: string | null;
  keyPassCode?: string;
}

export interface OrganisationData {
  id: string;
  name: string;
  type: OrganisationType | null;
  employeeBand: EmployeeCount | null;
  size: OrganisationSize;
  createdAt: string;
  packageType: PackageType | null;
  keyPassesAllocated: number;
  keyPassesUsed: number;
}

export interface KeyPass {
  id: string;
  code: string;
  organisationId: string;
  status: KeyPassStatus;
  usedByUserId: string | null;
  createdAt: string;
  usedAt: string | null;
}

export interface SignatureData {
  id: string;
  assessmentId: string;
  signedByUserId: string;
  signatoryName: string;
  signatoryRole: string;
  signatureImage: string;
  signedAt: string;
}

export interface EmployeeAssessmentStatus {
  userId: string;
  userName: string;
  email: string;
  status: 'not-started' | 'in-progress' | 'completed';
  startedAt: string | null;
  completedAt: string | null;
  overallRiskLevel: RiskPriority | null;
}

export interface PaymentRisk {
  id: string;
  area: PaymentRiskArea;
  title: string;
  description: string;
  scenarios: string[];
  impactScore: number;
  likelihoodScore: number;
  inherentScore: number;
  controlEffectiveness: ControlEffectiveness;
  residualScore: number;
  recommendedActions: string[];
  owner: string;
}

export interface PaymentControl {
  id: string;
  area: PaymentRiskArea;
  controlName: string;
  effectiveness: ControlEffectiveness;
  gaps: string[];
  recommendations: string[];
}

export interface MonitoringRule {
  id: string;
  name: string;
  description: string;
  frequency: MonitoringFrequency;
  alertSeverity: AlertSeverity;
  enabled: boolean;
  owner: string;
}

export interface PaymentsModule {
  risks: PaymentRisk[];
  controls: PaymentControl[];
  monitoringRules: MonitoringRule[];
  kpis: {
    duplicatePayments: number;
    manualOverrides: number;
    supplierVerificationRate: number;
    payrollChangeApprovals: number;
  };
  notes: string;
}

export interface TrainingRecord {
  id: string;
  trainingType: string;
  targetAudience: string;
  frequency: MonitoringFrequency;
  completionRate: number;
  status: TrainingStatus;
  lastDelivered: string | null;
  nextScheduled: string | null;
}

export interface TrainingAwareness {
  mandatoryTraining: TrainingRecord[];
  specialistTraining: TrainingRecord[];
  boardTraining: TrainingRecord[];
  overallCompletionRate: number;
  mandatoryCompletedCount: number;
  specialistCompletedCount: number;
  boardCompletedCount: number;
  notes: string;
}

export interface KPI {
  id: string;
  name: string;
  target: number;
  current: number;
  unit: string;
  frequency: MonitoringFrequency;
  status: 'on-track' | 'at-risk' | 'off-track';
}

export interface MonitoringEvaluation {
  kpis: KPI[];
  reviewFrequency: MonitoringFrequency;
  lastReviewDate: string | null;
  nextReviewDate: string | null;
  responsiblePerson: string;
  fraudIncidentsDetected: number;
  suspiciousTradeDetected: number;
  fraudRiskLikelihood: ScaleValue | null;
  notes: string;
}

export interface ComplianceMapping {
  govS013: {
    status: ComplianceStatus;
    gaps: string[];
    actions: string[];
  };
  fraudPreventionStandard: {
    status: ComplianceStatus;
    gaps: string[];
    actions: string[];
  };
  eccta2023: {
    status: ComplianceStatus;
    gaps: string[];
    actions: string[];
  };
  notes: string;
}

export interface FraudResponsePlan {
  reportingTimelines: {
    logIncident: number;
    initialAssessment: number;
    investigationStart: number;
  };
  investigationLifecycle: {
    triage: number;
    investigation: number;
    findings: number;
    closure: number;
  };
  disciplinaryMeasures: string[];
  externalReporting: string;
  detectedLossesValue: CurrencyValue | null;
  responseSpeed: ScaleValue | null;
  notes: string;
}

export interface ActionItem {
  id: string;
  title: string;
  priority: RiskPriority;
  timeline: string;
  owner: string;
  status: 'not-started' | 'in-progress' | 'completed';
  dueDate: string | null;
}

export interface ActionPlan {
  highPriority: ActionItem[];
  mediumPriority: ActionItem[];
  lowPriority: ActionItem[];
}

export interface DocumentControl {
  version: string;
  lastUpdated: string;
  reviewedBy: string;
  approvedBy: string;
  retentionPeriod: string;
  classification: string;
}

export interface AssessmentData {
  id: string;
  status: AssessmentStatus;
  createdAt: string;
  updatedAt: string;
  userId: string;
  organisationId: string;
  organisation: OrganisationInfo;
  riskAppetite: RiskAppetite;
  fraudTriangle: FraudTriangle;
  procurement: EnhancedProcurementAnswers;
  cashBanking: EnhancedCashBankingAnswers;
  payrollHR: EnhancedPayrollHRAnswers;
  revenue: EnhancedRevenueAnswers;
  itSystems: EnhancedITSystemsAnswers;
  peopleCulture: EnhancedPeopleCultureAnswers;
  controlsTechnology: EnhancedControlsTechnologyAnswers;
  priorities: string;
  riskRegister: RiskRegisterItem[];
  paymentsModule: PaymentsModule;
  trainingAwareness: TrainingAwareness;
  monitoringEvaluation: MonitoringEvaluation;
  complianceMapping: ComplianceMapping;
  fraudResponsePlan: FraudResponsePlan;
  actionPlan: ActionPlan;
  documentControl: DocumentControl;
  payment: PaymentDetails;
  signature: SignatureData | null;
  feedback: FeedbackData | null;
}
