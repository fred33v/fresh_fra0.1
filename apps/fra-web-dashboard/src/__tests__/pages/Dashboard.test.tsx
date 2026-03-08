import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '@/pages/Dashboard';
import { useAuth } from '@/hooks/useAuth';
import { useWorkshopProgress } from '@/hooks/useWorkshopProgress';
import { workshopSections } from '@/data/workshopContent';

// ── Mocks ──────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useWorkshopProgress');

vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseWorkshopProgress = vi.mocked(useWorkshopProgress);

// ── Helpers ────────────────────────────────────────────────

function makeProfile(overrides?: Record<string, unknown>) {
  return {
    id: 'p-1',
    user_id: 'u-1',
    full_name: 'Alice Smith',
    organization_name: 'Test Organisation',
    sector: 'public' as const,
    job_title: 'Finance Director',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

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

function makeProgress(overrides?: Record<string, unknown>) {
  return {
    id: 'wp-1',
    user_id: 'u-1',
    session_id: null,
    current_section: 0,
    completed_sections: [] as number[],
    quiz_scores: {} as Record<string, number>,
    scenario_choices: {} as Record<string, string>,
    completed_at: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
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

function setupProgress(overrides?: Record<string, unknown>) {
  mockedUseWorkshopProgress.mockReturnValue({
    progress: makeProgress(),
    isLoading: false,
    error: null,
    updateSection: vi.fn(),
    completeSection: vi.fn(),
    saveQuizScore: vi.fn(),
    saveScenarioChoice: vi.fn(),
    markComplete: vi.fn(),
    refreshProgress: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useWorkshopProgress>);
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
}

// ── Tests ──────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth();
  setupProgress();
});

describe('Dashboard', () => {
  // ── Loading state ───────────────────────────────

  describe('loading state', () => {
    it('shows loading spinner when progress is loading', () => {
      setupProgress({ isLoading: true });

      renderDashboard();

      expect(screen.getByText('Setting up your dashboard…')).toBeInTheDocument();
    });

    it('does not render dashboard content when progress is loading', () => {
      setupProgress({ isLoading: true });

      renderDashboard();

      expect(screen.queryByText('Welcome back, Alice')).not.toBeInTheDocument();
    });
  });

  // ── Auth guard ──────────────────────────────────

  describe('auth guard', () => {
    it('renders null when user is null', () => {
      setupAuth({ user: null });

      const { container } = renderDashboard();

      // Only the layout wrapper should exist but content is empty
      expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument();
      expect(container.querySelector('[data-testid="layout"]')).toBeNull();
    });

    it('renders null when profile is null', () => {
      setupAuth({ profile: null });

      const { container } = renderDashboard();

      expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument();
      expect(container.querySelector('[data-testid="layout"]')).toBeNull();
    });
  });

  // ── Welcome header ─────────────────────────────

  describe('welcome header', () => {
    it('displays user first name in welcome message', () => {
      renderDashboard();

      expect(screen.getByText('Welcome back, Alice')).toBeInTheDocument();
    });

    it('shows organisation name and sector badge', () => {
      renderDashboard();

      expect(screen.getByText('Test Organisation')).toBeInTheDocument();
      expect(screen.getByText('Public Sector')).toBeInTheDocument();
    });

    it('shows job title when present', () => {
      renderDashboard();

      expect(screen.getByText('Finance Director')).toBeInTheDocument();
    });

    it('hides job title when null', () => {
      setupAuth({ profile: makeProfile({ job_title: null }) });

      renderDashboard();

      expect(screen.queryByText('Finance Director')).not.toBeInTheDocument();
    });

    it('displays correct sector labels', () => {
      setupAuth({ profile: makeProfile({ sector: 'charity' }) });

      renderDashboard();

      expect(screen.getByText('Charity / Non-Profit')).toBeInTheDocument();
    });

    it('falls back to "there" when full_name has no parts', () => {
      setupAuth({ profile: makeProfile({ full_name: '' }) });

      renderDashboard();

      expect(screen.getByText('Welcome back, there')).toBeInTheDocument();
    });
  });

  // ── Workshop card (not started) ────────────────

  describe('workshop card - not started', () => {
    it('shows "Start Workshop" button when no sections completed', () => {
      renderDashboard();

      // "Start Workshop" appears in both main CTA and quiz "No quizzes" section
      const buttons = screen.getAllByText('Start Workshop');
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });

    it('shows 0 / 7 modules progress', () => {
      renderDashboard();

      expect(screen.getByText((content) => content.includes(`0 / ${workshopSections.length} modules`))).toBeInTheDocument();
    });

    it('does not show Completed badge', () => {
      renderDashboard();

      expect(screen.queryByText('Completed')).not.toBeInTheDocument();
    });

    it('does not show View Certificate button', () => {
      renderDashboard();

      expect(screen.queryByText('View Certificate')).not.toBeInTheDocument();
    });
  });

  // ── Workshop card (in progress) ────────────────

  describe('workshop card - in progress', () => {
    it('shows "Continue Workshop" when some sections completed', () => {
      setupProgress({ progress: makeProgress({ completed_sections: [0, 1], current_section: 2 }) });

      renderDashboard();

      expect(screen.getByText('Continue Workshop')).toBeInTheDocument();
    });

    it('shows correct progress count', () => {
      setupProgress({ progress: makeProgress({ completed_sections: [0, 1, 2] }) });

      renderDashboard();

      expect(screen.getByText((content) => content.includes(`3 / ${workshopSections.length} modules`))).toBeInTheDocument();
    });
  });

  // ── Workshop card (completed) ──────────────────

  describe('workshop card - completed', () => {
    it('shows "Review Workshop" when all sections completed', () => {
      setupProgress({
        progress: makeProgress({
          completed_sections: [0, 1, 2, 3, 4, 5, 6],
          completed_at: '2025-06-01T00:00:00Z',
        }),
      });

      renderDashboard();

      expect(screen.getByText('Review Workshop')).toBeInTheDocument();
    });

    it('shows Completed badge', () => {
      setupProgress({
        progress: makeProgress({ completed_at: '2025-06-01T00:00:00Z' }),
      });

      renderDashboard();

      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('shows View Certificate button', () => {
      setupProgress({
        progress: makeProgress({ completed_at: '2025-06-01T00:00:00Z' }),
      });

      renderDashboard();

      expect(screen.getByText('View Certificate')).toBeInTheDocument();
    });

    it('shows Workshop Complete card in sidebar', () => {
      setupProgress({
        progress: makeProgress({ completed_at: '2025-06-01T00:00:00Z' }),
      });

      renderDashboard();

      expect(screen.getByText('Workshop Complete!')).toBeInTheDocument();
      expect(screen.getByText('Certificate available')).toBeInTheDocument();
    });
  });

  // ── Quiz performance ───────────────────────────

  describe('quiz performance', () => {
    it('shows "No quizzes taken yet" when no quiz scores exist', () => {
      renderDashboard();

      expect(screen.getByText('No quizzes taken yet')).toBeInTheDocument();
    });

    it('shows average quiz score when scores exist', () => {
      setupProgress({
        progress: makeProgress({
          quiz_scores: { '0': 80, '1': 100 },
        }),
      });

      renderDashboard();

      expect(screen.getByText('90%')).toBeInTheDocument();
    });
  });

  // ── Current section ────────────────────────────

  describe('current section', () => {
    it('shows current section title in sidebar', () => {
      setupProgress({ progress: makeProgress({ current_section: 0 }) });

      renderDashboard();

      expect(screen.getByText('Current Section')).toBeInTheDocument();
      // "Welcome & Introduction" appears in both Current Section card and Module Overview
      expect(screen.getAllByText('Welcome & Introduction').length).toBeGreaterThanOrEqual(1);
    });

    it('updates current section based on progress', () => {
      setupProgress({ progress: makeProgress({ current_section: 3 }) });

      renderDashboard();

      expect(screen.getByText('Current Section')).toBeInTheDocument();
      // "Defence Strategies" (section 3) should appear
      expect(screen.getAllByText('Defence Strategies').length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Quick actions ──────────────────────────────

  describe('quick actions', () => {
    it('renders Resources, Action Plan, and Join Session cards', () => {
      renderDashboard();

      expect(screen.getByText('Resources')).toBeInTheDocument();
      expect(screen.getByText('Action Plan')).toBeInTheDocument();
      expect(screen.getByText('Join Session')).toBeInTheDocument();
    });

    it('navigates to /resources on click', async () => {
      const user = userEvent.setup();
      renderDashboard();

      await user.click(screen.getByText('Resources').closest('[role="button"]')!);

      expect(mockNavigate).toHaveBeenCalledWith('/resources');
    });

    it('navigates to /action-plan on click', async () => {
      const user = userEvent.setup();
      renderDashboard();

      await user.click(screen.getByText('Action Plan').closest('[role="button"]')!);

      expect(mockNavigate).toHaveBeenCalledWith('/action-plan');
    });

    it('navigates on keyboard Enter press', async () => {
      const user = userEvent.setup();
      renderDashboard();

      const resourcesCard = screen.getByText('Resources').closest('[role="button"]')!;
      resourcesCard.focus();
      await user.keyboard('{Enter}');

      expect(mockNavigate).toHaveBeenCalledWith('/resources');
    });

    it('shows Certificate quick action only when completed', () => {
      setupProgress({ progress: makeProgress({ completed_at: null }) });

      renderDashboard();

      // Certificate card should not exist in quick actions
      const quickActionCards = screen.getAllByRole('button');
      const certCard = quickActionCards.find(el => el.textContent?.includes('Download PDF'));
      expect(certCard).toBeUndefined();
    });

    it('shows Certificate quick action when workshop is completed', () => {
      setupProgress({
        progress: makeProgress({ completed_at: '2025-06-01T00:00:00Z' }),
      });

      renderDashboard();

      expect(screen.getByText('Download PDF')).toBeInTheDocument();
    });
  });

  // ── Module overview ────────────────────────────

  describe('module overview', () => {
    it('renders all workshop sections', () => {
      renderDashboard();

      expect(screen.getByText('Workshop Modules')).toBeInTheDocument();
      for (const section of workshopSections) {
        // Section titles may appear both in Current Section card and Module Overview
        const matches = screen.getAllByText(section.title);
        expect(matches.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('shows In Progress badge for current section', () => {
      setupProgress({ progress: makeProgress({ current_section: 2 }) });

      renderDashboard();

      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });

    it('does not show In Progress badge for completed sections', () => {
      setupProgress({
        progress: makeProgress({
          current_section: 2,
          completed_sections: [0, 1, 2],
        }),
      });

      renderDashboard();

      // Section 2 is both current and complete, so no "In Progress" badge
      expect(screen.queryByText('In Progress')).not.toBeInTheDocument();
    });
  });
});
