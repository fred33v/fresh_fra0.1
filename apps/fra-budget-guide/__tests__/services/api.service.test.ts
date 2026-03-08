// Mock the api constants
jest.mock('@/constants/api', () => ({
  API_CONFIG: {
    BASE_URL: 'http://localhost:3000',
    TIMEOUT: 5000,
    ENDPOINTS: {
      AUTH: {
        LOGIN: '/api/v1/auth/login',
        REFRESH: '/api/v1/auth/refresh',
        ME: '/api/v1/auth/me',
      },
    },
  },
}));

// Mock the logger
jest.mock('@/utils/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('ApiService', () => {
  let apiService: any;
  let AsyncStorage: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset module to get fresh instance
    jest.resetModules();

    // Re-import AsyncStorage after resetModules to get the same reference the module will use
    AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    const mod = await import('@/services/api.service');
    apiService = mod.apiService;
  });

  it('makes GET request with correct URL', async () => {
    const mockResponse = { success: true, data: { id: 1 } };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(mockResponse),
    }) as jest.Mock;

    const result = await apiService.get('/api/v1/test');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/test',
      expect.objectContaining({ method: 'GET' })
    );
    expect(result.success).toBe(true);
  });

  it('makes POST request with body', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    }) as jest.Mock;

    await apiService.post('/api/v1/test', { name: 'test' });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/test',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
      })
    );
  });

  it('makes PATCH request with body', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    }) as jest.Mock;

    await apiService.patch('/api/v1/test', { status: 'done' });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/test',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ status: 'done' }),
      })
    );
  });

  it('returns error on HTTP failure', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ success: false, error: { code: 'SERVER_ERROR', message: 'Internal error' } }),
    }) as jest.Mock;

    const result = await apiService.get('/api/v1/test');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('SERVER_ERROR');
  });

  it('handles network errors', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network request failed')) as jest.Mock;

    const result = await apiService.get('/api/v1/test');

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('NETWORK_ERROR');
  });

  it('returns not authenticated initially', () => {
    expect(apiService.isAuthenticated()).toBe(false);
  });

  it('sets and clears tokens', async () => {
    await apiService.setTokens('access123', 'refresh456');
    expect(apiService.isAuthenticated()).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('accessToken', 'access123');

    await apiService.clearTokens();
    expect(apiService.isAuthenticated()).toBe(false);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('accessToken');
  });
});
