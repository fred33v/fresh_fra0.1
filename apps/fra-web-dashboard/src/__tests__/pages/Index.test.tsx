import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Index from '@/pages/Index';
import { useAuth } from '@/hooks/useAuth';

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

function renderIndex() {
  return render(
    <MemoryRouter>
      <Index />
    </MemoryRouter>,
  );
}

// ── Tests ──────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  setupAuth();
});

describe('Index', () => {
  // ── Hero section ────────────────────────────────

  describe('hero section', () => {
    it('shows main heading', () => {
      renderIndex();

      expect(screen.getByRole('heading', { level: 1, name: /Fraud risk assessment/ })).toBeInTheDocument();
      expect(screen.getByText('and prevention training')).toBeInTheDocument();
    });

    it('shows the not-legal-advice badge', () => {
      renderIndex();

      expect(screen.getByText('Self-assessment and awareness tools — not legal advice')).toBeInTheDocument();
    });

    it('shows "Get Started" link to the package chooser when not authenticated', () => {
      renderIndex();

      const link = screen.getByRole('link', { name: /Get Started/ });
      expect(link).toHaveAttribute('href', '/#packages');
    });

    it('shows "Go to Dashboard" link when authenticated', () => {
      setupAuth({ user: makeUser() });

      renderIndex();

      const links = screen.getAllByRole('link', { name: /Go to Dashboard/ });
      links.forEach((link) => expect(link).toHaveAttribute('href', '/dashboard'));
    });

    it('shows View Resources link', () => {
      renderIndex();

      const link = screen.getByRole('link', { name: /View Resources/ });
      expect(link).toHaveAttribute('href', '/#free-guides');
    });

    it('shows stats (30 Minutes, 6 Modules, 100% Interactive)', () => {
      renderIndex();

      expect(screen.getByText('30')).toBeInTheDocument();
      expect(screen.getByText('Minutes')).toBeInTheDocument();
      expect(screen.getByText('6')).toBeInTheDocument();
      expect(screen.getByText('Modules')).toBeInTheDocument();
      expect(screen.getByText('100%')).toBeInTheDocument();
      expect(screen.getByText('Interactive')).toBeInTheDocument();
    });
  });

  // ── Session join ────────────────────────────────

  describe('session join', () => {
    it('shows Join a Live Session card', () => {
      renderIndex();

      expect(screen.getByText('Join a Live Session')).toBeInTheDocument();
      expect(screen.getByLabelText('Session code')).toBeInTheDocument();
    });

    it('Join button is disabled when session code is empty', () => {
      renderIndex();

      expect(screen.getByRole('button', { name: 'Join' })).toBeDisabled();
    });

    it('navigates to workshop with uppercased session code', async () => {
      const user = userEvent.setup();
      renderIndex();

      await user.type(screen.getByLabelText('Session code'), 'abc123');
      await user.click(screen.getByRole('button', { name: 'Join' }));

      expect(mockNavigate).toHaveBeenCalledWith('/workshop?session=ABC123');
    });

    it('training button navigates to the Professional package when not authenticated', async () => {
      const user = userEvent.setup();
      renderIndex();

      await user.click(screen.getByRole('button', { name: 'Explore Training Package' }));

      expect(mockNavigate).toHaveBeenCalledWith('/package/professional');
    });

    it('workshop button navigates to workshop when authenticated', async () => {
      setupAuth({ user: makeUser() });
      const user = userEvent.setup();
      renderIndex();

      await user.click(screen.getByRole('button', { name: 'Open Workshop' }));

      expect(mockNavigate).toHaveBeenCalledWith('/workshop');
    });
  });

  // ── Features section ────────────────────────────

  describe('features section', () => {
    it('shows section heading', () => {
      renderIndex();

      expect(screen.getByText('From risk assessment to practical action')).toBeInTheDocument();
    });

    it('shows the three steps', () => {
      renderIndex();

      expect(screen.getByText('Assess 13 areas of fraud risk')).toBeInTheDocument();
      expect(screen.getByText('Understand what to address')).toBeInTheDocument();
      expect(screen.getByText('Extend awareness across your team')).toBeInTheDocument();
    });
  });

  // ── Packages section ────────────────────────────

  describe('packages section', () => {
    it('shows section heading', () => {
      renderIndex();

      expect(screen.getByText('Choose Your Package')).toBeInTheDocument();
    });

    it('shows all three packages with prices', () => {
      renderIndex();

      expect(screen.getByText('Starter')).toBeInTheDocument();
      expect(screen.getByText('£795')).toBeInTheDocument();
      expect(screen.getByText('Professional')).toBeInTheDocument();
      expect(screen.getByText('£1,799')).toBeInTheDocument();
      expect(screen.getByText('Enterprise')).toBeInTheDocument();
      expect(screen.getByText('£4,995')).toBeInTheDocument();
    });

    it('shows the "Training & support" badge on Professional', () => {
      renderIndex();

      expect(screen.getByText('Training & support')).toBeInTheDocument();
    });

    it('says prices exclude VAT', () => {
      renderIndex();

      expect(screen.getByText(/Prices exclude VAT/)).toBeInTheDocument();
    });

    it('Starter links to the Starter package page', () => {
      renderIndex();

      const link = screen.getByRole('link', { name: /View Starter details/ });
      expect(link).toHaveAttribute('href', '/package/starter');
    });

    it('Professional links to checkout when authenticated', () => {
      setupAuth({ user: makeUser() });

      renderIndex();

      const link = screen.getByRole('link', { name: /Choose Professional/ });
      expect(link).toHaveAttribute('href', '/checkout?package=Professional');
    });

    it('Professional links to signup when not authenticated', () => {
      renderIndex();

      const link = screen.getByRole('link', { name: /Choose Professional/ });
      expect(link).toHaveAttribute('href', '/auth?mode=signup&package=professional');
    });

    it('Enterprise links to checkout when authenticated', () => {
      setupAuth({ user: makeUser() });

      renderIndex();

      const link = screen.getByRole('link', { name: /Choose Enterprise/ });
      expect(link).toHaveAttribute('href', '/checkout?package=Enterprise');
    });

    it('Enterprise links to signup when not authenticated', () => {
      renderIndex();

      const link = screen.getByRole('link', { name: /Choose Enterprise/ });
      expect(link).toHaveAttribute('href', '/auth?mode=signup&package=enterprise');
    });
  });

  // ── Workshop overview section ───────────────────

  describe('workshop overview section', () => {
    it('shows section heading', () => {
      renderIndex();

      expect(screen.getByText('A Comprehensive 30-Minute Journey')).toBeInTheDocument();
    });

    it('shows all six workshop modules', () => {
      renderIndex();

      expect(screen.getByText('Fraud Prevention Landscape')).toBeInTheDocument();
      expect(screen.getByText('Fraud Types & Risks')).toBeInTheDocument();
      expect(screen.getByText('Defence Strategies')).toBeInTheDocument();
      expect(screen.getByText('Organisational Impact')).toBeInTheDocument();
      expect(screen.getByText('Interactive Scenarios')).toBeInTheDocument();
      expect(screen.getByText('Action Planning')).toBeInTheDocument();
    });

    it('shows "What You\'ll Learn" card', () => {
      renderIndex();

      expect(screen.getByText("What You'll Learn")).toBeInTheDocument();
    });
  });

  // ── CTA section ─────────────────────────────────

  describe('ways to continue section', () => {
    it('links each tool to its web page', () => {
      renderIndex();

      expect(screen.getByRole('link', { name: /Open assessment/ })).toHaveAttribute('href', '/assessment');
      expect(screen.getByRole('link', { name: /Open training/ })).toHaveAttribute('href', '/workshop');
      expect(screen.getByRole('link', { name: /Open budget guide/ })).toHaveAttribute('href', '/budget-holder');
    });
  });

  describe('free guides section', () => {
    it('lists each public PDF with a download link', () => {
      renderIndex();

      expect(screen.getByText('Free fraud prevention guides')).toBeInTheDocument();
      const link = screen.getByRole('link', { name: 'Download PDF: Fraud Risk Self-Assessment Checklist' });
      expect(link).toHaveAttribute('href', '/resources/fraud-risk-self-assessment-checklist.pdf');
    });
  });

  describe('FAQ section', () => {
    it('shows the FAQ heading and the questions', () => {
      renderIndex();

      expect(screen.getByRole('heading', { name: 'Frequently asked questions' })).toBeInTheDocument();
      expect(screen.getByText('Who is the service for?')).toBeInTheDocument();
      expect(screen.getByText('Is this legal advice or a compliance guarantee?')).toBeInTheDocument();
    });
  });

  describe('CTA section', () => {
    it('shows CTA heading', () => {
      renderIndex();

      expect(screen.getByText('Choose your next step')).toBeInTheDocument();
    });

    it('Compare Packages link goes to the packages when not authenticated', () => {
      renderIndex();

      const link = screen.getByRole('link', { name: /Compare Packages/ });
      expect(link).toHaveAttribute('href', '/#packages');
    });

    it('shows Download Free Guides link', () => {
      renderIndex();

      const link = screen.getByRole('link', { name: 'Download Free Guides' });
      expect(link).toHaveAttribute('href', '/#free-guides');
    });
  });

  // ── Footer ──────────────────────────────────────

  describe('footer', () => {
    it('shows brand name', () => {
      renderIndex();

      expect(screen.getByLabelText('Site footer')).toBeInTheDocument();
      expect(screen.getAllByText('FRAUD-RISK.CO.UK').length).toBeGreaterThanOrEqual(1);
    });

    it('lists the contact email addresses', () => {
      renderIndex();

      for (const address of ['assessment', 'help', 'recruitment']) {
        expect(screen.getByRole('link', { name: `${address}@fraud-risk.co.uk` })).toHaveAttribute(
          'href',
          `mailto:${address}@fraud-risk.co.uk`,
        );
      }
    });

    it('shows copyright with current year', () => {
      renderIndex();

      const year = new Date().getFullYear();
      expect(screen.getByText(new RegExp(`© ${year}`))).toBeInTheDocument();
    });
  });

  // ── Accessibility ───────────────────────────────

  describe('accessibility', () => {
    it('has labelled sections', () => {
      renderIndex();

      expect(screen.getByLabelText('Hero')).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'From risk assessment to practical action' })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Choose Your Package' })).toBeInTheDocument();
      expect(screen.getByLabelText('Workshop overview')).toBeInTheDocument();
      expect(screen.getByLabelText('Call to action')).toBeInTheDocument();
      expect(screen.getByLabelText('Site footer')).toBeInTheDocument();
    });
  });
});
