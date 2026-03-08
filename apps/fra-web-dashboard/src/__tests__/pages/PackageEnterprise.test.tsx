import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PackageEnterprise from '@/pages/PackageEnterprise';
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
    role: 'employer',
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
      <PackageEnterprise />
    </MemoryRouter>,
  );
}

// ── Tests ──────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  setupAuth();
});

describe('PackageEnterprise', () => {
  describe('hero section', () => {
    it('shows heading and subtitle', () => {
      renderPage();

      expect(screen.getByText('Enterprise')).toBeInTheDocument();
      expect(screen.getByText('Full Dashboard')).toBeInTheDocument();
    });

    it('shows compliance badge', () => {
      renderPage();

      expect(screen.getByText('GovS-013 & ECCTA 2023 Compliant')).toBeInTheDocument();
    });

    it('shows price', () => {
      renderPage();

      expect(screen.getAllByText(/£4,995/).length).toBeGreaterThanOrEqual(1);
    });

    it('shows stats (∞ Key-Passes, Live Dashboard)', () => {
      renderPage();

      expect(screen.getByText('∞')).toBeInTheDocument();
      expect(screen.getByText('Live')).toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Unlimited access')).toBeInTheDocument();
    });
  });

  describe('auth-conditional links', () => {
    it('links to signup when not authenticated', () => {
      renderPage();

      const links = screen.getAllByRole('link', { name: /Choose Enterprise/ });
      expect(links[0]).toHaveAttribute('href', '/auth?mode=signup');
    });

    it('links to checkout when authenticated', () => {
      setupAuth({ user: makeUser() });

      renderPage();

      const links = screen.getAllByRole('link', { name: /Choose Enterprise/ });
      expect(links[0]).toHaveAttribute('href', '/checkout?package=Enterprise&price=4995');
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
      expect(link).toHaveAttribute('href', '/checkout?package=Enterprise&price=4995');
    });

    it('Compare All Packages links to /', () => {
      renderPage();

      const links = screen.getAllByRole('link', { name: /Compare All Packages/ });
      expect(links[0]).toHaveAttribute('href', '/');
    });
  });

  describe('included features', () => {
    it('shows "Everything in Professional" card', () => {
      renderPage();

      expect(screen.getByText('Everything in Professional')).toBeInTheDocument();
      expect(screen.getByText(/Fraud risk assessment across 13 key areas/)).toBeInTheDocument();
    });

    it('shows enterprise features section heading', () => {
      renderPage();

      expect(screen.getByText('Enterprise Features in Detail')).toBeInTheDocument();
    });

    it('shows all six enterprise feature cards', () => {
      renderPage();

      expect(screen.getAllByText('Real-Time Monitoring Dashboard').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Unlimited Employee Key-Passes').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Risk Register & Action Tracking').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('API Access').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Priority Support').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Compliance Reports').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('why enterprise section', () => {
    it('shows "Why Choose Enterprise?" heading', () => {
      renderPage();

      expect(screen.getByText('Why Choose Enterprise?')).toBeInTheDocument();
    });

    it('shows ideal-for items', () => {
      renderPage();

      expect(screen.getByText(/Large organisations with 100\+ employees/)).toBeInTheDocument();
      expect(screen.getByText(/Public sector and NHS bodies/)).toBeInTheDocument();
      expect(screen.getByText(/real-time compliance oversight/)).toBeInTheDocument();
      expect(screen.getByText(/API integration with existing GRC/)).toBeInTheDocument();
    });

    it('shows comparison card', () => {
      renderPage();

      expect(screen.getByText('Enterprise vs Professional')).toBeInTheDocument();
      expect(screen.getByText(/Unlimited key-passes vs 50/)).toBeInTheDocument();
    });
  });

  describe('onboarding steps', () => {
    it('shows onboarding section heading', () => {
      renderPage();

      expect(screen.getByText('Your Enterprise Onboarding')).toBeInTheDocument();
    });

    it('shows all four onboarding steps', () => {
      renderPage();

      expect(screen.getByText('Complete Payment')).toBeInTheDocument();
      expect(screen.getByText('Team Invitation')).toBeInTheDocument();
      expect(screen.getByText('Initial Setup')).toBeInTheDocument();
      expect(screen.getByText('Dashboard Live')).toBeInTheDocument();
    });

    it('shows time estimates for each step', () => {
      renderPage();

      expect(screen.getByText('5 minutes')).toBeInTheDocument();
      expect(screen.getByText('Within 24 hours')).toBeInTheDocument();
      expect(screen.getByText('30 minutes')).toBeInTheDocument();
      expect(screen.getByText('Same day')).toBeInTheDocument();
    });
  });

  describe('FAQ section', () => {
    it('shows FAQ heading', () => {
      renderPage();

      expect(screen.getByText('Common Questions')).toBeInTheDocument();
    });

    it('shows all five FAQ questions', () => {
      renderPage();

      expect(screen.getByText('How long is the onboarding process?')).toBeInTheDocument();
      expect(screen.getByText('Can I upgrade from Professional mid-year?')).toBeInTheDocument();
      expect(screen.getByText('Is API access included or paid separately?')).toBeInTheDocument();
      expect(screen.getByText('What does priority support cover?')).toBeInTheDocument();
      expect(screen.getByText('How do employee key-passes work?')).toBeInTheDocument();
    });

    it('expands FAQ answer when clicked', async () => {
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByText('How long is the onboarding process?'));

      expect(screen.getByText(/1–2 business days/)).toBeInTheDocument();
    });
  });

  describe('CTA section', () => {
    it('shows CTA heading and price', () => {
      renderPage();

      expect(screen.getByText('Full Visibility. Total Compliance.')).toBeInTheDocument();
      expect(screen.getByText('£4,995/year + VAT')).toBeInTheDocument();
    });

    it('mentions Professional package', () => {
      renderPage();

      expect(screen.getByText(/Professional package at £1,799/)).toBeInTheDocument();
    });
  });

  describe('footer', () => {
    it('shows brand name and copyright', () => {
      renderPage();

      expect(screen.getByText('Fraud Risk Enterprise Platform')).toBeInTheDocument();
      const year = new Date().getFullYear();
      expect(screen.getByText(new RegExp(`© ${year}`))).toBeInTheDocument();
    });
  });
});
