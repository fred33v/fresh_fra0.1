/**
 * Auth Service - Unit Tests
 *
 * Tests for signup, login, logout, getCurrentUser, getCachedUser,
 * getCachedOrganisation, and restoreSession.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService } from '@/services/api.service';
import { authService } from '@/services/auth.service';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('@/services/api.service', () => ({
  apiService: {
    post: jest.fn(),
    get: jest.fn(),
    setTokens: jest.fn(),
    clearTokens: jest.fn(),
    isAuthenticated: jest.fn(),
    getRefreshToken: jest.fn().mockReturnValue('mock-refresh-token'),
  },
}));

jest.mock('@/constants/api', () => ({
  API_CONFIG: {
    BASE_URL: 'http://test.com',
    ENDPOINTS: {
      AUTH: {
        SIGNUP: '/api/v1/auth/signup',
        LOGIN: '/api/v1/auth/login',
        LOGOUT: '/api/v1/auth/logout',
        REFRESH: '/api/v1/auth/refresh',
        ME: '/api/v1/auth/me',
      },
    },
    TIMEOUT: 5000,
  },
}));

jest.mock('@/utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockAuthResponse = {
  user: {
    userId: 'u1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'employer' as const,
    organisationId: 'o1',
    createdAt: '2025-01-01T00:00:00.000Z',
  },
  organisation: {
    organisationId: 'o1',
    name: 'Test Org',
  },
  accessToken: 'access-123',
  refreshToken: 'refresh-456',
};

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AuthService', () => {
  // -----------------------------------------------------------------------
  // signup
  // -----------------------------------------------------------------------

  describe('signup', () => {
    it('should save tokens and user/org data on successful signup', async () => {
      (apiService.post as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockAuthResponse,
      });

      const result = await authService.signup({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User',
        organisationName: 'Test Org',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAuthResponse);
      expect(apiService.setTokens).toHaveBeenCalledWith('access-123', 'refresh-456');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'user',
        JSON.stringify(mockAuthResponse.user),
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'organisation',
        JSON.stringify(mockAuthResponse.organisation),
      );
    });

    it('should return error when API responds with failure', async () => {
      (apiService.post as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: { code: 'SIGNUP_FAILED', message: 'Unable to create account. Please try signing in or resetting your password.' },
      });

      const result = await authService.signup({
        email: 'dup@example.com',
        password: 'pass',
        name: 'Dup',
        organisationName: 'Org',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SIGNUP_FAILED');
      expect(apiService.setTokens).not.toHaveBeenCalled();
    });

    it('should return a generic error when the API call throws', async () => {
      (apiService.post as jest.Mock).mockRejectedValueOnce(new Error('Network down'));

      const result = await authService.signup({
        email: 'fail@example.com',
        password: 'pass',
        name: 'Fail',
        organisationName: 'Org',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SIGNUP_FAILED');
    });
  });

  // -----------------------------------------------------------------------
  // login
  // -----------------------------------------------------------------------

  describe('login', () => {
    it('should save tokens and user/org data on successful login', async () => {
      (apiService.post as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockAuthResponse,
      });

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAuthResponse);
      expect(apiService.setTokens).toHaveBeenCalledWith('access-123', 'refresh-456');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'user',
        JSON.stringify(mockAuthResponse.user),
      );
    });

    it('should return error when credentials are wrong', async () => {
      (apiService.post as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Wrong password' },
      });

      const result = await authService.login({
        email: 'wrong@example.com',
        password: 'bad',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return a generic error when the API call throws', async () => {
      (apiService.post as jest.Mock).mockRejectedValueOnce(new Error('timeout'));

      const result = await authService.login({
        email: 'fail@example.com',
        password: 'pass',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('LOGIN_FAILED');
    });
  });

  // -----------------------------------------------------------------------
  // logout
  // -----------------------------------------------------------------------

  describe('logout', () => {
    it('should call the logout endpoint and clear tokens', async () => {
      (apiService.post as jest.Mock).mockResolvedValueOnce({ success: true });

      await authService.logout();

      expect(apiService.post).toHaveBeenCalledWith(
        '/api/v1/auth/logout',
        { refreshToken: 'mock-refresh-token' },
        { requiresAuth: true },
      );
      expect(apiService.clearTokens).toHaveBeenCalled();
    });

    it('should still clear tokens even if the logout API call fails', async () => {
      (apiService.post as jest.Mock).mockRejectedValueOnce(new Error('network'));

      await authService.logout();

      expect(apiService.clearTokens).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // getCurrentUser
  // -----------------------------------------------------------------------

  describe('getCurrentUser', () => {
    it('should fetch the user from the API and cache it', async () => {
      (apiService.get as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockAuthResponse.user,
      });

      const result = await authService.getCurrentUser();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockAuthResponse.user);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'user',
        JSON.stringify(mockAuthResponse.user),
      );
    });

    it('should return error when the API call fails', async () => {
      (apiService.get as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      });

      const result = await authService.getCurrentUser();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNAUTHORIZED');
    });

    it('should return a generic error when the API throws', async () => {
      (apiService.get as jest.Mock).mockRejectedValueOnce(new Error('boom'));

      const result = await authService.getCurrentUser();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FETCH_USER_FAILED');
    });
  });

  // -----------------------------------------------------------------------
  // getCachedUser / getCachedOrganisation
  // -----------------------------------------------------------------------

  describe('getCachedUser', () => {
    it('should return the user parsed from AsyncStorage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(mockAuthResponse.user),
      );

      const user = await authService.getCachedUser();

      expect(user).toEqual(mockAuthResponse.user);
    });

    it('should return null when no user is stored', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const user = await authService.getCachedUser();

      expect(user).toBeNull();
    });

    it('should return null when AsyncStorage throws', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('corrupt'));

      const user = await authService.getCachedUser();

      expect(user).toBeNull();
    });
  });

  describe('getCachedOrganisation', () => {
    it('should return the organisation parsed from AsyncStorage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify(mockAuthResponse.organisation),
      );

      const org = await authService.getCachedOrganisation();

      expect(org).toEqual(mockAuthResponse.organisation);
    });

    it('should return null when no organisation is stored', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const org = await authService.getCachedOrganisation();

      expect(org).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // restoreSession
  // -----------------------------------------------------------------------

  describe('restoreSession', () => {
    it('should restore a valid session from cache + API validation', async () => {
      // getCachedUser / getCachedOrganisation
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'user') return Promise.resolve(JSON.stringify(mockAuthResponse.user));
        if (key === 'organisation')
          return Promise.resolve(JSON.stringify(mockAuthResponse.organisation));
        return Promise.resolve(null);
      });

      // getCurrentUser (validates token)
      (apiService.get as jest.Mock).mockResolvedValueOnce({
        success: true,
        data: mockAuthResponse.user,
      });

      const result = await authService.restoreSession();

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockAuthResponse.user);
      expect(result.organisation).toEqual(mockAuthResponse.organisation);
    });

    it('should clear tokens and return failure when no cached user exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await authService.restoreSession();

      expect(result.success).toBe(false);
      expect(apiService.clearTokens).toHaveBeenCalled();
    });

    it('should clear tokens and return failure when token validation fails', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'user') return Promise.resolve(JSON.stringify(mockAuthResponse.user));
        if (key === 'organisation')
          return Promise.resolve(JSON.stringify(mockAuthResponse.organisation));
        return Promise.resolve(null);
      });

      (apiService.get as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Expired' },
      });

      const result = await authService.restoreSession();

      expect(result.success).toBe(false);
      expect(apiService.clearTokens).toHaveBeenCalled();
    });

    it('should clear tokens when restoreSession throws', async () => {
      (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('corrupt'));

      const result = await authService.restoreSession();

      expect(result.success).toBe(false);
      expect(apiService.clearTokens).toHaveBeenCalled();
    });
  });
});
