import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ActionPlan from '@/pages/ActionPlan';
import { useAuth } from '@/hooks/useAuth';
import { useWorkshopProgress } from '@/hooks/useWorkshopProgress';
import { useEntitlements } from '@/hooks/useEntitlements';
import { useOrgAssessments } from '@/hooks/useOrgAssessments';
import { api } from '@/lib/api';
import { actionPlanTemplates } from '@/data/workshopContent';

// ── Mocks ──────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useWorkshopProgress');
vi.mock('@/hooks/useEntitlements');
vi.mock('@/hooks/useOrgAssessments');

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
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
const mockedUseWorkshopProgress = vi.mocked(useWorkshopProgress);
const mockedUseEntitlements = vi.mocked(useEntitlements);
const mockedUseOrgAssessments = vi.mocked(useOrgAssessments);
const mockedApi = vi.mocked(api);

// ── Helpers ────────────────────────────────────────────────

function makeUser() {
  return {
    userId: 'u-1',
    email: 'alice@example.com',
    name: 'Alice Smith',
    role: 'employee',
    organisationId: 'org-1',
    createdAt: '2025-01-01T00:00:00Z',
  };
}

function makeProfile() {
  return {
    id: 'p-1',
    user_id: 'u-1',
    full_name: 'Alice Smith',
    organization_name: 'Test Organisation',
    sector: 'public' as const,
    job_title: 'Finance Director',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  };
}

function makeActionItems() {
  return [
    ...actionPlanTemplates.immediate.map((item, i) => ({
      id: `immediate-${i}`,
      title: item,
      description: '',
      priority: 'high' as const,
      timeframe: 'Immediate',
      completed: false,
    })),
    ...actionPlanTemplates.thirtyDays.map((item, i) => ({
      id: `thirty-${i}`,
      title: item,
      description: '',
      priority: 'medium' as const,
      timeframe: '30 Days',
      completed: false,
    })),
    ...actionPlanTemplates.ninetyDays.map((item, i) => ({
      id: `ninety-${i}`,
      title: item,
      description: '',
      priority: 'low' as const,
      timeframe: '90 Days',
      completed: false,
    })),
  ];
}

function makeActionPlan(overrides?: Record<string, unknown>) {
  return {
    id: 'ap-1',
    user_id: 'u-1',
    session_id: null,
    action_items: makeActionItems(),
    commitments: null,
    generated_at: '2025-06-01T00:00:00Z',
    ...overrides,
  };
}

function setupAuth(overrides?: Record<string, unknown>) {
  mockedUseAuth.mockReturnValue({
    user: makeUser(),
    profile: makeProfile(),
    roles: ['participant'] as never[],
    isLoading: false,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    hasRole: vi.fn(),
    refreshProfile: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useAuth>);
}

function setupProgress() {
  mockedUseWorkshopProgress.mockReturnValue({
    progress: null,
    isLoading: false,
    error: null,
    updateSection: vi.fn(),
    completeSection: vi.fn(),
    saveQuizScore: vi.fn(),
    saveScenarioChoice: vi.fn(),
    markComplete: vi.fn(),
    refreshProgress: vi.fn(),
  } as ReturnType<typeof useWorkshopProgress>);
}

function setupAssessment(finished: boolean, loading = false) {
  mockedUseEntitlements.mockReturnValue({
    isLoading: false,
    entitlements: { features: { assessment: true } },
  } as ReturnType<typeof useEntitlements>);
  mockedUseOrgAssessments.mockReturnValue({
    assessments: [],
    isLoading: loading,
    hasFinishedAssessment: finished,
  } as ReturnType<typeof useOrgAssessments>);
}

function renderActionPlan() {
  return render(
    <MemoryRouter>
      <ActionPlan />
    </MemoryRouter>,
  );
}

// ── Tests ──────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth();
  setupProgress();
  setupAssessment(false);
  // Default: existing action plan
  mockedApi.get.mockResolvedValue(makeActionPlan());
});

describe('ActionPlan', () => {
  // ── Auth guard ──────────────────────────────

  describe('auth guard', () => {
    it('stays in loading state when user is null (never fetches)', () => {
      setupAuth({ user: null });
      mockedApi.get.mockResolvedValue(null);

      renderActionPlan();

      // Component stays loading since fetchActionPlan exits early when user is null
      expect(screen.getByRole('status', { name: 'Loading action plan' })).toBeInTheDocument();
      expect(mockedApi.get).not.toHaveBeenCalled();
    });

    it('stays in loading state when profile is null', () => {
      setupAuth({ profile: null });
      mockedApi.get.mockResolvedValue(null);

      renderActionPlan();

      expect(screen.getByRole('status', { name: 'Loading action plan' })).toBeInTheDocument();
    });
  });

  // ── Loading state ─────────────────────────────

  describe('loading state', () => {
    it('shows loading spinner while fetching', () => {
      mockedApi.get.mockReturnValue(new Promise(() => {}));

      renderActionPlan();

      expect(screen.getByRole('status', { name: 'Loading action plan' })).toBeInTheDocument();
    });
  });

  // ── Fetch error state ─────────────────────────

  describe('fetch error state', () => {
    it('shows error card with retry button when fetch fails', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));

      renderActionPlan();

      await waitFor(() => {
        expect(screen.getByText('Failed to load action plan')).toBeInTheDocument();
      });
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('retries fetch when Try Again is clicked', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));

      const user = userEvent.setup();
      renderActionPlan();

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });

      // Second call succeeds
      mockedApi.get.mockResolvedValueOnce(makeActionPlan());
      await user.click(screen.getByText('Try Again'));

      await waitFor(() => {
        expect(screen.getByText('Your Action Plan')).toBeInTheDocument();
      });
    });
  });

  // ── API contract ──────────────────────────────

  describe('API contract', () => {
    it('reuses the existing plan the API returns instead of creating another', async () => {
      // GET /workshop/action-plans returns a single plan object (or null), not a list
      mockedApi.get.mockResolvedValueOnce(makeActionPlan());
      renderActionPlan();

      await waitFor(() => {
        expect(screen.getByText('Your Action Plan')).toBeInTheDocument();
      });
      expect(mockedApi.post).not.toHaveBeenCalled();
    });
  });

  // ── Empty state ───────────────────────────────

  describe('empty state', () => {
    it('shows empty state when action plan has zero items', async () => {
      mockedApi.get.mockResolvedValueOnce(makeActionPlan({ action_items: [] }));

      renderActionPlan();

      await waitFor(() => {
        expect(screen.getByText('No action items yet')).toBeInTheDocument();
      });
      expect(screen.getByText('Go to Workshop')).toBeInTheDocument();
    });

    it('Go to Workshop button navigates to /workshop', async () => {
      mockedApi.get.mockResolvedValueOnce(makeActionPlan({ action_items: [] }));

      const user = userEvent.setup();
      renderActionPlan();

      await waitFor(() => {
        expect(screen.getByText('Go to Workshop')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Go to Workshop'));

      expect(mockNavigate).toHaveBeenCalledWith('/workshop');
    });
  });

  // ── Action plan display ───────────────────────

  describe('action plan display', () => {
    it('shows action plan title and description', async () => {
      renderActionPlan();

      await waitFor(() => {
        expect(screen.getByText('Your Action Plan')).toBeInTheDocument();
      });
      expect(screen.getByText(/Track your progress/)).toBeInTheDocument();
    });

    it('groups items by timeframe', async () => {
      renderActionPlan();

      await waitFor(() => {
        expect(screen.getByText('Immediate')).toBeInTheDocument();
      });
      expect(screen.getByText('30 Days')).toBeInTheDocument();
      expect(screen.getByText('90 Days')).toBeInTheDocument();
    });

    it('shows all action items from templates', async () => {
      renderActionPlan();

      await waitFor(() => {
        expect(screen.getByText(actionPlanTemplates.immediate[0])).toBeInTheDocument();
      });
      expect(screen.getByText(actionPlanTemplates.thirtyDays[0])).toBeInTheDocument();
      expect(screen.getByText(actionPlanTemplates.ninetyDays[0])).toBeInTheDocument();
    });

    it('shows progress counter', async () => {
      renderActionPlan();

      const totalItems = actionPlanTemplates.immediate.length +
        actionPlanTemplates.thirtyDays.length +
        actionPlanTemplates.ninetyDays.length;

      await waitFor(() => {
        expect(screen.getByText(`0/${totalItems}`)).toBeInTheDocument();
      });
      expect(screen.getByText('Actions Completed')).toBeInTheDocument();
    });

    it('shows progressbar with correct values', async () => {
      renderActionPlan();

      const totalItems = actionPlanTemplates.immediate.length +
        actionPlanTemplates.thirtyDays.length +
        actionPlanTemplates.ninetyDays.length;

      await waitFor(() => {
        const bar = screen.getByRole('progressbar');
        expect(bar).toHaveAttribute('aria-valuenow', '0');
        expect(bar).toHaveAttribute('aria-valuemax', String(totalItems));
      });
    });
  });

  // ── Toggle completion ─────────────────────────

  describe('after the risk assessment is submitted', () => {
    const ASSESSMENT_ITEM = 'Complete the Fraud Risk Self-Assessment';

    it('the template still has the assessment action, so the filter below keeps matching it', () => {
      expect(actionPlanTemplates.thirtyDays).toContain(ASSESSMENT_ITEM);
    });

    it('keeps the assessment action while no assessment has been submitted', async () => {
      renderActionPlan();
      expect(await screen.findByText(ASSESSMENT_ITEM)).toBeInTheDocument();
    });

    it('hides the assessment action from a plan saved earlier, and leaves it out of the count', async () => {
      setupAssessment(true);
      renderActionPlan();

      await screen.findByText('Your Action Plan');
      expect(screen.queryByText(ASSESSMENT_ITEM)).not.toBeInTheDocument();
      expect(screen.getByText(actionPlanTemplates.thirtyDays[1])).toBeInTheDocument();
      const total = makeActionItems().length - 1;
      expect(screen.getByText(`0/${total}`)).toBeInTheDocument();
    });

    it('starts a new plan without the assessment action', async () => {
      setupAssessment(true);
      mockedApi.get.mockResolvedValue(null);
      mockedApi.post.mockResolvedValue(makeActionPlan({ action_items: makeActionItems().filter((i) => i.title !== ASSESSMENT_ITEM) }));
      renderActionPlan();

      await waitFor(() => expect(mockedApi.post).toHaveBeenCalled());
      const sent = (mockedApi.post.mock.calls[0][1] as { actionItems: { title: string }[] }).actionItems;
      expect(sent.map((i) => i.title)).not.toContain(ASSESSMENT_ITEM);
      expect(sent).toHaveLength(makeActionItems().length - 1);
    });

    it('waits to know whether the assessment is done before creating a plan', async () => {
      setupAssessment(false, true);
      mockedApi.get.mockResolvedValue(null);
      renderActionPlan();

      await new Promise((r) => setTimeout(r, 30));
      expect(mockedApi.get).not.toHaveBeenCalled();
      expect(mockedApi.post).not.toHaveBeenCalled();
    });
  });

  describe('toggle completion', () => {
    it('toggles item and calls API with updated items', async () => {
      mockedApi.patch.mockResolvedValueOnce(undefined);

      const user = userEvent.setup();
      renderActionPlan();

      await waitFor(() => {
        expect(screen.getByText(actionPlanTemplates.immediate[0])).toBeInTheDocument();
      });

      // Click the checkbox for the first immediate item
      const checkbox = screen.getByLabelText(new RegExp(actionPlanTemplates.immediate[0]));
      await user.click(checkbox);

      expect(mockedApi.patch).toHaveBeenCalledWith(
        '/api/v1/workshop/action-plans/ap-1',
        expect.objectContaining({ actionItems: expect.any(Array) }),
      );
    });

    it('reverts optimistic update on API failure', async () => {
      const { toast } = await import('sonner');
      mockedApi.patch.mockRejectedValueOnce(new Error('Server error'));

      const user = userEvent.setup();
      renderActionPlan();

      await waitFor(() => {
        expect(screen.getByText(actionPlanTemplates.immediate[0])).toBeInTheDocument();
      });

      const checkbox = screen.getByLabelText(new RegExp(actionPlanTemplates.immediate[0]));
      await user.click(checkbox);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to update action item');
      });
    });
  });

  // ── Commitments ───────────────────────────────

  describe('commitments', () => {
    it('shows commitments textarea', async () => {
      renderActionPlan();

      await waitFor(() => {
        expect(screen.getByLabelText(/personal commitments/i)).toBeInTheDocument();
      });
    });

    it('pre-fills commitments from API data', async () => {
      mockedApi.get.mockResolvedValueOnce(makeActionPlan({ commitments: ['First commitment', 'Second commitment'] }));

      renderActionPlan();

      await waitFor(() => {
        expect(screen.getByLabelText(/personal commitments/i)).toHaveValue(
          'First commitment\nSecond commitment',
        );
      });
    });

    it('saves commitments on button click', async () => {
      const { toast } = await import('sonner');
      mockedApi.patch.mockResolvedValueOnce(undefined);

      const user = userEvent.setup();
      renderActionPlan();

      await waitFor(() => {
        expect(screen.getByLabelText(/personal commitments/i)).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText(/personal commitments/i), 'My commitment');
      await user.click(screen.getByText('Save Commitments'));

      expect(mockedApi.patch).toHaveBeenCalledWith(
        '/api/v1/workshop/action-plans/ap-1',
        { commitments: ['My commitment'] },
      );
      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Commitments saved!');
      });
    });

    it('shows error toast when save fails', async () => {
      const { toast } = await import('sonner');
      mockedApi.patch.mockRejectedValueOnce(new Error('Server error'));

      const user = userEvent.setup();
      renderActionPlan();

      await waitFor(() => {
        expect(screen.getByLabelText(/personal commitments/i)).toBeInTheDocument();
      });

      await user.click(screen.getByText('Save Commitments'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to save commitments');
      });
    });
  });

  // ── Navigation ────────────────────────────────

  describe('navigation', () => {
    it('Back button navigates back', async () => {
      const user = userEvent.setup();
      renderActionPlan();

      await waitFor(() => {
        expect(screen.getByText('Back')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Back'));

      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });

  // ── Creates default plan when none exists ─────

  describe('default plan creation', () => {
    it('creates a new action plan via POST when none exists', async () => {
      mockedApi.get.mockResolvedValueOnce(null);
      mockedApi.post.mockResolvedValueOnce(makeActionPlan());

      renderActionPlan();

      await waitFor(() => {
        expect(mockedApi.post).toHaveBeenCalledWith('/api/v1/workshop/action-plans', {
          actionItems: expect.any(Array),
          commitments: [],
        });
      });
    });
  });
});
