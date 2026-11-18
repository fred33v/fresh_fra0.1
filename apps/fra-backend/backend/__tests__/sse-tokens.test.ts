import { describe, it, expect, jest } from '@jest/globals';
import type { AuthContext } from '../src/helpers.js';
const values = new Map<string, unknown>();
const getdel = jest.fn(async (key: string) => {
  const value = values.get(key);
  values.delete(key);
  return value ?? null;
});
jest.unstable_mockModule('../src/redis.js', () => ({
  getRedis: () => ({ getdel, set: async (key: string, value: unknown) => { values.set(key, value); } }),
}));
const { storeSseToken, consumeSseToken } = await import('../src/sse-tokens.js');
const auth = { userId: 'user', organisationId: 'org', role: 'employee' } as AuthContext;
describe('single-use SSE Redis tokens', () => {
  it('allows only one concurrent claim, preserving the existing key format', async () => {
    await storeSseToken('one', auth);
    expect(values.has('sse_token:one')).toBe(true);
    expect(await Promise.all([consumeSseToken('one'), consumeSseToken('one')])).toEqual([auth, null]);
    expect(getdel).toHaveBeenCalledWith('sse_token:one');
  });
  it('supports Redis automatic JSON deserialization', async () => {
    values.set('sse_token:object', auth);
    expect(await consumeSseToken('object')).toEqual(auth);
    expect(await consumeSseToken('object')).toBeNull();
  });
  it('consumes invalid JSON without authenticating', async () => {
    values.set('sse_token:bad', '{');
    expect(await consumeSseToken('bad')).toBeNull();
    expect(values.has('sse_token:bad')).toBe(false);
  });
});
