import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { AuthContext } from '../src/helpers.js';
jest.unstable_mockModule('../src/redis.js', () => ({ getRedis: () => null }));
const { storeSseToken, consumeSseToken } = await import('../src/sse-tokens.js');
const auth: AuthContext = { userId: 'user', email: 'user@example.com', role: 'employee', organisationId: 'org' };
afterEach(() => { jest.restoreAllMocks(); });
describe('memory SSE token expiry and exclusivity', () => {
  it('permits exactly one concurrent consumer', async () => {
    const token = crypto.randomUUID();
    await storeSseToken(token, auth);
    expect(await Promise.all([consumeSseToken(token), consumeSseToken(token)])).toEqual([auth, null]);
  });
  it('rejects a token at the exact expiry boundary', async () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const token = crypto.randomUUID();
    await storeSseToken(token, auth);
    clock.mockReturnValue(301000);
    expect(await consumeSseToken(token)).toBeNull();
    expect(await consumeSseToken(token)).toBeNull();
  });
});
