import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Certificate from '@/pages/Certificate';
import { useAuth } from '@/hooks/useAuth';
import { useWorkshopProgress } from '@/hooks/useWorkshopProgress';
import { api } from '@/lib/api';

// ── Mocks ──────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useWorkshopProgress');

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
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
    current_section: 6,
    completed_sections: [0, 1, 2, 3, 4, 5, 6] as number[],
    quiz_scores: {} as Record<string, number>,
    scenario_choices: {} as Record<string, string>,
    completed_at: '2025-06-01T00:00:00Z',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-06-01T00:00:00Z',
    ...overrides,
  };
}

function makeCertificate(overrides?: Record<string, unknown>) {
  return {
    id: 'cert-1',
    user_id: 'u-1',
    session_id: null,
    certificate_number: 'FRA-2025-0001',
    issued_at: '2025-06-01T12:00:00Z',
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

function renderCertificate() {
  return render(
    <MemoryRouter>
      <Certificate />
    </MemoryRouter>,
  );
}

// ── Tests ──────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth();
  setupProgress();
  // Default: no certificate exists yet, loading finishes quickly
  mockedApi.get.mockResolvedValue([]);
});

describe('Certificate', () => {
  // ── Auth guard ──────────────────────────────────

  describe('auth guard', () => {
    it('renders null when user is null', () => {
      setupAuth({ user: null });

      const { container } = renderCertificate();

      expect(screen.queryByText(/Certificate/)).not.toBeInTheDocument();
      expect(container.querySelector('[data-testid="layout"]')).toBeNull();
    });

    it('renders null when profile is null', () => {
      setupAuth({ profile: null });

      const { container } = renderCertificate();

      expect(screen.queryByText(/Certificate/)).not.toBeInTheDocument();
      expect(container.querySelector('[data-testid="layout"]')).toBeNull();
    });
  });

  // ── Loading state ─────────────────────────────

  describe('loading state', () => {
    it('shows loading spinner while fetching certificate', () => {
      // API never resolves → stays in loading state
      mockedApi.get.mockReturnValue(new Promise(() => {}));

      renderCertificate();

      expect(screen.getByRole('status', { name: 'Loading certificate' })).toBeInTheDocument();
    });
  });

  // ── Not completed state ───────────────────────

  describe('not completed state', () => {
    beforeEach(() => {
      setupProgress({ progress: makeProgress({ completed_at: null }) });
    });

    it('shows "Complete the Workshop First" message', async () => {
      renderCertificate();

      await waitFor(() => {
        expect(screen.getByText('Complete the Workshop First')).toBeInTheDocument();
      });
    });

    it('shows Continue Workshop button that navigates to /workshop', async () => {
      renderCertificate();

      await waitFor(() => {
        expect(screen.getByText('Continue Workshop')).toBeInTheDocument();
      });

      await userEvent.setup().click(screen.getByText('Continue Workshop'));

      expect(mockNavigate).toHaveBeenCalledWith('/workshop');
    });
  });

  // ── Congratulations (no certificate yet) ──────

  describe('congratulations card', () => {
    it('shows congratulations when completed but no certificate', async () => {
      renderCertificate();

      await waitFor(() => {
        expect(screen.getByText('Congratulations!')).toBeInTheDocument();
      });
      expect(screen.getByText("You've completed the Fraud Risk Awareness Workshop")).toBeInTheDocument();
    });

    it('shows Generate Certificate button', async () => {
      renderCertificate();

      await waitFor(() => {
        expect(screen.getByText('Generate Certificate')).toBeInTheDocument();
      });
    });

    it('generates certificate on button click', async () => {
      const cert = makeCertificate();
      mockedApi.post.mockResolvedValueOnce(cert);

      const user = userEvent.setup();
      renderCertificate();

      await waitFor(() => {
        expect(screen.getByText('Generate Certificate')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Generate Certificate'));

      expect(mockedApi.post).toHaveBeenCalledWith('/api/v1/workshop/certificates', {});
      await waitFor(() => {
        expect(screen.getByText('Certificate of Completion')).toBeInTheDocument();
      });
    });

    it('shows error toast when generation fails', async () => {
      const { toast } = await import('sonner');
      mockedApi.post.mockRejectedValueOnce(new Error('Server error'));

      const user = userEvent.setup();
      renderCertificate();

      await waitFor(() => {
        expect(screen.getByText('Generate Certificate')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Generate Certificate'));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to generate certificate. Please try again.');
      });
    });
  });

  // ── Certificate display ───────────────────────

  describe('certificate display', () => {
    beforeEach(() => {
      mockedApi.get.mockResolvedValue([makeCertificate()]);
    });

    it('shows user name and organisation', async () => {
      renderCertificate();

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });
      expect(screen.getByText('Test Organisation')).toBeInTheDocument();
    });

    it('displays certificate number', async () => {
      renderCertificate();

      await waitFor(() => {
        expect(screen.getByText('FRA-2025-0001')).toBeInTheDocument();
      });
    });

    it('formats issued date in en-GB locale', async () => {
      renderCertificate();

      await waitFor(() => {
        expect(screen.getByText('1 June 2025')).toBeInTheDocument();
      });
    });

    it('shows completion badges for all sections', async () => {
      renderCertificate();

      await waitFor(() => {
        expect(screen.getByText('Regulatory Landscape')).toBeInTheDocument();
      });
      expect(screen.getByText('Fraud Types & Risks')).toBeInTheDocument();
      expect(screen.getByText('Defence Strategies')).toBeInTheDocument();
      expect(screen.getByText('Case Studies')).toBeInTheDocument();
    });

    it('shows Download PDF and Share Certificate buttons', async () => {
      renderCertificate();

      await waitFor(() => {
        expect(screen.getByText('Download PDF')).toBeInTheDocument();
      });
      expect(screen.getByText('Share Certificate')).toBeInTheDocument();
    });
  });

  // ── PDF download ──────────────────────────────

  describe('pdf download', () => {
    it('calls window.print when Download PDF is clicked', async () => {
      mockedApi.get.mockResolvedValue([makeCertificate()]);
      const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

      const user = userEvent.setup();
      renderCertificate();

      await waitFor(() => {
        expect(screen.getByText('Download PDF')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Download PDF'));

      expect(printSpy).toHaveBeenCalled();
      printSpy.mockRestore();
    });
  });

  // ── Share functionality ───────────────────────

  describe('share functionality', () => {
    it('falls back to clipboard when navigator.share is unavailable', async () => {
      mockedApi.get.mockResolvedValue([makeCertificate()]);
      const { toast } = await import('sonner');

      // Ensure navigator.share is absent
      const originalShare = navigator.share;
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true, writable: true });

      // Spy on clipboard.writeText
      const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

      const user = userEvent.setup();
      renderCertificate();

      await waitFor(() => {
        expect(screen.getByText('Share Certificate')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Share Certificate'));

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Certificate link copied to clipboard');
      });
      expect(writeTextSpy).toHaveBeenCalled();

      // Restore
      writeTextSpy.mockRestore();
      Object.defineProperty(navigator, 'share', { value: originalShare, configurable: true, writable: true });
    });
  });

  // ── Fetch error ───────────────────────────────

  describe('fetch error', () => {
    it('shows error toast when fetching certificate fails', async () => {
      const { toast } = await import('sonner');
      mockedApi.get.mockRejectedValueOnce(new Error('Network error'));

      renderCertificate();

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Failed to load certificate');
      });
    });
  });

  // ── Navigation ────────────────────────────────

  describe('navigation', () => {
    it('Back button navigates back', async () => {
      renderCertificate();

      await waitFor(() => {
        expect(screen.getByText('Back')).toBeInTheDocument();
      });

      await userEvent.setup().click(screen.getByText('Back'));

      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });
});
