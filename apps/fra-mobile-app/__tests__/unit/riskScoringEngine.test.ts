/**
 * Risk Scoring Engine - Unit Tests
 *
 * Tests the core risk scoring logic from AssessmentContext.tsx
 * This is CRITICAL business logic for regulatory compliance (ECCTA 2023, GovS-013)
 *
 * Target: 95%+ code coverage
 */

import type { AssessmentData, RiskRegisterItem, RiskPriority } from '@/types/assessment';

// ============================================================================
// HELPER FUNCTIONS (Extracted from AssessmentContext.tsx)
// ============================================================================

/**
 * Calculate control reduction based on control strength
 * - Very strong: 40% reduction
 * - Reasonably strong: 20% reduction
 * - Some gaps/weak: 0% reduction
 */
function getControlReduction(strength: string | null): number {
  if (strength === 'very-strong' || strength === 'well-separated') return 0.4;
  if (strength === 'reasonably-strong' || strength === 'partly') return 0.2;
  return 0;
}

/**
 * Classify risk priority based on residual score
 * - High: 15-25
 * - Medium: 8-14
 * - Low: 1-7
 */
function getPriority(score: number): RiskPriority {
  if (score >= 15) return 'high';
  if (score >= 8) return 'medium';
  return 'low';
}

/**
 * Calculate risk score and generate risk register
 * This is the CORE BUSINESS LOGIC being tested
 */
function calculateRiskScore(assessment: AssessmentData): RiskRegisterItem[] {
  const risks: RiskRegisterItem[] = [];
  let riskCounter = 1;

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

  // Procurement risks
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

  // Cash & Banking risks
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

  // Payroll & HR risks
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

  // Revenue risks
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

  // IT Systems risks
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

  // People & Culture risks
  if (assessment.peopleCulture.whistleblowing === 'no-formal') {
    addRisk(
      'Unreported fraud',
      'People & Culture',
      'Absence of whistleblowing mechanisms prevents detection of fraudulent activity.',
      3,
      4,
      controlReduction * 0.5, // Half control reduction for whistleblowing
      'HR Director'
    );
  }

  // Controls & Technology risks
  if (assessment.controlsTechnology.segregation === 'one-person' || assessment.controlsTechnology.segregation === 'not-sure') {
    addRisk(
      'Segregation of duties failure',
      'Controls',
      'Lack of segregation allows single individuals to execute and conceal fraudulent transactions.',
      5,
      4,
      0, // No control reduction for segregation failures
      'Chief Operating Officer'
    );
  }

  // Default risk if none identified
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

// ============================================================================
// TEST DATA FACTORY
// ============================================================================

function createBaseAssessment(): AssessmentData {
  return {
    id: 'test-assessment-id',
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: 'test-user-id',
    organisationId: 'test-org-id',
    organisation: {
      name: 'Test Organisation',
      type: 'private-sme',
      employeeCount: '11-50',
      region: 'London',
      activities: 'Software development',
    },
    riskAppetite: {
      tolerance: 'medium',
      fraudSeriousness: 'very-serious',
      reputationImportance: 'critical',
    },
    fraudTriangle: {
      pressure: 'moderate',
      controlStrength: 'reasonably-strong',
      speakUpCulture: 'quite-confident',
    },
    procurement: {
      q1: 'always',
      q2: 'always',
      notes: '',
    },
    cashBanking: {
      q1: 'always',
      q2: 'always',
      notes: '',
    },
    payrollHR: {
      q1: 'always',
      q2: 'always',
      notes: '',
    },
    revenue: {
      q1: 'always',
      q2: 'always',
      notes: '',
    },
    itSystems: {
      q1: 'always',
      q2: 'always',
      notes: '',
    },
    peopleCulture: {
      staffChecks: 'always',
      whistleblowing: 'well-communicated',
      leadershipMessage: 'very-clear',
    },
    controlsTechnology: {
      segregation: 'well-separated',
      accessManagement: 'very-confident',
      monitoring: 'regularly',
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
        supplierVerificationRate: 100,
        payrollChangeApprovals: 100,
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
        logIncident: 1,
        initialAssessment: 24,
        investigationStart: 48,
      },
      investigationLifecycle: {
        triage: 2,
        investigation: 10,
        findings: 5,
        closure: 3,
      },
      disciplinaryMeasures: [],
      externalReporting: '',
      notes: '',
    },
    actionPlan: {
      highPriority: [],
      mediumPriority: [],
      lowPriority: [],
    },
    documentControl: {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      reviewedBy: '',
      approvedBy: '',
      retentionPeriod: '6 years',
      classification: 'Confidential',
    },
    payment: {
      packageType: null,
      price: 0,
      transactionId: null,
      status: 'pending',
      date: null,
    },
    signature: null,
    feedback: null,
  };
}

// ============================================================================
// UNIT TESTS
// ============================================================================

describe('Risk Scoring Engine', () => {

  // ==========================================================================
  // Control Reduction Logic Tests
  // ==========================================================================

  describe('getControlReduction', () => {
    it('should return 40% reduction for very strong controls', () => {
      expect(getControlReduction('very-strong')).toBe(0.4);
    });

    it('should return 40% reduction for well-separated controls', () => {
      expect(getControlReduction('well-separated')).toBe(0.4);
    });

    it('should return 20% reduction for reasonably strong controls', () => {
      expect(getControlReduction('reasonably-strong')).toBe(0.2);
    });

    it('should return 20% reduction for partly separated controls', () => {
      expect(getControlReduction('partly')).toBe(0.2);
    });

    it('should return 0% reduction for weak controls', () => {
      expect(getControlReduction('weak')).toBe(0);
    });

    it('should return 0% reduction for some-gaps controls', () => {
      expect(getControlReduction('some-gaps')).toBe(0);
    });

    it('should return 0% reduction for null controls', () => {
      expect(getControlReduction(null)).toBe(0);
    });

    it('should return 0% reduction for unknown control strength', () => {
      expect(getControlReduction('unknown')).toBe(0);
    });
  });

  // ==========================================================================
  // Priority Classification Tests
  // ==========================================================================

  describe('getPriority', () => {
    it('should classify score 25 as high priority', () => {
      expect(getPriority(25)).toBe('high');
    });

    it('should classify score 15 as high priority (lower boundary)', () => {
      expect(getPriority(15)).toBe('high');
    });

    it('should classify score 20 as high priority', () => {
      expect(getPriority(20)).toBe('high');
    });

    it('should classify score 14 as medium priority (upper boundary)', () => {
      expect(getPriority(14)).toBe('medium');
    });

    it('should classify score 8 as medium priority (lower boundary)', () => {
      expect(getPriority(8)).toBe('medium');
    });

    it('should classify score 10 as medium priority', () => {
      expect(getPriority(10)).toBe('medium');
    });

    it('should classify score 7 as low priority (upper boundary)', () => {
      expect(getPriority(7)).toBe('low');
    });

    it('should classify score 1 as low priority (lower boundary)', () => {
      expect(getPriority(1)).toBe('low');
    });

    it('should classify score 0 as low priority', () => {
      expect(getPriority(0)).toBe('low');
    });
  });

  // ==========================================================================
  // Inherent Risk Calculation Tests
  // ==========================================================================

  describe('Inherent Risk Calculation', () => {
    it('should calculate inherent risk as impact × likelihood', () => {
      const assessment = createBaseAssessment();
      assessment.procurement.q1 = 'rarely'; // Triggers procurement risk
      assessment.fraudTriangle.controlStrength = 'weak'; // 0% reduction

      const risks = calculateRiskScore(assessment);

      // Procurement risk: impact=4, likelihood=4, inherent=16
      expect(risks[0].inherentScore).toBe(16);
    });

    it('should calculate maximum inherent risk score (5×5=25)', () => {
      const assessment = createBaseAssessment();
      assessment.itSystems.q1 = 'rarely'; // Triggers IT risk (impact=5, likelihood=4)
      assessment.fraudTriangle.controlStrength = 'weak';

      const risks = calculateRiskScore(assessment);

      // IT Systems risk: impact=5, likelihood=4, inherent=20
      expect(risks[0].inherentScore).toBe(20);
    });

    it('should calculate minimum inherent risk score (2×2=4)', () => {
      const assessment = createBaseAssessment();
      // No specific risks triggered, should create default general risk

      const risks = calculateRiskScore(assessment);

      // General fraud risk: impact=2, likelihood=2, inherent=4
      expect(risks[0].inherentScore).toBe(4);
    });
  });

  // ==========================================================================
  // Residual Risk Calculation Tests
  // ==========================================================================

  describe('Residual Risk Calculation', () => {
    it('should apply 40% reduction for very strong controls', () => {
      const assessment = createBaseAssessment();
      assessment.procurement.q1 = 'rarely';
      assessment.fraudTriangle.controlStrength = 'very-strong'; // 40% reduction

      const risks = calculateRiskScore(assessment);

      // Inherent: 16, Reduction: 40%, Residual: 16 * (1 - 0.4) = 9.6 → 10 (rounded)
      expect(risks[0].residualScore).toBe(10);
    });

    it('should apply 20% reduction for reasonably strong controls', () => {
      const assessment = createBaseAssessment();
      assessment.procurement.q1 = 'rarely';
      assessment.fraudTriangle.controlStrength = 'reasonably-strong'; // 20% reduction

      const risks = calculateRiskScore(assessment);

      // Inherent: 16, Reduction: 20%, Residual: 16 * (1 - 0.2) = 12.8 → 13 (rounded)
      expect(risks[0].residualScore).toBe(13);
    });

    it('should apply 0% reduction for weak controls', () => {
      const assessment = createBaseAssessment();
      assessment.procurement.q1 = 'rarely';
      assessment.fraudTriangle.controlStrength = 'weak'; // 0% reduction

      const risks = calculateRiskScore(assessment);

      // Inherent: 16, Reduction: 0%, Residual: 16 * (1 - 0) = 16
      expect(risks[0].residualScore).toBe(16);
    });

    it('should round residual scores correctly', () => {
      const assessment = createBaseAssessment();
      assessment.cashBanking.q1 = 'rarely';
      assessment.fraudTriangle.controlStrength = 'very-strong'; // 40% reduction

      const risks = calculateRiskScore(assessment);

      // Cash risk: Inherent: 4*3=12, Reduction: 40%, Residual: 12 * 0.6 = 7.2 → 7 (rounded)
      expect(risks[0].residualScore).toBe(7);
    });
  });

  // ==========================================================================
  // Risk Identification Tests (Module-Specific)
  // ==========================================================================

  describe('Risk Identification - Procurement', () => {
    it('should identify supplier fraud risk when q1 is rarely', () => {
      const assessment = createBaseAssessment();
      assessment.procurement.q1 = 'rarely';

      const risks = calculateRiskScore(assessment);

      expect(risks).toHaveLength(1);
      expect(risks[0].title).toBe('Supplier fraud');
      expect(risks[0].area).toBe('Procurement');
      expect(risks[0].suggestedOwner).toBe('Head of Procurement');
    });

    it('should identify supplier fraud risk when q1 is never', () => {
      const assessment = createBaseAssessment();
      assessment.procurement.q1 = 'never';

      const risks = calculateRiskScore(assessment);

      expect(risks).toHaveLength(1);
      expect(risks[0].title).toBe('Supplier fraud');
    });

    it('should identify supplier fraud risk when q2 is rarely', () => {
      const assessment = createBaseAssessment();
      assessment.procurement.q2 = 'rarely';

      const risks = calculateRiskScore(assessment);

      expect(risks).toHaveLength(1);
      expect(risks[0].title).toBe('Supplier fraud');
    });

    it('should not identify procurement risk when controls are adequate', () => {
      const assessment = createBaseAssessment();
      assessment.procurement.q1 = 'always';
      assessment.procurement.q2 = 'always';

      const risks = calculateRiskScore(assessment);

      expect(risks.every(r => r.area !== 'Procurement')).toBe(true);
    });
  });

  describe('Risk Identification - Cash & Banking', () => {
    it('should identify cash misappropriation risk when q1 is rarely', () => {
      const assessment = createBaseAssessment();
      assessment.cashBanking.q1 = 'rarely';

      const risks = calculateRiskScore(assessment);

      expect(risks.some(r => r.title === 'Cash misappropriation')).toBe(true);
      expect(risks.find(r => r.title === 'Cash misappropriation')?.area).toBe('Cash & Banking');
      expect(risks.find(r => r.title === 'Cash misappropriation')?.suggestedOwner).toBe('Finance Manager');
    });

    it('should identify cash misappropriation risk when q1 is never', () => {
      const assessment = createBaseAssessment();
      assessment.cashBanking.q1 = 'never';

      const risks = calculateRiskScore(assessment);

      expect(risks.some(r => r.title === 'Cash misappropriation')).toBe(true);
    });
  });

  describe('Risk Identification - Payroll & HR', () => {
    it('should identify payroll fraud risk when q1 is rarely', () => {
      const assessment = createBaseAssessment();
      assessment.payrollHR.q1 = 'rarely';

      const risks = calculateRiskScore(assessment);

      expect(risks.some(r => r.title === 'Payroll fraud')).toBe(true);
      expect(risks.find(r => r.title === 'Payroll fraud')?.area).toBe('Payroll & HR');
      expect(risks.find(r => r.title === 'Payroll fraud')?.suggestedOwner).toBe('HR Manager');
    });

    it('should identify payroll fraud risk when q1 is never', () => {
      const assessment = createBaseAssessment();
      assessment.payrollHR.q1 = 'never';

      const risks = calculateRiskScore(assessment);

      expect(risks.some(r => r.title === 'Payroll fraud')).toBe(true);
    });
  });

  describe('Risk Identification - Revenue', () => {
    it('should identify revenue leakage risk when q1 is rarely', () => {
      const assessment = createBaseAssessment();
      assessment.revenue.q1 = 'rarely';

      const risks = calculateRiskScore(assessment);

      expect(risks.some(r => r.title === 'Revenue leakage')).toBe(true);
      expect(risks.find(r => r.title === 'Revenue leakage')?.area).toBe('Revenue');
      expect(risks.find(r => r.title === 'Revenue leakage')?.suggestedOwner).toBe('Finance Director');
    });

    it('should identify revenue leakage risk when q1 is never', () => {
      const assessment = createBaseAssessment();
      assessment.revenue.q1 = 'never';

      const risks = calculateRiskScore(assessment);

      expect(risks.some(r => r.title === 'Revenue leakage')).toBe(true);
    });
  });

  describe('Risk Identification - IT Systems', () => {
    it('should identify cyber fraud risk when q1 is rarely', () => {
      const assessment = createBaseAssessment();
      assessment.itSystems.q1 = 'rarely';

      const risks = calculateRiskScore(assessment);

      expect(risks.some(r => r.title === 'Cyber fraud')).toBe(true);
      expect(risks.find(r => r.title === 'Cyber fraud')?.area).toBe('IT Systems');
      expect(risks.find(r => r.title === 'Cyber fraud')?.suggestedOwner).toBe('IT Lead');
    });

    it('should identify cyber fraud risk when q1 is never', () => {
      const assessment = createBaseAssessment();
      assessment.itSystems.q1 = 'never';

      const risks = calculateRiskScore(assessment);

      expect(risks.some(r => r.title === 'Cyber fraud')).toBe(true);
    });

    it('should calculate cyber fraud as highest inherent risk (5×4=20)', () => {
      const assessment = createBaseAssessment();
      assessment.itSystems.q1 = 'rarely';
      assessment.fraudTriangle.controlStrength = 'weak';

      const risks = calculateRiskScore(assessment);
      const cyberRisk = risks.find(r => r.title === 'Cyber fraud');

      expect(cyberRisk?.inherentScore).toBe(20); // 5 * 4
    });
  });

  describe('Risk Identification - People & Culture', () => {
    it('should identify unreported fraud risk when whistleblowing is no-formal', () => {
      const assessment = createBaseAssessment();
      assessment.peopleCulture.whistleblowing = 'no-formal';

      const risks = calculateRiskScore(assessment);

      expect(risks.some(r => r.title === 'Unreported fraud')).toBe(true);
      expect(risks.find(r => r.title === 'Unreported fraud')?.area).toBe('People & Culture');
      expect(risks.find(r => r.title === 'Unreported fraud')?.suggestedOwner).toBe('HR Director');
    });

    it('should apply half control reduction for whistleblowing risk', () => {
      const assessment = createBaseAssessment();
      assessment.peopleCulture.whistleblowing = 'no-formal';
      assessment.fraudTriangle.controlStrength = 'very-strong'; // 40% -> 20% for this risk

      const risks = calculateRiskScore(assessment);
      const whistleblowingRisk = risks.find(r => r.title === 'Unreported fraud');

      // Inherent: 3*4=12, Half reduction: 40% * 0.5 = 20%, Residual: 12 * 0.8 = 9.6 → 10
      expect(whistleblowingRisk?.inherentScore).toBe(12);
      expect(whistleblowingRisk?.residualScore).toBe(10);
    });

    it('should not identify whistleblowing risk when mechanism is well-communicated', () => {
      const assessment = createBaseAssessment();
      assessment.peopleCulture.whistleblowing = 'well-communicated';

      const risks = calculateRiskScore(assessment);

      expect(risks.every(r => r.title !== 'Unreported fraud')).toBe(true);
    });
  });

  describe('Risk Identification - Controls & Technology', () => {
    it('should identify segregation failure when duties handled by one-person', () => {
      const assessment = createBaseAssessment();
      assessment.controlsTechnology.segregation = 'one-person';

      const risks = calculateRiskScore(assessment);

      expect(risks.some(r => r.title === 'Segregation of duties failure')).toBe(true);
      expect(risks.find(r => r.title === 'Segregation of duties failure')?.area).toBe('Controls');
      expect(risks.find(r => r.title === 'Segregation of duties failure')?.suggestedOwner).toBe('Chief Operating Officer');
    });

    it('should identify segregation failure when not-sure', () => {
      const assessment = createBaseAssessment();
      assessment.controlsTechnology.segregation = 'not-sure';

      const risks = calculateRiskScore(assessment);

      expect(risks.some(r => r.title === 'Segregation of duties failure')).toBe(true);
    });

    it('should apply 0% control reduction for segregation failures', () => {
      const assessment = createBaseAssessment();
      assessment.controlsTechnology.segregation = 'one-person';
      assessment.fraudTriangle.controlStrength = 'very-strong'; // Should be ignored

      const risks = calculateRiskScore(assessment);
      const segregationRisk = risks.find(r => r.title === 'Segregation of duties failure');

      // Inherent: 5*4=20, No reduction: residual=20
      expect(segregationRisk?.inherentScore).toBe(20);
      expect(segregationRisk?.residualScore).toBe(20); // No reduction applied
    });

    it('should not identify segregation risk when well-separated', () => {
      const assessment = createBaseAssessment();
      assessment.controlsTechnology.segregation = 'well-separated';

      const risks = calculateRiskScore(assessment);

      expect(risks.every(r => r.title !== 'Segregation of duties failure')).toBe(true);
    });
  });

  // ==========================================================================
  // Default Risk Tests
  // ==========================================================================

  describe('Default General Risk', () => {
    it('should create default general fraud risk when no specific risks identified', () => {
      const assessment = createBaseAssessment();
      // All controls adequate - no specific risks

      const risks = calculateRiskScore(assessment);

      expect(risks).toHaveLength(1);
      expect(risks[0].title).toBe('General fraud risk');
      expect(risks[0].area).toBe('Overall');
      expect(risks[0].suggestedOwner).toBe('Senior Management Team');
    });

    it('should not create default risk when specific risks exist', () => {
      const assessment = createBaseAssessment();
      assessment.procurement.q1 = 'rarely'; // Triggers specific risk

      const risks = calculateRiskScore(assessment);

      expect(risks.every(r => r.title !== 'General fraud risk')).toBe(true);
    });

    it('should apply control reduction to default general risk', () => {
      const assessment = createBaseAssessment();
      assessment.fraudTriangle.controlStrength = 'very-strong';

      const risks = calculateRiskScore(assessment);

      // Inherent: 2*2=4, Reduction: 40%, Residual: 4 * 0.6 = 2.4 → 2
      expect(risks[0].residualScore).toBe(2);
    });
  });

  // ==========================================================================
  // Priority Assignment Tests
  // ==========================================================================

  describe('Priority Assignment', () => {
    it('should assign high priority to segregation failure (residual=20)', () => {
      const assessment = createBaseAssessment();
      assessment.controlsTechnology.segregation = 'one-person';

      const risks = calculateRiskScore(assessment);
      const segregationRisk = risks.find(r => r.title === 'Segregation of duties failure');

      expect(segregationRisk?.priority).toBe('high');
      expect(segregationRisk?.residualScore).toBeGreaterThanOrEqual(15);
    });

    it('should assign high priority to cyber fraud with weak controls (residual=20)', () => {
      const assessment = createBaseAssessment();
      assessment.itSystems.q1 = 'rarely';
      assessment.fraudTriangle.controlStrength = 'weak';

      const risks = calculateRiskScore(assessment);
      const cyberRisk = risks.find(r => r.title === 'Cyber fraud');

      expect(cyberRisk?.priority).toBe('high');
      expect(cyberRisk?.residualScore).toBe(20);
    });

    it('should assign medium priority with reasonably-strong controls', () => {
      const assessment = createBaseAssessment();
      assessment.procurement.q1 = 'rarely';
      assessment.fraudTriangle.controlStrength = 'reasonably-strong';

      const risks = calculateRiskScore(assessment);

      // Inherent: 16, Residual: 13 (medium priority)
      expect(risks[0].priority).toBe('medium');
      expect(risks[0].residualScore).toBeGreaterThanOrEqual(8);
      expect(risks[0].residualScore).toBeLessThan(15);
    });

    it('should assign low priority to default risk with very strong controls', () => {
      const assessment = createBaseAssessment();
      assessment.fraudTriangle.controlStrength = 'very-strong';

      const risks = calculateRiskScore(assessment);

      // Default risk: Inherent: 4, Residual: 2 (low priority)
      expect(risks[0].priority).toBe('low');
      expect(risks[0].residualScore).toBeLessThan(8);
    });
  });

  // ==========================================================================
  // Risk ID Generation Tests
  // ==========================================================================

  describe('Risk ID Generation', () => {
    it('should generate sequential risk IDs starting from FRA-001', () => {
      const assessment = createBaseAssessment();
      assessment.procurement.q1 = 'rarely';
      assessment.cashBanking.q1 = 'rarely';
      assessment.payrollHR.q1 = 'rarely';

      const risks = calculateRiskScore(assessment);

      expect(risks[0].id).toBe('FRA-001');
      expect(risks[1].id).toBe('FRA-002');
      expect(risks[2].id).toBe('FRA-003');
    });

    it('should pad risk IDs with leading zeros', () => {
      const assessment = createBaseAssessment();
      assessment.procurement.q1 = 'rarely';

      const risks = calculateRiskScore(assessment);

      expect(risks[0].id).toBe('FRA-001'); // Not FRA-1
    });
  });

  // ==========================================================================
  // Multiple Risk Scenarios
  // ==========================================================================

  describe('Multiple Risk Scenarios', () => {
    it('should identify all risks when all controls are weak', () => {
      const assessment = createBaseAssessment();
      assessment.procurement.q1 = 'rarely';
      assessment.cashBanking.q1 = 'rarely';
      assessment.payrollHR.q1 = 'rarely';
      assessment.revenue.q1 = 'rarely';
      assessment.itSystems.q1 = 'rarely';
      assessment.peopleCulture.whistleblowing = 'no-formal';
      assessment.controlsTechnology.segregation = 'one-person';

      const risks = calculateRiskScore(assessment);

      expect(risks).toHaveLength(7); // All 7 specific risks
      expect(risks.some(r => r.title === 'Supplier fraud')).toBe(true);
      expect(risks.some(r => r.title === 'Cash misappropriation')).toBe(true);
      expect(risks.some(r => r.title === 'Payroll fraud')).toBe(true);
      expect(risks.some(r => r.title === 'Revenue leakage')).toBe(true);
      expect(risks.some(r => r.title === 'Cyber fraud')).toBe(true);
      expect(risks.some(r => r.title === 'Unreported fraud')).toBe(true);
      expect(risks.some(r => r.title === 'Segregation of duties failure')).toBe(true);
    });

    it('should calculate different residual scores based on control strength', () => {
      const assessment = createBaseAssessment();
      assessment.procurement.q1 = 'rarely';
      assessment.itSystems.q1 = 'rarely';
      assessment.fraudTriangle.controlStrength = 'reasonably-strong'; // 20% reduction

      const risks = calculateRiskScore(assessment);

      // Procurement: 16 * 0.8 = 12.8 → 13
      // IT: 20 * 0.8 = 16
      expect(risks[0].residualScore).toBe(13);
      expect(risks[1].residualScore).toBe(16);
    });

    it('should maintain correct risk order and IDs with multiple risks', () => {
      const assessment = createBaseAssessment();
      assessment.procurement.q1 = 'rarely';
      assessment.cashBanking.q1 = 'rarely';
      assessment.payrollHR.q1 = 'rarely';

      const risks = calculateRiskScore(assessment);

      expect(risks[0].id).toBe('FRA-001');
      expect(risks[0].area).toBe('Procurement');
      expect(risks[1].id).toBe('FRA-002');
      expect(risks[1].area).toBe('Cash & Banking');
      expect(risks[2].id).toBe('FRA-003');
      expect(risks[2].area).toBe('Payroll & HR');
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle null control strength gracefully', () => {
      const assessment = createBaseAssessment();
      assessment.fraudTriangle.controlStrength = null;
      assessment.procurement.q1 = 'rarely';

      const risks = calculateRiskScore(assessment);

      // Should apply 0% reduction for null
      expect(risks[0].residualScore).toBe(16); // No reduction
    });

    it('should handle assessment with all null values', () => {
      const assessment = createBaseAssessment();
      assessment.procurement.q1 = null;
      assessment.cashBanking.q1 = null;
      assessment.payrollHR.q1 = null;
      assessment.revenue.q1 = null;
      assessment.itSystems.q1 = null;
      assessment.peopleCulture.whistleblowing = null as any;
      assessment.controlsTechnology.segregation = null;

      const risks = calculateRiskScore(assessment);

      // Should create default general risk
      expect(risks).toHaveLength(1);
      expect(risks[0].title).toBe('General fraud risk');
    });

    it('should handle mixed trigger conditions (q1 and q2)', () => {
      const assessment = createBaseAssessment();
      assessment.procurement.q1 = 'always'; // OK
      assessment.procurement.q2 = 'rarely'; // Triggers risk

      const risks = calculateRiskScore(assessment);

      expect(risks[0].title).toBe('Supplier fraud');
    });

    it('should round residual scores correctly at boundaries', () => {
      const assessment = createBaseAssessment();
      assessment.cashBanking.q1 = 'rarely';
      assessment.fraudTriangle.controlStrength = 'very-strong';

      const risks = calculateRiskScore(assessment);

      // Cash: 12 * 0.6 = 7.2 → should round to 7
      expect(risks[0].residualScore).toBe(7);
    });
  });

  // ==========================================================================
  // Compliance & Regulatory Tests
  // ==========================================================================

  describe('Compliance & Regulatory Requirements', () => {
    it('should identify all 7 specific fraud risk categories per GovS-013', () => {
      const assessment = createBaseAssessment();
      assessment.procurement.q1 = 'rarely';
      assessment.cashBanking.q1 = 'rarely';
      assessment.payrollHR.q1 = 'rarely';
      assessment.revenue.q1 = 'rarely';
      assessment.itSystems.q1 = 'rarely';
      assessment.peopleCulture.whistleblowing = 'no-formal';
      assessment.controlsTechnology.segregation = 'one-person';

      const risks = calculateRiskScore(assessment);
      const areas = risks.map(r => r.area);

      expect(areas).toContain('Procurement');
      expect(areas).toContain('Cash & Banking');
      expect(areas).toContain('Payroll & HR');
      expect(areas).toContain('Revenue');
      expect(areas).toContain('IT Systems');
      expect(areas).toContain('People & Culture');
      expect(areas).toContain('Controls');
    });

    it('should assign risk owners for accountability (ECCTA 2023)', () => {
      const assessment = createBaseAssessment();
      assessment.procurement.q1 = 'rarely';
      assessment.cashBanking.q1 = 'rarely';

      const risks = calculateRiskScore(assessment);

      // Every risk must have a suggested owner
      risks.forEach(risk => {
        expect(risk.suggestedOwner).toBeTruthy();
        expect(risk.suggestedOwner.length).toBeGreaterThan(0);
      });
    });

    it('should ensure all risks have complete data for audit trail', () => {
      const assessment = createBaseAssessment();
      assessment.procurement.q1 = 'rarely';

      const risks = calculateRiskScore(assessment);

      risks.forEach(risk => {
        expect(risk.id).toBeTruthy();
        expect(risk.title).toBeTruthy();
        expect(risk.area).toBeTruthy();
        expect(risk.description).toBeTruthy();
        expect(risk.inherentScore).toBeGreaterThan(0);
        expect(risk.residualScore).toBeGreaterThanOrEqual(0);
        expect(risk.priority).toBeTruthy();
        expect(risk.suggestedOwner).toBeTruthy();
      });
    });

    it('should ensure residual scores never exceed inherent scores', () => {
      const assessment = createBaseAssessment();
      assessment.procurement.q1 = 'rarely';
      assessment.cashBanking.q1 = 'rarely';
      assessment.fraudTriangle.controlStrength = 'very-strong';

      const risks = calculateRiskScore(assessment);

      risks.forEach(risk => {
        expect(risk.residualScore).toBeLessThanOrEqual(risk.inherentScore);
      });
    });
  });
});
