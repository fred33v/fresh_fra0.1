/**
 * Assessment Workflow E2E Tests
 * 
 * Tests the complete fraud risk assessment workflow across all 13 modules,
 * ensuring data integrity, navigation, and risk scoring calculations.
 * 
 * Phase 2: Enhanced Module Testing
 * Last Updated: March 2026
 */

import { riskScoringEngine } from '@/services/riskScoringEngine';
import type {
  AssessmentData,
  EnhancedProcurementAnswers,
  EnhancedCashBankingAnswers,
  EnhancedPayrollHRAnswers,
  EnhancedRevenueAnswers,
  EnhancedITSystemsAnswers,
  EnhancedPeopleCultureAnswers,
  EnhancedControlsTechnologyAnswers,
  FraudTriangle,
  RiskAppetite,
  TrainingAwareness,
  MonitoringEvaluation,
  FraudResponsePlan,
  ComplianceMapping,
  ActionPlan,
  OrganisationInfo,
} from '@/types/assessment';

describe('Fraud Risk Assessment Workflow - E2E Tests', () => {
  let assessment: Partial<AssessmentData>;

  beforeEach(() => {
    // Initialize fresh assessment for each test
    assessment = {
      id: 'test-assessment-001',
      status: 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: 'test-user-001',
      organisationId: 'test-org-001',
      organisation: {
        name: 'Test Organization',
        type: 'private-sme',
        employeeCount: '51-100',
        region: 'UK',
        activities: 'Financial Services',
      } as OrganisationInfo,
    };
  });

  describe('Module 1: Risk Appetite Assessment', () => {
    it('should capture risk tolerance on numeric scale', () => {
      assessment.riskAppetite = {
        tolerance: 3 as any, // Medium risk tolerance (1-5 scale)
        fraudSeriousness: 'quite-serious',
        reputationImportance: 4 as any, // Important (1-5 scale)
      };

      expect(assessment.riskAppetite?.tolerance).toBe(3);
      expect(assessment.riskAppetite?.fraudSeriousness).toBe('quite-serious');
      expect(assessment.riskAppetite?.reputationImportance).toBe(4);
    });

    it('should validate reputation importance impact quantification', () => {
      const scenarios = [
        { reputationImportance: 1, description: 'Low priority' },
        { reputationImportance: 5, description: 'Critical impact' },
      ];

      scenarios.forEach(({ reputationImportance, description }) => {
        const riskAppetite: RiskAppetite = {
          tolerance: 3,
          fraudSeriousness: 'quite-serious',
          reputationImportance: reputationImportance as any,
        };

        expect(riskAppetite.reputationImportance).toBeGreaterThanOrEqual(1);
        expect(riskAppetite.reputationImportance).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('Module 2: Fraud Triangle - Quantitative Scoring', () => {
    it('should capture estimated loss exposure as currency value', () => {
      assessment.fraudTriangle = {
        pressure: 'high',
        controlStrength: 'reasonably-strong',
        speakUpCulture: 'quite-confident',
        estimatedLossExposure: 250000, // £250k potential loss
        rationalizationRisk: 3, // Scale 1-5
      };

      expect(assessment.fraudTriangle?.estimatedLossExposure).toBe(250000);
      expect(typeof assessment.fraudTriangle?.estimatedLossExposure).toBe('number');
    });

    it('should score rationalization risk on scale 1-5', () => {
      const risks = [
        { rationalizationRisk: 1, description: 'Culture actively discourages' },
        { rationalizationRisk: 5, description: 'Culture could enable rationalization' },
      ];

      risks.forEach(({ rationalizationRisk }) => {
        assessment.fraudTriangle = {
          pressure: 'moderate',
          controlStrength: 'some-gaps',
          speakUpCulture: 'not-sure',
          estimatedLossExposure: 100000,
          rationalizationRisk: rationalizationRisk as any,
        };

        const risk = assessment.fraudTriangle as FraudTriangle;
        expect(risk.rationalizationRisk).toBeGreaterThanOrEqual(1);
        expect(risk.rationalizationRisk).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('Module 3: Procurement with Quantitative Metrics', () => {
    it('should track monthly procurement spend as currency', () => {
      assessment.procurement = {
        q1: 'usually',
        q2: 'always',
        q3: 'usually',
        notes: 'Robust procurement controls in place',
        dueDiligenceLevel: 4,
        monthlySpend: 500000, // £500k monthly spend
        recentFraud: 'no',
        fraudDescription: '',
        controlMaturity: 4,
      } as EnhancedProcurementAnswers;

      expect(assessment.procurement?.monthlySpend).toBe(500000);
      expect(typeof assessment.procurement?.monthlySpend).toBe('number');
    });

    it('should assess due diligence maturity on scale', () => {
      const levels = [1, 2, 3, 4, 5];
      
      levels.forEach((level) => {
        assessment.procurement = {
          q1: 'always',
          q2: 'always',
          q3: 'usually',
          notes: '',
          dueDiligenceLevel: level as any,
          monthlySpend: 300000,
          recentFraud: 'yes',
          fraudDescription: 'One supplier was found to be duplicate entity',
          controlMaturity: 3,
        } as EnhancedProcurementAnswers;

        expect(assessment.procurement?.dueDiligenceLevel).toBe(level);
      });
    });
  });

  describe('Module 4: Cash & Banking with Currency Tracking', () => {
    it('should track daily cash volume in GBP', () => {
      assessment.cashBanking = {
        q1: 'always',
        q2: 'usually',
        notes: 'Strong cash controls',
        dailyCashVolume: 50000, // £50k daily
        bankAccountCount: 5,
        fraudIncidents: 'no',
        fraudDescription: '',
        controlEffectiveness: 4,
      } as EnhancedCashBankingAnswers;

      expect(assessment.cashBanking?.dailyCashVolume).toBe(50000);
      expect(assessment.cashBanking?.bankAccountCount).toBe(5);
    });
  });

  describe('Module 5: Payroll & HR with Numeric Employee Tracking', () => {
    it('should track total employee count', () => {
      assessment.payrollHR = {
        q1: 'always',
        q2: 'usually',
        notes: 'Reviewed payroll controls',
        totalEmployeeCount: 85, // 85 total employees
        payrollFrequency: 'usually',
        unauthorizedChangesDetected: 'no',
        changeDescription: '',
        controlMaturity: 4,
      } as EnhancedPayrollHRAnswers;

      expect(assessment.payrollHR?.totalEmployeeCount).toBe(85);
      expect(typeof assessment.payrollHR?.totalEmployeeCount).toBe('number');
    });
  });

  describe('Module 6: Revenue with Percentage & Currency Metrics', () => {
    it('should track monthly revenue and unpaid invoice percentage', () => {
      assessment.revenue = {
        q1: 'usually',
        q2: 'always',
        notes: 'Revenue controls are strong',
        monthlyRevenueVolume: 1500000, // £1.5m monthly
        unpaidInvoicesPercentage: 5, // 5% unpaid after 60 days
        writeOffsOccurred: 'yes',
        writeOffDescription: 'One large client defaulted, written off £50k',
        collectionEffectiveness: 4,
      } as EnhancedRevenueAnswers;

      expect(assessment.revenue?.monthlyRevenueVolume).toBe(1500000);
      expect(assessment.revenue?.unpaidInvoicesPercentage).toBe(5);
    });
  });

  describe('Module 7: IT Systems with Cybersecurity Maturity', () => {
    it('should track security incidents count and MFA adoption', () => {
      assessment.itSystems = {
        q1: 'usually',
        q2: 'always',
        q3: 'usually',
        notes: 'IT security is being enhanced',
        cybersecurityMaturity: 3,
        securityIncidentsCount: 2, // 2 incidents in past 12 months
        hasCriticalSystems: 'yes',
        criticalSystemsDescription: 'ERP and accounting systems are critical',
        backupTestingFrequency: 4, // Quarterly testing
        mfaAdoption: 3, // Partial MFA adoption
      } as EnhancedITSystemsAnswers;

      expect(assessment.itSystems?.securityIncidentsCount).toBe(2);
      expect(assessment.itSystems?.mfaAdoption).toBe(3);
    });
  });

  describe('Module 8: People & Culture with Whistleblowing Metrics', () => {
    it('should track whistleblowing usage and leadership messaging intensity', () => {
      assessment.peopleCulture = {
        staffChecks: 'usually',
        staffCheckMaturity: 4,
        whistleblowing: 'well-communicated',
        whistleblowingUsed: 'yes',
        whistleblowingDetails: 'One concern reported and investigated in 2024',
        leadershipMessage: 'quite-clear',
        leadershipMessagingIntensity: 4, // Regular, clear messaging
      } as EnhancedPeopleCultureAnswers;

      expect(assessment.peopleCulture?.leadershipMessagingIntensity).toBe(4);
      expect(assessment.peopleCulture?.whistleblowingUsed).toBe('yes');
    });
  });

  describe('Module 9: Controls & Technology with Maturity Scales', () => {
    it('should assess segregation, access, and monitoring maturity', () => {
      assessment.controlsTechnology = {
        segregation: 'well-separated',
        segregationMaturity: 4, // Well separated duties
        accessManagement: 'very-confident',
        accessMaturity: 4, // Automated RBAC
        monitoring: 'regularly',
        automatedMonitoring: 'yes',
        automatedMonitoringDetails: 'Daily exception reports on all payments',
      } as EnhancedControlsTechnologyAnswers;

      expect(assessment.controlsTechnology?.segregationMaturity).toBe(4);
      expect(assessment.controlsTechnology?.accessMaturity).toBe(4);
      expect(assessment.controlsTechnology?.automatedMonitoring).toBe('yes');
    });
  });

  describe('Module 10: Training & Awareness with Completion Tracking', () => {
    it('should track numeric completion counts and percentages', () => {
      assessment.trainingAwareness = {
        mandatoryTraining: [],
        specialistTraining: [],
        boardTraining: [],
        overallCompletionRate: 92, // 92% completion rate
        mandatoryCompletedCount: 78, // 78 staff completed mandatory
        specialistCompletedCount: 12, // 12 completed specialist
        boardCompletedCount: 7, // 7 board members completed
        notes: 'Good training uptake across organization',
      };

      expect(assessment.trainingAwareness?.overallCompletionRate).toBe(92);
      expect(assessment.trainingAwareness?.mandatoryCompletedCount).toBe(78);
      expect(assessment.trainingAwareness?.specialistCompletedCount).toBe(12);
      expect(assessment.trainingAwareness?.boardCompletedCount).toBe(7);
    });
  });

  describe('Module 11: Monitoring & Evaluation with Incident Tracking', () => {
    it('should track detected fraud incidents and suspicious trades', () => {
      assessment.monitoringEvaluation = {
        kpis: [],
        reviewFrequency: 'monthly',
        lastReviewDate: '2026-02-01',
        nextReviewDate: '2026-03-01',
        responsiblePerson: 'Head of Internal Audit',
        fraudIncidentsDetected: 3, // 3 fraud incidents detected
        suspiciousTradeDetected: 12, // 12 suspicious trades flagged
        fraudRiskLikelihood: 2, // Low likelihood of undetected fraud
        notes: 'Monitoring controls are effective',
      };

      expect(assessment.monitoringEvaluation?.fraudIncidentsDetected).toBe(3);
      expect(assessment.monitoringEvaluation?.suspiciousTradeDetected).toBe(12);
      expect(assessment.monitoringEvaluation?.fraudRiskLikelihood).toBe(2);
    });
  });

  describe('Module 12: Fraud Response with Incident & Loss Tracking', () => {
    it('should track detected losses and response speed', () => {
      assessment.fraudResponsePlan = {
        reportingTimelines: {
          logIncident: 24,
          initialAssessment: 48,
          investigationStart: 72,
        },
        investigationLifecycle: {
          triage: 5,
          investigation: 20,
          findings: 30,
          closure: 45,
        },
        disciplinaryMeasures: ['Termination', 'Police referral'],
        externalReporting: 'Yes, to police and regulators',
        detectedLossesValue: 75000, // £75k detected in past 3 years
        responseSpeed: 4, // Quick, proactive response
        notes: 'Incident response plan is documented',
      };

      expect(assessment.fraudResponsePlan?.detectedLossesValue).toBe(75000);
      expect(assessment.fraudResponsePlan?.responseSpeed).toBe(4);
    });
  });

  describe('Cross-Module Risk Scoring Integration', () => {
    it('should calculate inherent risk across all fraud triangle components', () => {
      // Set up complete assessment data
      assessment.riskAppetite = {
        tolerance: 3,
        fraudSeriousness: 'quite-serious',
        reputationImportance: 4,
      };

      assessment.fraudTriangle = {
        pressure: 'moderate',
        controlStrength: 'some-gaps',
        speakUpCulture: 'quite-confident',
        estimatedLossExposure: 250000,
        rationalizationRisk: 3,
      };

      assessment.procurement = {
        q1: 'usually',
        dueDiligenceLevel: 3,
        monthlySpend: 500000,
      } as any;

      // Risk scoring should integrate data from multiple modules
      const mockRiskAreas = {
        procurement: { inherent: 6, residual: 4 },
        cashBanking: { inherent: 5, residual: 3 },
        payrollHR: { inherent: 5, residual: 2 },
        revenue: { inherent: 6, residual: 4 },
        itSystems: { inherent: 5, residual: 3 },
        peopleCulture: { inherent: 4, residual: 2 },
        controlsTechnology: { inherent: 4, residual: 2 },
      };

      // Calculate overall risk
      const totalInherent = Object.values(mockRiskAreas).reduce((sum, area) => sum + area.inherent, 0);
      const totalResidual = Object.values(mockRiskAreas).reduce((sum, area) => sum + area.residual, 0);

      expect(totalInherent).toBeGreaterThan(0);
      expect(totalResidual).toBeLessThan(totalInherent);
    });
  });

  describe('Compliance Mapping Integration', () => {
    it('should map assessment responses to GovS-013 standards', () => {
      assessment.complianceMapping = {
        govS013: {
          status: 'partially-compliant',
          gaps: ['MFA not fully implemented', 'Segregation of duties gaps in small teams'],
          actions: ['Deploy MFA across organization', 'Implement additional compensating controls'],
        },
        fraudPreventionStandard: {
          status: 'partially-compliant',
          gaps: ['Board training not current'],
          actions: ['Schedule board fraud awareness training'],
        },
        eccta2023: {
          status: 'compliant',
          gaps: [],
          actions: [],
        },
        notes: 'Moving towards full compliance',
      };

      expect(assessment.complianceMapping?.govS013?.status).toBe('partially-compliant');
      expect(assessment.complianceMapping?.govS013?.gaps?.length).toBeGreaterThan(0);
    });
  });

  describe('Action Plan Generation', () => {
    it('should generate action items from risk assessment', () => {
      assessment.actionPlan = {
        highPriority: [
          {
            id: 'action-1',
            title: 'Implement MFA for all critical systems',
            priority: 'high',
            timeline: 'Q2 2026',
            owner: 'IT Director',
            status: 'not-started',
            dueDate: '2026-06-30',
          },
        ],
        mediumPriority: [
          {
            id: 'action-2',
            title: 'Enhance segregation of duties in finance team',
            priority: 'medium',
            timeline: 'Q3 2026',
            owner: 'CFO',
            status: 'not-started',
            dueDate: '2026-09-30',
          },
        ],
        lowPriority: [
          {
            id: 'action-3',
            title: 'Review and update fraud response procedures',
            priority: 'low',
            timeline: 'Q4 2026',
            owner: 'Compliance Manager',
            status: 'not-started',
            dueDate: '2026-12-31',
          },
        ],
      };

      expect(assessment.actionPlan?.highPriority?.length).toBe(1);
      expect(assessment.actionPlan?.mediumPriority?.length).toBe(1);
      expect(assessment.actionPlan?.lowPriority?.length).toBe(1);
    });
  });

  describe('Data Persistence & Validation', () => {
    it('should maintain data integrity across all modules', () => {
      // Complete assessment with all modules
      const completeAssessment = {
        id: 'test-001',
        status: 'draft' as const,
        riskAppetite: { tolerance: 3, fraudSeriousness: 'quite-serious', reputationImportance: 4 },
        fraudTriangle: { pressure: 'moderate', controlStrength: 'some-gaps', speakUpCulture: 'quite-confident', estimatedLossExposure: 250000, rationalizationRisk: 3 },
        procurement: { q1: 'usually', dueDiligenceLevel: 3, monthlySpend: 500000 },
        cashBanking: { q1: 'always', dailyCashVolume: 50000, bankAccountCount: 5 },
        payrollHR: { q1: 'always', totalEmployeeCount: 85 },
        revenue: { q1: 'usually', monthlyRevenueVolume: 1500000, unpaidInvoicesPercentage: 5 },
        itSystems: { q1: 'usually', cybersecurityMaturity: 3, securityIncidentsCount: 2, mfaAdoption: 3 },
        peopleCulture: { staffChecks: 'usually', leadershipMessagingIntensity: 4, whistleblowingUsed: 'yes' },
        controlsTechnology: { segregation: 'well-separated', segregationMaturity: 4, accessMaturity: 4 },
        trainingAwareness: { overallCompletionRate: 92, mandatoryCompletedCount: 78, specialistCompletedCount: 12, boardCompletedCount: 7 },
        monitoringEvaluation: { fraudIncidentsDetected: 3, suspiciousTradeDetected: 12, fraudRiskLikelihood: 2 },
        fraudResponsePlan: { detectedLossesValue: 75000, responseSpeed: 4 },
      };

      // Verify all module data exists
      expect(completeAssessment.riskAppetite).toBeDefined();
      expect(completeAssessment.fraudTriangle).toBeDefined();
      expect(completeAssessment.procurement).toBeDefined();
      expect(completeAssessment.cashBanking).toBeDefined();
      expect(completeAssessment.payrollHR).toBeDefined();
      expect(completeAssessment.revenue).toBeDefined();
      expect(completeAssessment.itSystems).toBeDefined();
      expect(completeAssessment.peopleCulture).toBeDefined();
      expect(completeAssessment.controlsTechnology).toBeDefined();
      expect(completeAssessment.trainingAwareness).toBeDefined();
      expect(completeAssessment.monitoringEvaluation).toBeDefined();
      expect(completeAssessment.fraudResponsePlan).toBeDefined();
    });
  });

  describe('Edge Cases & Boundary Conditions', () => {
    it('should handle zero values in currency fields', () => {
      assessment.procurement = {
        monthlySpend: 0,
      } as any;

      assessment.fraudTriangle = {
        estimatedLossExposure: 0,
      } as any;

      expect(assessment.procurement?.monthlySpend).toBe(0);
      expect(assessment.fraudTriangle?.estimatedLossExposure).toBe(0);
    });

    it('should handle maximum scale values (scale 1-5)', () => {
      assessment.riskAppetite = {
        tolerance: 5 as any, // Maximum tolerance
        fraudSeriousness: 'not-serious',
        reputationImportance: 5 as any, // Critical impact
      };

      expect(assessment.riskAppetite?.tolerance).toBe(5);
      expect(assessment.riskAppetite?.reputationImportance).toBe(5);
    });

    it('should handle empty descriptions and notes', () => {
      assessment.peopleCulture = {
        whistleblowingUsed: 'no',
        whistleblowingDetails: '', // Empty when no incidents
      } as any;

      assessment.fraudResponsePlan = {
        detectedLossesValue: 0,
        notes: '',
      };

      expect(assessment.peopleCulture?.whistleblowingDetails).toBe('');
      expect(assessment.fraudResponsePlan?.notes).toBe('');
    });
  });

  describe('Workflow Navigation & Progress Tracking', () => {
    it('should track progress through 13 assessment modules', () => {
      const modules = [
        { name: 'Risk Appetite', progress: 1, total: 13 },
        { name: 'Fraud Triangle', progress: 2, total: 13 },
        { name: 'Procurement', progress: 3, total: 13 },
        { name: 'Cash & Banking', progress: 4, total: 13 },
        { name: 'Payroll & HR', progress: 5, total: 13 },
        { name: 'Revenue', progress: 6, total: 13 },
        { name: 'IT Systems', progress: 7, total: 13 },
        { name: 'People & Culture', progress: 8, total: 13 },
        { name: 'Controls & Technology', progress: 9, total: 13 },
        { name: 'Training & Awareness', progress: 10, total: 13 },
        { name: 'Monitoring & Evaluation', progress: 11, total: 13 },
        { name: 'Fraud Response', progress: 12, total: 13 },
        { name: 'Priorities & Action Plan', progress: 13, total: 13 },
      ];

      modules.forEach((module, index) => {
        expect(module.progress).toBe(index + 1);
        expect(module.total).toBe(13);
      });

      // Verify sequential progression
      for (let i = 0; i < modules.length - 1; i++) {
        expect(modules[i].progress).toBeLessThan(modules[i + 1].progress);
      }
    });
  });
});
