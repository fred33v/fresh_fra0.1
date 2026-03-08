/**
 * Assessment Utility Functions - Unit Tests
 *
 * Tests for the pure functions extracted from AssessmentContext:
 *   generateId, isLocalOnlyAssessmentId, createEmptyAssessment
 */

import {
  generateId,
  isLocalOnlyAssessmentId,
  createEmptyAssessment,
} from '@/utils/assessment';

// ---------------------------------------------------------------------------
// generateId
// ---------------------------------------------------------------------------

describe('generateId', () => {
  it('should return a string starting with "fra-"', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.startsWith('fra-')).toBe(true);
  });

  it('should return unique values on consecutive calls', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateId()));
    expect(ids.size).toBe(50);
  });

  it('should contain a numeric timestamp segment', () => {
    const id = generateId();
    const parts = id.split('-');
    // parts[0] === 'fra', parts[1] === timestamp digits
    expect(parts.length).toBeGreaterThanOrEqual(3);
    expect(Number(parts[1])).not.toBeNaN();
  });
});

// ---------------------------------------------------------------------------
// isLocalOnlyAssessmentId
// ---------------------------------------------------------------------------

describe('isLocalOnlyAssessmentId', () => {
  it('should return true for IDs with the "fra-" prefix', () => {
    expect(isLocalOnlyAssessmentId('fra-1234567890-abc123')).toBe(true);
  });

  it('should return true for a minimal "fra-" prefix string', () => {
    expect(isLocalOnlyAssessmentId('fra-')).toBe(true);
  });

  it('should return false for server-style UUIDs', () => {
    expect(isLocalOnlyAssessmentId('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
  });

  it('should return false for an empty string', () => {
    expect(isLocalOnlyAssessmentId('')).toBe(false);
  });

  it('should return false for strings that contain "fra-" but do not start with it', () => {
    expect(isLocalOnlyAssessmentId('prefix-fra-1234')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createEmptyAssessment
// ---------------------------------------------------------------------------

describe('createEmptyAssessment', () => {
  it('should return an object with all required top-level fields', () => {
    const a = createEmptyAssessment('u1', 'o1');
    const requiredKeys: string[] = [
      'id', 'status', 'createdAt', 'updatedAt', 'userId', 'organisationId',
      'organisation', 'riskAppetite', 'fraudTriangle',
      'procurement', 'cashBanking', 'payrollHR', 'revenue', 'itSystems',
      'peopleCulture', 'controlsTechnology', 'priorities', 'riskRegister',
      'paymentsModule', 'trainingAwareness', 'monitoringEvaluation',
      'complianceMapping', 'fraudResponsePlan', 'actionPlan',
      'documentControl', 'payment', 'signature', 'feedback',
    ];
    for (const key of requiredKeys) {
      expect(a).toHaveProperty(key);
    }
  });

  it('should set the provided userId and organisationId', () => {
    const a = createEmptyAssessment('user-42', 'org-99');
    expect(a.userId).toBe('user-42');
    expect(a.organisationId).toBe('org-99');
  });

  it('should default userId and organisationId to empty strings when not provided', () => {
    const a = createEmptyAssessment();
    expect(a.userId).toBe('');
    expect(a.organisationId).toBe('');
  });

  it('should set status to "draft"', () => {
    const a = createEmptyAssessment('u', 'o');
    expect(a.status).toBe('draft');
  });

  it('should generate a unique ID via generateId', () => {
    const a1 = createEmptyAssessment('u', 'o');
    const a2 = createEmptyAssessment('u', 'o');
    expect(a1.id).not.toBe(a2.id);
    expect(a1.id.startsWith('fra-')).toBe(true);
  });

  it('should initialise all process-risk sections with null q values and empty notes', () => {
    const a = createEmptyAssessment('u', 'o');
    const sections = ['procurement', 'cashBanking', 'payrollHR', 'revenue', 'itSystems'] as const;
    for (const s of sections) {
      expect(a[s].q1).toBeNull();
      expect(a[s].q2).toBeNull();
      expect(a[s].notes).toBe('');
    }
  });

  it('should initialise organisation with empty strings and null enums', () => {
    const a = createEmptyAssessment('u', 'o');
    expect(a.organisation.name).toBe('');
    expect(a.organisation.type).toBeNull();
    expect(a.organisation.employeeCount).toBeNull();
  });

  it('should initialise riskRegister as an empty array', () => {
    const a = createEmptyAssessment('u', 'o');
    expect(Array.isArray(a.riskRegister)).toBe(true);
    expect(a.riskRegister).toHaveLength(0);
  });

  it('should initialise payment with pending status and null packageType', () => {
    const a = createEmptyAssessment('u', 'o');
    expect(a.payment.status).toBe('pending');
    expect(a.payment.packageType).toBeNull();
    expect(a.payment.price).toBe(795);
  });

  it('should set createdAt and updatedAt to valid ISO strings', () => {
    const before = new Date().toISOString();
    const a = createEmptyAssessment('u', 'o');
    const after = new Date().toISOString();
    expect(a.createdAt >= before).toBe(true);
    expect(a.createdAt <= after).toBe(true);
    expect(a.updatedAt).toBe(a.createdAt);
  });
});
