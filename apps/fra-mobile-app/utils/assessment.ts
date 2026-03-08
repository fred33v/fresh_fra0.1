/**
 * Assessment Utility Functions
 *
 * Pure functions extracted from AssessmentContext for testability and reuse.
 * These handle ID generation, empty assessment creation, and risk scoring.
 */

import type {
  AssessmentData,
  AssessmentStatus,
  PaymentStatus,
  RiskRegisterItem,
  RiskPriority,
} from '@/types/assessment';

/**
 * Generate a unique local assessment ID.
 * Format: fra-{timestamp}-{random alphanumeric}
 */
export function generateId(): string {
  return `fra-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Check whether an assessment ID is a locally-generated one (not yet synced
 * to the backend). Local IDs always start with 'fra-'.
 */
export function isLocalOnlyAssessmentId(id: string): boolean {
  return id.startsWith('fra-');
}

/**
 * Return a complete blank AssessmentData object with every field initialised
 * to its default value.
 */
export function createEmptyAssessment(
  userId: string = '',
  organisationId: string = '',
): AssessmentData {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    status: 'draft' as AssessmentStatus,
    createdAt: now,
    updatedAt: now,
    userId,
    organisationId,
    organisation: {
      name: '',
      type: null,
      employeeCount: null,
      region: '',
      activities: '',
    },
    riskAppetite: {
      tolerance: null,
      fraudSeriousness: null,
      reputationImportance: null,
    },
    fraudTriangle: {
      pressure: null,
      controlStrength: null,
      speakUpCulture: null,
    },
    procurement: {
      q1: null,
      q2: null,
      q3: null,
      dueDiligenceLevel: null,
      monthlySpend: null,
      recentFraud: null,
      fraudDescription: '',
      controlMaturity: null,
      notes: ''
    },
    cashBanking: {
      q1: null,
      q2: null,
      dailyCashVolume: null,
      bankAccountCount: null,
      fraudIncidents: null,
      fraudDescription: '',
      controlEffectiveness: null,
      notes: ''
    },
    payrollHR: {
      q1: null,
      q2: null,
      totalEmployeeCount: null,
      payrollFrequency: null,
      unauthorizedChangesDetected: null,
      changeDescription: '',
      controlMaturity: null,
      notes: ''
    },
    revenue: {
      q1: null,
      q2: null,
      monthlyRevenueVolume: null,
      unpaidInvoicesPercentage: null,
      writeOffsOccurred: null,
      writeOffDescription: '',
      collectionEffectiveness: null,
      notes: ''
    },
    itSystems: {
      q1: null,
      q2: null,
      cybersecurityMaturity: null,
      securityIncidentsCount: null,
      hasCriticalSystems: null,
      criticalSystemsDescription: '',
      backupTestingFrequency: null,
      mfaAdoption: null,
      notes: ''
    },
    peopleCulture: {
      staffChecks: null,
      staffCheckMaturity: null,
      whistleblowing: null,
      whistleblowingUsed: null,
      whistleblowingDetails: '',
      leadershipMessage: null,
      leadershipMessagingIntensity: null,
    },
    controlsTechnology: {
      segregation: null,
      segregationMaturity: null,
      accessManagement: null,
      accessMaturity: null,
      monitoring: null,
      automatedMonitoring: null,
      automatedMonitoringDetails: '',
    },
    priorities: '',
    riskRegister: [],
    paymentsModule: {
      risks: [],
      controls: [],
      monitoringRules: [],
      kpis: {
        duplicatePayments: 0,
        manualOverrides: 0,
        supplierVerificationRate: 0,
        payrollChangeApprovals: 0,
      },
      notes: '',
    },
    trainingAwareness: {
      mandatoryTraining: [],
      specialistTraining: [],
      boardTraining: [],
      overallCompletionRate: 0,
      notes: '',
    },
    monitoringEvaluation: {
      kpis: [],
      reviewFrequency: 'quarterly',
      lastReviewDate: null,
      nextReviewDate: null,
      responsiblePerson: '',
      notes: '',
    },
    complianceMapping: {
      govS013: {
        status: 'not-assessed',
        gaps: [],
        actions: [],
      },
      fraudPreventionStandard: {
        status: 'not-assessed',
        gaps: [],
        actions: [],
      },
      eccta2023: {
        status: 'not-assessed',
        gaps: [],
        actions: [],
      },
      notes: '',
    },
    fraudResponsePlan: {
      reportingTimelines: {
        logIncident: 24,
        initialAssessment: 48,
        investigationStart: 72,
      },
      investigationLifecycle: {
        triage: 2,
        investigation: 10,
        findings: 3,
        closure: 5,
      },
      disciplinaryMeasures: ['Verbal Warning', 'Written Warning', 'Suspension', 'Dismissal', 'Prosecution'],
      externalReporting: 'Regulatory reporting within 7 days where legally required',
      notes: '',
    },
    actionPlan: {
      highPriority: [],
      mediumPriority: [],
      lowPriority: [],
    },
    documentControl: {
      version: '2.0',
      lastUpdated: now,
      reviewedBy: '',
      approvedBy: '',
      retentionPeriod: '7 years',
      classification: 'Internal',
    },
    payment: {
      packageType: null,
      price: 795,
      transactionId: null,
      status: 'pending' as PaymentStatus,
      date: null,
    },
    signature: null,
    feedback: null,
  };
}

/**
 * Risk scoring engine.
 *
 * Evaluates an assessment's answers and returns a list of identified risks
 * with inherent / residual scores, priorities, and suggested owners.
 */
export function calculateRiskScore(assessment: AssessmentData): RiskRegisterItem[] {
  const risks: RiskRegisterItem[] = [];
  let riskCounter = 1;

  const getControlReduction = (strength: string | null): number => {
    if (strength === 'very-strong' || strength === 'well-separated') return 0.4;
    if (strength === 'reasonably-strong' || strength === 'partly') return 0.2;
    return 0;
  };

  const getPriority = (score: number): RiskPriority => {
    if (score >= 15) return 'high';
    if (score >= 8) return 'medium';
    return 'low';
  };

  const addRisk = (
    title: string,
    area: string,
    description: string,
    impact: number,
    likelihood: number,
    controlReduction: number,
    owner: string
  ) => {
    const inherent = impact * likelihood;
    const residual = Math.round(inherent * (1 - controlReduction));
    risks.push({
      id: `FRA-${String(riskCounter).padStart(3, '0')}`,
      title,
      area,
      description,
      inherentScore: inherent,
      residualScore: residual,
      priority: getPriority(residual),
      suggestedOwner: owner,
    });
    riskCounter++;
  };

  const controlReduction = getControlReduction(assessment.fraudTriangle.controlStrength);

  if (assessment.procurement.q1 === 'rarely' || assessment.procurement.q1 === 'never' || assessment.procurement.q2 === 'rarely') {
    addRisk(
      'Supplier fraud',
      'Procurement',
      'Weak procurement controls may allow fraudulent supplier relationships or inflated invoicing.',
      4,
      4,
      controlReduction,
      'Head of Procurement'
    );
  }

  if (assessment.cashBanking.q1 === 'rarely' || assessment.cashBanking.q1 === 'never') {
    addRisk(
      'Cash misappropriation',
      'Cash & Banking',
      'Insufficient cash handling controls increase risk of theft or misappropriation.',
      4,
      3,
      controlReduction,
      'Finance Manager'
    );
  }

  if (assessment.payrollHR.q1 === 'rarely' || assessment.payrollHR.q1 === 'never') {
    addRisk(
      'Payroll fraud',
      'Payroll & HR',
      'Weak payroll controls may enable ghost employees or timesheet manipulation.',
      3,
      3,
      controlReduction,
      'HR Manager'
    );
  }

  if (assessment.revenue.q1 === 'rarely' || assessment.revenue.q1 === 'never') {
    addRisk(
      'Revenue leakage',
      'Revenue',
      'Poor revenue controls may lead to unrecorded income or fee manipulation.',
      4,
      3,
      controlReduction,
      'Finance Director'
    );
  }

  if (assessment.itSystems.q1 === 'rarely' || assessment.itSystems.q1 === 'never') {
    addRisk(
      'Cyber fraud',
      'IT Systems',
      'Weak IT access controls increase vulnerability to internal and external cyber fraud.',
      5,
      4,
      controlReduction,
      'IT Lead'
    );
  }

  if (assessment.peopleCulture.whistleblowing === 'no-formal') {
    addRisk(
      'Unreported fraud',
      'People & Culture',
      'Absence of whistleblowing mechanisms prevents detection of fraudulent activity.',
      3,
      4,
      controlReduction * 0.5,
      'HR Director'
    );
  }

  if (assessment.controlsTechnology.segregation === 'one-person' || assessment.controlsTechnology.segregation === 'not-sure') {
    addRisk(
      'Segregation of duties failure',
      'Controls',
      'Lack of segregation allows single individuals to execute and conceal fraudulent transactions.',
      5,
      4,
      0,
      'Chief Operating Officer'
    );
  }

  if (risks.length === 0) {
    addRisk(
      'General fraud risk',
      'Overall',
      'While specific indicators are limited, all organisations face some inherent fraud risk.',
      2,
      2,
      controlReduction,
      'Senior Management Team'
    );
  }

  return risks;
}
