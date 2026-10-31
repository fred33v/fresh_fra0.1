import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Join from '@/pages/Join';
import { useAuth } from '@/hooks/useAuth';
import { ApiError } from '@/lib/api';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/hooks/useAuth');

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockJoin = vi.fn();

function setupAuth(overrides?: Record<string, unknown>) {
  mockedUseAuth.mockReturnValue({
    user: null,
    profile: null,
    roles: [] as never[],
    isLoading: false,
    joinWithKeypass: mockJoin,
    signIn: vi.fn(),
    signUp: vi.fn(),
    verifyEmail: vi.fn(),
    signOut: vi.fn(),
    hasRole: vi.fn(),
    refreshProfile: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useAuth>);
}

function renderJoin(route = '/join') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Join />
    </MemoryRouter>,
  );
}

const PASSWORD = 'Employee-Pass-2026';

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, overrides: { code?: string; email?: string; password?: string; confirm?: string; name?: string } = {}) {
  if (overrides.code !== undefined) {
    const code = screen.getByLabelText('Key-pass');
    await user.clear(code);
    if (overrides.code) await user.type(code, overrides.code);
  }
  if (overrides.name) await user.type(screen.getByLabelText(/Your name/), overrides.name);
  await user.type(screen.getByLabelText('Work email'), overrides.email ?? 'sam@acme.example');
  await user.type(screen.getByLabelText('Choose a password'), overrides.password ?? PASSWORD);
  await user.type(screen.getByLabelText('Confirm password'), overrides.confirm ?? overrides.password ?? PASSWORD);
  await user.click(screen.getByRole('button', { name: 'Join' }));
}

describe('Join page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJoin.mockResolvedValue({ error: null });
    setupAuth();
  });

  it('has one main heading and the form fields', () => {
    renderJoin();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Join your organisation' })).toBeInTheDocument();
    for (const label of ['Key-pass', 'Work email', 'Choose a password', 'Confirm password']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
  });

  it('keeps the headings in order: one h1, then the card title as an h2', () => {
    renderJoin();
    expect(screen.getByRole('heading', { level: 2, name: 'Use your key-pass' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
  });

  it('fills in the code from the link, ignoring case and dashes', () => {
    renderJoin('/join?code=k7qx-4mpa-9wtd');
    expect(screen.getByLabelText('Key-pass')).toHaveValue('K7QX4MPA9WTD');
  });

  it('sends the cleaned-up code, email and password, then goes to the dashboard', async () => {
    const user = userEvent.setup();
    renderJoin();
    await fillAndSubmit(user, { code: 'k7qx 4mpa-9wtd', name: ' Sam ', email: 'sam@acme.example' });

    await waitFor(() => expect(mockJoin).toHaveBeenCalledTimes(1));
    expect(mockJoin).toHaveBeenCalledWith({ code: 'K7QX4MPA9WTD', email: 'sam@acme.example', password: PASSWORD, name: 'Sam' });
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'));
  });

  it('does not send a weak password', async () => {
    const user = userEvent.setup();
    renderJoin('/join?code=K7QX4MPA9WTD');
    await fillAndSubmit(user, { password: 'short' });
    expect(await screen.findByText('Password must be at least 12 characters')).toBeInTheDocument();
    expect(mockJoin).not.toHaveBeenCalled();
  });

  it('does not send mismatched passwords', async () => {
    const user = userEvent.setup();
    renderJoin('/join?code=K7QX4MPA9WTD');
    await fillAndSubmit(user, { confirm: 'Different-Pass-2026' });
    expect(await screen.findByText("Passwords don't match")).toBeInTheDocument();
    expect(mockJoin).not.toHaveBeenCalled();
  });

  it('asks for a code when it is missing', async () => {
    const user = userEvent.setup();
    renderJoin();
    await fillAndSubmit(user, { code: '' });
    expect(await screen.findByText('Enter the key-pass your employer gave you')).toBeInTheDocument();
    expect(mockJoin).not.toHaveBeenCalled();
  });

  it.each([
    ['NOT_FOUND', /don't recognise that key-pass/],
    ['EXPIRED', /key-pass has expired/],
    ['NOT_AVAILABLE', /already been used or was withdrawn/],
    ['ALREADY_USED', /already been used or was withdrawn/],
    ['PACKAGE_INACTIVE', /package is no longer active/],
    ['RATE_LIMITED', /Too many attempts/],
    ['VALIDATION_ERROR', /check your details/],
    ['SOMETHING_ELSE', /could not add you just now/],
  ])('explains a refused code (%s) in an alert and stays on the page', async (code, message) => {
    mockJoin.mockResolvedValue({ error: new ApiError(code, 'server text') });
    const user = userEvent.setup();
    renderJoin('/join?code=K7QX4MPA9WTD');
    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('points to sign in when the email already has an account', async () => {
    mockJoin.mockResolvedValue({ error: new ApiError('ACCOUNT_EXISTS', 'exists') });
    const user = userEvent.setup();
    renderJoin('/join?code=K7QX4MPA9WTD');
    await fillAndSubmit(user);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/already exists/);
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/auth');
  });

  it('shows a network failure as a generic message', async () => {
    mockJoin.mockResolvedValue({ error: new Error('boom') });
    const user = userEvent.setup();
    renderJoin('/join?code=K7QX4MPA9WTD');
    await fillAndSubmit(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not add you just now/);
  });

  it('tells a signed-in person instead of showing the form', () => {
    setupAuth({ user: { userId: 'u1', email: 'boss@acme.example', name: 'Boss', role: 'employer', organisationId: 'o1', createdAt: '2026-01-01' } });
    renderJoin();
    expect(screen.getByText(/signed in as boss@acme.example/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Key-pass')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to your dashboard' })).toHaveAttribute('href', '/dashboard');
  });

  it('fills in and locks the address an invitation was sent to', async () => {
    const user = userEvent.setup();
    renderJoin('/join?code=K7QX4MPA9WTD&email=alex%40acme.example');
    const email = screen.getByLabelText('Work email');
    expect(email).toHaveValue('alex@acme.example');
    expect(email).toHaveAttribute('readonly');
    await user.type(screen.getByLabelText('Choose a password'), PASSWORD);
    await user.type(screen.getByLabelText('Confirm password'), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Join' }));
    await waitFor(() => expect(mockJoin).toHaveBeenCalledWith(expect.objectContaining({ email: 'alex@acme.example' })));
  });

  it('explains when the key-pass was sent to another address', async () => {
    mockJoin.mockResolvedValue({ error: new ApiError('EMAIL_MISMATCH', 'mismatch') });
    const user = userEvent.setup();
    renderJoin('/join?code=K7QX4MPA9WTD');
    await fillAndSubmit(user);
    expect(await screen.findByRole('alert')).toHaveTextContent(/sent to a different email address/);
  });
});

