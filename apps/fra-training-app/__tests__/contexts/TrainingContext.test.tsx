import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrainingProvider, useTraining } from '@/contexts/TrainingContext';

// ── Mocks ───────────────────────────────────────────────────

jest.mock('@/utils/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

const mockedStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

// ── Helpers ─────────────────────────────────────────────────

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TrainingProvider>{children}</TrainingProvider>
);

const defaultProgress = {
  completedSections: [],
  quizScores: {},
  scenarioChoices: {},
  actionPlanCommitments: { immediate: [], thirtyDays: [], ninetyDays: [] },
  currentSection: 0,
  completedAt: null,
  certificateNumber: null,
};

// ── Tests ───────────────────────────────────────────────────

beforeEach(() => {
  jest.resetAllMocks();
  mockedStorage.getItem.mockResolvedValue(null);
  mockedStorage.setItem.mockResolvedValue(undefined);
});

describe('TrainingContext', () => {
  // ── Initialisation ──────────────────────────────────────

  describe('initialisation', () => {
    it('starts with default progress and loading true', async () => {
      const { result } = renderHook(() => useTraining(), { wrapper });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.completedSections).toEqual([]);
      expect(result.current.currentSection).toBe(0);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });

    it('loads saved progress from AsyncStorage', async () => {
      const saved = {
        ...defaultProgress,
        completedSections: [0, 1, 2],
        currentSection: 3,
        quizScores: { 0: 80, 1: 90 },
      };
      mockedStorage.getItem.mockResolvedValue(JSON.stringify(saved));

      const { result } = renderHook(() => useTraining(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.completedSections).toEqual([0, 1, 2]);
      expect(result.current.currentSection).toBe(3);
      expect(result.current.quizScores).toEqual({ 0: 80, 1: 90 });
    });

    it('handles AsyncStorage load failure gracefully', async () => {
      mockedStorage.getItem.mockRejectedValue(new Error('storage error'));

      const { result } = renderHook(() => useTraining(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.completedSections).toEqual([]);
    });
  });

  // ── completeSection ─────────────────────────────────────

  describe('completeSection', () => {
    it('adds a section to completedSections', async () => {
      const { result } = renderHook(() => useTraining(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Fire-and-forget: persistProgress wraps setProgress in a Promise
      // that resolves inside the updater — awaiting inside act deadlocks.
      act(() => {
        result.current.completeSection(0);
      });

      await waitFor(() => {
        expect(result.current.completedSections).toContain(0);
      });

      expect(mockedStorage.setItem).toHaveBeenCalledWith(
        'training_progress',
        expect.stringContaining('"completedSections":[0]'),
      );
    });

    it('does not duplicate an already-completed section', async () => {
      const saved = { ...defaultProgress, completedSections: [0] };
      mockedStorage.getItem.mockResolvedValue(JSON.stringify(saved));

      const { result } = renderHook(() => useTraining(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.completeSection(0);
      });

      await waitFor(() => {
        expect(result.current.completedSections).toEqual([0]);
      });
    });

    it('accumulates multiple completed sections', async () => {
      const { result } = renderHook(() => useTraining(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.completeSection(0);
      });
      await waitFor(() => expect(result.current.completedSections).toContain(0));

      act(() => {
        result.current.completeSection(1);
      });
      await waitFor(() => expect(result.current.completedSections).toContain(1));

      act(() => {
        result.current.completeSection(2);
      });
      await waitFor(() => expect(result.current.completedSections).toContain(2));

      expect(result.current.completedSections).toEqual([0, 1, 2]);
    });
  });

  // ── saveQuizScore ───────────────────────────────────────

  describe('saveQuizScore', () => {
    it('saves a quiz score for a section', async () => {
      const { result } = renderHook(() => useTraining(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.saveQuizScore(1, 85);
      });

      await waitFor(() => {
        expect(result.current.quizScores).toEqual({ 1: 85 });
      });

      expect(mockedStorage.setItem).toHaveBeenCalled();
    });

    it('overwrites an existing quiz score', async () => {
      const saved = { ...defaultProgress, quizScores: { 1: 60 } };
      mockedStorage.getItem.mockResolvedValue(JSON.stringify(saved));

      const { result } = renderHook(() => useTraining(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.saveQuizScore(1, 95);
      });

      await waitFor(() => {
        expect(result.current.quizScores).toEqual({ 1: 95 });
      });
    });
  });

  // ── saveScenarioChoice ──────────────────────────────────

  describe('saveScenarioChoice', () => {
    it('saves a scenario choice by step ID', async () => {
      const { result } = renderHook(() => useTraining(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.saveScenarioChoice('step-1', 'choice-a');
      });

      await waitFor(() => {
        expect(result.current.scenarioChoices).toEqual({ 'step-1': 'choice-a' });
      });

      expect(mockedStorage.setItem).toHaveBeenCalled();
    });

    it('preserves existing choices when adding new ones', async () => {
      const saved = {
        ...defaultProgress,
        scenarioChoices: { 'step-1': 'choice-a' },
      };
      mockedStorage.getItem.mockResolvedValue(JSON.stringify(saved));

      const { result } = renderHook(() => useTraining(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.saveScenarioChoice('step-2', 'choice-b');
      });

      await waitFor(() => {
        expect(result.current.scenarioChoices).toEqual({
          'step-1': 'choice-a',
          'step-2': 'choice-b',
        });
      });
    });
  });

  // ── saveActionPlan ──────────────────────────────────────

  describe('saveActionPlan', () => {
    it('saves action plan commitments', async () => {
      const { result } = renderHook(() => useTraining(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const commitments = {
        immediate: ['Review fraud policy'],
        thirtyDays: ['Schedule team training'],
        ninetyDays: ['Implement new controls'],
      };

      act(() => {
        result.current.saveActionPlan(commitments);
      });

      await waitFor(() => {
        expect(result.current.actionPlanCommitments).toEqual(commitments);
      });

      expect(mockedStorage.setItem).toHaveBeenCalled();
    });

    it('replaces previous action plan entirely', async () => {
      const saved = {
        ...defaultProgress,
        actionPlanCommitments: {
          immediate: ['Old task'],
          thirtyDays: [],
          ninetyDays: [],
        },
      };
      mockedStorage.getItem.mockResolvedValue(JSON.stringify(saved));

      const { result } = renderHook(() => useTraining(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const newCommitments = {
        immediate: ['New task'],
        thirtyDays: ['30-day task'],
        ninetyDays: [],
      };

      act(() => {
        result.current.saveActionPlan(newCommitments);
      });

      await waitFor(() => {
        expect(result.current.actionPlanCommitments).toEqual(newCommitments);
      });
    });
  });

  // ── setCurrentSection ───────────────────────────────────

  describe('setCurrentSection', () => {
    it('updates the current section', async () => {
      const { result } = renderHook(() => useTraining(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.setCurrentSection(4);
      });

      await waitFor(() => {
        expect(result.current.currentSection).toBe(4);
      });

      expect(mockedStorage.setItem).toHaveBeenCalled();
    });
  });

  // ── completeCourse ──────────────────────────────────────

  describe('completeCourse', () => {
    it('sets completedAt timestamp and certificate number', async () => {
      const { result } = renderHook(() => useTraining(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      act(() => {
        result.current.completeCourse('CERT-001');
      });

      await waitFor(() => {
        expect(result.current.certificateNumber).toBe('CERT-001');
      });

      expect(result.current.completedAt).toBeTruthy();
      // Verify it's a valid ISO date string
      expect(new Date(result.current.completedAt!).toISOString()).toBe(
        result.current.completedAt,
      );
    });
  });

  // ── resetProgress ───────────────────────────────────────

  describe('resetProgress', () => {
    it('resets all progress to defaults', async () => {
      const saved = {
        ...defaultProgress,
        completedSections: [0, 1, 2],
        quizScores: { 0: 80 },
        currentSection: 3,
        certificateNumber: 'CERT-001',
        completedAt: '2026-01-01T00:00:00.000Z',
      };
      mockedStorage.getItem.mockResolvedValue(JSON.stringify(saved));

      const { result } = renderHook(() => useTraining(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Verify loaded state first
      expect(result.current.completedSections).toEqual([0, 1, 2]);

      act(() => {
        result.current.resetProgress();
      });

      await waitFor(() => {
        expect(result.current.completedSections).toEqual([]);
      });

      expect(result.current.quizScores).toEqual({});
      expect(result.current.currentSection).toBe(0);
      expect(result.current.certificateNumber).toBeNull();
      expect(result.current.completedAt).toBeNull();
      expect(mockedStorage.setItem).toHaveBeenCalled();
    });
  });

  // ── isComplete ──────────────────────────────────────────

  describe('isComplete', () => {
    it('returns false when fewer than 7 sections completed', async () => {
      const saved = { ...defaultProgress, completedSections: [0, 1, 2] };
      mockedStorage.getItem.mockResolvedValue(JSON.stringify(saved));

      const { result } = renderHook(() => useTraining(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isComplete).toBe(false);
    });

    it('returns true when all 7 sections completed', async () => {
      const saved = {
        ...defaultProgress,
        completedSections: [0, 1, 2, 3, 4, 5, 6],
      };
      mockedStorage.getItem.mockResolvedValue(JSON.stringify(saved));

      const { result } = renderHook(() => useTraining(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isComplete).toBe(true);
    });

    it('returns true when more than 7 sections completed', async () => {
      const saved = {
        ...defaultProgress,
        completedSections: [0, 1, 2, 3, 4, 5, 6, 7],
      };
      mockedStorage.getItem.mockResolvedValue(JSON.stringify(saved));

      const { result } = renderHook(() => useTraining(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.isComplete).toBe(true);
    });
  });

  // ── Persistence error handling ──────────────────────────

  describe('persistence errors', () => {
    it('continues working when AsyncStorage.setItem fails', async () => {
      mockedStorage.setItem.mockRejectedValue(new Error('write error'));

      const { result } = renderHook(() => useTraining(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Should not throw — error is caught and logged
      act(() => {
        result.current.completeSection(0);
      });

      // State is still updated in memory
      await waitFor(() => {
        expect(result.current.completedSections).toContain(0);
      });
    });
  });
});
