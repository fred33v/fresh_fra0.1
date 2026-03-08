import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Resources from '@/pages/Resources';
import { useAuth } from '@/hooks/useAuth';
import { downloadableResources } from '@/data/workshopContent';

// ── Mocks ──────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/hooks/useAuth');

vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
}));

const mockedUseAuth = vi.mocked(useAuth);

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

function setupAuth(overrides?: Record<string, unknown>) {
  mockedUseAuth.mockReturnValue({
    user: makeUser(),
    profile: null,
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

function renderResources() {
  return render(
    <MemoryRouter>
      <Resources />
    </MemoryRouter>,
  );
}

// ── Tests ──────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  setupAuth();
});

describe('Resources', () => {
  // ── Auth guard ──────────────────────────────────

  describe('auth guard', () => {
    it('shows loading spinner when auth is loading', () => {
      setupAuth({ isLoading: true });

      renderResources();

      expect(screen.getByRole('status', { name: 'Loading resources' })).toBeInTheDocument();
    });

    it('renders null when user is null', () => {
      setupAuth({ user: null });

      const { container } = renderResources();

      expect(container.querySelector('[data-testid="layout"]')).toBeNull();
    });
  });

  // ── Page layout ─────────────────────────────────

  describe('page layout', () => {
    it('shows page title and description', () => {
      renderResources();

      expect(screen.getByText('Workshop Resources')).toBeInTheDocument();
      expect(screen.getByText(/Download materials and tools/)).toBeInTheDocument();
    });

    it('shows Back button that navigates back', async () => {
      const user = userEvent.setup();
      renderResources();

      await user.click(screen.getByText('Back'));

      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });

    it('shows all three section headings', () => {
      renderResources();

      expect(screen.getByText('Core Workshop Materials')).toBeInTheDocument();
      expect(screen.getByText('Pre-Workshop Reading')).toBeInTheDocument();
      expect(screen.getByText('External Resources')).toBeInTheDocument();
    });

    it('has labelled sections for accessibility', () => {
      renderResources();

      expect(screen.getByLabelText('Core workshop materials')).toBeInTheDocument();
      expect(screen.getByLabelText('Pre-workshop reading')).toBeInTheDocument();
      expect(screen.getByLabelText('External resources')).toBeInTheDocument();
    });
  });

  // ── Core workshop materials ─────────────────────

  describe('core workshop materials', () => {
    it('renders all downloadable resources from data', () => {
      renderResources();

      for (const resource of downloadableResources) {
        expect(screen.getByText(resource.title)).toBeInTheDocument();
        expect(screen.getByText(resource.description)).toBeInTheDocument();
      }
    });

    it('renders a Download PDF button for each resource', () => {
      renderResources();

      const downloadButtons = screen.getAllByText('Download PDF');
      expect(downloadButtons).toHaveLength(downloadableResources.length);
    });

    it('has accessible download button labels', () => {
      renderResources();

      for (const resource of downloadableResources) {
        expect(screen.getByLabelText(`Download ${resource.title} PDF`)).toBeInTheDocument();
      }
    });

    it('shows toast when download is clicked', async () => {
      const { toast } = await import('sonner');
      const user = userEvent.setup();
      renderResources();

      await user.click(screen.getByLabelText(`Download ${downloadableResources[0].title} PDF`));

      expect(toast.info).toHaveBeenCalledWith(
        expect.stringContaining(downloadableResources[0].title),
        expect.objectContaining({ duration: 5000 }),
      );
    });
  });

  // ── Pre-workshop reading ────────────────────────

  describe('pre-workshop reading', () => {
    it('shows all pre-workshop resources', () => {
      renderResources();

      expect(screen.getByText('Understanding the Economic Crime Act 2023')).toBeInTheDocument();
      expect(screen.getByText('Fraud Risk Primer')).toBeInTheDocument();
      expect(screen.getByText('Regulatory Compliance Checklist')).toBeInTheDocument();
    });

    it('shows descriptions for pre-workshop resources', () => {
      renderResources();

      expect(screen.getByText(/key provisions and implications/)).toBeInTheDocument();
      expect(screen.getByText(/common fraud schemes and red flags/)).toBeInTheDocument();
      expect(screen.getByText(/Quick reference for compliance/)).toBeInTheDocument();
    });

    it('has accessible read buttons', () => {
      renderResources();

      expect(screen.getByLabelText('Read Understanding the Economic Crime Act 2023')).toBeInTheDocument();
      expect(screen.getByLabelText('Read Fraud Risk Primer')).toBeInTheDocument();
      expect(screen.getByLabelText('Read Regulatory Compliance Checklist')).toBeInTheDocument();
    });
  });

  // ── External resources ──────────────────────────

  describe('external resources', () => {
    it('shows Government Guidance card', () => {
      renderResources();

      expect(screen.getByText('Government Guidance')).toBeInTheDocument();
      expect(screen.getByText(/Economic Crime and Corporate Transparency Act/)).toBeInTheDocument();
    });

    it('shows ACFE Resources card', () => {
      renderResources();

      expect(screen.getByText('ACFE Resources')).toBeInTheDocument();
      expect(screen.getByText(/Certified Fraud Examiners/)).toBeInTheDocument();
    });

    it('GOV.UK link opens in new window', () => {
      renderResources();

      const govLink = screen.getByLabelText('Visit GOV.UK (opens in new window)');
      expect(govLink).toHaveAttribute('href', 'https://www.gov.uk');
      expect(govLink).toHaveAttribute('target', '_blank');
      expect(govLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('ACFE link opens in new window', () => {
      renderResources();

      const acfeLink = screen.getByLabelText('Visit ACFE (opens in new window)');
      expect(acfeLink).toHaveAttribute('href', 'https://www.acfe.com');
      expect(acfeLink).toHaveAttribute('target', '_blank');
      expect(acfeLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });
});
