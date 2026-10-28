import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { createLogger } from '@/lib/logger';
import type { AssessmentRecord } from '@/types/assessment';

const logger = createLogger('useOrgAssessments');

/** A risk assessment counts as done once it has been submitted. */
export const isFinishedAssessment = (a: AssessmentRecord) => a.status === 'submitted' || a.status === 'completed';

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
  };
}
