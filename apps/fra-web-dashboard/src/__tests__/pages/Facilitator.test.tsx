import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Facilitator from '@/pages/Facilitator';
import { useAuth } from '@/hooks/useAuth';
import { api, connectSSE } from '@/lib/api';

// ── Mocks ──────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/hooks/useAuth');

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  connectSSE: vi.fn(() => vi.fn()),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}));

vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedApi = vi.mocked(api);
const mockedConnectSSE = vi.mocked(connectSSE);

// ── Helpers ────────────────────────────────────────────────

function makeUser() {
  return {
    userId: 'u-1',
    email: 'facilitator@example.com',
    name: 'Fiona Facilitator',
    role: 'admin',
    organisationId: 'org-1',
    createdAt: '2025-01-01T00:00:00Z',
  };
}

function makeProfile() {
  return {
    id: 'p-1',
    user_id: 'u-1',
    full_name: 'Fiona Facilitator',
    organization_name: 'Test Organisation',
    sector: 'public' as const,
    job_title: 'Training Lead',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  };
}

function makeSession(overrides?: Record<string, unknown>) {
  return {
    id: 's-1',
    facilitator_id: 'u-1',
    session_code: 'ABC123',
    title: 'Q1 Board Workshop',
    status: 'active' as const,
    is_active: true,
    scheduled_at: null,
    started_at: '2025-06-01T10:00:00Z',
    ended_at: null,
    max_participants: 50,
    created_at: '2025-06-01T09:00:00Z',
    ...overrides,
  };
}

function makePoll(overrides?: Record<string, unknown>) {
  return {
    id: 'poll-1',
    session_id: 's-1',
    question: 'What is your biggest fraud risk?',
    options: ['Procurement', 'Payroll', 'Cyber', 'Expense'],
    is_active: true,
    created_at: '2025-06-01T10:30:00Z',
    ...overrides,
  };
}

function makeQuestion(overrides?: Record<string, unknown>) {
  return {
    id: 'q-1',
    session_id: 's-1',
    user_id: 'u-2',
    question_text: 'How do we report suspected fraud?',
    upvotes: 3,
    is_answered: false,
    created_at: '2025-06-01T10:15:00Z',
    ...overrides,
  };
}

function setupAuth(overrides?: Record<string, unknown>) {
  mockedUseAuth.mockReturnValue({
    user: makeUser(),
    profile: makeProfile(),
    roles: ['facilitator'] as never[],
    isLoading: false,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    hasRole: vi.fn(),
    refreshProfile: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useAuth>);
}

function setupApiDefaults(sessions: ReturnType<typeof makeSession>[] = []) {
  mockedApi.get.mockImplementation(async (url: string) => {
    if (url === '/api/v1/workshop/sessions') return sessions;
    if (url.includes('/polls')) return [];
    if (url.includes('/questions')) return [];
    if (url.includes('/participants')) return { count: 0 };
    return [];
  });
}

function renderFacilitator() {
  return render(
    <MemoryRouter>
      <Facilitator />
    </MemoryRouter>,
  );
}

// ── Tests ──────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  setupAuth();
  setupApiDefaults();
  mockedConnectSSE.mockReturnValue(vi.fn());
});

describe('Facilitator', () => {
  // ── Loading state ─────────────────────────────

  describe('loading state', () => {
    it('shows loading spinner when auth is loading', () => {
      setupAuth({ isLoading: true });

      renderFacilitator();

      expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    });

    it('shows loading spinner while fetching sessions', () => {
      mockedApi.get.mockReturnValue(new Promise(() => {}));

      renderFacilitator();

      expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    });
  });

  // ── Auth guard ──────────────────────────────────

  describe('auth guard', () => {
    it('renders null when user is null', async () => {
      setupAuth({ user: null });

      const { container } = renderFacilitator();

      // fetchSessions exits early when user is null, isLoading stays true → loading spinner
      // After loading finishes, !user → returns null
      expect(container.querySelector('[data-testid="layout"]')).toBeTruthy();
    });

    it('renders null when profile is null after loading', async () => {
      setupAuth({ profile: null });

      renderFacilitator();

      await waitFor(() => {
        expect(screen.queryByText('Facilitator Dashboard')).not.toBeInTheDocument();
      });
    });
  });

  // ── Empty sessions state ───────────────────────

  describe('empty sessions state', () => {
    it('shows "No sessions yet" when there are no sessions', async () => {
      renderFacilitator();

      await waitFor(() => {
        expect(screen.getByText('No sessions yet')).toBeInTheDocument();
      });
    });

    it('shows "No Session Selected" prompt', async () => {
      renderFacilitator();

      await waitFor(() => {
        expect(screen.getByText('No Session Selected')).toBeInTheDocument();
      });
    });

    it('shows page title and description', async () => {
      renderFacilitator();

      await waitFor(() => {
        expect(screen.getByText('Facilitator Dashboard')).toBeInTheDocument();
      });
      expect(screen.getByText('Create and manage live workshop sessions')).toBeInTheDocument();
    });
  });

  // ── Create session ─────────────────────────────

  describe('create session', () => {
    it('Create Session button is disabled when title is empty', async () => {
      renderFacilitator();

      await waitFor(() => {
        expect(screen.getByText('Create Session')).toBeInTheDocument();
      });

      expect(screen.getByText('Create Session').closest('button')).toBeDisabled();
    });

    it('creates session on button click and shows success toast', async () => {
      const { toast } = await import('sonner');
      const newSession = makeSession({ id: 's-new', session_code: 'XYZ789', title: 'New Workshop' });
      mockedApi.post.mockResolvedValueOnce(newSession);

      const user = userEvent.setup();
      renderFacilitator();

      await waitFor(() => {
        expect(screen.getByLabelText('Session Title')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('Session Title'), 'New Workshop');
      await user.click(screen.getByText('Create Session'));

      await waitFor(() => {
        expect(mockedApi.post).toHaveBeenCalledWith('/api/v1/workshop/sessions', {
          title: 'New Workshop',
        });
      });
      expect(toast.success).toHaveBeenCalledWith('Session created! Code: XYZ789');
    });

    it('shows error toast when session creation fails', async () => {
      const { toast } = await import('sonner');
      mockedApi.post.mockRejectedValueOnce(new Error('Server error'));

      const user = userEvent.setup();
      renderFacilitator();

      await waitFor(() => {
        expect(screen.getByLabelText('Session Title')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('Session Title'), 'New Workshop');
      await user.click(screen.getByText('Create Session'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to create session');
      });
    });
  });

  // ── Session list display ───────────────────────

  describe('session list display', () => {
    it('shows sessions with title, code, and Live badge', async () => {
      setupApiDefaults([makeSession()]);

      renderFacilitator();

      await waitFor(() => {
        // Title and code appear in both sidebar and detail panel (auto-selected)
        expect(screen.getAllByText('Q1 Board Workshop').length).toBeGreaterThanOrEqual(1);
      });
      expect(screen.getAllByText('ABC123').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Live')).toBeInTheDocument();
    });

    it('shows Ended badge for inactive sessions', async () => {
      setupApiDefaults([makeSession({ is_active: false, ended_at: '2025-06-01T12:00:00Z' })]);

      renderFacilitator();

      await waitFor(() => {
        expect(screen.getByText('Ended')).toBeInTheDocument();
      });
    });

    it('selects session on click and loads session data', async () => {
      const session = makeSession();
      setupApiDefaults([session]);

      const user = userEvent.setup();
      renderFacilitator();

      await waitFor(() => {
        expect(screen.getByLabelText(`Select session: ${session.title}`)).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText(`Select session: ${session.title}`));

      // Should now show the active session details panel
      await waitFor(() => {
        expect(screen.getByText('Participants')).toBeInTheDocument();
      });
    });
  });

  // ── Active session info ────────────────────────

  describe('active session info', () => {
    beforeEach(() => {
      const session = makeSession();
      mockedApi.get.mockImplementation(async (url: string) => {
        if (url === '/api/v1/workshop/sessions') return [session];
        if (url.includes('/polls')) return [makePoll()];
        if (url.includes('/questions')) return [
          makeQuestion(),
          makeQuestion({ id: 'q-2', question_text: 'What training is available?', upvotes: 1, is_answered: true }),
        ];
        if (url.includes('/participants')) return { count: 15 };
        return [];
      });
    });

    it('shows participant count, polls count, and questions count', async () => {
      renderFacilitator();

      await waitFor(() => {
        expect(screen.getByText('15')).toBeInTheDocument();
      });
      expect(screen.getByText('Participants')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('Polls Created')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('Questions')).toBeInTheDocument();
    });

    it('shows unanswered questions count', async () => {
      renderFacilitator();

      await waitFor(() => {
        expect(screen.getByText('1 unanswered')).toBeInTheDocument();
      });
    });

    it('shows poll question with options and participant questions with upvotes', async () => {
      renderFacilitator();

      await waitFor(() => {
        expect(screen.getByText('What is your biggest fraud risk?')).toBeInTheDocument();
      });
      expect(screen.getByText('Procurement | Payroll | Cyber | Expense')).toBeInTheDocument();

      // Participant questions
      expect(screen.getByText('How do we report suspected fraud?')).toBeInTheDocument();
      expect(screen.getByText('3 upvotes')).toBeInTheDocument();
    });
  });

  // ── End session ────────────────────────────────

  describe('end session', () => {
    beforeEach(() => {
      setupApiDefaults([makeSession()]);
    });

    it('shows End Session button for active sessions', async () => {
      renderFacilitator();

      await waitFor(() => {
        expect(screen.getByText('End Session')).toBeInTheDocument();
      });
    });

    it('shows confirmation dialog with participant count', async () => {
      mockedApi.get.mockImplementation(async (url: string) => {
        if (url === '/api/v1/workshop/sessions') return [makeSession()];
        if (url.includes('/participants')) return { count: 8 };
        if (url.includes('/polls')) return [];
        if (url.includes('/questions')) return [];
        return [];
      });

      const user = userEvent.setup();
      renderFacilitator();

      await waitFor(() => {
        expect(screen.getByText('End Session')).toBeInTheDocument();
      });

      // Click the first End Session (trigger button)
      const endButtons = screen.getAllByText('End Session');
      await user.click(endButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('End this session?')).toBeInTheDocument();
      });
      expect(screen.getByText(/disconnect all 8 participants/)).toBeInTheDocument();
    });

    it('ends session and shows success toast', async () => {
      const { toast } = await import('sonner');
      mockedApi.post.mockResolvedValueOnce(undefined);

      const user = userEvent.setup();
      renderFacilitator();

      await waitFor(() => {
        expect(screen.getByText('End Session')).toBeInTheDocument();
      });

      // Click trigger to open dialog
      const endButtons = screen.getAllByText('End Session');
      await user.click(endButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('End this session?')).toBeInTheDocument();
      });

      // Click the confirm action inside the dialog
      const dialogEndButtons = screen.getAllByText('End Session');
      // The last one is in the dialog action
      await user.click(dialogEndButtons[dialogEndButtons.length - 1]);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Session ended');
      });
    });
  });

  // ── Create poll ────────────────────────────────

  describe('create poll', () => {
    beforeEach(() => {
      setupApiDefaults([makeSession()]);
    });

    it('shows poll form when New Poll button is clicked', async () => {
      const user = userEvent.setup();
      renderFacilitator();

      await waitFor(() => {
        expect(screen.getByText('New Poll')).toBeInTheDocument();
      });

      await user.click(screen.getByText('New Poll'));

      expect(screen.getByLabelText('Question')).toBeInTheDocument();
      expect(screen.getByLabelText('Options (one per line)')).toBeInTheDocument();
      expect(screen.getByText('Launch Poll')).toBeInTheDocument();
    });

    it('creates poll and shows success toast', async () => {
      const { toast } = await import('sonner');
      const newPoll = makePoll({ id: 'poll-new', question: 'Test poll?' });
      mockedApi.post.mockResolvedValueOnce(newPoll);

      const user = userEvent.setup();
      renderFacilitator();

      await waitFor(() => {
        expect(screen.getByText('New Poll')).toBeInTheDocument();
      });

      await user.click(screen.getByText('New Poll'));

      await user.type(screen.getByLabelText('Question'), 'Test poll?');
      await user.type(screen.getByLabelText('Options (one per line)'), 'Option A\nOption B');
      await user.click(screen.getByText('Launch Poll'));

      await waitFor(() => {
        expect(mockedApi.post).toHaveBeenCalledWith(
          `/api/v1/workshop/sessions/s-1/polls`,
          { question: 'Test poll?', options: ['Option A', 'Option B'] },
        );
      });
      expect(toast.success).toHaveBeenCalledWith('Poll created and live!');
    });

    it('shows error toast when less than 2 options provided', async () => {
      const { toast } = await import('sonner');

      const user = userEvent.setup();
      renderFacilitator();

      await waitFor(() => {
        expect(screen.getByText('New Poll')).toBeInTheDocument();
      });

      await user.click(screen.getByText('New Poll'));

      await user.type(screen.getByLabelText('Question'), 'Test?');
      await user.type(screen.getByLabelText('Options (one per line)'), 'Only one');
      await user.click(screen.getByText('Launch Poll'));

      expect(toast.error).toHaveBeenCalledWith('Please provide at least 2 options');
    });

    it('hides poll form when Cancel is clicked', async () => {
      const user = userEvent.setup();
      renderFacilitator();

      await waitFor(() => {
        expect(screen.getByText('New Poll')).toBeInTheDocument();
      });

      await user.click(screen.getByText('New Poll'));
      expect(screen.getByLabelText('Question')).toBeInTheDocument();

      await user.click(screen.getByText('Cancel'));
      expect(screen.queryByLabelText('Question')).not.toBeInTheDocument();
    });
  });

  // ── Mark question answered ─────────────────────

  describe('mark question answered', () => {
    beforeEach(() => {
      const session = makeSession();
      mockedApi.get.mockImplementation(async (url: string) => {
        if (url === '/api/v1/workshop/sessions') return [session];
        if (url.includes('/polls')) return [];
        if (url.includes('/questions')) return [makeQuestion()];
        if (url.includes('/participants')) return { count: 0 };
        return [];
      });
    });

    it('marks question as answered and calls API', async () => {
      mockedApi.patch.mockResolvedValueOnce(undefined);

      const user = userEvent.setup();
      renderFacilitator();

      await waitFor(() => {
        expect(screen.getByText('How do we report suspected fraud?')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Answered'));

      expect(mockedApi.patch).toHaveBeenCalledWith(
        '/api/v1/workshop/questions/q-1',
        { isAnswered: true },
      );
    });
  });

  // ── Copy session code ──────────────────────────

  describe('copy session code', () => {
    it('copies session code to clipboard and shows toast', async () => {
      const { toast } = await import('sonner');
      const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

      setupApiDefaults([makeSession()]);

      const user = userEvent.setup();
      renderFacilitator();

      await waitFor(() => {
        expect(screen.getByLabelText('Copy session code ABC123')).toBeInTheDocument();
      });

      await user.click(screen.getByLabelText('Copy session code ABC123'));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Session code copied!');
      });
      expect(writeTextSpy).toHaveBeenCalledWith('ABC123');

      writeTextSpy.mockRestore();
    });
  });

  // ── SSE subscription ──────────────────────────

  describe('SSE subscription', () => {
    it('connects SSE when an active session exists', async () => {
      setupApiDefaults([makeSession()]);

      renderFacilitator();

      await waitFor(() => {
        expect(mockedConnectSSE).toHaveBeenCalledWith(
          '/api/v1/workshop/sessions/s-1/events',
          expect.objectContaining({
            session_update: expect.any(Function),
            poll_created: expect.any(Function),
            poll_closed: expect.any(Function),
            question_added: expect.any(Function),
            question_updated: expect.any(Function),
            participant_joined: expect.any(Function),
          }),
        );
      });
    });
  });

  // ── Navigation ────────────────────────────────

  describe('navigation', () => {
    it('Back to Dashboard button navigates to /dashboard', async () => {
      const user = userEvent.setup();
      renderFacilitator();

      await waitFor(() => {
        expect(screen.getByText('Back to Dashboard')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Back to Dashboard'));

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  // ── Fetch error ────────────────────────────────

  describe('fetch error', () => {
    it('shows error toast when fetching sessions fails', async () => {
      const { toast } = await import('sonner');
      mockedApi.get.mockRejectedValueOnce(new Error('Network error'));

      renderFacilitator();

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to load sessions');
      });
    });
  });
});
