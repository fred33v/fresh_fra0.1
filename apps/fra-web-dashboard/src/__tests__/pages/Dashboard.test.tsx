import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from '@/pages/Dashboard';
import { useAuth } from '@/hooks/useAuth';
import { useWorkshopProgress } from '@/hooks/useWorkshopProgress';
import { useEntitlements, type Entitlements } from '@/hooks/useEntitlements';
import { useOrgAssessments } from '@/hooks/useOrgAssessments';
import { workshopSections } from '@/data/workshopContent';

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

// The health check card loads its own data; its behaviour is tested in HealthCheckCard.test.tsx
vi.mock('@/components/HealthCheckCard', () => ({
  HealthCheckCard: ({ entitlements }: { entitlements: Entitlements | null }) => (
    <div data-testid="health-check-card">Health check for {entitlements?.packageName ?? 'no package'}</div>
  ),
}));

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
const mockedUseEntitlements = vi.mocked(useEntitlements);
const mockedUseOrgAssessments = vi.mocked(useOrgAssessments);

function setupAssessments(hasFinishedAssessment: boolean) {
  mockedUseOrgAssessments.mockReturnValue({ assessments: [], isLoading: false, hasFinishedAssessment });
}

const PACKAGE_FEATURES = {
  pkg_basic: { packageName: 'Starter', tier: 1, training: false, dashboard: false },
  pkg_training: { packageName: 'Professional', tier: 2, training: true, dashboard: false },
  pkg_full: { packageName: 'Enterprise', tier: 3, training: true, dashboard: true },
} as const;

function setupPackage(packageId: keyof typeof PACKAGE_FEATURES) {
  const p = PACKAGE_FEATURES[packageId];
  mockedUseEntitlements.mockReturnValue({
    isLoading: false,
    entitlements: {
      packageId, packageName: p.packageName, tier: p.tier, expiresAt: null, keypassAllowance: 1,
      features: { assessment: true, training: p.training, certificates: p.training, dashboard: p.dashboard, compliance: p.dashboard },
      assessments: { allowed: true, limit: 1, used: 0 },
    },
  });
}

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
  setupPackage('pkg_training');
  // Most tests look at an organisation that has already done its risk assessment
  setupAssessments(true);
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

    // Key-pass employees have no workshop profile; they still get their dashboard
    it('renders from the account when there is no workshop profile', () => {
      setupAuth({ profile: null });

      renderDashboard();

      expect(screen.getByText('Welcome back, Alice')).toBeInTheDocument();
      expect(screen.queryByText('Test Organisation')).not.toBeInTheDocument();
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

    it('falls back to "there" when neither the profile nor the account has a name', () => {
      setupAuth({ profile: makeProfile({ full_name: '' }), user: { ...makeUser(), name: '' } });

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

  // ── Each package includes everything below it ─────────────

  describe('packages', () => {
    it.each(['pkg_basic', 'pkg_training', 'pkg_full'] as const)('shows the health check for %s', (packageId) => {
      setupPackage(packageId);
      renderDashboard();
      expect(screen.getByTestId('health-check-card')).toHaveTextContent(PACKAGE_FEATURES[packageId].packageName);
    });

    it('Starter: health check, with the workshop shown as part of Professional', () => {
      setupPackage('pkg_basic');
      setupAuth({ user: { ...makeUser(), role: 'employer' } });
      renderDashboard();

      expect(screen.getByTestId('health-check-card')).toBeInTheDocument();
      expect(screen.getByText('See Professional')).toBeInTheDocument();
      expect(screen.queryByText('Start Workshop')).not.toBeInTheDocument();
      expect(screen.queryByText('Action Plan')).not.toBeInTheDocument();
      expect(screen.queryByText('Workshop Modules')).not.toBeInTheDocument();
      // Resources are for every package
      expect(screen.getByText('Resources')).toBeInTheDocument();
    });

    it('Professional: the Starter health check and the workshop together', () => {
      setupPackage('pkg_training');
      renderDashboard();

      expect(screen.getByTestId('health-check-card')).toBeInTheDocument();
      expect(screen.getAllByText('Start Workshop').length).toBeGreaterThan(0);
      expect(screen.getByText('Action Plan')).toBeInTheDocument();
      expect(screen.queryByText('See Professional')).not.toBeInTheDocument();
    });

    const NO_PACKAGE = {
      isLoading: false,
      entitlements: {
        packageId: null, packageName: null, tier: 0, expiresAt: null, keypassAllowance: 0,
        features: { assessment: false, training: false, certificates: false, dashboard: false, compliance: false },
        assessments: { allowed: false, limit: 0, used: 0 },
      },
    } as const;

    it('no package: shows the three packages with prices + VAT and a way to pay, not the workshop', () => {
      mockedUseEntitlements.mockReturnValue(NO_PACKAGE as never);
      setupAuth({ user: { ...makeUser(), role: 'employer' } });
      renderDashboard();

      expect(screen.queryByText('Start Workshop')).not.toBeInTheDocument();
      expect(screen.queryByTestId('health-check-card')).not.toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Choose your package' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Choose Starter' })).toHaveAttribute('href', '/checkout?package=Starter');
      expect(screen.getByRole('link', { name: 'Choose Professional' })).toHaveAttribute('href', '/checkout?package=Professional');
      expect(screen.getByRole('link', { name: 'Choose Enterprise' })).toHaveAttribute('href', '/checkout?package=Enterprise');
      expect(screen.getAllByText(/\+ VAT/)).toHaveLength(3);
      expect(screen.getByText(/Risk appetite, Fraud triangle/)).toBeInTheDocument();
      expect(screen.queryByText(/your current package/)).not.toBeInTheDocument();
    });

    it('employee whose organisation lacks training: points them to their manager, with nothing to buy', () => {
      setupPackage('pkg_basic');
      renderDashboard();

      expect(screen.queryByText('Start Workshop')).not.toBeInTheDocument();
      expect(screen.getByText(/Ask the person who manages/)).toBeInTheDocument();
      expect(screen.queryByText('See Professional')).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /^Choose / })).not.toBeInTheDocument();
    });

    it('waits for the package before showing the dashboard', () => {
      mockedUseEntitlements.mockReturnValue({ isLoading: true, entitlements: null });
      renderDashboard();
      expect(screen.queryByTestId('health-check-card')).not.toBeInTheDocument();
    });
  });

  // ── Package 2 starts with the package 1 risk assessment ─────

  describe('risk assessment first', () => {
    it('Professional manager: step 1 is the risk assessment, and the workshop waits for it', () => {
      setupAuth({ user: { ...makeUser(), role: 'employer' } });
      setupPackage('pkg_training');
      setupAssessments(false);
      renderDashboard();

      expect(screen.getByText('Step 2: Fraud Risk Awareness Workshop')).toBeInTheDocument();
      expect(screen.getByText('Go to step 1').closest('a')).toHaveAttribute('href', '/assessment');
      expect(screen.queryByText('Start Workshop')).not.toBeInTheDocument();
      expect(screen.queryByText('Action Plan')).not.toBeInTheDocument();
    });

    it('Professional manager: the workshop opens once the risk assessment is submitted', () => {
      setupAuth({ user: { ...makeUser(), role: 'employer' } });
      setupPackage('pkg_training');
      setupAssessments(true);
      renderDashboard();

      expect(screen.queryByText('Step 2: Fraud Risk Awareness Workshop')).not.toBeInTheDocument();
      expect(screen.getAllByText('Start Workshop').length).toBeGreaterThan(0);
    });

    it('staff who joined with a key-pass go straight to their training', () => {
      setupAuth({ user: { ...makeUser(), role: 'employee' } });
      setupPackage('pkg_training');
      setupAssessments(false);
      renderDashboard();

      expect(screen.queryByText('Step 2: Fraud Risk Awareness Workshop')).not.toBeInTheDocument();
      expect(screen.getAllByText('Start Workshop').length).toBeGreaterThan(0);
    });
  });
});
