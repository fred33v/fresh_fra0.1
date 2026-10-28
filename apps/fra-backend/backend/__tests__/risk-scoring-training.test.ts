/// <reference types="jest" />

import { describe, expect, it } from '@jest/globals';
import { calculateRiskScore } from '../src/risk-scoring';

const trainingRisk = (staffTrainedPercentage: number) =>
  calculateRiskScore({ trainingAwareness: { staffTrainedPercentage, specialistTraining: 'yes', boardTrained: 'yes' } })
    .topRisks.find((r) => r.module === 'trainingAwareness');

describe('staff training coverage', () => {
  it('rates near-zero coverage as at least Medium', () => {
    expect(trainingRisk(5)?.severity).toBe('Medium');
  });

  it('keeps partial coverage at Low', () => {
    expect(trainingRisk(40)?.severity).toBe('Low');
  });
});
