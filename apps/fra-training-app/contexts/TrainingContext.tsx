import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { TrainingProgress } from '@/types/training';
import { createLogger } from '@/utils/logger';
const logger = createLogger('TrainingContext');

const STORAGE_KEY = 'training_progress';
const TOTAL_SECTIONS = 7;

const defaultProgress: TrainingProgress = {
  completedSections: [],
  quizScores: {},
  scenarioChoices: {},
  actionPlanCommitments: {
    immediate: [],
    thirtyDays: [],
    ninetyDays: [],
  },
  currentSection: 0,
  completedAt: null,
  certificateNumber: null,
};

export const [TrainingProvider, useTraining] = createContextHook(() => {
  const [progress, setProgress] = useState<TrainingProgress>(defaultProgress);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        setProgress(JSON.parse(stored));
      }
    } catch (error: unknown) {
      logger.error('Failed to load training progress', error);
    } finally {
      setIsLoading(false);
    }
  };

  const persistProgress = async (updater: (prev: TrainingProgress) => TrainingProgress) => {
    return new Promise<void>((resolve) => {
      setProgress((prev) => {
        const updated = updater(prev);
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch((error: unknown) => {
          logger.error('Failed to save training progress', error);
        });
        resolve();
        return updated;
      });
    });
  };

  const completeSection = useCallback(
    async (sectionId: number) => {
      await persistProgress((prev) => {
        if (prev.completedSections.includes(sectionId)) return prev;
        return { ...prev, completedSections: [...prev.completedSections, sectionId] };
      });
    },
    []
  );

  const saveQuizScore = useCallback(
    async (sectionId: number, score: number) => {
      await persistProgress((prev) => ({
        ...prev,
        quizScores: { ...prev.quizScores, [sectionId]: score },
      }));
    },
    []
  );

  const saveScenarioChoice = useCallback(
    async (stepId: string, choiceId: string) => {
      await persistProgress((prev) => ({
        ...prev,
        scenarioChoices: { ...prev.scenarioChoices, [stepId]: choiceId },
      }));
    },
    []
  );

  const saveActionPlan = useCallback(
    async (commitments: { immediate: string[]; thirtyDays: string[]; ninetyDays: string[] }) => {
      await persistProgress((prev) => ({
        ...prev,
        actionPlanCommitments: commitments,
      }));
    },
    []
  );

  const setCurrentSection = useCallback(
    async (sectionId: number) => {
      await persistProgress((prev) => ({
        ...prev,
        currentSection: sectionId,
      }));
    },
    []
  );

  const completeCourse = useCallback(
    async (certificateNumber: string) => {
      await persistProgress((prev) => ({
        ...prev,
        completedAt: new Date().toISOString(),
        certificateNumber,
      }));
    },
    []
  );

  const resetProgress = useCallback(async () => {
    await persistProgress(() => defaultProgress);
  }, []);

  const isComplete = useMemo(
    () => progress.completedSections.length >= TOTAL_SECTIONS,
    [progress.completedSections]
  );

  return {
    ...progress,
    isLoading,
    isComplete,
    completeSection,
    saveQuizScore,
    saveScenarioChoice,
    saveActionPlan,
    setCurrentSection,
    completeCourse,
    resetProgress,
  };
});
