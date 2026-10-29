import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Auth from '@/pages/Auth';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiError } from '@/lib/api';

// ── Mocks ──────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/hooks/useAuth');

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
  ApiError: class ApiError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
      this.name = 'ApiError';
    }
  },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedApi = vi.mocked(api);

// ── Helpers ────────────────────────────────────────────────

const mockSignIn = vi.fn().mockResolvedValue({ error: null });
const mockSignUp = vi.fn().mockResolvedValue({ error: null });
const mockVerifyEmail = vi.fn().mockResolvedValue({ error: null });

function setupAuth(overrides?: Record<string, unknown>) {
  mockedUseAuth.mockReturnValue({
    user: null,
    profile: null,
    roles: [] as never[],
    isLoading: false,
    signIn: mockSignIn,
    signUp: mockSignUp,
    verifyEmail: mockVerifyEmail,
    signOut: vi.fn(),
    hasRole: vi.fn(),
    refreshProfile: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useAuth>);
}

function renderAuth(initialRoute = '/auth') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Auth />
    </MemoryRouter>,
  );
}

// ── Tests ──────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth();
});

describe('Auth', () => {
  // ── Redirect if authenticated ─────────────────

  describe('redirect if authenticated', () => {
    it('returns to the page that asked for sign-in', () => {
      setupAuth({
        user: { userId: 'u-1', email: 'a@b.com', name: 'A', role: 'employee', organisationId: 'o-1', createdAt: '' },
      });
      renderAuth('/auth?returnTo=%2Fcompliance%3Ftab%3Dincidents');
      expect(mockNavigate).toHaveBeenCalledWith('/compliance?tab=incidents');
    });

    it.each(['https://evil.example', '//evil.example', '/\\evil.example', 'compliance', '/auth?returnTo=%2Fx'])(
      'ignores an unsafe return address (%s) and goes to the dashboard', (target) => {
        setupAuth({
          user: { userId: 'u-1', email: 'a@b.com', name: 'A', role: 'employee', organisationId: 'o-1', createdAt: '' },
        });
        renderAuth(`/auth?returnTo=${encodeURIComponent(target)}`);
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      });

    it('navigates to /dashboard when user exists', () => {
      setupAuth({
        user: { userId: 'u-1', email: 'a@b.com', name: 'A', role: 'employee', organisationId: 'o-1', createdAt: '' },
      });

      renderAuth();

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    it('navigates to checkout for the chosen package when ?package= is set', () => {
      setupAuth({
        user: { userId: 'u-1', email: 'a@b.com', name: 'A', role: 'employee', organisationId: 'o-1', createdAt: '' },
      });

      renderAuth('/auth?mode=signup&package=enterprise');

      expect(mockNavigate).toHaveBeenCalledWith('/checkout?package=Enterprise');
    });

    it('ignores an unknown ?package= value', () => {
      setupAuth({
        user: { userId: 'u-1', email: 'a@b.com', name: 'A', role: 'employee', organisationId: 'o-1', createdAt: '' },
      });

      renderAuth('/auth?package=not-a-package');

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  // ── Sign in mode (default) ────────────────────

  describe('sign in mode', () => {
    it('shows sign in form by default', () => {
      renderAuth();

      expect(screen.getByText('Welcome back')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByLabelText('Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
    });

    it('calls signIn and navigates on successful login', async () => {
      const { toast } = await import('sonner');
      const user = userEvent.setup();
      renderAuth();

      await user.type(screen.getByLabelText('Email'), 'alice@example.com');
      await user.type(screen.getByLabelText('Password'), 'Password123');
      await user.click(screen.getByRole('button', { name: /Sign In/i }));

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith('alice@example.com', 'Password123');
      });
      expect(toast.success).toHaveBeenCalledWith('Welcome back!');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    it('shows error toast on INVALID_CREDENTIALS', async () => {
      const { toast } = await import('sonner');
      mockSignIn.mockResolvedValueOnce({ error: new ApiError('Bad', 'INVALID_CREDENTIALS') });

      const user = userEvent.setup();
      renderAuth();

      await user.type(screen.getByLabelText('Email'), 'alice@example.com');
      await user.type(screen.getByLabelText('Password'), 'WrongPass1');
      await user.click(screen.getByRole('button', { name: /Sign In/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Invalid email or password');
      });
    });

    it('shows error toast on ACCOUNT_LOCKED', async () => {
      const { toast } = await import('sonner');
      mockSignIn.mockResolvedValueOnce({ error: new ApiError('Locked', 'ACCOUNT_LOCKED') });

      const user = userEvent.setup();
      renderAuth();

      await user.type(screen.getByLabelText('Email'), 'alice@example.com');
      await user.type(screen.getByLabelText('Password'), 'SomePass1');
      await user.click(screen.getByRole('button', { name: /Sign In/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Account temporarily locked. Please try again later.');
      });
    });

    it('shows generic error toast on unknown error', async () => {
      const { toast } = await import('sonner');
      mockSignIn.mockResolvedValueOnce({ error: new Error('Network') });

      const user = userEvent.setup();
      renderAuth();

      await user.type(screen.getByLabelText('Email'), 'alice@example.com');
      await user.type(screen.getByLabelText('Password'), 'SomePass1');
      await user.click(screen.getByRole('button', { name: /Sign In/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Sign in failed. Please try again.');
      });
    });

    it('shows "Forgot your password?" link that switches to forgot mode', async () => {
      const user = userEvent.setup();
      renderAuth();

      await user.click(screen.getByText('Forgot your password?'));

      expect(screen.getByText('Reset your password')).toBeInTheDocument();
    });

    it('shows "Create one" link that switches to signup mode', async () => {
      const user = userEvent.setup();
      renderAuth();

      await user.click(screen.getByText('Create one'));

      expect(screen.getByText('Create an account')).toBeInTheDocument();
    });
  });

  // ── Sign up mode ──────────────────────────────

  describe('sign up mode', () => {
    it('shows sign up form when ?mode=signup', () => {
      renderAuth('/auth?mode=signup');

      expect(screen.getByText('Create an account')).toBeInTheDocument();
      expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Organisation Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Sector')).toBeInTheDocument();
    });

    it('calls signUp with correct data on successful registration', async () => {
      const { toast } = await import('sonner');
      const user = userEvent.setup();
      renderAuth('/auth?mode=signup');

      await user.type(screen.getByLabelText('Full Name'), 'Alice Smith');
      await user.type(screen.getByLabelText('Organisation Name'), 'Test Org');
      await user.type(screen.getByLabelText('Email'), 'alice@example.com');
      await user.type(screen.getByLabelText('Password'), 'StrongPass123');
      await user.type(screen.getByLabelText('Confirm Password'), 'StrongPass123');
      await user.click(screen.getByRole('button', { name: /Create Account/i }));

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith('alice@example.com', 'StrongPass123', {
          full_name: 'Alice Smith',
          organization_name: 'Test Org',
          sector: 'private',
          job_title: '',
        });
      });
      // Signing in waits for the emailed link
      expect(await screen.findByText('Check your email')).toBeInTheDocument();
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('sends a new confirmation link from the "check your email" screen', async () => {
      const { toast } = await import('sonner');
      mockedApi.post.mockResolvedValueOnce({});
      const user = userEvent.setup();
      renderAuth('/auth?mode=signup');

      await user.type(screen.getByLabelText('Full Name'), 'Alice Smith');
      await user.type(screen.getByLabelText('Organisation Name'), 'Test Org');
      await user.type(screen.getByLabelText('Email'), 'alice@example.com');
      await user.type(screen.getByLabelText('Password'), 'StrongPass123');
      await user.type(screen.getByLabelText('Confirm Password'), 'StrongPass123');
      await user.click(screen.getByRole('button', { name: /Create Account/i }));
      await user.click(await screen.findByRole('button', { name: /Send a new link/i }));

      await waitFor(() => {
        expect(mockedApi.post).toHaveBeenCalledWith('/api/v1/auth/resend-verification', { email: 'alice@example.com' });
      });
      expect(toast.success).toHaveBeenCalled();
    });

    it('shows error toast on signup failure', async () => {
      const { toast } = await import('sonner');
      mockSignUp.mockResolvedValueOnce({ error: new Error('Failed') });

      const user = userEvent.setup();
      renderAuth('/auth?mode=signup');

      await user.type(screen.getByLabelText('Full Name'), 'Alice Smith');
      await user.type(screen.getByLabelText('Organisation Name'), 'Test Org');
      await user.type(screen.getByLabelText('Email'), 'alice@example.com');
      await user.type(screen.getByLabelText('Password'), 'StrongPass123');
      await user.type(screen.getByLabelText('Confirm Password'), 'StrongPass123');
      await user.click(screen.getByRole('button', { name: /Create Account/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Registration failed. Please try again.');
      });
    });

    it('shows "Sign in" link that switches back', async () => {
      const user = userEvent.setup();
      renderAuth('/auth?mode=signup');

      await user.click(screen.getByText('Sign in'));

      expect(screen.getByText('Welcome back')).toBeInTheDocument();
    });
  });

  // ── Forgot password mode ──────────────────────

  describe('forgot password mode', () => {
    it('shows forgot password form when ?mode=forgot', () => {
      renderAuth('/auth?mode=forgot');

      expect(screen.getByText('Reset your password')).toBeInTheDocument();
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Send Reset Link/i })).toBeInTheDocument();
    });

    it('shows success message after submitting email', async () => {
      mockedApi.post.mockResolvedValueOnce(undefined);

      const user = userEvent.setup();
      renderAuth('/auth?mode=forgot');

      await user.type(screen.getByLabelText('Email'), 'alice@example.com');
      await user.click(screen.getByRole('button', { name: /Send Reset Link/i }));

      await waitFor(() => {
        expect(screen.getByText(/If an account with that email exists/)).toBeInTheDocument();
      });
    });

    it('shows success message even on API error (prevents email enumeration)', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('Not found'));

      const user = userEvent.setup();
      renderAuth('/auth?mode=forgot');

      await user.type(screen.getByLabelText('Email'), 'unknown@example.com');
      await user.click(screen.getByRole('button', { name: /Send Reset Link/i }));

      await waitFor(() => {
        expect(screen.getByText(/If an account with that email exists/)).toBeInTheDocument();
      });
    });

    it('Back to Sign In button returns to sign in mode', async () => {
      mockedApi.post.mockResolvedValueOnce(undefined);

      const user = userEvent.setup();
      renderAuth('/auth?mode=forgot');

      await user.type(screen.getByLabelText('Email'), 'alice@example.com');
      await user.click(screen.getByRole('button', { name: /Send Reset Link/i }));

      await waitFor(() => {
        expect(screen.getByText('Back to Sign In')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Back to Sign In'));

      expect(screen.getByText('Welcome back')).toBeInTheDocument();
    });
  });

  // ── Reset password mode ───────────────────────

  describe('reset password mode', () => {
    it('shows reset form when ?mode=reset', () => {
      renderAuth('/auth?mode=reset');

      expect(screen.getByText('Set a new password')).toBeInTheDocument();
      expect(screen.getByLabelText('Reset code')).toBeVisible();
      expect(screen.getByLabelText('New Password')).toBeInTheDocument();
      expect(screen.getByLabelText('Confirm New Password')).toBeInTheDocument();
    });

    it('takes the token from the emailed link and only asks for the new password', () => {
      renderAuth('/auth?mode=reset&token=abc123');

      expect(screen.getByText('Choose a new password for your account')).toBeInTheDocument();
      // Still in the form, so it is sent with the new password, but not shown
      expect(screen.getByLabelText('Reset code')).toHaveValue('abc123');
      expect(screen.getByLabelText('Reset code').closest('.hidden')).not.toBeNull();
    });

    it('shows success message on successful reset', async () => {
      const { toast } = await import('sonner');
      mockedApi.post.mockResolvedValueOnce(undefined);

      const user = userEvent.setup();
      renderAuth('/auth?mode=reset&token=valid-token');

      await user.type(screen.getByLabelText('New Password'), 'NewStrongPass1');
      await user.type(screen.getByLabelText('Confirm New Password'), 'NewStrongPass1');
      await user.click(screen.getByRole('button', { name: /Reset Password/i }));

      await waitFor(() => {
        expect(screen.getByText(/password has been reset successfully/)).toBeInTheDocument();
      });
      expect(toast.success).toHaveBeenCalledWith('Password reset successfully');
    });

    it('shows error toast on INVALID_TOKEN', async () => {
      const { toast } = await import('sonner');
      mockedApi.post.mockRejectedValueOnce(new ApiError('Bad token', 'INVALID_TOKEN'));

      const user = userEvent.setup();
      renderAuth('/auth?mode=reset&token=expired-token');

      await user.type(screen.getByLabelText('New Password'), 'NewStrongPass1');
      await user.type(screen.getByLabelText('Confirm New Password'), 'NewStrongPass1');
      await user.click(screen.getByRole('button', { name: /Reset Password/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Invalid or expired reset link. Please request a new one.');
      });
    });

    it('Sign In button after success switches to sign in mode', async () => {
      mockedApi.post.mockResolvedValueOnce(undefined);

      const user = userEvent.setup();
      renderAuth('/auth?mode=reset&token=valid-token');

      await user.type(screen.getByLabelText('New Password'), 'NewStrongPass1');
      await user.type(screen.getByLabelText('Confirm New Password'), 'NewStrongPass1');
      await user.click(screen.getByRole('button', { name: /Reset Password/i }));

      await waitFor(() => {
        expect(screen.getByText(/password has been reset successfully/)).toBeInTheDocument();
      });

      // The "Sign In" button in the success state
      await user.click(screen.getByRole('button', { name: 'Sign In' }));

      expect(screen.getByText('Welcome back')).toBeInTheDocument();
    });
  });

  // ── Branding panel ────────────────────────────

  describe('page heading', () => {
    it('has a heading for small screens, where the branding panel with the main heading is hidden', () => {
      setupAuth();
      renderAuth();
      const small = screen.getByRole('heading', { level: 1, name: 'Sign in or create an account' });
      expect(small).toHaveClass('sr-only', 'lg:hidden');
      // The card title sits under it as an h2, not an h3
      expect(screen.getByRole('heading', { level: 2, name: 'Welcome back' })).toBeInTheDocument();
    });
  });

  describe('branding panel', () => {
    it('shows Back to Home button that navigates to /', async () => {
      const user = userEvent.setup();
      renderAuth();

      await user.click(screen.getByText('Back to Home'));

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('displays branding text', () => {
      renderAuth();

      expect(screen.getByText('Fraud Risk Awareness')).toBeInTheDocument();
    });
  });

  describe('confirmation link', () => {
    it('confirms the token from the link', async () => {
      const { toast } = await import('sonner');
      renderAuth('/auth?mode=verify&token=tok-123');
      await waitFor(() => expect(mockVerifyEmail).toHaveBeenCalledWith('tok-123'));
      expect(mockVerifyEmail).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Email confirmed. Welcome!'));
    });

    it('offers a new link when the token has expired', async () => {
      mockVerifyEmail.mockResolvedValueOnce({ error: new ApiError('expired', 'INVALID_TOKEN') });
      renderAuth('/auth?mode=verify&token=old');
      expect(await screen.findByText('This link has expired')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Send a new link/i })).toBeInTheDocument();
    });
  });

  it('shows the "check your email" screen when signing in before confirming', async () => {
    mockSignIn.mockResolvedValueOnce({ error: new ApiError('Please confirm', 'EMAIL_NOT_VERIFIED') });
    const user = userEvent.setup();
    renderAuth('/auth');
    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'StrongPass123');
    await user.click(screen.getByRole('button', { name: /^Sign In$/i }));
    expect(await screen.findByText('Check your email')).toBeInTheDocument();
  });
});
