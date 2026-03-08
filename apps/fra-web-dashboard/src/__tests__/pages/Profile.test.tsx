import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Profile from '@/pages/Profile';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

// ── Mocks ──────────────────────────────────────────────────

vi.mock('@/hooks/useAuth');

vi.mock('@/lib/api', () => ({
  api: { patch: vi.fn() },
}));

vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));

const mockToast = vi.fn();
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedApi = vi.mocked(api);

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
    organization_name: 'Test Organisation',
    sector: 'public' as const,
    job_title: 'Finance Director',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function setupAuth(overrides?: Record<string, unknown>) {
  mockedUseAuth.mockReturnValue({
    user: makeUser(),
    profile: makeProfile(),
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

function renderProfile() {
  return render(
    <MemoryRouter>
      <Profile />
    </MemoryRouter>,
  );
}

// ── Tests ──────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  setupAuth();
  // Prevent actual page reload
  Object.defineProperty(window, 'location', {
    value: { ...window.location, reload: vi.fn() },
    writable: true,
  });
});

describe('Profile', () => {
  // ── Auth guard ──────────────────────────────────

  describe('auth guard', () => {
    it('renders null when user is null', () => {
      setupAuth({ user: null });

      const { container } = renderProfile();

      expect(container.querySelector('[data-testid="layout"]')).toBeNull();
    });
  });

  // ── Display mode ────────────────────────────────

  describe('display mode', () => {
    it('shows user name from profile', () => {
      renderProfile();

      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    });

    it('falls back to user.name when profile is null', () => {
      setupAuth({ profile: null, user: makeUser({ name: 'Bob Jones' }) });

      renderProfile();

      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    });

    it('falls back to "User" when both names are missing', () => {
      setupAuth({ profile: null, user: makeUser({ name: '' }) });

      renderProfile();

      expect(screen.getByText('User')).toBeInTheDocument();
    });

    it('shows email address', () => {
      renderProfile();

      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    it('shows role badge as Participant for employee', () => {
      renderProfile();

      // Appears in header badge and Account Details section
      expect(screen.getAllByText('Participant').length).toBe(2);
    });

    it('shows role badge as Employer', () => {
      setupAuth({ user: makeUser({ role: 'employer' }) });

      renderProfile();

      expect(screen.getAllByText('Employer').length).toBe(2);
    });

    it('shows role badge as Admin', () => {
      setupAuth({ user: makeUser({ role: 'admin' }) });

      renderProfile();

      expect(screen.getAllByText('Admin').length).toBe(2);
    });

    it('shows organisation name from profile', () => {
      renderProfile();

      expect(screen.getByText('Test Organisation')).toBeInTheDocument();
    });

    it('hides organisation when profile has no organization_name', () => {
      setupAuth({ profile: makeProfile({ organization_name: null }) });

      renderProfile();

      expect(screen.queryByText('Organisation')).not.toBeInTheDocument();
    });

    it('shows Edit Profile button', () => {
      renderProfile();

      expect(screen.getByText('Edit Profile')).toBeInTheDocument();
    });
  });

  // ── Edit mode ───────────────────────────────────

  describe('edit mode', () => {
    it('shows edit form when Edit Profile is clicked', async () => {
      const user = userEvent.setup();
      renderProfile();

      await user.click(screen.getByText('Edit Profile'));

      expect(screen.getByText('Edit Profile')).toBeInTheDocument();
      expect(screen.getByLabelText('Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Department')).toBeInTheDocument();
    });

    it('pre-fills name from display name', async () => {
      const user = userEvent.setup();
      renderProfile();

      await user.click(screen.getByText('Edit Profile'));

      expect(screen.getByLabelText('Name')).toHaveValue('Alice Smith');
    });

    it('Cancel button returns to display mode', async () => {
      const user = userEvent.setup();
      renderProfile();

      await user.click(screen.getByText('Edit Profile'));
      await user.click(screen.getByText('Cancel'));

      expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    });

    it('Save button is disabled when name is empty', async () => {
      const user = userEvent.setup();
      renderProfile();

      await user.click(screen.getByText('Edit Profile'));
      await user.clear(screen.getByLabelText('Name'));

      expect(screen.getByText('Save Changes')).toBeDisabled();
    });

    it('exits edit mode without API call when no changes', async () => {
      const user = userEvent.setup();
      renderProfile();

      await user.click(screen.getByText('Edit Profile'));
      await user.click(screen.getByText('Save Changes'));

      expect(mockedApi.patch).not.toHaveBeenCalled();
      expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    });
  });

  // ── Save profile ────────────────────────────────

  describe('save profile', () => {
    it('calls API with name change and shows success toast', async () => {
      mockedApi.patch.mockResolvedValueOnce({} as never);
      const user = userEvent.setup();
      renderProfile();

      await user.click(screen.getByText('Edit Profile'));
      await user.clear(screen.getByLabelText('Name'));
      await user.type(screen.getByLabelText('Name'), 'New Name');
      await user.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(mockedApi.patch).toHaveBeenCalledWith('/api/v1/auth/profile', { name: 'New Name' });
      });
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Profile updated' }),
      );
    });

    it('calls API with department change', async () => {
      mockedApi.patch.mockResolvedValueOnce({} as never);
      const user = userEvent.setup();
      renderProfile();

      await user.click(screen.getByText('Edit Profile'));
      await user.type(screen.getByLabelText('Department'), 'Finance');
      await user.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(mockedApi.patch).toHaveBeenCalledWith('/api/v1/auth/profile', { department: 'Finance' });
      });
    });

    it('shows error toast when save fails', async () => {
      mockedApi.patch.mockRejectedValueOnce(new Error('Server error'));
      const user = userEvent.setup();
      renderProfile();

      await user.click(screen.getByText('Edit Profile'));
      await user.clear(screen.getByLabelText('Name'));
      await user.type(screen.getByLabelText('Name'), 'New Name');
      await user.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({ title: 'Update failed', variant: 'destructive' }),
        );
      });
    });

    it('reloads page after successful save', async () => {
      mockedApi.patch.mockResolvedValueOnce({} as never);
      const user = userEvent.setup();
      renderProfile();

      await user.click(screen.getByText('Edit Profile'));
      await user.clear(screen.getByLabelText('Name'));
      await user.type(screen.getByLabelText('Name'), 'New Name');
      await user.click(screen.getByText('Save Changes'));

      await waitFor(() => {
        expect(window.location.reload).toHaveBeenCalled();
      });
    });
  });
});
