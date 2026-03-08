import { renderHook, act, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { AuthProvider, useAuth, AuthUser } from '@/hooks/useAuth';
import { api, setTokens, clearTokens, hasStoredTokens, getRefreshToken } from '@/lib/api';
import { Profile } from '@/types/workshop';

// ── Mocks ──────────────────────────────────────────────────

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  setTokens: vi.fn(),
  clearTokens: vi.fn(),
  hasStoredTokens: vi.fn(),
  getRefreshToken: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

const mockApi = vi.mocked(api);
const mockSetTokens = vi.mocked(setTokens);
const mockClearTokens = vi.mocked(clearTokens);
const mockHasStoredTokens = vi.mocked(hasStoredTokens);
const mockGetRefreshToken = vi.mocked(getRefreshToken);

// ── Helpers ────────────────────────────────────────────────

function makeUser(overrides?: Partial<AuthUser>): AuthUser {
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

function makeProfile(): Profile {
  return {
    id: 'p-1',
    user_id: 'u-1',
    full_name: 'Alice Smith',
    organization_name: 'Test Org',
    sector: 'public',
    job_title: 'Director',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
  };
}

function makeMeResponse(overrides?: Record<string, unknown>) {
  return {
    ...makeUser(),
    profile: {
      id: 'p-1',
      user_id: 'u-1',
      full_name: 'Alice Smith',
      organization_name: 'Test Org',
      sector: 'public' as const,
      job_title: 'Director',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    workshopRoles: ['participant'],
    ...overrides,
  };
}

function makeAuthResponse(overrides?: Record<string, unknown>) {
  return {
    user: makeUser(),
    organisation: { organisationId: 'org-1', name: 'Test Org' },
    accessToken: 'at-new',
    refreshToken: 'rt-new',
    profile: {
      id: 'p-1',
      user_id: 'u-1',
      full_name: 'Alice Smith',
      organization_name: 'Test Org',
      sector: 'public' as const,
      job_title: 'Director',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    },
    workshopRoles: ['participant'],
    ...overrides,
  };
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

// ── Tests ──────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockHasStoredTokens.mockReturnValue(false);
});

describe('AuthProvider', () => {
  // ── Initial state ───────────────────────────────

  describe('initial state', () => {
    it('sets isLoading false immediately when no stored tokens', async () => {
      mockHasStoredTokens.mockReturnValue(false);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.user).toBeNull();
      expect(result.current.profile).toBeNull();
      expect(result.current.roles).toEqual([]);
    });

    it('hydrates user from /me when stored tokens exist', async () => {
      mockHasStoredTokens.mockReturnValue(true);
      mockApi.get.mockResolvedValueOnce(makeMeResponse());

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.user).toEqual(makeUser());
      expect(result.current.profile).toEqual(makeProfile());
      expect(result.current.roles).toEqual(['participant']);
    });

    it('clears tokens and sets null state when hydration fails', async () => {
      mockHasStoredTokens.mockReturnValue(true);
      mockApi.get.mockRejectedValueOnce(new Error('Unauthorized'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(mockClearTokens).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
      expect(result.current.profile).toBeNull();
      expect(result.current.roles).toEqual([]);
    });

    it('handles null profile in /me response', async () => {
      mockHasStoredTokens.mockReturnValue(true);
      mockApi.get.mockResolvedValueOnce(makeMeResponse({ profile: null }));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.user).toEqual(makeUser());
      expect(result.current.profile).toBeNull();
    });

    it('defaults to empty roles when workshopRoles is missing', async () => {
      mockHasStoredTokens.mockReturnValue(true);
      mockApi.get.mockResolvedValueOnce(makeMeResponse({ workshopRoles: undefined }));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.roles).toEqual([]);
    });
  });

  // ── signUp ──────────────────────────────────────

  describe('signUp', () => {
    it('calls /auth/signup, sets tokens, user, profile and roles', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const authResp = makeAuthResponse();
      mockApi.post.mockResolvedValueOnce(authResp);

      let response: { error: Error | null } | undefined;
      await act(async () => {
        response = await result.current.signUp('alice@example.com', 'Password123', {
          full_name: 'Alice Smith',
          organization_name: 'Test Org',
          sector: 'public',
          job_title: 'Director',
        });
      });

      expect(response!.error).toBeNull();
      expect(mockApi.post).toHaveBeenCalledWith('/api/v1/auth/signup', {
        email: 'alice@example.com',
        password: 'Password123',
        name: 'Alice Smith',
        organisationName: 'Test Org',
        jobTitle: 'Director',
        sector: 'public',
        workshopRole: 'participant',
      });
      expect(mockSetTokens).toHaveBeenCalledWith('at-new', 'rt-new');
      expect(result.current.user).toEqual(makeUser());
      expect(result.current.profile).toEqual(makeProfile());
      expect(result.current.roles).toEqual(['participant']);
    });

    it('defaults roles to participant when workshopRoles is missing', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      mockApi.post.mockResolvedValueOnce(makeAuthResponse({ workshopRoles: undefined }));

      await act(async () => {
        await result.current.signUp('a@b.com', 'Pass1234567', {
          full_name: 'Test',
          organization_name: 'Org',
          sector: 'private',
        });
      });

      expect(result.current.roles).toEqual(['participant']);
    });

    it('returns error on signup failure', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const signUpError = new Error('Email already in use');
      mockApi.post.mockRejectedValueOnce(signUpError);

      let response: { error: Error | null } | undefined;
      await act(async () => {
        response = await result.current.signUp('a@b.com', 'Pass1234567', {
          full_name: 'Test',
          organization_name: 'Org',
          sector: 'charity',
        });
      });

      expect(response!.error).toBe(signUpError);
      expect(result.current.user).toBeNull();
    });

    it('handles signup without profile in response', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      mockApi.post.mockResolvedValueOnce(makeAuthResponse({ profile: null }));

      await act(async () => {
        await result.current.signUp('a@b.com', 'Pass1234567', {
          full_name: 'Test',
          organization_name: 'Org',
          sector: 'private',
        });
      });

      expect(result.current.user).toEqual(makeUser());
      expect(result.current.profile).toBeNull();
    });
  });

  // ── signIn ──────────────────────────────────────

  describe('signIn', () => {
    it('calls /auth/login, sets tokens, then hydrates from /me', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const loginResp = makeAuthResponse();
      mockApi.post.mockResolvedValueOnce(loginResp);
      mockApi.get.mockResolvedValueOnce(makeMeResponse());

      let response: { error: Error | null } | undefined;
      await act(async () => {
        response = await result.current.signIn('alice@example.com', 'Password123');
      });

      expect(response!.error).toBeNull();
      expect(mockApi.post).toHaveBeenCalledWith('/api/v1/auth/login', {
        email: 'alice@example.com',
        password: 'Password123',
      });
      expect(mockSetTokens).toHaveBeenCalledWith('at-new', 'rt-new');
      // After hydrate from /me
      expect(mockApi.get).toHaveBeenCalledWith('/api/v1/auth/me');
      expect(result.current.user).toEqual(makeUser());
      expect(result.current.profile).toEqual(makeProfile());
    });

    it('returns error on login failure', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const loginError = new Error('Invalid credentials');
      mockApi.post.mockRejectedValueOnce(loginError);

      let response: { error: Error | null } | undefined;
      await act(async () => {
        response = await result.current.signIn('wrong@example.com', 'bad');
      });

      expect(response!.error).toBe(loginError);
      expect(result.current.user).toBeNull();
    });
  });

  // ── signOut ─────────────────────────────────────

  describe('signOut', () => {
    it('calls /auth/logout with refresh token, clears state', async () => {
      mockHasStoredTokens.mockReturnValue(true);
      mockApi.get.mockResolvedValueOnce(makeMeResponse());

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.user).not.toBeNull());

      mockGetRefreshToken.mockReturnValue('rt-stored');
      mockApi.post.mockResolvedValueOnce(undefined);

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockApi.post).toHaveBeenCalledWith('/api/v1/auth/logout', { refreshToken: 'rt-stored' });
      expect(mockClearTokens).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
      expect(result.current.profile).toBeNull();
      expect(result.current.roles).toEqual([]);
    });

    it('clears tokens locally even if logout API call fails', async () => {
      mockHasStoredTokens.mockReturnValue(true);
      mockApi.get.mockResolvedValueOnce(makeMeResponse());

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.user).not.toBeNull());

      mockGetRefreshToken.mockReturnValue('rt-stored');
      mockApi.post.mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockClearTokens).toHaveBeenCalled();
      expect(result.current.user).toBeNull();
    });
  });

  // ── hasRole ─────────────────────────────────────

  describe('hasRole', () => {
    it('returns true when user has the requested role', async () => {
      mockHasStoredTokens.mockReturnValue(true);
      mockApi.get.mockResolvedValueOnce(
        makeMeResponse({ workshopRoles: ['admin', 'facilitator'] })
      );

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.hasRole('admin')).toBe(true);
      expect(result.current.hasRole('facilitator')).toBe(true);
    });

    it('returns false when user does not have the requested role', async () => {
      mockHasStoredTokens.mockReturnValue(true);
      mockApi.get.mockResolvedValueOnce(
        makeMeResponse({ workshopRoles: ['participant'] })
      );

      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.hasRole('admin')).toBe(false);
      expect(result.current.hasRole('facilitator')).toBe(false);
    });
  });

  // ── refreshProfile ──────────────────────────────

  describe('refreshProfile', () => {
    it('re-hydrates from /me when tokens are stored', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Now simulate tokens being present and call refreshProfile
      mockHasStoredTokens.mockReturnValue(true);
      mockApi.get.mockResolvedValueOnce(makeMeResponse({ name: 'Updated Name' }));

      await act(async () => {
        await result.current.refreshProfile();
      });

      expect(mockApi.get).toHaveBeenCalledWith('/api/v1/auth/me');
      expect(result.current.user?.name).toBe('Updated Name');
    });

    it('does nothing when no tokens are stored', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      mockHasStoredTokens.mockReturnValue(false);

      await act(async () => {
        await result.current.refreshProfile();
      });

      expect(mockApi.get).not.toHaveBeenCalled();
    });
  });
});

// ── useAuth outside provider ─────────────────────

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    // Suppress console.error for expected React error boundary output
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');

    consoleSpy.mockRestore();
  });
});
