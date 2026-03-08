import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PackageProfessional from '@/pages/PackageProfessional';
import { useAuth } from '@/hooks/useAuth';

// ── Mocks ──────────────────────────────────────────────────

vi.mock('@/hooks/useAuth');

vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
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
    user: null,
    profile: null,
    roles: [] as never[],
    isLoading: false,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    hasRole: vi.fn(),
    refreshProfile: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useAuth>);
}

function renderPage() {
  return render(
    <MemoryRouter>
      <PackageProfessional />
    </MemoryRouter>,
  );
}

// ── Tests ──────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  setupAuth();
});

describe('PackageProfessional', () => {
  describe('hero section', () => {
    it('shows heading and subtitle', () => {
      renderPage();

      expect(screen.getByText('Professional')).toBeInTheDocument();
      expect(screen.getByText('FRA + Training')).toBeInTheDocument();
    });

    it('shows compliance badge', () => {
      renderPage();

      expect(screen.getByText('GovS-013 & ECCTA 2023 Compliant')).toBeInTheDocument();
    });

    it('shows "Most Popular" badge', () => {
      renderPage();

      expect(screen.getByText('Most Popular')).toBeInTheDocument();
    });

    it('shows price', () => {
      renderPage();

      expect(screen.getAllByText(/£1,799/).length).toBeGreaterThanOrEqual(1);
    });

    it('shows stats (50 Key-Passes, 4x Per Year)', () => {
      renderPage();

      expect(screen.getByText('50')).toBeInTheDocument();
      expect(screen.getByText('Key-Passes')).toBeInTheDocument();
      expect(screen.getByText('4x')).toBeInTheDocument();
    });
  });

  describe('auth-conditional links', () => {
    it('links to signup when not authenticated', () => {
      renderPage();

      const links = screen.getAllByRole('link', { name: /Choose Professional/ });
      expect(links[0]).toHaveAttribute('href', '/auth?mode=signup');
    });

    it('links to checkout when authenticated', () => {
      setupAuth({ user: makeUser() });

      renderPage();

      const links = screen.getAllByRole('link', { name: /Choose Professional/ });
      expect(links[0]).toHaveAttribute('href', '/checkout?package=Professional&price=1799');
    });

    it('CTA "Get Started Now" links to signup when not authenticated', () => {
      renderPage();

      const link = screen.getByRole('link', { name: /Get Started Now/ });
      expect(link).toHaveAttribute('href', '/auth?mode=signup');
    });

    it('CTA "Get Started Now" links to checkout when authenticated', () => {
      setupAuth({ user: makeUser() });

      renderPage();

      const link = screen.getByRole('link', { name: /Get Started Now/ });
      expect(link).toHaveAttribute('href', '/checkout?package=Professional&price=1799');
    });

    it('View Resources link points to /resources', () => {
      renderPage();

      const link = screen.getByRole('link', { name: /View Resources/ });
      expect(link).toHaveAttribute('href', '/resources');
    });

    it('Compare All Packages link points to /', () => {
      renderPage();

      const link = screen.getByRole('link', { name: /Compare All Packages/ });
      expect(link).toHaveAttribute('href', '/');
    });
  });

  describe('included features', () => {
    it('shows "What\'s Included" card with starter features', () => {
      renderPage();

      expect(screen.getByText("What's Included")).toBeInTheDocument();
      expect(screen.getByText(/Single fraud risk assessment/)).toBeInTheDocument();
      expect(screen.getByText(/Professional PDF health check/)).toBeInTheDocument();
      expect(screen.getByText(/ECCTA 2023 compliance snapshot/)).toBeInTheDocument();
    });

    it('shows professional features section', () => {
      renderPage();

      expect(screen.getByText('Professional Features in Detail')).toBeInTheDocument();
    });

    it('shows all four professional feature cards', () => {
      renderPage();

      expect(screen.getAllByText('Staff Awareness Training').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Up to 50 Employee Key-Passes').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Quarterly Reassessment').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Email Support').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('why upgrade section', () => {
    it('shows "Why Upgrade to Professional?" heading', () => {
      renderPage();

      expect(screen.getByText('Why Upgrade to Professional?')).toBeInTheDocument();
    });

    it('shows ideal-for items', () => {
      renderPage();

      expect(screen.getByText(/SMEs with 10–100 employees/)).toBeInTheDocument();
      expect(screen.getByText(/staff training evidence for ECCTA/)).toBeInTheDocument();
    });

    it('shows comparison card', () => {
      renderPage();

      expect(screen.getByText('Professional vs Starter')).toBeInTheDocument();
      expect(screen.getByText(/50 employee key-passes vs 1/)).toBeInTheDocument();
    });
  });

  describe('CTA section', () => {
    it('shows CTA heading and price', () => {
      renderPage();

      expect(screen.getByText('Train Your Team. Prove Compliance.')).toBeInTheDocument();
      expect(screen.getByText('£1,799/year + VAT')).toBeInTheDocument();
    });

    it('mentions Enterprise package', () => {
      renderPage();

      expect(screen.getByText(/Enterprise package/)).toBeInTheDocument();
    });
  });

  describe('footer', () => {
    it('shows brand name and copyright', () => {
      renderPage();

      expect(screen.getByText('Fraud Risk Awareness Workshop')).toBeInTheDocument();
      const year = new Date().getFullYear();
      expect(screen.getByText(new RegExp(`© ${year}`))).toBeInTheDocument();
    });
  });
});
