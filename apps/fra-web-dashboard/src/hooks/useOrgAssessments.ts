import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { createLogger } from '@/lib/logger';
import type { AssessmentRecord, AssessmentResults } from '@/types/assessment';

const logger = createLogger('useOrgAssessments');

/** A risk assessment counts as done once it has been submitted. */
export const isFinishedAssessment = (a: AssessmentRecord) => a.status === 'submitted' || a.status === 'completed';

/**
 * Results of the latest submitted assessment: the person's own if they have one, otherwise the organisation's.
 */
export function latestResult(assessments: AssessmentRecord[], userId?: string): AssessmentResults | null {
  const done = assessments.filter((a) => isFinishedAssessment(a) && a.result)
    .sort((a, b) => (b.submittedAt ?? b.updatedAt).localeCompare(a.submittedAt ?? a.updatedAt));
  return (done.find((a) => a.createdByUserId === userId) ?? done[0])?.result?.results ?? null;
}

/**
 * The organisation's fraud risk assessments (package 1, included in every package).
 * Pass enabled=false when the organisation has no package, so nothing is requested.
 */
export function useOrgAssessments(enabled: boolean) {
  const [assessments, setAssessments] = useState<AssessmentRecord[] | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setAssessments(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    api
      .get<AssessmentRecord[]>('/api/v1/assessments?pageSize=50')
      .then((rows) => { if (!cancelled) setAssessments(rows); })
      .catch((err: unknown) => {
        logger.error('Failed to load assessments', err);
        if (!cancelled) setAssessments([]);
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [enabled]);

  return {
    assessments,
    isLoading,
    hasFinishedAssessment: !!assessments?.some(isFinishedAssessment),
    latestResult: (userId?: string) => latestResult(assessments ?? [], userId),
  };
}
