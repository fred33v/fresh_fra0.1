import { describe, it, expect, beforeEach } from 'vitest';
import type { TokenStorage } from '../services/api.service';
import { createSecureTokenStorage, type SecureStoreLike } from '../services/secure-token-storage';

function memorySecureStore(): SecureStoreLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItemAsync: async (k) => data.get(k) ?? null,
    setItemAsync: async (k, v) => { data.set(k, v); },
    deleteItemAsync: async (k) => { data.delete(k); },
  };
}

function memoryStorage(): TokenStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => { data.set(k, v); },
    removeItem: async (k) => { data.delete(k); },
  };
}

describe('createSecureTokenStorage', () => {
  let secure: ReturnType<typeof memorySecureStore>;
  let plain: ReturnType<typeof memoryStorage>;
  let storage: TokenStorage;

  beforeEach(() => {
    secure = memorySecureStore();
    plain = memoryStorage();
    storage = createSecureTokenStorage(secure, plain);
  });

  it('keeps login tokens out of ordinary storage', async () => {
    await storage.setItem('accessToken', 'at');
    await storage.setItem('refreshToken', 'rt');

    expect(secure.data.get('accessToken')).toBe('at');
    expect(secure.data.get('refreshToken')).toBe('rt');
    expect(plain.data.size).toBe(0);
    expect(await storage.getItem('refreshToken')).toBe('rt');
  });

  it('keeps other data in ordinary storage', async () => {
    await storage.setItem('organisation', '{"id":"o1"}');
    expect(plain.data.get('organisation')).toBe('{"id":"o1"}');
    expect(secure.data.size).toBe(0);
    await storage.removeItem('organisation');
    expect(plain.data.size).toBe(0);
  });

  it('moves a token saved by an older app version into the secure store', async () => {
    plain.data.set('refreshToken', 'old-rt');

    expect(await storage.getItem('refreshToken')).toBe('old-rt');
    expect(secure.data.get('refreshToken')).toBe('old-rt');
    expect(plain.data.has('refreshToken')).toBe(false);
  });

  it('removes tokens from both stores on logout', async () => {
    secure.data.set('accessToken', 'at');
    plain.data.set('accessToken', 'stale');

    await storage.removeItem('accessToken');

    expect(secure.data.has('accessToken')).toBe(false);
    expect(plain.data.has('accessToken')).toBe(false);
  });

  it('returns null when no token exists anywhere', async () => {
    expect(await storage.getItem('accessToken')).toBeNull();
  });
});
