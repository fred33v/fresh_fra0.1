import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWorkshopProgress } from '@/hooks/useWorkshopProgress';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// ── Mocks ────────────────────────────────────────────────────

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    patch: (...args: unknown[]) => mockPatch(...args),
  },
}));

const mockUser = {
  userId: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  role: 'employee',
  organisationId: 'org-1',
  createdAt: '2025-01-01T00:00:00Z',
};

const defaultAuthReturn = {
  user: mockUser as ReturnType<typeof useAuth>['user'],
  profile: null,
  roles: [] as ReturnType<typeof useAuth>['roles'],
  isLoading: false,
  signUp: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  hasRole: vi.fn(),
  refreshProfile: vi.fn(),
};

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => defaultAuthReturn),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const mockedUseAuth = vi.mocked(useAuth);

// ── Helpers ──────────────────────────────────────────────────

function makeProgressRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prog-1',
    user_id: 'user-1',
    session_id: null,
    current_section: 0,
    completed_sections: [],
    quiz_scores: {},
    scenario_choices: {},
    completed_at: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function setNoUser() {
  mockedUseAuth.mockReturnValue({
    ...defaultAuthReturn,
    user: null,
  });
}

// ── Tests ────────────────────────────────────────────────────

describe('useWorkshopProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseAuth.mockReturnValue({ ...defaultAuthReturn });
  });

  // ── fetchProgress (on mount) ──────────────────────────────

  describe('fetchProgress on mount', () => {
    it('fetches existing progress and maps it correctly', async () => {
      const row = makeProgressRow({ current_section: 3, completed_sections: [0, 1, 2] });
      mockGet.mockResolvedValueOnce(row);

      const { result } = renderHook(() => useWorkshopProgress());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockGet).toHaveBeenCalledWith('/api/v1/workshop/progress');
      expect(result.current.progress).toEqual(
        expect.objectContaining({
          id: 'prog-1',
          current_section: 3,
          completed_sections: [0, 1, 2],
        }),
      );
      expect(result.current.error).toBeNull();
    });

    it('creates new progress when API returns null', async () => {
      mockGet.mockResolvedValueOnce(null);
      const newRow = makeProgressRow({ id: 'prog-new' });
      mockPost.mockResolvedValueOnce(newRow);

      const { result } = renderHook(() => useWorkshopProgress());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockPost).toHaveBeenCalledWith('/api/v1/workshop/progress', {
        sessionId: undefined,
      });
      expect(result.current.progress?.id).toBe('prog-new');
    });

    it('passes sessionId as query param when provided', async () => {
      const row = makeProgressRow({ session_id: 'sess-1' });
      mockGet.mockResolvedValueOnce(row);

      const { result } = renderHook(() => useWorkshopProgress('sess-1'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockGet).toHaveBeenCalledWith('/api/v1/workshop/progress?sessionId=sess-1');
    });

    it('passes sessionId to POST when creating new progress', async () => {
      mockGet.mockResolvedValueOnce(null);
      mockPost.mockResolvedValueOnce(makeProgressRow({ session_id: 'sess-2' }));

      renderHook(() => useWorkshopProgress('sess-2'));

      await waitFor(() => expect(mockPost).toHaveBeenCalled());

      expect(mockPost).toHaveBeenCalledWith('/api/v1/workshop/progress', {
        sessionId: 'sess-2',
      });
    });

    it('sets error state when fetch fails', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network failure'));

      const { result } = renderHook(() => useWorkshopProgress());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBe('Network failure');
      expect(result.current.progress).toBeNull();
      expect(toast.error).toHaveBeenCalledWith('Failed to load progress');
    });

    it('sets progress to null and stops loading when no user', async () => {
      setNoUser();

      const { result } = renderHook(() => useWorkshopProgress());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.progress).toBeNull();
      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  // ── mapProgress edge cases ────────────────────────────────

  describe('mapProgress data mapping', () => {
    it('defaults completed_sections to empty array if falsy', async () => {
      mockGet.mockResolvedValueOnce(makeProgressRow({ completed_sections: null }));

      const { result } = renderHook(() => useWorkshopProgress());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.progress?.completed_sections).toEqual([]);
    });

    it('defaults quiz_scores to empty object if falsy', async () => {
      mockGet.mockResolvedValueOnce(makeProgressRow({ quiz_scores: null }));

      const { result } = renderHook(() => useWorkshopProgress());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.progress?.quiz_scores).toEqual({});
    });

    it('defaults scenario_choices to empty object if falsy', async () => {
      mockGet.mockResolvedValueOnce(makeProgressRow({ scenario_choices: null }));

      const { result } = renderHook(() => useWorkshopProgress());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.progress?.scenario_choices).toEqual({});
    });

    it('preserves completed_at when set', async () => {
      mockGet.mockResolvedValueOnce(makeProgressRow({ completed_at: '2025-06-01T12:00:00Z' }));

      const { result } = renderHook(() => useWorkshopProgress());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.progress?.completed_at).toBe('2025-06-01T12:00:00Z');
    });
  });

  // ── updateSection ─────────────────────────────────────────

  describe('updateSection', () => {
    it('patches current section and updates local state', async () => {
      mockGet.mockResolvedValueOnce(makeProgressRow());
      mockPatch.mockResolvedValueOnce({});

      const { result } = renderHook(() => useWorkshopProgress());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.updateSection(5);
      });

      expect(mockPatch).toHaveBeenCalledWith('/api/v1/workshop/progress/prog-1', {
        currentSection: 5,
      });
      expect(result.current.progress?.current_section).toBe(5);
    });

    it('does nothing when no user', async () => {
      setNoUser();

      const { result } = renderHook(() => useWorkshopProgress());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.updateSection(5);
      });

      expect(mockPatch).not.toHaveBeenCalled();
    });

    it('shows toast on error', async () => {
      mockGet.mockResolvedValueOnce(makeProgressRow());
      mockPatch.mockRejectedValueOnce(new Error('Server error'));

      const { result } = renderHook(() => useWorkshopProgress());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.updateSection(5);
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to update section');
    });
  });

  // ── completeSection ───────────────────────────────────────

  describe('completeSection', () => {
    it('adds new section to completed list', async () => {
      mockGet.mockResolvedValueOnce(makeProgressRow({ completed_sections: [0, 1] }));
      mockPatch.mockResolvedValueOnce({});

      const { result } = renderHook(() => useWorkshopProgress());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.completeSection(2);
      });

      expect(mockPatch).toHaveBeenCalledWith('/api/v1/workshop/progress/prog-1', {
        completedSections: [0, 1, 2],
      });
      expect(result.current.progress?.completed_sections).toEqual([0, 1, 2]);
    });

    it('does not duplicate already completed section', async () => {
      mockGet.mockResolvedValueOnce(makeProgressRow({ completed_sections: [0, 1, 2] }));
      mockPatch.mockResolvedValueOnce({});

      const { result } = renderHook(() => useWorkshopProgress());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.completeSection(1);
      });

      expect(mockPatch).toHaveBeenCalledWith('/api/v1/workshop/progress/prog-1', {
        completedSections: [0, 1, 2],
      });
    });

    it('shows toast on error', async () => {
      mockGet.mockResolvedValueOnce(makeProgressRow());
      mockPatch.mockRejectedValueOnce(new Error('fail'));

      const { result } = renderHook(() => useWorkshopProgress());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.completeSection(0);
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to save progress');
    });
  });

  // ── saveQuizScore ─────────────────────────────────────────

  describe('saveQuizScore', () => {
    it('saves quiz score and updates local state', async () => {
      mockGet.mockResolvedValueOnce(makeProgressRow({ quiz_scores: { '0': 80 } }));
      mockPatch.mockResolvedValueOnce({});

      const { result } = renderHook(() => useWorkshopProgress());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.saveQuizScore(2, 95);
      });

      expect(mockPatch).toHaveBeenCalledWith('/api/v1/workshop/progress/prog-1', {
        quizScores: { '0': 80, '2': 95 },
      });
      expect(result.current.progress?.quiz_scores).toEqual({ '0': 80, '2': 95 });
    });

    it('overwrites existing score for same section', async () => {
      mockGet.mockResolvedValueOnce(makeProgressRow({ quiz_scores: { '1': 60 } }));
      mockPatch.mockResolvedValueOnce({});

      const { result } = renderHook(() => useWorkshopProgress());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.saveQuizScore(1, 100);
      });

      expect(result.current.progress?.quiz_scores).toEqual({ '1': 100 });
    });

    it('shows toast on error', async () => {
      mockGet.mockResolvedValueOnce(makeProgressRow());
      mockPatch.mockRejectedValueOnce(new Error('fail'));

      const { result } = renderHook(() => useWorkshopProgress());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.saveQuizScore(0, 50);
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to save quiz score');
    });
  });

  // ── saveScenarioChoice ────────────────────────────────────

  describe('saveScenarioChoice', () => {
    it('saves choice and updates local state', async () => {
      mockGet.mockResolvedValueOnce(makeProgressRow({ scenario_choices: { 'step-1': 'a' } }));
      mockPatch.mockResolvedValueOnce({});

      const { result } = renderHook(() => useWorkshopProgress());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.saveScenarioChoice('step-2', 'b');
      });

      expect(mockPatch).toHaveBeenCalledWith('/api/v1/workshop/progress/prog-1', {
        scenarioChoices: { 'step-1': 'a', 'step-2': 'b' },
      });
      expect(result.current.progress?.scenario_choices).toEqual({
        'step-1': 'a',
        'step-2': 'b',
      });
    });

    it('overwrites existing choice for same step', async () => {
      mockGet.mockResolvedValueOnce(makeProgressRow({ scenario_choices: { 'step-1': 'a' } }));
      mockPatch.mockResolvedValueOnce({});

      const { result } = renderHook(() => useWorkshopProgress());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.saveScenarioChoice('step-1', 'c');
      });

      expect(result.current.progress?.scenario_choices).toEqual({ 'step-1': 'c' });
    });

    it('shows toast on error', async () => {
      mockGet.mockResolvedValueOnce(makeProgressRow());
      mockPatch.mockRejectedValueOnce(new Error('fail'));

      const { result } = renderHook(() => useWorkshopProgress());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.saveScenarioChoice('step-1', 'a');
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to save choice');
    });
  });

  // ── markComplete ──────────────────────────────────────────

  describe('markComplete', () => {
    it('marks workshop as complete with ISO timestamp', async () => {
      mockGet.mockResolvedValueOnce(makeProgressRow());
      mockPatch.mockResolvedValueOnce({});

      const { result } = renderHook(() => useWorkshopProgress());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const before = new Date().toISOString();

      await act(async () => {
        await result.current.markComplete();
      });

      const after = new Date().toISOString();

      expect(mockPatch).toHaveBeenCalledWith(
        '/api/v1/workshop/progress/prog-1',
        expect.objectContaining({ completedAt: expect.any(String) }),
      );

      const completedAt = result.current.progress?.completed_at;
      expect(completedAt).toBeTruthy();
      expect(completedAt! >= before).toBe(true);
      expect(completedAt! <= after).toBe(true);
    });

    it('does nothing when no progress loaded', async () => {
      setNoUser();

      const { result } = renderHook(() => useWorkshopProgress());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.markComplete();
      });

      expect(mockPatch).not.toHaveBeenCalled();
    });

    it('shows toast on error', async () => {
      mockGet.mockResolvedValueOnce(makeProgressRow());
      mockPatch.mockRejectedValueOnce(new Error('fail'));

      const { result } = renderHook(() => useWorkshopProgress());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.markComplete();
      });

      expect(toast.error).toHaveBeenCalledWith('Failed to complete workshop');
    });
  });

  // ── refreshProgress ───────────────────────────────────────

  describe('refreshProgress', () => {
    it('re-fetches progress when called', async () => {
      const row1 = makeProgressRow({ current_section: 0 });
      const row2 = makeProgressRow({ current_section: 4 });
      mockGet.mockResolvedValueOnce(row1).mockResolvedValueOnce(row2);

      const { result } = renderHook(() => useWorkshopProgress());

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.progress?.current_section).toBe(0);

      await act(async () => {
        await result.current.refreshProgress();
      });

      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(result.current.progress?.current_section).toBe(4);
    });
  });
});
