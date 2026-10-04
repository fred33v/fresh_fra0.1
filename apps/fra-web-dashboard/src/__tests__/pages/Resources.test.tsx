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

    it('links each download to its PDF in public/resources', () => {
      renderResources();

      for (const resource of downloadableResources) {
        const link = screen.getByLabelText(`Download ${resource.title} (PDF)`);
        expect(link).toHaveAttribute('href', `/resources/${resource.filename}`);
        expect(link).toHaveAttribute('download');
      }
    });

    it('ships a PDF for every download', async () => {
      const { existsSync } = await import('node:fs');
      const { resolve } = await import('node:path');
      for (const resource of downloadableResources) {
        expect(existsSync(resolve(__dirname, '../../../public/resources', resource.filename))).toBe(true);
      }
    });
  });

  // ── Pre-workshop reading ────────────────────────

  describe('pre-workshop reading', () => {
    const READING = [
      ['Failure to prevent fraud: Home Office guidance', 'https://www.gov.uk/government/publications/offence-of-failure-to-prevent-fraud-introduced-by-eccta'],
      ['A–Z of fraud and cyber crime', 'https://www.reportfraud.police.uk/collection/a-z-fraud/'],
      ['GovS 013: Counter Fraud functional standard', 'https://www.gov.uk/government/publications/government-functional-standard-govs-013-counter-fraud'],
    ];

    it('links each item to its official source in a new tab', () => {
      renderResources();

      for (const [title, url] of READING) {
        expect(screen.getByText(title)).toBeInTheDocument();
        const link = screen.getByLabelText(`Read ${title} (opens in a new tab)`);
        expect(link).toHaveAttribute('href', url);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      }
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
