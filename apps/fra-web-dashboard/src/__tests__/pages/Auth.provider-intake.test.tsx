import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Auth from '@/pages/Auth';
import { useAuth } from '@/hooks/useAuth';
import { clearPendingReturn, pendingReturn, rememberReturn } from '@/lib/pending-return';

// A new account is confirmed from an emailed link that no longer carries returnTo: the intended page is remembered.

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => mockNavigate,
}));
vi.mock('@/hooks/useAuth');
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() }, ApiError: class extends Error {} }));
vi.mock('framer-motion', () => ({
  motion: { div: ({ children, ...p }: React.HTMLAttributes<HTMLDivElement>) => <div {...p}>{children}</div> },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/pending-return', () => ({
  rememberReturn: vi.fn(),
  pendingReturn: vi.fn(() => null),
  clearPendingReturn: vi.fn(),
}));

const mockSignUp = vi.fn().mockResolvedValue({ error: null });
const auth = (overrides?: Record<string, unknown>) =>
  vi.mocked(useAuth).mockReturnValue({
    user: null, profile: null, roles: [], isLoading: false,
    signIn: vi.fn(), signUp: mockSignUp, verifyEmail: vi.fn().mockResolvedValue({ error: null }),
    joinWithKeypass: vi.fn(), signOut: vi.fn(), hasRole: vi.fn(), refreshProfile: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useAuth>);
const signedIn = { userId: 'u-1', email: 'a@b.com', name: 'A', role: 'employee', organisationId: 'o-1', createdAt: '' };
const renderAuth = (route: string) =>
  render(<MemoryRouter initialEntries={[route]}><Auth /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(pendingReturn).mockReturnValue(null);
  auth();
});

describe('Auth: applying to become a provider', () => {
  it('remembers the page being applied for when an account is created', async () => {
    const user = userEvent.setup();
    renderAuth('/auth?mode=signup&returnTo=%2Fprovider-application');
    await user.type(screen.getByLabelText('Full Name'), 'Alice Smith');
    await user.type(screen.getByLabelText('Organisation Name'), 'Alice Training');
    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'StrongPass123');
    await user.type(screen.getByLabelText('Confirm Password'), 'StrongPass123');
    await user.click(screen.getByRole('button', { name: /Create Account/i }));
    await waitFor(() => expect(rememberReturn).toHaveBeenCalledWith('/provider-application'));
    expect(await screen.findByText('Check your email')).toBeInTheDocument();
  });

  it('does not remember anything when the sign-up was refused', async () => {
    mockSignUp.mockResolvedValueOnce({ error: new Error('no') });
    const user = userEvent.setup();
    renderAuth('/auth?mode=signup&returnTo=%2Fprovider-application');
    await user.type(screen.getByLabelText('Full Name'), 'Alice Smith');
    await user.type(screen.getByLabelText('Organisation Name'), 'Alice Training');
    await user.type(screen.getByLabelText('Email'), 'alice@example.com');
    await user.type(screen.getByLabelText('Password'), 'StrongPass123');
    await user.type(screen.getByLabelText('Confirm Password'), 'StrongPass123');
    await user.click(screen.getByRole('button', { name: /Create Account/i }));
    await waitFor(() => expect(mockSignUp).toHaveBeenCalled());
    expect(rememberReturn).not.toHaveBeenCalled();
  });

  it('after the emailed link confirms the account, goes to the remembered application and forgets it', () => {
    vi.mocked(pendingReturn).mockReturnValue('/provider-application');
    auth({ user: signedIn });
    renderAuth('/auth?mode=verify&token=abc');
    expect(mockNavigate).toHaveBeenCalledWith('/provider-application');
    expect(clearPendingReturn).toHaveBeenCalled();
  });

  it('stays on the remembered page when the sign-in page renders again after clearing it', () => {
    // Storage that really clears: the first read finds the path, every later read finds nothing. A page that
    // recomputed its destination on each render would then send the user on to the dashboard.
    let stored: string | null = '/provider-application';
    vi.mocked(pendingReturn).mockImplementation(() => stored);
    vi.mocked(clearPendingReturn).mockImplementation(() => {
      stored = null;
    });
    auth({ user: signedIn });
    const view = renderAuth('/auth?mode=verify&token=abc');
    expect(mockNavigate).toHaveBeenCalledWith('/provider-application');
    view.rerender(<MemoryRouter initialEntries={['/auth?mode=verify&token=abc']}><Auth /></MemoryRouter>);
    auth({ user: { ...signedIn, name: 'A (refreshed)' } }); // the account refreshes while the page is still mounted
    view.rerender(<MemoryRouter initialEntries={['/auth?mode=verify&token=abc']}><Auth /></MemoryRouter>);
    expect(mockNavigate).not.toHaveBeenCalledWith('/dashboard');
    expect(mockNavigate.mock.calls.every(([path]) => path === '/provider-application')).toBe(true);
  });

  it('an explicit returnTo wins over the remembered one, and nothing remembered means the dashboard', () => {
    vi.mocked(pendingReturn).mockReturnValue('/provider-application');
    auth({ user: signedIn });
    renderAuth('/auth?returnTo=%2Fcompliance');
    expect(mockNavigate).toHaveBeenCalledWith('/compliance');
    mockNavigate.mockClear();
    vi.mocked(pendingReturn).mockReturnValue(null);
    renderAuth('/auth');
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});
