/**
 * useAssessment Hook
 *
 * Manages the fraud risk assessment workflow:
 * - Resume the user's open assessment, or create a new one
 * - Track user answers to each module
 * - Submit for scoring and load the results
 *
 * Backend endpoints used:
 * - GET   /api/v1/assessments/modules
 * - GET   /api/v1/assessments
 * - POST  /api/v1/assessments   (403 PACKAGE_REQUIRED / ASSESSMENT_LIMIT_REACHED)
 * - PATCH /api/v1/assessments/:id
 * - POST  /api/v1/assessments/:id/submit
 * - GET   /api/v1/assessments/:id/results
 */

import { useState, useCallback, useRef } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from './useAuth';
import { createLogger } from '@/lib/logger';
import { toast } from 'sonner';
import type { AssessmentModule, AssessmentRecord, AssessmentResults } from '@/types/assessment';

const logger = createLogger('useAssessment');

/**
 * Structure for tracking answers to assessment questions
 * Key: question ID, Value: answer (varies by question type)
 */
type AssessmentAnswers = Record<string, unknown>;

const OPEN_STATUSES = new Set<AssessmentRecord['status']>(['draft', 'in_progress']);

function describeError(err: unknown, fallback: string): { code: string | null; message: string } {
  if (err instanceof ApiError) return { code: err.code, message: err.message || fallback };
  if (err instanceof Error) return { code: null, message: err.message || fallback };
  return { code: null, message: fallback };
}

export function useAssessment() {
  const { user, profile } = useAuth();
  const [assessment, setAssessment] = useState<AssessmentRecord | null>(null);
  const [answers, setAnswers] = useState<AssessmentAnswers>({});
  const [results, setResults] = useState<AssessmentResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [modules, setModules] = useState<AssessmentModule[]>([]);
  // Guards against a double start (e.g. StrictMode effects) creating two assessments,
  // which would consume the Starter package's single allowance
  const startingRef = useRef(false);

  /**
   * Resume the user's open assessment, or create a new one if there is none
   */
  const startAssessment = useCallback(async () => {
    if (!user || !profile || startingRef.current) return;
    startingRef.current = true;

    setIsLoading(true);
    setError(null);
    setErrorCode(null);

    try {
      const [modulesData, existing] = await Promise.all([
        api.get<AssessmentModule[]>('/api/v1/assessments/modules'),
        api.get<AssessmentRecord[]>('/api/v1/assessments?pageSize=200'),
      ]);

      const open = existing
        .filter(a => a.createdByUserId === user.userId && OPEN_STATUSES.has(a.status))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

      const data = open ?? await api.post<AssessmentRecord>('/api/v1/assessments', {});

      setModules(modulesData);
      setAssessment(data);
      setAnswers(data.answers ?? {});
      setCurrentModuleIndex(0);

      toast.success(open ? 'Assessment resumed' : 'Assessment started');
    } catch (err: unknown) {
      const { code, message } = describeError(err, 'Failed to start assessment');
      logger.error('Error starting assessment', err);
      setError(message);
      setErrorCode(code);
      toast.error(message);
    } finally {
      setIsLoading(false);
      startingRef.current = false;
    }
  }, [user, profile]);

  /**
   * Update a single answer
   * Automatically saves to backend
   */
  const updateAnswer = useCallback(
    async (questionId: string, value: unknown) => {
      if (!assessment) return;

      const newAnswers = { ...answers, [questionId]: value };
      setAnswers(newAnswers);

      try {
        await api.patch(`/api/v1/assessments/${assessment.id}`, {
          answers: newAnswers,
        });
      } catch (err: unknown) {
        logger.error('Error saving answer', err);
        toast.error('Failed to save answer');
      }
    },
    [assessment, answers]
  );

  /**
   * Move to next module
   */
  const nextModule = useCallback(() => {
    if (currentModuleIndex < modules.length - 1) {
      setCurrentModuleIndex(i => i + 1);
    }
  }, [currentModuleIndex, modules.length]);

  /**
   * Move to previous module
   */
  const previousModule = useCallback(() => {
    if (currentModuleIndex > 0) {
      setCurrentModuleIndex(i => i - 1);
    }
  }, [currentModuleIndex]);

  /**
   * Skip to specific module
   */
  const jumpToModule = useCallback((index: number) => {
    if (index >= 0 && index < modules.length) {
      setCurrentModuleIndex(index);
    }
  }, [modules.length]);

  /**
   * Submit completed assessment for scoring.
   * Returns the results on success so the caller can navigate to them.
   */
  const submitAssessment = useCallback(async (): Promise<AssessmentResults | null> => {
    if (!assessment) return null;

    setIsLoading(true);
    setError(null);
    setErrorCode(null);

    try {
      // Submit does not take answers, so persist the latest set first in case an autosave failed
      await api.patch(`/api/v1/assessments/${assessment.id}`, { answers });
      const submitted = await api.post<AssessmentRecord>(`/api/v1/assessments/${assessment.id}/submit`);
      setAssessment(submitted);

      const scored = await api.get<AssessmentResults>(`/api/v1/assessments/${assessment.id}/results`);
      setResults(scored);
      toast.success('Assessment submitted successfully');
      return scored;
    } catch (err: unknown) {
      const { code, message } = describeError(err, 'Failed to submit assessment');
      logger.error('Error submitting assessment', err);
      setError(message);
      setErrorCode(code);
      toast.error(message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [assessment, answers]);

  /**
   * Calculate progress percentage
   */
  const progressPercent = modules.length > 0
    ? ((currentModuleIndex + 1) / modules.length) * 100
    : 0;

  /**
   * Check if current module is complete
   */
  const isCurrentModuleComplete = () => {
    if (modules.length === 0) return false;
    const module = modules[currentModuleIndex];
    return module.questions.every(q => answers[q.id] !== undefined);
  };

  return {
    // State
    assessment,
    answers,
    results,
    riskScore: results?.overallScore ?? null,
    isLoading,
    error,
    errorCode,
    currentModule: modules[currentModuleIndex],
    modules,
    currentModuleIndex,
    progressPercent,

    // Actions
    startAssessment,
    updateAnswer,
    nextModule,
    previousModule,
    jumpToModule,
    submitAssessment,
    isCurrentModuleComplete,
  };
}

export type UseAssessment = ReturnType<typeof useAssessment>;
