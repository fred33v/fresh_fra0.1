import { describe, expect, it } from '@jest/globals';
import { app, authHeaders, createPaidUser } from './helpers';
import { usersByEmail } from '../src/stores';

async function request(path: string, token: string) {
  return app.request(`http://localhost/api/v1/compliance${path}`, { headers: authHeaders(token) });
}
describe('current authority for organisation compliance evidence', () => {
  it('refuses a previously issued manager JWT after role demotion', async () => {
    const account = await createPaidUser();
    const current = [...usersByEmail.values()].find(user => user.id === account.userId)!;
    current.role = 'employee';
    for (const path of ['/report', '/export', '/audit']) {
      const response = await request(path, account.accessToken);
      expect(response.status).toBe(403);
      expect((await response.json() as { error: { code: string } }).error.code).toBe('FORBIDDEN');
    }
  });
  it('refuses a stale organisation claim after an account transfer', async () => {
    const account = await createPaidUser();
    const other = await createPaidUser();
    const current = [...usersByEmail.values()].find(user => user.id === account.userId)!;
    current.organisationId = other.organisationId;
    expect((await request('/export', account.accessToken)).status).toBe(403);
  });
  it('retains current manager access and marks evidence responses no-store', async () => {
    const account = await createPaidUser();
    const response = await request('/export', account.accessToken);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const body = await response.json() as { data: { organisationId: string } };
    expect(body.data.organisationId).toBe(account.organisationId);
  });
});
