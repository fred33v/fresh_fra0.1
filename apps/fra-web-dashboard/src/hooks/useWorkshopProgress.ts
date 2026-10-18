import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from './useAuth';
import { createLogger } from '@/lib/logger';
const logger = createLogger('WorkshopProgress');
import { toast } from 'sonner';
import { WorkshopProgress } from '@/types/workshop';

type ProgressRow = {
  id: string;
  user_id: string;
  session_id: string | null;
  current_section: number;
  completed_sections: number[];
  quiz_scores: Record<string, number>;
  scenario_choices: Record<string, string>;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

function mapProgress(row: ProgressRow): WorkshopProgress {
  return {
    id: row.id,
    user_id: row.user_id,
    session_id: row.session_id,
    current_section: row.current_section,
    completed_sections: row.completed_sections || [],
    quiz_scores: (row.quiz_scores as Record<string, number>) || {},
    scenario_choices: (row.scenario_choices as Record<string, string>) || {},
    completed_at: row.completed_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Progress for the signed-in user, solo (no sessionId) or within a live session.
 * `enabled: false` holds off loading, e.g. while a session code is still being resolved to its id.
 */
export function useWorkshopProgress(sessionId?: string | null, { enabled = true }: { enabled?: boolean } = {}) {
  const { user } = useAuth();
  const [progress, setProgress] = useState<WorkshopProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    if (!user) return;

    try {
      const queryParam = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
      const data = await api.get<ProgressRow | null>(`/api/v1/workshop/progress${queryParam}`);

      if (data) {
        setProgress(mapProgress(data));
      } else {
        // Create initial progress record
        const newData = await api.post<ProgressRow>('/api/v1/workshop/progress', {
          sessionId: sessionId || undefined,
        });
        setProgress(mapProgress(newData));
      }
      setError(null);
    } catch (err: unknown) {
      // The workshop is part of Professional and Enterprise; without it there is simply no progress
      if ((err as { code?: string } | null)?.code === 'PACKAGE_REQUIRED') {
        setProgress(null);
        setError(null);
        setIsLoading(false);
        return;
      }
      logger.error('Error fetching progress', err);
      setError((err as Error).message || 'Failed to load progress');
      toast.error('Failed to load progress');
    }

    setIsLoading(false);
  }, [user, sessionId]);

  useEffect(() => {
    if (!enabled) return; // stays loading until enabled
    if (user) {
      fetchProgress();
    } else {
      setProgress(null);
      setIsLoading(false);
    }
  }, [user, sessionId, fetchProgress, enabled]);

  const updateSection = async (sectionId: number) => {
    if (!user || !progress) return;

    try {
      await api.patch(`/api/v1/workshop/progress/${progress.id}`, {
        currentSection: sectionId,
      });
      setProgress(prev => prev ? { ...prev, current_section: sectionId } : null);
    } catch (err: unknown) {
      logger.error('Error updating section', err);
      toast.error('Failed to update section');
    }
  };

  const completeSection = async (sectionId: number) => {
    if (!user || !progress) return;

    const newCompletedSections = progress.completed_sections.includes(sectionId)
      ? progress.completed_sections
      : [...progress.completed_sections, sectionId];

    try {
      await api.patch(`/api/v1/workshop/progress/${progress.id}`, {
        completedSections: newCompletedSections,
      });
      setProgress(prev => prev ? { ...prev, completed_sections: newCompletedSections } : null);
    } catch (err: unknown) {
      logger.error('Error completing section', err);
      toast.error('Failed to save progress');
    }
  };

  /** Sends the chosen option; the server marks it and returns the saved scores. */
  const saveQuizAnswer = async (sectionId: number, answer: number) => {
    if (!user || !progress) return;

    try {
      const row = await api.patch<Partial<ProgressRow> | null>(`/api/v1/workshop/progress/${progress.id}`, {
        quizAnswers: { [sectionId.toString()]: answer },
      });
      const scores = row?.quiz_scores as Record<string, number> | undefined;
      if (scores) setProgress(prev => prev ? { ...prev, quiz_scores: scores } : null);
    } catch (err: unknown) {
      logger.error('Error saving quiz score', err);
      toast.error('Failed to save quiz score');
    }
  };

  const saveScenarioChoice = async (stepId: string, choiceId: string) => {
    if (!user || !progress) return;

    const newChoices = { ...progress.scenario_choices, [stepId]: choiceId };

    try {
      await api.patch(`/api/v1/workshop/progress/${progress.id}`, {
        scenarioChoices: newChoices,
      });
      setProgress(prev => prev ? { ...prev, scenario_choices: newChoices } : null);
    } catch (err: unknown) {
      logger.error('Error saving scenario choice', err);
      toast.error('Failed to save choice');
    }
  };

  /** Asks the server to mark the workshop complete; it checks every section and quiz is done. */
  const markComplete = async (): Promise<boolean> => {
    if (!user || !progress) return false;

    try {
      const row = await api.patch<Partial<ProgressRow> | null>(`/api/v1/workshop/progress/${progress.id}`, {
        completedAt: new Date().toISOString(),
      });
      const completedAt = row?.completed_at ?? new Date().toISOString();
      setProgress(prev => prev ? { ...prev, completed_at: completedAt } : null);
      return true;
    } catch (err: unknown) {
      logger.error('Error marking complete', err);
      if (err instanceof ApiError && err.code === 'NOT_COMPLETED') {
        toast.error('Please complete every section and answer every quiz question first');
      } else {
        toast.error('Failed to complete workshop');
      }
      return false;
    }
  };

  return {
    progress,
    isLoading,
    error,
    updateSection,
    completeSection,
    saveQuizAnswer,
    saveScenarioChoice,
    markComplete,
    refreshProgress: fetchProgress,
  };
}
