// ============================================================
// An assessment's result is computed once, when it is submitted, and kept
// with it. Everything shown afterwards reads that saved result, so the score
// a customer saw (and showed an auditor) stays the same even if the scoring
// method changes later, and stays with the organisation when it moves from
// Starter to Professional or Enterprise.
// ============================================================

import type { Assessment } from './types.js';
import { buildAssessmentResults, type AssessmentResults } from './assessment-modules.js';
import { scoreAnswers, type AssessmentRisk } from './assessment-risk.js';

/** Raise when the scoring method changes, so saved results say which method produced them. */
export const SCORING_METHOD_VERSION = 1;

export type AssessmentResultSnapshot = {
  methodVersion: number;
  scoredAt: string;
  /** What the respondent sees: overall score, level, score per area, top risks */
  results: AssessmentResults;
  /** The register view (1–25 scale) used by dashboards, compliance and the risk register */
  risk: AssessmentRisk;
};

export const isSubmitted = (a: Pick<Assessment, 'status'>) => a.status === 'submitted' || a.status === 'completed';

export function computeResult(a: Pick<Assessment, 'id' | 'answers'>, scoredAt = new Date().toISOString()): AssessmentResultSnapshot {
  return {
    methodVersion: SCORING_METHOD_VERSION,
    scoredAt,
    results: buildAssessmentResults(a.id, a.answers),
    risk: scoreAnswers(a.answers),
  };
}

/** The saved results, or (for an assessment from before results were saved) computed now. */
export function resultsOf(a: Assessment): AssessmentResults {
  return a.result?.results ?? buildAssessmentResults(a.id, a.answers);
}
