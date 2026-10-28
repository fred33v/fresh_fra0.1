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

// Signed out by default, so these tests cover the phone-only behaviour; the
// 'server sync' tests sign in and mock the workshop API
const mockAuth = { isAuthenticated: false };
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => mockAuth }));

const mockStartProgress = jest.fn();
const mockUpdateProgress = jest.fn();
const mockIssueCertificate = jest.fn();
jest.mock('@/services/workshop.service', () => ({
  startProgress: (...args: unknown[]) => mockStartProgress(...args),
  updateProgress: (...args: unknown[]) => mockUpdateProgress(...args),
  issueCertificate: (...args: unknown[]) => mockIssueCertificate(...args),
  isPackageRequired: (res: { error?: { code?: string } }) => res.error?.code === 'PACKAGE_REQUIRED',
  isOffline: (res: { error?: { code?: string } }) => res.error?.code === 'NETWORK_ERROR' || res.error?.code === 'TIMEOUT',
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
  certificateIssuedAt: null,
  pendingQuizAnswers: {},
  serverProgressId: null,
};

// ── Tests ───────────────────────────────────────────────────

beforeEach(() => {
  jest.resetAllMocks();
  mockAuth.isAuthenticated = false;
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

  // ── saveQuizAnswer ──────────────────────────────────────

  describe('saveQuizAnswer', () => {
    it('shows the result straight away and keeps the answer for the server', async () => {
      const { result } = renderHook(() => useTraining(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.saveQuizAnswer(1, 2, false);
      });

      expect(result.current.quizScores).toEqual({ 1: 0 });
      expect(result.current.pendingQuizAnswers).toEqual({ '1': 2 });
      expect(result.current.hasPendingSync).toBe(true);
      expect(mockedStorage.setItem).toHaveBeenCalled();
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

// ── Server sync ─────────────────────────────────────────────

describe('TrainingContext server sync', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    id: 'prog-1', current_section: 0, completed_sections: [], quiz_scores: {}, scenario_choices: {}, completed_at: null, ...over,
  });

  beforeEach(() => {
    mockAuth.isAuthenticated = true;
  });

  it('is locked when the organisation has no package with the workshop', async () => {
    mockStartProgress.mockResolvedValue({ success: false, error: { code: 'PACKAGE_REQUIRED' } });
    const { result } = renderHook(() => useTraining(), { wrapper });

    await waitFor(() => expect(result.current.access).toBe('locked'));
    expect(mockUpdateProgress).not.toHaveBeenCalled();
  });

  it('keeps answers on the phone while offline and sends them when back online', async () => {
    mockStartProgress.mockResolvedValue({ success: false, error: { code: 'NETWORK_ERROR' } });
    const { result } = renderHook(() => useTraining(), { wrapper });
    await waitFor(() => expect(result.current.access).toBe('offline'));

    await act(async () => {
      await result.current.saveQuizAnswer(1, 1, true);
    });
    expect(result.current.pendingQuizAnswers).toEqual({ '1': 1 });

    // Back online: the server marks the answer and its score replaces the phone's
    mockStartProgress.mockResolvedValue({ success: true, data: row() });
    mockUpdateProgress.mockResolvedValue({ success: true, data: row({ quiz_scores: { 1: 100 } }) });
    await act(async () => {
      await result.current.sync();
    });

    expect(mockUpdateProgress).toHaveBeenCalledWith('prog-1', expect.objectContaining({ quizAnswers: { '1': 1 } }));
    expect(result.current.pendingQuizAnswers).toEqual({});
    expect(result.current.quizScores).toEqual({ 1: 100 });
    expect(result.current.access).toBe('granted');
  });

  it('sends completed sections to the server', async () => {
    mockStartProgress.mockResolvedValue({ success: true, data: row({ completed_sections: [0] }) });
    mockUpdateProgress.mockResolvedValue({ success: true, data: row({ completed_sections: [0, 1] }) });
    const { result } = renderHook(() => useTraining(), { wrapper });
    await waitFor(() => expect(result.current.access).toBe('granted'));

    await act(async () => {
      await result.current.completeSection(1);
    });

    expect(mockUpdateProgress).toHaveBeenCalledWith('prog-1', expect.objectContaining({ completedSections: [0, 1] }));
    expect(result.current.completedSections).toEqual([0, 1]);
  });

  it('gets the certificate from the server once it agrees the workshop is complete', async () => {
    const all = [0, 1, 2, 3, 4, 5, 6];
    mockStartProgress.mockResolvedValue({ success: true, data: row({ completed_sections: all }) });
    mockUpdateProgress.mockResolvedValue({ success: true, data: row({ completed_sections: all, completed_at: '2026-10-18T10:00:00.000Z' }) });
    mockIssueCertificate.mockResolvedValue({ success: true, data: { id: 'c1', certificate_number: 'FRA-ABC-123456', issued_at: '2026-10-18T10:00:01.000Z' } });
    const { result } = renderHook(() => useTraining(), { wrapper });
    await waitFor(() => expect(result.current.access).toBe('granted'));

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.issueCertificate();
    });

    expect(outcome).toEqual({ ok: true });
    expect(mockUpdateProgress).toHaveBeenCalledWith('prog-1', { completedAt: expect.any(String) });
    expect(result.current.certificateNumber).toBe('FRA-ABC-123456');
    expect(result.current.completedAt).toBe('2026-10-18T10:00:00.000Z');
  });

  it('issues no certificate when the server says the workshop is not finished', async () => {
    mockStartProgress.mockResolvedValue({ success: true, data: row() });
    mockUpdateProgress.mockResolvedValue({ success: false, error: { code: 'NOT_COMPLETED', message: 'Workshop not finished' } });
    const { result } = renderHook(() => useTraining(), { wrapper });
    await waitFor(() => expect(result.current.access).toBe('granted'));

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.issueCertificate();
    });

    expect(outcome).toEqual({ ok: false, reason: 'not-completed', message: 'Workshop not finished' });
    expect(mockIssueCertificate).not.toHaveBeenCalled();
    expect(result.current.certificateNumber).toBeNull();
  });

  it('drops a certificate number made up on the phone by an older version', async () => {
    mockedStorage.getItem.mockResolvedValue(JSON.stringify({ ...defaultProgress, certificateNumber: 'FRA-LOCAL01' }));
    mockStartProgress.mockResolvedValue({ success: false, error: { code: 'NETWORK_ERROR' } });
    const { result } = renderHook(() => useTraining(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.certificateNumber).toBeNull();
  });
});
