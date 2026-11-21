import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
  length: 0,
  key: vi.fn(() => null),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock import.meta.env
vi.stubEnv('VITE_API_URL', 'http://test-api:3000');

describe('api token management', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('setTokens stores access and refresh tokens', async () => {
    const { setTokens } = await import('@/lib/api');
    setTokens('access123', 'refresh456');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('fra_access_token', 'access123');
    expect(localStorageMock.setItem).toHaveBeenCalledWith('fra_refresh_token', 'refresh456');
  });

  it('clearTokens removes both tokens', async () => {
    const { clearTokens } = await import('@/lib/api');
    clearTokens();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('fra_access_token');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('fra_refresh_token');
  });

  it('hasStoredTokens returns true when access token exists', async () => {
    store['fra_access_token'] = 'some-token';
    const { hasStoredTokens } = await import('@/lib/api');
    expect(hasStoredTokens()).toBe(true);
  });

  it('hasStoredTokens returns false when no access token', async () => {
    delete store['fra_access_token'];
    const { hasStoredTokens } = await import('@/lib/api');
    expect(hasStoredTokens()).toBe(false);
  });
});

describe('api.get', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it('sends GET request with auth header when token exists', async () => {
    store['fra_access_token'] = 'my-token';
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ success: true, data: { items: [] } }),
    });

    const { api } = await import('@/lib/api');
    const result = await api.get('/api/v1/test');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/test'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer my-token',
        }),
      }),
    );
    expect(result).toEqual({ items: [] });
  });

  it('throws on error response', async () => {
    mockFetch.mockResolvedValueOnce({
      status: 400,
      json: async () => ({ success: false, error: { code: 'BAD_REQUEST', message: 'Invalid input' } }),
    });

    const { api } = await import('@/lib/api');
    await expect(api.get('/api/v1/test')).rejects.toThrow('Invalid input');
  });
});

describe('authenticated PDF upload', () => {
  it('preserves multipart boundaries and the PDF body across a token refresh', async () => {
    store.fra_access_token='expired';store.fra_refresh_token='refresh';
    const {api} = await import('@/lib/api');
    mockFetch.mockReset();
    mockFetch.mockResolvedValueOnce({status:401});
    mockFetch.mockResolvedValueOnce({ok:true,json:async () => ({success:true,data:{accessToken:'new',refreshToken:'rotated'}})});
    mockFetch.mockResolvedValueOnce({status:201,json:async () => ({success:true,data:{id:'doc'}})});
    const form=new FormData();form.set('title','Agreement');form.set('file',new File(['pdf'],'agreement.pdf',{type:'application/pdf'}));
    expect(await api.upload('/api/v1/esign/documents',form)).toEqual({id:'doc'});
    expect(mockFetch.mock.calls[0][1].body).toBe(form);
    expect(mockFetch.mock.calls[2][1].body).toBe(form);
    expect(mockFetch.mock.calls[2][1].headers).not.toHaveProperty('Content-Type');
    expect(mockFetch.mock.calls[2][1].headers.Authorization).toBe('Bearer new');
  });
});
