import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { useAuth } from '@/hooks/useAuth';

// ── Mocks ──────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/hooks/useAuth');

const mockedUseAuth = vi.mocked(useAuth);

// ── Helpers ────────────────────────────────────────────────

function makeUser(overrides?: Record<string, unknown>) {
  return {
    userId: 'u-1',
    email: 'alice@example.com',
    name: 'Alice Smith',
    role: 'employee',
    organisationId: 'org-1',
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeProfile(overrides?: Record<string, unknown>) {
  return {
    id: 'p-1',
    user_id: 'u-1',
    full_name: 'Alice Smith',
    organization_name: 'Acme Ltd',
    sector: 'private',
    job_title: 'Manager',
    ...overrides,
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
    hasRole: vi.fn().mockReturnValue(false),
    refreshProfile: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useAuth>);
}

function renderHeader() {
  return render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>,
  );
}

// ── Tests ──────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  setupAuth();
});

describe('Header', () => {
  // ── Unauthenticated state ──────────────────────

  describe('unauthenticated', () => {
    it('shows Sign In link pointing to /auth', () => {
      renderHeader();

      const link = screen.getByRole('link', { name: /Sign In/ });
      expect(link).toHaveAttribute('href', '/auth');
    });

    it('shows Get Started link pointing to /auth?mode=signup', () => {
      renderHeader();

      const link = screen.getByRole('link', { name: /Get Started/ });
      expect(link).toHaveAttribute('href', '/auth?mode=signup');
    });

    it('does not render the avatar dropdown', () => {
      renderHeader();

      expect(screen.queryByLabelText('User menu')).not.toBeInTheDocument();
    });
  });

  // ── Authenticated — participant role ───────────

  describe('authenticated participant', () => {
    beforeEach(() => {
      setupAuth({
        user: makeUser(),
        profile: makeProfile(),
        hasRole: vi.fn().mockReturnValue(false),
      });
    });

    it('shows avatar with initials from profile name', () => {
      renderHeader();

      expect(screen.getByText('AS')).toBeInTheDocument();
    });

    it('does not show Organisation nav button', () => {
      renderHeader();

      expect(screen.queryByRole('link', { name: 'Organisation' })).not.toBeInTheDocument();
    });

    it('does not show Facilitator Dashboard nav button', () => {
      renderHeader();

      expect(screen.queryByRole('link', { name: 'Facilitator Dashboard' })).not.toBeInTheDocument();
    });

    it('shows user name and email in dropdown', async () => {
      const user = userEvent.setup();
      renderHeader();

      await user.click(screen.getByLabelText('User menu'));

      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });
  });

  // ── Authenticated — employer role ──────────────

  describe('authenticated employer', () => {
    beforeEach(() => {
      setupAuth({
        user: makeUser({ role: 'employer' }),
        profile: makeProfile(),
        hasRole: vi.fn().mockReturnValue(false),
      });
    });

    it('shows Organisation nav button linking to /employer', () => {
      renderHeader();

      const links = screen.getAllByRole('link', { name: 'Organisation' });
      expect(links[0]).toHaveAttribute('href', '/employer');
    });

    it('shows Organisation link in dropdown menu', async () => {
      const user = userEvent.setup();
      renderHeader();

      await user.click(screen.getByLabelText('User menu'));

      const orgLinks = screen.getAllByRole('menuitem', { name: 'Organisation' });
      expect(orgLinks.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Authenticated — facilitator role ───────────

  describe('authenticated facilitator', () => {
    it('shows Facilitator Dashboard nav button linking to /facilitator', () => {
      setupAuth({
        user: makeUser(),
        profile: makeProfile(),
        hasRole: vi.fn().mockImplementation((role: string) => role === 'facilitator'),
      });

      renderHeader();

      const link = screen.getByRole('link', { name: 'Facilitator Dashboard' });
      expect(link).toHaveAttribute('href', '/facilitator');
    });
  });

  // ── Authenticated — admin role ─────────────────

  describe('authenticated admin', () => {
    beforeEach(() => {
      setupAuth({
        user: makeUser({ role: 'admin' }),
        profile: makeProfile(),
        hasRole: vi.fn().mockReturnValue(true),
      });
    });

    it('shows both Organisation and Facilitator Dashboard buttons', () => {
      renderHeader();

      expect(screen.getAllByRole('link', { name: 'Organisation' }).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole('link', { name: 'Facilitator Dashboard' })).toBeInTheDocument();
    });
  });

  // ── Sign out flow ──────────────────────────────

  describe('sign out', () => {
    it('calls signOut and navigates to / when Sign out is clicked', async () => {
      const mockSignOut = vi.fn().mockResolvedValue(undefined);
      setupAuth({
        user: makeUser(),
        profile: makeProfile(),
        signOut: mockSignOut,
        hasRole: vi.fn().mockReturnValue(false),
      });

      const user = userEvent.setup();
      renderHeader();

      await user.click(screen.getByLabelText('User menu'));
      await user.click(screen.getByText('Sign out'));

      expect(mockSignOut).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  // ── Initials generation ────────────────────────

  describe('initials', () => {
    it('generates two-letter initials from two-word name', () => {
      setupAuth({
        user: makeUser(),
        profile: makeProfile({ full_name: 'John Doe' }),
        hasRole: vi.fn().mockReturnValue(false),
      });

      renderHeader();

      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('falls back to User icon when profile name is null', () => {
      setupAuth({
        user: makeUser(),
        profile: makeProfile({ full_name: null }),
        hasRole: vi.fn().mockReturnValue(false),
      });

      renderHeader();

      // No initials text; User icon is rendered instead
      expect(screen.queryByText('AS')).not.toBeInTheDocument();
      expect(screen.queryByText('JD')).not.toBeInTheDocument();
    });
  });

  // ── Brand link ─────────────────────────────────

  describe('brand', () => {
    it('shows brand name linking to /', () => {
      renderHeader();

      const link = screen.getByRole('link', { name: /Fraud Risk Awareness/ });
      expect(link).toHaveAttribute('href', '/');
    });
  });
});
