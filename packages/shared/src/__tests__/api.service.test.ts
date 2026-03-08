import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiService, type TokenStorage } from '../services/api.service';

// ── Mock logger ─────────────────────────────────────────────

vi.mock('../logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// ── Mock fetch ──────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ── Helpers ─────────────────────────────────────────────────

function createMockStorage(): TokenStorage & { store: Record<string, string> } {
  const store: Record<string, string> = {};
  return {
    store,
    getItem: vi.fn(async (key: string) => store[key] ?? null),
    setItem: vi.fn(async (key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn(async (key: string) => { delete store[key]; }),
  };
}

function createService(storage?: ReturnType<typeof createMockStorage>, overrides = {}) {
  return new ApiService({
    baseUrl: 'http://api.test',
    refreshEndpoint: '/api/v1/auth/refresh',
    storage: storage ?? createMockStorage(),
    ...overrides,
  });
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

// ── Tests ───────────────────────────────────────────────────

describe('ApiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Constructor & Token Loading ───────────────────────────

  describe('constructor and token loading', () => {
    it('loads tokens from storage on construction', async () => {
      const storage = createMockStorage();
      storage.store.accessToken = 'stored-access';
      storage.store.refreshToken = 'stored-refresh';

      const service = createService(storage);

      // Wait for internal token loading
      mockFetch.mockReturnValueOnce(
        jsonResponse(200, { success: true, data: { ok: true } }),
      );
      await service.get('/test', { requiresAuth: true });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://api.test/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer stored-access',
          }),
        }),
      );
    });

    it('handles storage failure during token loading gracefully', async () => {
      const storage = createMockStorage();
      (storage.getItem as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('storage error'));
      (storage.getItem as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('storage error'));

      const service = createService(storage);

      mockFetch.mockReturnValueOnce(
        jsonResponse(200, { success: true, data: {} }),
      );
      const result = await service.get('/test');

      expect(result.success).toBe(true);
    });
  });

  // ── setTokens / getAccessToken / isAuthenticated / getRefreshToken ──

  describe('token management', () => {
    it('setTokens saves tokens to storage and memory', async () => {
      const storage = createMockStorage();
      const service = createService(storage);
      // Let constructor's loadTokens() resolve before calling setTokens
      await new Promise(resolve => setTimeout(resolve, 0));

      await service.setTokens('new-access', 'new-refresh');

      expect(storage.setItem).toHaveBeenCalledWith('accessToken', 'new-access');
      expect(storage.setItem).toHaveBeenCalledWith('refreshToken', 'new-refresh');
      expect(service.getAccessToken()).toBe('new-access');
      expect(service.getRefreshToken()).toBe('new-refresh');
      expect(service.isAuthenticated()).toBe(true);
    });

    it('clearTokens removes all tokens and extra keys', async () => {
      const storage = createMockStorage();
      storage.store.accessToken = 'a';
      storage.store.refreshToken = 'r';
      storage.store.user = '{}';
      storage.store.organisation = '{}';

      const service = createService(storage, { extraClearKeys: ['organisation'] });
      await service.setTokens('a', 'r');
      await service.clearTokens();

      expect(service.getAccessToken()).toBeNull();
      expect(service.getRefreshToken()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
      expect(storage.removeItem).toHaveBeenCalledWith('accessToken');
      expect(storage.removeItem).toHaveBeenCalledWith('refreshToken');
      expect(storage.removeItem).toHaveBeenCalledWith('user');
      expect(storage.removeItem).toHaveBeenCalledWith('organisation');
    });

    it('isAuthenticated returns false when no access token', () => {
      const service = createService();
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  // ── GET requests ──────────────────────────────────────────

  describe('get()', () => {
    it('sends GET request to correct URL', async () => {
      const service = createService();
      mockFetch.mockReturnValueOnce(
        jsonResponse(200, { success: true, data: { items: [] } }),
      );

      const result = await service.get('/api/v1/items');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://api.test/api/v1/items',
        expect.objectContaining({ method: 'GET' }),
      );
      expect(result).toEqual({ success: true, data: { items: [] } });
    });

    it('does not include Authorization header without requiresAuth', async () => {
      const storage = createMockStorage();
      storage.store.accessToken = 'my-token';
      const service = createService(storage);

      mockFetch.mockReturnValueOnce(
        jsonResponse(200, { success: true, data: null }),
      );
      await service.get('/public');

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers).not.toHaveProperty('Authorization');
    });

    it('includes Authorization header with requiresAuth', async () => {
      const storage = createMockStorage();
      storage.store.accessToken = 'my-token';
      const service = createService(storage);

      mockFetch.mockReturnValueOnce(
        jsonResponse(200, { success: true, data: null }),
      );
      await service.get('/protected', { requiresAuth: true });

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toBe('Bearer my-token');
    });
  });

  // ── POST requests ─────────────────────────────────────────

  describe('post()', () => {
    it('sends POST request with JSON body', async () => {
      const service = createService();
      mockFetch.mockReturnValueOnce(
        jsonResponse(201, { success: true, data: { id: '1' } }),
      );

      const result = await service.post('/api/v1/items', { name: 'test' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://api.test/api/v1/items',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'test' }),
        }),
      );
      expect(result).toEqual({ success: true, data: { id: '1' } });
    });

    it('sends POST without body when data is undefined', async () => {
      const service = createService();
      mockFetch.mockReturnValueOnce(
        jsonResponse(200, { success: true, data: {} }),
      );

      await service.post('/api/v1/action');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://api.test/api/v1/action',
        expect.objectContaining({
          method: 'POST',
          body: undefined,
        }),
      );
    });
  });

  // ── PATCH requests ────────────────────────────────────────

  describe('patch()', () => {
    it('sends PATCH request with JSON body', async () => {
      const service = createService();
      mockFetch.mockReturnValueOnce(
        jsonResponse(200, { success: true, data: { updated: true } }),
      );

      await service.patch('/api/v1/items/1', { name: 'updated' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://api.test/api/v1/items/1',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ name: 'updated' }),
        }),
      );
    });
  });

  // ── DELETE requests ───────────────────────────────────────

  describe('delete()', () => {
    it('sends DELETE request', async () => {
      const service = createService();
      mockFetch.mockReturnValueOnce(
        jsonResponse(200, { success: true, data: null }),
      );

      await service.delete('/api/v1/items/1');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://api.test/api/v1/items/1',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  // ── Error handling ────────────────────────────────────────

  describe('error handling', () => {
    it('returns error for non-OK HTTP response with error body', async () => {
      const service = createService();
      mockFetch.mockReturnValueOnce(
        jsonResponse(400, {
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Invalid input' },
        }),
      );

      const result = await service.get('/fail');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('BAD_REQUEST');
      expect(result.error?.message).toBe('Invalid input');
    });

    it('returns HTTP_ERROR when response has no error body', async () => {
      const service = createService();
      mockFetch.mockReturnValueOnce(
        jsonResponse(500, { success: false }),
      );

      const result = await service.get('/fail');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('HTTP_ERROR');
    });

    it('returns PARSE_ERROR for non-JSON response', async () => {
      const service = createService();
      mockFetch.mockReturnValueOnce({
        ok: false,
        status: 502,
        json: async () => { throw new Error('not json'); },
      });

      const result = await service.get('/bad-gateway');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PARSE_ERROR');
      expect(result.error?.message).toContain('502');
    });

    it('returns NETWORK_ERROR on fetch failure', async () => {
      const service = createService();
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await service.get('/unreachable');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NETWORK_ERROR');
      expect(result.error?.message).toBe('Connection refused');
    });

    it('returns TIMEOUT on AbortError', async () => {
      const service = createService(undefined, { timeout: 1 });
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await service.get('/slow');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TIMEOUT');
      expect(result.error?.message).toBe('Request timed out');
    });

    it('returns NETWORK_ERROR for non-Error thrown', async () => {
      const service = createService();
      mockFetch.mockRejectedValueOnce('string error');

      const result = await service.get('/fail');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NETWORK_ERROR');
      expect(result.error?.message).toBe('Network request failed');
    });
  });

  // ── 401 retry with token refresh ─────────────────────────

  describe('token refresh on 401', () => {
    it('refreshes token and retries request on 401', async () => {
      const storage = createMockStorage();
      storage.store.accessToken = 'old-access';
      storage.store.refreshToken = 'old-refresh';
      const service = createService(storage);

      // First request → 401
      mockFetch.mockReturnValueOnce(
        jsonResponse(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'Expired' } }),
      );
      // Refresh → success
      mockFetch.mockReturnValueOnce(
        jsonResponse(200, {
          success: true,
          data: { accessToken: 'new-access', refreshToken: 'new-refresh' },
        }),
      );
      // Retry → success
      mockFetch.mockReturnValueOnce(
        jsonResponse(200, { success: true, data: { items: [] } }),
      );

      const result = await service.get('/protected', { requiresAuth: true });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
      // Verify retry used new token
      const retryHeaders = mockFetch.mock.calls[2][1].headers;
      expect(retryHeaders.Authorization).toBe('Bearer new-access');
    });

    it('does not retry if refresh fails', async () => {
      const storage = createMockStorage();
      storage.store.accessToken = 'old-access';
      storage.store.refreshToken = 'old-refresh';
      const service = createService(storage);

      // First request → 401
      mockFetch.mockReturnValueOnce(
        jsonResponse(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'Expired' } }),
      );
      // Refresh → fail
      mockFetch.mockReturnValueOnce(
        jsonResponse(401, { success: false, error: { code: 'INVALID_REFRESH', message: 'Bad token' } }),
      );

      const result = await service.get('/protected', { requiresAuth: true });

      // Returns the original 401 error (no retry)
      expect(result.success).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      // Tokens should be cleared
      expect(service.isAuthenticated()).toBe(false);
    });

    it('does not attempt refresh without requiresAuth', async () => {
      const storage = createMockStorage();
      storage.store.accessToken = 'token';
      storage.store.refreshToken = 'refresh';
      const service = createService(storage);

      mockFetch.mockReturnValueOnce(
        jsonResponse(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'Expired' } }),
      );

      const result = await service.get('/public');

      expect(result.success).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No refresh attempt
    });

    it('does not retry twice (prevents infinite loop)', async () => {
      const storage = createMockStorage();
      storage.store.accessToken = 'token';
      storage.store.refreshToken = 'refresh';
      const service = createService(storage);

      // First request → 401
      mockFetch.mockReturnValueOnce(
        jsonResponse(401, { success: false, error: { code: 'UNAUTHORIZED', message: '' } }),
      );
      // Refresh → success
      mockFetch.mockReturnValueOnce(
        jsonResponse(200, {
          success: true,
          data: { accessToken: 'new', refreshToken: 'new-r' },
        }),
      );
      // Retry → 401 again
      mockFetch.mockReturnValueOnce(
        jsonResponse(401, { success: false, error: { code: 'UNAUTHORIZED', message: '' } }),
      );

      const result = await service.get('/protected', { requiresAuth: true });

      // Should not attempt a third request
      expect(result.success).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('deduplicates concurrent refresh requests (mutex)', async () => {
      const storage = createMockStorage();
      storage.store.accessToken = 'old';
      storage.store.refreshToken = 'refresh';
      const service = createService(storage);

      // Both requests get 401
      mockFetch
        .mockReturnValueOnce(
          jsonResponse(401, { success: false, error: { code: 'UNAUTHORIZED', message: '' } }),
        )
        .mockReturnValueOnce(
          jsonResponse(401, { success: false, error: { code: 'UNAUTHORIZED', message: '' } }),
        );

      // Only ONE refresh should happen
      mockFetch.mockReturnValueOnce(
        jsonResponse(200, {
          success: true,
          data: { accessToken: 'new', refreshToken: 'new-r' },
        }),
      );

      // Both retries succeed
      mockFetch
        .mockReturnValueOnce(jsonResponse(200, { success: true, data: { a: 1 } }))
        .mockReturnValueOnce(jsonResponse(200, { success: true, data: { b: 2 } }));

      const [r1, r2] = await Promise.all([
        service.get('/a', { requiresAuth: true }),
        service.get('/b', { requiresAuth: true }),
      ]);

      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);

      // Count refresh calls (POST to refresh endpoint)
      const refreshCalls = mockFetch.mock.calls.filter(
        (call) => call[0] === 'http://api.test/api/v1/auth/refresh',
      );
      expect(refreshCalls).toHaveLength(1);
    });

    it('clears tokens when refresh request throws', async () => {
      const storage = createMockStorage();
      storage.store.accessToken = 'token';
      storage.store.refreshToken = 'refresh';
      const service = createService(storage);

      // First request → 401
      mockFetch.mockReturnValueOnce(
        jsonResponse(401, { success: false, error: { code: 'UNAUTHORIZED', message: '' } }),
      );
      // Refresh → network error
      mockFetch.mockRejectedValueOnce(new Error('Network down'));

      await service.get('/protected', { requiresAuth: true });

      expect(service.isAuthenticated()).toBe(false);
      expect(service.getRefreshToken()).toBeNull();
    });
  });

  // ── Timeout configuration ─────────────────────────────────

  describe('timeout', () => {
    it('uses default timeout of 30000ms', async () => {
      const service = createService();
      mockFetch.mockReturnValueOnce(
        jsonResponse(200, { success: true, data: null }),
      );

      await service.get('/test');

      // Verify AbortController signal was passed
      const fetchCall = mockFetch.mock.calls[0][1];
      expect(fetchCall.signal).toBeInstanceOf(AbortSignal);
    });

    it('accepts custom timeout in config', async () => {
      const service = createService(undefined, { timeout: 5000 });
      mockFetch.mockReturnValueOnce(
        jsonResponse(200, { success: true, data: null }),
      );

      await service.get('/test');

      expect(mockFetch).toHaveBeenCalled();
    });

    it('accepts per-request timeout override', async () => {
      const service = createService();
      mockFetch.mockReturnValueOnce(
        jsonResponse(200, { success: true, data: null }),
      );

      await service.get('/test', { timeout: 1000 });

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  // ── Custom headers ────────────────────────────────────────

  describe('custom headers', () => {
    it('merges custom headers with defaults', async () => {
      const service = createService();
      mockFetch.mockReturnValueOnce(
        jsonResponse(200, { success: true, data: null }),
      );

      await service.get('/test', {
        headers: { 'X-Custom': 'value' },
      });

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['X-Custom']).toBe('value');
    });
  });
});
