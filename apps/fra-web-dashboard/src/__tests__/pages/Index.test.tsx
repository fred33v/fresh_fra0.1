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

      expect(screen.getAllByText('FRAUD-RISK.CO.UK').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Protect Your Organisation')).toBeInTheDocument();
    });

    it('shows compliance badge', () => {
      renderIndex();

      expect(screen.getByText('GovS-013 & ECCTA 2023 Compliant')).toBeInTheDocument();
    });

    it('shows "Get Started" link when not authenticated', () => {
      renderIndex();

      const link = screen.getByRole('link', { name: /Get Started/ });
      expect(link).toHaveAttribute('href', '/auth?mode=signup');
    });

    it('shows "Go to Dashboard" link when authenticated', () => {
      setupAuth({ user: makeUser() });

      renderIndex();

      const link = screen.getByRole('link', { name: /Go to Dashboard/ });
      expect(link).toHaveAttribute('href', '/dashboard');
    });

    it('shows View Resources link', () => {
      renderIndex();

      const link = screen.getByRole('link', { name: /View Resources/ });
      expect(link).toHaveAttribute('href', '/resources');
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

    it('Self-paced button navigates to signup when not authenticated', async () => {
      const user = userEvent.setup();
      renderIndex();

      await user.click(screen.getByText('Start Self-Paced Workshop'));

      expect(mockNavigate).toHaveBeenCalledWith('/auth?mode=signup');
    });

    it('Self-paced button navigates to workshop when authenticated', async () => {
      setupAuth({ user: makeUser() });
      const user = userEvent.setup();
      renderIndex();

      await user.click(screen.getByText('Start Self-Paced Workshop'));

      expect(mockNavigate).toHaveBeenCalledWith('/workshop');
    });
  });

  // ── Features section ────────────────────────────

  describe('features section', () => {
    it('shows section heading', () => {
      renderIndex();

      expect(screen.getByText("What You'll Experience")).toBeInTheDocument();
    });

    it('shows all four feature cards', () => {
      renderIndex();

      expect(screen.getByText('Interactive Learning')).toBeInTheDocument();
      expect(screen.getByText('Live Collaboration')).toBeInTheDocument();
      expect(screen.getByText('Personalised Action Plans')).toBeInTheDocument();
      expect(screen.getByText('Certificate of Completion')).toBeInTheDocument();
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

    it('shows "Most Popular" badge on Professional', () => {
      renderIndex();

      expect(screen.getByText('Most Popular')).toBeInTheDocument();
    });

    it('Starter links to signup', () => {
      renderIndex();

      const link = screen.getByRole('link', { name: /Start Assessment/ });
      expect(link).toHaveAttribute('href', '/auth?mode=signup');
    });

    it('Professional links to checkout when authenticated', () => {
      setupAuth({ user: makeUser() });

      renderIndex();

      const link = screen.getByRole('link', { name: /Choose Professional/ });
      expect(link).toHaveAttribute('href', '/checkout?package=Professional&price=1799');
    });

    it('Professional links to signup when not authenticated', () => {
      renderIndex();

      const link = screen.getByRole('link', { name: /Choose Professional/ });
      expect(link).toHaveAttribute('href', '/auth?mode=signup');
    });

    it('Enterprise links to checkout when authenticated', () => {
      setupAuth({ user: makeUser() });

      renderIndex();

      const link = screen.getByRole('link', { name: /Choose Enterprise/ });
      expect(link).toHaveAttribute('href', '/checkout?package=Enterprise&price=4995');
    });

    it('Enterprise links to signup when not authenticated', () => {
      renderIndex();

      const link = screen.getByRole('link', { name: /Choose Enterprise/ });
      expect(link).toHaveAttribute('href', '/auth?mode=signup');
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

      expect(screen.getByText('Regulatory Landscape')).toBeInTheDocument();
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

  describe('CTA section', () => {
    it('shows CTA heading', () => {
      renderIndex();

      expect(screen.getByText('Ready to Strengthen Your Fraud Defences?')).toBeInTheDocument();
    });

    it('Start Workshop link goes to signup when not authenticated', () => {
      renderIndex();

      const link = screen.getByRole('link', { name: /Start Workshop Now/ });
      expect(link).toHaveAttribute('href', '/auth?mode=signup');
    });

    it('Start Workshop link goes to workshop when authenticated', () => {
      setupAuth({ user: makeUser() });

      renderIndex();

      const link = screen.getByRole('link', { name: /Start Workshop Now/ });
      expect(link).toHaveAttribute('href', '/workshop');
    });

    it('shows Download Resources link', () => {
      renderIndex();

      const link = screen.getByRole('link', { name: 'Download Resources' });
      expect(link).toHaveAttribute('href', '/resources');
    });
  });

  // ── Footer ──────────────────────────────────────

  describe('footer', () => {
    it('shows brand name', () => {
      renderIndex();

      expect(screen.getByLabelText('Site footer')).toBeInTheDocument();
      expect(screen.getAllByText('FRAUD-RISK.CO.UK').length).toBeGreaterThanOrEqual(1);
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
      expect(screen.getByLabelText('Features')).toBeInTheDocument();
      expect(screen.getByLabelText('Packages')).toBeInTheDocument();
      expect(screen.getByLabelText('Workshop overview')).toBeInTheDocument();
      expect(screen.getByLabelText('Call to action')).toBeInTheDocument();
      expect(screen.getByLabelText('Site footer')).toBeInTheDocument();
    });
  });
});
