/**
 * useAssessment Hook
 * 
 * Manages the fraud risk assessment workflow:
 * - Create new assessment
 * - Track user answers to 13 modules
 * - Calculate risk scores
 * - Submit for analysis
 * 
 * Backend endpoints used:
 * - POST /api/v1/assessment/create
 * - PATCH /api/v1/assessment/:id
 * - GET /api/v1/assessment/:id
 */

import { useState, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from './useAuth';
import { createLogger } from '@/lib/logger';
import { toast } from 'sonner';
import type { AssessmentType, RiskScore } from '@stopfra/types';

const logger = createLogger('useAssessment');

/**
 * Structure for tracking answers to assessment questions
 * Key: question ID, Value: answer (varies by question type)
 */
type AssessmentAnswers = Record<string, unknown>;

/**
 * Module data returned from backend
 */
interface AssessmentModule {
  id: string;
  title: string;
  description: string;
  category: 'governance' | 'people' | 'process' | 'systems' | 'culture';
  questions: Array<{
    id: string;
    text: string;
    type: 'frequency' | 'currency' | 'scale' | 'yesno';
    weight?: number;
  }>;
}

export function useAssessment() {
  const { user, profile } = useAuth();
  const [assessment, setAssessment] = useState<AssessmentType | null>(null);
  const [answers, setAnswers] = useState<AssessmentAnswers>({});
  const [riskScore, setRiskScore] = useState<RiskScore | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [modules, setModules] = useState<AssessmentModule[]>([]);

  /**
   * Initialize new assessment
   */
  const startAssessment = useCallback(async () => {
    if (!user || !profile) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await api.post<AssessmentType>('/api/v1/assessment/create', {
        organisationId: profile.organisation_id,
      });

      setAssessment(data);
      setAnswers({});
      setCurrentModuleIndex(0);

      // Fetch assessment modules after creation
      const modulesData = await api.get<AssessmentModule[]>(
        `/api/v1/assessment/${data.id}/modules`
      );
      setModules(modulesData);

      toast.success('Assessment started');
    } catch (err: unknown) {
      const errorMsg = (err as ApiError).message || 'Failed to start assessment';
      logger.error('Error starting assessment', err);
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
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
        await api.patch(`/api/v1/assessment/${assessment.id}`, {
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
   * Submit completed assessment for scoring
   */
  const submitAssessment = useCallback(async () => {
    if (!assessment) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await api.post<{ riskScore: RiskScore }>(
        `/api/v1/assessment/${assessment.id}/submit`,
        {
          answers,
        }
      );

      setRiskScore(result.riskScore);
      toast.success('Assessment submitted successfully');
    } catch (err: unknown) {
      const errorMsg = (err as ApiError).message || 'Failed to submit assessment';
      logger.error('Error submitting assessment', err);
      setError(errorMsg);
      toast.error(errorMsg);
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
    riskScore,
    isLoading,
    error,
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
