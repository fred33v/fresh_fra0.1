import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Workshop from '@/pages/Workshop';
import { useAuth } from '@/hooks/useAuth';
import { useWorkshopProgress } from '@/hooks/useWorkshopProgress';
import { useSession } from '@/hooks/useSession';
import { workshopSections, sectionContent, quizQuestions, scenarioExercise } from '@/data/workshopContent';

// ── Mocks ──────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useWorkshopProgress');
vi.mock('@/hooks/useSession');

vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    li: ({ children, ...props }: React.HTMLAttributes<HTMLLIElement>) => <li {...props}>{children}</li>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseWorkshopProgress = vi.mocked(useWorkshopProgress);
const mockedUseSession = vi.mocked(useSession);

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

const mockUpdateSection = vi.fn().mockResolvedValue(undefined);
const mockCompleteSection = vi.fn().mockResolvedValue(undefined);
const mockSaveQuizScore = vi.fn().mockResolvedValue(undefined);
const mockSaveScenarioChoice = vi.fn().mockResolvedValue(undefined);

function setupProgress(overrides?: Record<string, unknown>) {
  mockedUseWorkshopProgress.mockReturnValue({
    progress: makeProgress(),
    isLoading: false,
    error: null,
    updateSection: mockUpdateSection,
    completeSection: mockCompleteSection,
    saveQuizScore: mockSaveQuizScore,
    saveScenarioChoice: mockSaveScenarioChoice,
    markComplete: vi.fn(),
    refreshProgress: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useWorkshopProgress>);
}

const mockJoinSession = vi.fn();

function setupSession(overrides?: Record<string, unknown>) {
  mockedUseSession.mockReturnValue({
    session: null,
    activePoll: null,
    questions: [],
    participantCount: 0,
    isLoading: false,
    error: null,
    joinSession: mockJoinSession,
    submitPollResponse: vi.fn(),
    askQuestion: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useSession>);
}

function renderWorkshop(initialRoute = '/workshop') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Workshop />
    </MemoryRouter>,
  );
}

// ── Tests ──────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth();
  setupProgress();
  setupSession();
});

describe('Workshop', () => {
  // ── Loading state ─────────────────────────────

  describe('loading state', () => {
    it('shows loading spinner when progress is loading', () => {
      setupProgress({ isLoading: true });

      renderWorkshop();

      expect(screen.getByRole('status', { name: 'Loading workshop' })).toBeInTheDocument();
    });

    it('does not render workshop content when loading', () => {
      setupProgress({ isLoading: true });

      renderWorkshop();

      expect(screen.queryByText('Key Learning Points')).not.toBeInTheDocument();
    });
  });

  // ── Auth guard ──────────────────────────────

  describe('auth guard', () => {
    it('renders null when user is null', () => {
      setupAuth({ user: null });

      const { container } = renderWorkshop();

      expect(container.querySelector('[data-testid="layout"]')).toBeNull();
    });

    it('renders null when profile is null', () => {
      setupAuth({ profile: null });

      const { container } = renderWorkshop();

      expect(container.querySelector('[data-testid="layout"]')).toBeNull();
    });
  });

  // ── Section display ───────────────────────────

  describe('section display', () => {
    it('shows first section title and subtitle on load', () => {
      renderWorkshop();

      expect(screen.getByText(sectionContent[0].title)).toBeInTheDocument();
      expect(screen.getByText(sectionContent[0].subtitle)).toBeInTheDocument();
    });

    it('shows section badge with correct number', () => {
      renderWorkshop();

      expect(screen.getByText('Section 1')).toBeInTheDocument();
    });

    it('shows key learning points', () => {
      renderWorkshop();

      for (const point of sectionContent[0].keyPoints) {
        expect(screen.getByText(point)).toBeInTheDocument();
      }
    });

    it('shows discussion prompt', () => {
      renderWorkshop();

      expect(screen.getByText(`"${sectionContent[0].discussionPrompt}"`)).toBeInTheDocument();
    });
  });

  // ── Progress bar ──────────────────────────────

  describe('progress bar', () => {
    it('shows slide counter', () => {
      renderWorkshop();

      expect(screen.getByText(`1 / ${workshopSections.length}`)).toBeInTheDocument();
    });

    it('shows progress labels', () => {
      renderWorkshop();

      expect(screen.getByText(`1 of ${workshopSections.length} sections`)).toBeInTheDocument();
    });
  });

  // ── Navigation ────────────────────────────────

  describe('navigation', () => {
    it('Previous button is disabled on first section', () => {
      renderWorkshop();

      expect(screen.getByText('Previous').closest('button')).toBeDisabled();
    });

    it('clicking Next advances to next section', async () => {
      const user = userEvent.setup();
      renderWorkshop();

      await user.click(screen.getByText('Next'));

      expect(mockCompleteSection).toHaveBeenCalledWith(0);
      expect(mockUpdateSection).toHaveBeenCalledWith(1);
      expect(screen.getByText('Section 2')).toBeInTheDocument();
    });

    it('shows "Complete Workshop" on last section', () => {
      setupProgress({
        progress: makeProgress({ current_section: workshopSections.length - 1 }),
      });

      renderWorkshop();

      expect(screen.getByText('Complete Workshop')).toBeInTheDocument();
    });

    it('completing last section navigates to /certificate', async () => {
      const { toast } = await import('sonner');
      setupProgress({
        progress: makeProgress({ current_section: workshopSections.length - 1 }),
      });

      const user = userEvent.setup();
      renderWorkshop();

      await user.click(screen.getByText('Complete Workshop'));

      expect(mockCompleteSection).toHaveBeenCalledWith(workshopSections.length - 1);
      expect(toast.success).toHaveBeenCalledWith('Congratulations! Workshop completed!');
      expect(mockNavigate).toHaveBeenCalledWith('/certificate');
    });

    it('Previous button navigates back after advancing', async () => {
      setupProgress({
        progress: makeProgress({ current_section: 2 }),
      });

      const user = userEvent.setup();
      renderWorkshop();

      await user.click(screen.getByText('Previous'));

      expect(mockUpdateSection).toHaveBeenCalledWith(1);
      expect(screen.getByText('Section 2')).toBeInTheDocument();
    });

    it('Exit Workshop button navigates to /dashboard', async () => {
      const user = userEvent.setup();
      renderWorkshop();

      await user.click(screen.getByText('Exit Workshop'));

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  // ── Sidebar ───────────────────────────────────

  describe('sidebar', () => {
    it('lists all workshop sections', () => {
      renderWorkshop();

      for (const section of workshopSections) {
        expect(screen.getByLabelText(new RegExp(section.title))).toBeInTheDocument();
      }
    });

    it('marks current section with aria-current', () => {
      renderWorkshop();

      const firstSection = screen.getByLabelText(new RegExp(workshopSections[0].title));
      expect(firstSection).toHaveAttribute('aria-current', 'step');
    });

    it('clicking a sidebar section navigates to it', async () => {
      const user = userEvent.setup();
      renderWorkshop();

      await user.click(screen.getByLabelText(new RegExp(workshopSections[2].title)));

      expect(mockUpdateSection).toHaveBeenCalledWith(2);
      expect(screen.getByText('Section 3')).toBeInTheDocument();
    });

    it('shows completed label for completed sections', () => {
      setupProgress({
        progress: makeProgress({ completed_sections: [0, 1] }),
      });

      renderWorkshop();

      expect(screen.getByLabelText(/Section 1.*completed/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Section 2.*completed/)).toBeInTheDocument();
    });
  });

  // ── Quiz ──────────────────────────────────────

  describe('quiz', () => {
    // Find first section with a quiz
    const quizSectionIndex = Number(Object.keys(quizQuestions)[0]);
    const quiz = quizQuestions[quizSectionIndex];

    beforeEach(() => {
      setupProgress({
        progress: makeProgress({ current_section: quizSectionIndex }),
      });
    });

    it('shows quiz question when section has one', () => {
      renderWorkshop();

      expect(screen.getByText('Quick Quiz')).toBeInTheDocument();
      expect(screen.getByText(quiz.question)).toBeInTheDocument();
    });

    it('shows all quiz options', () => {
      renderWorkshop();

      for (const option of quiz.options) {
        expect(screen.getByText(option)).toBeInTheDocument();
      }
    });

    it('Submit Answer button is disabled until an option is selected', () => {
      renderWorkshop();

      expect(screen.getByText('Submit Answer').closest('button')).toBeDisabled();
    });

    it('saves quiz score on submit with correct answer', async () => {
      const { toast } = await import('sonner');
      const user = userEvent.setup();
      renderWorkshop();

      // Select the correct answer
      await user.click(screen.getByText(quiz.options[quiz.correctAnswer]));
      await user.click(screen.getByText('Submit Answer'));

      expect(mockSaveQuizScore).toHaveBeenCalledWith(quizSectionIndex, 100);
      expect(toast.success).toHaveBeenCalledWith('Correct! Well done.');
    });

    it('saves score 0 on incorrect answer', async () => {
      const { toast } = await import('sonner');
      const user = userEvent.setup();
      renderWorkshop();

      // Select a wrong answer
      const wrongIndex = quiz.correctAnswer === 0 ? 1 : 0;
      await user.click(screen.getByText(quiz.options[wrongIndex]));
      await user.click(screen.getByText('Submit Answer'));

      expect(mockSaveQuizScore).toHaveBeenCalledWith(quizSectionIndex, 0);
      expect(toast.error).toHaveBeenCalledWith('Not quite right. Review the explanation.');
    });

    it('shows explanation after submitting', async () => {
      const user = userEvent.setup();
      renderWorkshop();

      await user.click(screen.getByText(quiz.options[quiz.correctAnswer]));
      await user.click(screen.getByText('Submit Answer'));

      expect(screen.getByText('Explanation:')).toBeInTheDocument();
      expect(screen.getByText(quiz.explanation)).toBeInTheDocument();
    });

    it('does not show quiz on sections without one', () => {
      // Section 0 typically has no quiz
      setupProgress({ progress: makeProgress({ current_section: 0 }) });

      renderWorkshop();

      if (!quizQuestions[0]) {
        expect(screen.queryByText('Quick Quiz')).not.toBeInTheDocument();
      }
    });
  });

  // ── Case study (section 5) ────────────────────

  describe('case study', () => {
    beforeEach(() => {
      setupProgress({ progress: makeProgress({ current_section: 5 }) });
    });

    it('shows sector-specific case study on section 5', () => {
      renderWorkshop();

      // Profile sector is 'public'
      expect(screen.getByText(/Case Study: Council Procurement Fraud/)).toBeInTheDocument();
    });

    it('shows discussion questions', () => {
      renderWorkshop();

      expect(screen.getByText('Discussion Questions:')).toBeInTheDocument();
    });

    it('shows interactive scenario title', () => {
      renderWorkshop();

      expect(screen.getByText(`Interactive Scenario: ${scenarioExercise.title}`)).toBeInTheDocument();
    });

    it('shows scenario options that can be clicked', async () => {
      const user = userEvent.setup();
      renderWorkshop();

      const firstOption = scenarioExercise.steps[0].options[0];
      const optionButton = screen.getByText(firstOption.text);
      expect(optionButton).toBeInTheDocument();

      await user.click(optionButton);

      expect(mockSaveScenarioChoice).toHaveBeenCalledWith('step0', firstOption.id);
    });

    it('shows feedback after making a scenario choice', async () => {
      const user = userEvent.setup();
      renderWorkshop();

      const firstOption = scenarioExercise.steps[0].options[0];
      await user.click(screen.getByText(firstOption.text));

      // Feedback should appear
      expect(screen.getByText(firstOption.feedback)).toBeInTheDocument();
    });
  });

  // ── Session info ──────────────────────────────

  describe('session info', () => {
    it('shows participant count when session exists', () => {
      setupSession({
        session: {
          id: 's-1',
          facilitator_id: 'f-1',
          session_code: 'ABC123',
          title: 'Test Session',
          status: 'active' as const,
          scheduled_at: null,
          started_at: '2025-01-01T00:00:00Z',
          ended_at: null,
          max_participants: 50,
          created_at: '2025-01-01T00:00:00Z',
        },
        participantCount: 12,
      });

      renderWorkshop();

      expect(screen.getByText('12 participants')).toBeInTheDocument();
      expect(screen.getByText('Session: ABC123')).toBeInTheDocument();
    });

    it('does not show session info when no session', () => {
      renderWorkshop();

      expect(screen.queryByText(/participants/)).not.toBeInTheDocument();
    });
  });

  // ── Dot navigation ────────────────────────────

  describe('dot navigation', () => {
    it('renders a dot for each section', () => {
      renderWorkshop();

      const dots = screen.getAllByLabelText(/Go to section/);
      expect(dots).toHaveLength(workshopSections.length);
    });

    it('clicking a dot navigates to that section', async () => {
      const user = userEvent.setup();
      renderWorkshop();

      const dot3 = screen.getByLabelText('Go to section 3');
      await user.click(dot3);

      expect(mockUpdateSection).toHaveBeenCalledWith(2);
    });
  });
});
