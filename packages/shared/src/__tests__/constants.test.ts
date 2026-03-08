import { describe, it, expect } from 'vitest';
import {
  RISK_SCORES,
  CONTROL_REDUCTIONS,
  ASSESSMENT_MODULES,
  PACKAGES,
  REGULATIONS,
  FRAUD_TRIANGLE,
} from '../constants';

describe('RISK_SCORES', () => {
  it('has HIGH with correct min, max, and label', () => {
    expect(RISK_SCORES.HIGH).toEqual({ min: 15, max: 25, label: 'High' });
  });

  it('has MEDIUM with correct min, max, and label', () => {
    expect(RISK_SCORES.MEDIUM).toEqual({ min: 8, max: 14, label: 'Medium' });
  });

  it('has LOW with correct min, max, and label', () => {
    expect(RISK_SCORES.LOW).toEqual({ min: 1, max: 7, label: 'Low' });
  });

  it('has non-overlapping ranges', () => {
    expect(RISK_SCORES.LOW.max).toBeLessThan(RISK_SCORES.MEDIUM.min);
    expect(RISK_SCORES.MEDIUM.max).toBeLessThan(RISK_SCORES.HIGH.min);
  });
});

describe('CONTROL_REDUCTIONS', () => {
  it('has VERY_STRONG with numeric value', () => {
    expect(typeof CONTROL_REDUCTIONS.VERY_STRONG).toBe('number');
    expect(CONTROL_REDUCTIONS.VERY_STRONG).toBe(0.4);
  });

  it('has REASONABLY_STRONG with numeric value', () => {
    expect(typeof CONTROL_REDUCTIONS.REASONABLY_STRONG).toBe('number');
    expect(CONTROL_REDUCTIONS.REASONABLY_STRONG).toBe(0.2);
  });

  it('has SOME_GAPS with numeric value', () => {
    expect(typeof CONTROL_REDUCTIONS.SOME_GAPS).toBe('number');
    expect(CONTROL_REDUCTIONS.SOME_GAPS).toBe(0);
  });

  it('has WEAK with numeric value', () => {
    expect(typeof CONTROL_REDUCTIONS.WEAK).toBe('number');
    expect(CONTROL_REDUCTIONS.WEAK).toBe(0);
  });

  it('has all 4 keys', () => {
    expect(Object.keys(CONTROL_REDUCTIONS)).toHaveLength(4);
  });
});

describe('ASSESSMENT_MODULES', () => {
  it('is an array of 13 strings', () => {
    expect(Array.isArray(ASSESSMENT_MODULES)).toBe(true);
    expect(ASSESSMENT_MODULES).toHaveLength(13);
    for (const mod of ASSESSMENT_MODULES) {
      expect(typeof mod).toBe('string');
    }
  });

  it('contains expected modules', () => {
    expect(ASSESSMENT_MODULES).toContain('risk-appetite');
    expect(ASSESSMENT_MODULES).toContain('fraud-triangle');
    expect(ASSESSMENT_MODULES).toContain('people-culture');
    expect(ASSESSMENT_MODULES).toContain('controls-technology');
    expect(ASSESSMENT_MODULES).toContain('compliance-mapping');
  });
});

describe('PACKAGES', () => {
  it('has BASIC with id, name, and features', () => {
    expect(PACKAGES.BASIC.id).toBe(1);
    expect(PACKAGES.BASIC.name).toBe('Basic Health Check');
    expect(PACKAGES.BASIC.features).toContain('health-check');
  });

  it('has STANDARD with id, name, and features', () => {
    expect(PACKAGES.STANDARD.id).toBe(2);
    expect(PACKAGES.STANDARD.name).toBe('Health Check + Training');
    expect(PACKAGES.STANDARD.features).toContain('health-check');
    expect(PACKAGES.STANDARD.features).toContain('awareness-training');
  });

  it('has PREMIUM with id, name, and features', () => {
    expect(PACKAGES.PREMIUM.id).toBe(3);
    expect(PACKAGES.PREMIUM.name).toBe('Full Dashboard');
    expect(PACKAGES.PREMIUM.features).toContain('health-check');
    expect(PACKAGES.PREMIUM.features).toContain('awareness-training');
    expect(PACKAGES.PREMIUM.features).toContain('dashboard');
    expect(PACKAGES.PREMIUM.features).toContain('employee-assessment');
  });

  it('PREMIUM includes all STANDARD features', () => {
    for (const feature of PACKAGES.STANDARD.features) {
      expect(PACKAGES.PREMIUM.features).toContain(feature);
    }
  });
});

describe('REGULATIONS', () => {
  it('has GOVS013 with code, name, and url', () => {
    expect(REGULATIONS.GOVS013.code).toBe('GovS-013');
    expect(REGULATIONS.GOVS013.name).toContain('Counter-Fraud');
    expect(REGULATIONS.GOVS013.url).toMatch(/^https:\/\//);
  });

  it('has ECCTA with code, name, and url', () => {
    expect(REGULATIONS.ECCTA.code).toBe('ECCTA-2023');
    expect(REGULATIONS.ECCTA.name).toContain('Economic Crime');
    expect(REGULATIONS.ECCTA.url).toMatch(/^https:\/\//);
  });

  it('has FAILURE_TO_PREVENT with code, name, and deadline', () => {
    expect(REGULATIONS.FAILURE_TO_PREVENT.code).toBe('FTP-2025');
    expect(REGULATIONS.FAILURE_TO_PREVENT.name).toContain('Failure to Prevent');
    expect(REGULATIONS.FAILURE_TO_PREVENT.deadline).toBe('2025-09-01');
  });
});

describe('FRAUD_TRIANGLE', () => {
  it('has OPPORTUNITY', () => {
    expect(FRAUD_TRIANGLE.OPPORTUNITY).toBe('opportunity');
  });

  it('has PRESSURE', () => {
    expect(FRAUD_TRIANGLE.PRESSURE).toBe('pressure');
  });

  it('has RATIONALIZATION', () => {
    expect(FRAUD_TRIANGLE.RATIONALIZATION).toBe('rationalization');
  });

  it('has exactly 3 factors', () => {
    expect(Object.keys(FRAUD_TRIANGLE)).toHaveLength(3);
  });
});
