/**
 * API Service - Unit Tests
 *
 * Tests the singleton ApiService that handles all HTTP communication
 * with the backend. Verifies token management, request construction,
 * error handling, timeout behaviour, and the 401 + refresh flow.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Mocks - must be declared before the module under test is imported
// ---------------------------------------------------------------------------

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Use a mutable reference so it stays in sync after jest.resetModules()
let AsyncStorage: any = require('@react-native-async-storage/async-storage');

jest.mock('@/constants/api', () => ({
  API_CONFIG: {
    BASE_URL: 'http://test.com',
    ENDPOINTS: {
      AUTH: {
        REFRESH: '/api/v1/auth/refresh',
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

// We need a fresh module for each test so the constructor's loadTokens() picks
// up the mocked AsyncStorage values we configure per-test.
let apiService: any;

beforeEach(() => {
  jest.clearAllMocks();
  // Reset the module registry so ApiService re-runs its constructor.
  jest.resetModules();
  // Re-acquire the AsyncStorage mock reference after jest.resetModules()
  // so that mockImplementation calls target the current mock instance.
  AsyncStorage = require('@react-native-async-storage/async-storage');
});

async function loadService() {
  const mod = await import('@/services/api.service');
  apiService = mod.apiService;
  // Give the constructor's loadTokens a tick to resolve.
  await new Promise((r) => setTimeout(r, 0));
  return apiService;
}

// Mock global fetch
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

// Also provide a minimal AbortController for environments that lack it.
if (typeof AbortController === 'undefined') {
  (global as any).AbortController = class {
    signal = {};
    abort() {}
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ApiService', () => {
  // -----------------------------------------------------------------------
  // Token management
  // -----------------------------------------------------------------------

  describe('token management', () => {
    it('should load tokens from AsyncStorage on construction', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'accessToken') return Promise.resolve('stored-access');
        if (key === 'refreshToken') return Promise.resolve('stored-refresh');
        return Promise.resolve(null);
      });

      await loadService();

      expect(AsyncStorage.getItem).toHaveBeenCalledWith('accessToken');
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('refreshToken');
      expect(apiService.isAuthenticated()).toBe(true);
    });

    it('should save tokens via setTokens()', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      await loadService();

      await apiService.setTokens('new-access', 'new-refresh');

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('accessToken', 'new-access');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('refreshToken', 'new-refresh');
      expect(apiService.isAuthenticated()).toBe(true);
    });

    it('should clear tokens and user/org data via clearTokens()', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      await loadService();

      await apiService.setTokens('a', 'b');
      await apiService.clearTokens();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('accessToken');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('refreshToken');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('user');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('organisation');
      expect(apiService.isAuthenticated()).toBe(false);
    });

    it('should return the access token via getAccessToken()', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      await loadService();

      expect(apiService.getAccessToken()).toBeNull();

      await apiService.setTokens('tok', 'ref');
      expect(apiService.getAccessToken()).toBe('tok');
    });
  });

  // -----------------------------------------------------------------------
  // Request URL construction
  // -----------------------------------------------------------------------

  describe('request URL construction', () => {
    it('should prepend the base URL to the endpoint', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      await loadService();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: {} }),
      });

      await apiService.get('/api/v1/health');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toBe('http://test.com/api/v1/health');
    });
  });

  // -----------------------------------------------------------------------
  // Auth header
  // -----------------------------------------------------------------------

  describe('auth header inclusion', () => {
    it('should include Authorization header when requiresAuth is true and token exists', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      await loadService();
      await apiService.setTokens('my-token', 'ref');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      await apiService.get('/endpoint', { requiresAuth: true });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer my-token');
    });

    it('should not include Authorization header when requiresAuth is false', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      await loadService();
      await apiService.setTokens('my-token', 'ref');

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      await apiService.get('/endpoint');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['Authorization']).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // HTTP method helpers
  // -----------------------------------------------------------------------

  describe('HTTP method helpers', () => {
    beforeEach(async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      await loadService();
    });

    it('POST should send body as JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: { id: 1 } }),
      });

      const result = await apiService.post('/items', { name: 'test' });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({ name: 'test' });
      expect(result.success).toBe(true);
    });

    it('PATCH should send body as JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      await apiService.patch('/items/1', { name: 'updated' });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('PATCH');
      expect(JSON.parse(options.body)).toEqual({ name: 'updated' });
    });

    it('DELETE should not include a body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });

      await apiService.delete('/items/1');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.method).toBe('DELETE');
      expect(options.body).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Network error handling
  // -----------------------------------------------------------------------

  describe('network error handling', () => {
    it('should return NETWORK_ERROR when fetch throws', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      await loadService();

      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      const result = await apiService.get('/endpoint');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NETWORK_ERROR');
      expect(result.error?.message).toBe('Network failure');
    });

    it('should return HTTP_ERROR for non-OK responses', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      await loadService();

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () =>
          Promise.resolve({
            success: false,
            error: { code: 'SERVER_ERROR', message: 'Internal error' },
          }),
      });

      const result = await apiService.get('/endpoint');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SERVER_ERROR');
    });
  });

  // -----------------------------------------------------------------------
  // Timeout handling
  // -----------------------------------------------------------------------

  describe('timeout handling', () => {
    it('should return TIMEOUT when the request is aborted', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      await loadService();

      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await apiService.get('/slow-endpoint');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TIMEOUT');
      expect(result.error?.message).toBe('Request timed out');
    });
  });

  // -----------------------------------------------------------------------
  // 401 + refresh flow
  // -----------------------------------------------------------------------

  describe('401 + token refresh flow', () => {
    it('should attempt to refresh the token on 401 and retry', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'accessToken') return Promise.resolve('expired-token');
        if (key === 'refreshToken') return Promise.resolve('valid-refresh');
        return Promise.resolve(null);
      });
      await loadService();

      // First call: 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Token expired' },
          }),
      });

      // Refresh call: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            success: true,
            data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
          }),
      });

      // Retry call: success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: { id: 1 } }),
      });

      const result = await apiService.get('/protected', { requiresAuth: true });

      expect(result.success).toBe(true);
      // 3 fetch calls: original, refresh, retry
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should clear tokens when refresh fails', async () => {
      (AsyncStorage.getItem as jest.Mock).mockImplementation((key: string) => {
        if (key === 'accessToken') return Promise.resolve('expired');
        if (key === 'refreshToken') return Promise.resolve('bad-refresh');
        return Promise.resolve(null);
      });
      await loadService();

      // First call: 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Token expired' },
          }),
      });

      // Refresh call: failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({ success: false }),
      });

      const result = await apiService.get('/protected', { requiresAuth: true });

      expect(result.success).toBe(false);
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('accessToken');
    });
  });
});
