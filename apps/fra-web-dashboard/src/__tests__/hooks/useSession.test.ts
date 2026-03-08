import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSession } from '@/hooks/useSession';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// ── Mocks ────────────────────────────────────────────────────

const mockGet = vi.fn();
const mockPost = vi.fn();
let sseCleanup = vi.fn();
const sseHandlers: Record<string, (data: unknown) => void> = {};

vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
  },
  connectSSE: (_path: string, handlers: Record<string, (data: unknown) => void>) => {
    Object.assign(sseHandlers, handlers);
    return sseCleanup;
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

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1',
    title: 'Workshop Session',
    session_code: 'ABC123',
    facilitator_id: 'fac-1',
    is_active: true,
    current_slide: 0,
    created_at: '2025-01-01T00:00:00Z',
    ended_at: null,
    ...overrides,
  };
}

function makePoll(overrides: Record<string, unknown> = {}) {
  return {
    id: 'poll-1',
    session_id: 'session-1',
    question: 'What is fraud?',
    options: ['Option A', 'Option B', 'Option C'],
    is_active: true,
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeQuestion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'q-1',
    session_id: 'session-1',
    user_id: 'user-1',
    question_text: 'How does this work?',
    is_answered: false,
    upvotes: 0,
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Sets up mockGet to respond to the session fetch and the parallel sub-fetches.
 * Order: session → polls/active → questions → participants
 */
function setupSessionFetch(
  sessionData = makeSession(),
  pollData: unknown = null,
  questionsData: unknown[] = [],
  participantCount = 5,
) {
  mockGet
    .mockResolvedValueOnce(sessionData)      // session by code
    .mockResolvedValueOnce(pollData)          // polls/active
    .mockResolvedValueOnce(questionsData)     // questions
    .mockResolvedValueOnce({ count: participantCount }); // participants
}

// ── Tests ────────────────────────────────────────────────────

describe('useSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sseCleanup = vi.fn();
    // Clear captured SSE handlers
    for (const key of Object.keys(sseHandlers)) delete sseHandlers[key];
    mockedUseAuth.mockReturnValue({ ...defaultAuthReturn });
  });

  // ── fetchSession (on mount) ───────────────────────────────

  describe('fetchSession on mount', () => {
    it('fetches session by code and loads sub-data', async () => {
      const session = makeSession();
      const poll = makePoll();
      const questions = [makeQuestion()];
      setupSessionFetch(session, poll, questions, 12);

      const { result } = renderHook(() => useSession('ABC123'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockGet).toHaveBeenCalledWith('/api/v1/workshop/sessions/code/ABC123');
      expect(result.current.session).toEqual(session);
      expect(result.current.activePoll).toEqual(expect.objectContaining({ id: 'poll-1' }));
      expect(result.current.questions).toHaveLength(1);
      expect(result.current.participantCount).toBe(12);
      expect(result.current.error).toBeNull();
    });

    it('uppercases session code in API call', async () => {
      setupSessionFetch();

      const { result } = renderHook(() => useSession('abc123'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockGet).toHaveBeenCalledWith('/api/v1/workshop/sessions/code/ABC123');
    });

    it('sets error when session fetch fails', async () => {
      mockGet.mockRejectedValueOnce(new Error('Session not found'));

      const { result } = renderHook(() => useSession('BADCODE'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBe('Session not found');
      expect(result.current.session).toBeNull();
      expect(toast.error).toHaveBeenCalledWith('Failed to load session');
    });

    it('does not fetch when no session code provided', async () => {
      const { result } = renderHook(() => useSession());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockGet).not.toHaveBeenCalled();
      expect(result.current.session).toBeNull();
    });

    it('does not fetch when session code is undefined', async () => {
      const { result } = renderHook(() => useSession(undefined));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockGet).not.toHaveBeenCalled();
    });

    it('handles null active poll gracefully', async () => {
      setupSessionFetch(makeSession(), null, [], 0);

      const { result } = renderHook(() => useSession('ABC123'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.activePoll).toBeNull();
    });

    it('handles poll fetch failure silently', async () => {
      mockGet
        .mockResolvedValueOnce(makeSession())
        .mockRejectedValueOnce(new Error('poll error'))  // polls/active fails
        .mockResolvedValueOnce([])                        // questions
        .mockResolvedValueOnce({ count: 0 });             // participants

      const { result } = renderHook(() => useSession('ABC123'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Session still loaded, poll silently failed
      expect(result.current.session).toBeTruthy();
      expect(result.current.activePoll).toBeNull();
    });
  });

  // ── SSE events ────────────────────────────────────────────

  describe('SSE event handling', () => {
    it('registers SSE handlers after session loads', async () => {
      setupSessionFetch();

      renderHook(() => useSession('ABC123'));

      await waitFor(() => expect(Object.keys(sseHandlers).length).toBeGreaterThan(0));

      expect(sseHandlers).toHaveProperty('session_update');
      expect(sseHandlers).toHaveProperty('poll_created');
      expect(sseHandlers).toHaveProperty('poll_closed');
      expect(sseHandlers).toHaveProperty('question_added');
      expect(sseHandlers).toHaveProperty('question_updated');
      expect(sseHandlers).toHaveProperty('participant_joined');
    });

    it('session_update replaces session state', async () => {
      setupSessionFetch();

      const { result } = renderHook(() => useSession('ABC123'));

      await waitFor(() => expect(result.current.session).toBeTruthy());

      const updatedSession = makeSession({ current_slide: 5 });
      act(() => {
        sseHandlers.session_update(updatedSession);
      });

      expect(result.current.session?.current_slide).toBe(5);
    });

    it('poll_created sets active poll', async () => {
      setupSessionFetch(makeSession(), null, [], 0);

      const { result } = renderHook(() => useSession('ABC123'));

      await waitFor(() => expect(result.current.session).toBeTruthy());

      const newPoll = makePoll({ id: 'poll-2' });
      act(() => {
        sseHandlers.poll_created(newPoll);
      });

      expect(result.current.activePoll?.id).toBe('poll-2');
    });

    it('poll_created ignores inactive polls', async () => {
      setupSessionFetch(makeSession(), null, [], 0);

      const { result } = renderHook(() => useSession('ABC123'));

      await waitFor(() => expect(result.current.session).toBeTruthy());

      act(() => {
        sseHandlers.poll_created(makePoll({ is_active: false }));
      });

      expect(result.current.activePoll).toBeNull();
    });

    it('poll_closed clears matching active poll', async () => {
      const poll = makePoll();
      setupSessionFetch(makeSession(), poll, [], 0);

      const { result } = renderHook(() => useSession('ABC123'));

      await waitFor(() => expect(result.current.activePoll).toBeTruthy());

      act(() => {
        sseHandlers.poll_closed({ id: 'poll-1' });
      });

      expect(result.current.activePoll).toBeNull();
    });

    it('poll_closed does not clear different poll', async () => {
      const poll = makePoll();
      setupSessionFetch(makeSession(), poll, [], 0);

      const { result } = renderHook(() => useSession('ABC123'));

      await waitFor(() => expect(result.current.activePoll).toBeTruthy());

      act(() => {
        sseHandlers.poll_closed({ id: 'poll-other' });
      });

      // Original poll remains
      expect(result.current.activePoll?.id).toBe('poll-1');
    });
  });

  // ── joinSession ───────────────────────────────────────────

  describe('joinSession', () => {
    it('posts to join endpoint and returns no error', async () => {
      setupSessionFetch();
      mockPost.mockResolvedValueOnce({});

      const { result } = renderHook(() => useSession('ABC123'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let joinResult: { error: string | null } | undefined;
      await act(async () => {
        joinResult = await result.current.joinSession();
      });

      expect(mockPost).toHaveBeenCalledWith('/api/v1/workshop/sessions/session-1/join', {});
      expect(joinResult?.error).toBeNull();
    });

    it('returns error message on failure', async () => {
      setupSessionFetch();
      mockPost.mockRejectedValueOnce(new Error('Already joined'));

      const { result } = renderHook(() => useSession('ABC123'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let joinResult: { error: string | null } | undefined;
      await act(async () => {
        joinResult = await result.current.joinSession();
      });

      expect(joinResult?.error).toBe('Already joined');
    });

    it('returns error when no user', async () => {
      mockedUseAuth.mockReturnValue({ ...defaultAuthReturn, user: null });

      const { result } = renderHook(() => useSession('ABC123'));

      // No session fetched (no code triggers fetch, but user check is in joinSession)
      let joinResult: { error: string | null } | undefined;
      await act(async () => {
        joinResult = await result.current.joinSession();
      });

      expect(joinResult?.error).toBe('Not authenticated or no session');
      expect(mockPost).not.toHaveBeenCalled();
    });

    it('returns error when no session loaded', async () => {
      // No session code → no session fetched
      const { result } = renderHook(() => useSession());

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let joinResult: { error: string | null } | undefined;
      await act(async () => {
        joinResult = await result.current.joinSession();
      });

      expect(joinResult?.error).toBe('Not authenticated or no session');
    });
  });

  // ── submitPollResponse ────────────────────────────────────

  describe('submitPollResponse', () => {
    it('posts poll response and returns no error', async () => {
      setupSessionFetch();
      mockPost.mockResolvedValueOnce({});

      const { result } = renderHook(() => useSession('ABC123'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let pollResult: { error: string | null } | undefined;
      await act(async () => {
        pollResult = await result.current.submitPollResponse('poll-1', 2);
      });

      expect(mockPost).toHaveBeenCalledWith('/api/v1/workshop/polls/poll-1/respond', {
        selectedOption: 2,
      });
      expect(pollResult?.error).toBeNull();
    });

    it('returns error on failure', async () => {
      setupSessionFetch();
      mockPost.mockRejectedValueOnce(new Error('Already responded'));

      const { result } = renderHook(() => useSession('ABC123'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let pollResult: { error: string | null } | undefined;
      await act(async () => {
        pollResult = await result.current.submitPollResponse('poll-1', 0);
      });

      expect(pollResult?.error).toBe('Already responded');
    });

    it('returns error when no user', async () => {
      mockedUseAuth.mockReturnValue({ ...defaultAuthReturn, user: null });

      const { result } = renderHook(() => useSession());

      let pollResult: { error: string | null } | undefined;
      await act(async () => {
        pollResult = await result.current.submitPollResponse('poll-1', 0);
      });

      expect(pollResult?.error).toBe('Not authenticated');
      expect(mockPost).not.toHaveBeenCalled();
    });
  });

  // ── submitQuestion ────────────────────────────────────────

  describe('submitQuestion', () => {
    it('posts question and returns no error', async () => {
      setupSessionFetch();
      mockPost.mockResolvedValueOnce({});

      const { result } = renderHook(() => useSession('ABC123'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let qResult: { error: string | null } | undefined;
      await act(async () => {
        qResult = await result.current.submitQuestion('What is phishing?');
      });

      expect(mockPost).toHaveBeenCalledWith(
        '/api/v1/workshop/sessions/session-1/questions',
        { questionText: 'What is phishing?' },
      );
      expect(qResult?.error).toBeNull();
    });

    it('returns error on failure', async () => {
      setupSessionFetch();
      mockPost.mockRejectedValueOnce(new Error('Rate limited'));

      const { result } = renderHook(() => useSession('ABC123'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let qResult: { error: string | null } | undefined;
      await act(async () => {
        qResult = await result.current.submitQuestion('Test?');
      });

      expect(qResult?.error).toBe('Rate limited');
    });

    it('returns error when no user or session', async () => {
      mockedUseAuth.mockReturnValue({ ...defaultAuthReturn, user: null });

      const { result } = renderHook(() => useSession());

      let qResult: { error: string | null } | undefined;
      await act(async () => {
        qResult = await result.current.submitQuestion('Question');
      });

      expect(qResult?.error).toBe('Not authenticated or no session');
    });
  });

  // ── upvoteQuestion ────────────────────────────────────────

  describe('upvoteQuestion', () => {
    it('posts upvote and refreshes questions', async () => {
      setupSessionFetch(makeSession(), null, [makeQuestion()], 0);
      mockPost.mockResolvedValueOnce({});
      // After upvote, fetchQuestions is called which does another GET
      mockGet.mockResolvedValueOnce([makeQuestion({ upvotes: 1 })]);

      const { result } = renderHook(() => useSession('ABC123'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let upvoteResult: { error: string | null } | undefined;
      await act(async () => {
        upvoteResult = await result.current.upvoteQuestion('q-1');
      });

      expect(mockPost).toHaveBeenCalledWith('/api/v1/workshop/questions/q-1/upvote', {});
      expect(upvoteResult?.error).toBeNull();
    });

    it('returns error on failure', async () => {
      setupSessionFetch();
      mockPost.mockRejectedValueOnce(new Error('Already upvoted'));

      const { result } = renderHook(() => useSession('ABC123'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let upvoteResult: { error: string | null } | undefined;
      await act(async () => {
        upvoteResult = await result.current.upvoteQuestion('q-1');
      });

      expect(upvoteResult?.error).toBe('Already upvoted');
    });

    it('returns error when no user', async () => {
      mockedUseAuth.mockReturnValue({ ...defaultAuthReturn, user: null });

      const { result } = renderHook(() => useSession());

      let upvoteResult: { error: string | null } | undefined;
      await act(async () => {
        upvoteResult = await result.current.upvoteQuestion('q-1');
      });

      expect(upvoteResult?.error).toBe('Not authenticated');
    });
  });

  // ── refreshSession ────────────────────────────────────────

  describe('refreshSession', () => {
    it('re-fetches session and sub-data', async () => {
      const session1 = makeSession({ current_slide: 0 });
      setupSessionFetch(session1, null, [], 2);

      const { result } = renderHook(() => useSession('ABC123'));

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.session?.current_slide).toBe(0);

      const session2 = makeSession({ current_slide: 7 });
      setupSessionFetch(session2, null, [], 10);

      await act(async () => {
        await result.current.refreshSession();
      });

      expect(result.current.session?.current_slide).toBe(7);
      expect(result.current.participantCount).toBe(10);
    });
  });
});
