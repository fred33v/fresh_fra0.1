import { describe, it, expect } from 'vitest';
import type {
  RiskLevel,
  ControlStrength,
  AssessmentModule,
  AssessmentStatus,
  RiskRegisterItem,
  Assessment,
} from '../assessment';

describe('assessment types', () => {
  it('RiskLevel accepts valid values', () => {
    const levels: RiskLevel[] = ['HIGH', 'MEDIUM', 'LOW'];
    expect(levels).toHaveLength(3);
    expect(levels).toContain('HIGH');
    expect(levels).toContain('MEDIUM');
    expect(levels).toContain('LOW');
  });

  it('ControlStrength accepts valid values', () => {
    const strengths: ControlStrength[] = [
      'VERY_STRONG',
      'REASONABLY_STRONG',
      'SOME_GAPS',
      'WEAK',
    ];
    expect(strengths).toHaveLength(4);
    expect(strengths).toContain('VERY_STRONG');
    expect(strengths).toContain('REASONABLY_STRONG');
    expect(strengths).toContain('SOME_GAPS');
    expect(strengths).toContain('WEAK');
  });

  it('AssessmentModule has 13 modules', () => {
    const modules: AssessmentModule[] = [
      'risk-appetite',
      'fraud-triangle',
      'people-culture',
      'controls-technology',
      'procurement',
      'payroll-hr',
      'revenue',
      'cash-banking',
      'it-systems',
      'monitoring-evaluation',
      'fraud-response',
      'training-awareness',
      'compliance-mapping',
    ];
    expect(modules).toHaveLength(13);
  });

  it('AssessmentStatus accepts valid values', () => {
    const statuses: AssessmentStatus[] = [
      'draft',
      'in_progress',
      'submitted',
      'completed',
    ];
    expect(statuses).toHaveLength(4);
    expect(statuses).toContain('draft');
    expect(statuses).toContain('in_progress');
    expect(statuses).toContain('submitted');
    expect(statuses).toContain('completed');
  });

  it('RiskRegisterItem has required fields', () => {
    const item: RiskRegisterItem = {
      id: 'rri-1',
      assessmentId: 'a-1',
      module: 'procurement',
      riskDescription: 'Vendor fraud risk',
      impact: 4,
      likelihood: 3,
      inherentRiskScore: 12,
      controlStrength: 'REASONABLY_STRONG',
      residualRiskScore: 6,
      priority: 'MEDIUM',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };
    expect(item.id).toBeDefined();
    expect(item.assessmentId).toBeDefined();
    expect(item.module).toBeDefined();
    expect(item.riskDescription).toBeDefined();
    expect(item.impact).toBeDefined();
    expect(item.likelihood).toBeDefined();
    expect(item.inherentRiskScore).toBeDefined();
    expect(item.controlStrength).toBeDefined();
    expect(item.residualRiskScore).toBeDefined();
    expect(item.priority).toBeDefined();
    expect(item.createdAt).toBeDefined();
    expect(item.updatedAt).toBeDefined();
  });

  it('Assessment has required fields', () => {
    const assessment: Assessment = {
      id: 'a-1',
      organisationId: 'org-1',
      userId: 'user-1',
      packageId: 1,
      status: 'in_progress',
      startedAt: '2024-01-01',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    };
    expect(assessment.id).toBeDefined();
    expect(assessment.organisationId).toBeDefined();
    expect(assessment.userId).toBeDefined();
    expect(assessment.packageId).toBeDefined();
    expect(assessment.status).toBeDefined();
    expect(assessment.startedAt).toBeDefined();
    expect(assessment.createdAt).toBeDefined();
    expect(assessment.updatedAt).toBeDefined();
  });

  it('Assessment supports optional fields', () => {
    const assessment: Assessment = {
      id: 'a-1',
      organisationId: 'org-1',
      userId: 'user-1',
      packageId: 1,
      status: 'completed',
      startedAt: '2024-01-01',
      completedAt: '2024-02-01',
      signedAt: '2024-02-01',
      signatureUrl: 'https://example.com/sig.png',
      overallRiskScore: 45,
      overallRiskLevel: 'MEDIUM',
      reportUrl: 'https://example.com/report.pdf',
      createdAt: '2024-01-01',
      updatedAt: '2024-02-01',
    };
    expect(assessment.completedAt).toBe('2024-02-01');
    expect(assessment.overallRiskScore).toBe(45);
    expect(assessment.overallRiskLevel).toBe('MEDIUM');
    expect(assessment.reportUrl).toBeDefined();
  });
});
