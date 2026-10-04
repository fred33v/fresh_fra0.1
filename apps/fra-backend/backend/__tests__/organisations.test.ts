/// <reference types="jest" />

import { describe, expect, it } from '@jest/globals';
import { app, createAuthenticatedUser, authHeaders } from './helpers';

const orgUrl = (id: string) => `http://localhost/api/v1/organisations/${id}`;

describe('Organisation endpoints', () => {
  it('returns the caller\'s organisation', async () => {
    const { accessToken, organisationId } = await createAuthenticatedUser({ organisationName: 'Acme Ltd' });
    const res = await app.request(orgUrl(organisationId), { headers: authHeaders(accessToken) });
    expect(res.status).toBe(200);
    const json = (await res.json()) as any;
    expect(json.data).toMatchObject({ organisationId, name: 'Acme Ltd', employeeCount: null });
  });

  it('updates profile fields and keeps the rest', async () => {
    const { accessToken, organisationId } = await createAuthenticatedUser({ organisationName: 'Acme Ltd' });
    const res = await app.request(orgUrl(organisationId), {
      method: 'PATCH',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ employeeCount: '11-50', industry: 'Retail' }),
    });
    expect(res.status).toBe(200);

    const after = (await (await app.request(orgUrl(organisationId), { headers: authHeaders(accessToken) })).json()) as any;
    expect(after.data).toMatchObject({ name: 'Acme Ltd', employeeCount: '11-50', industry: 'Retail' });
  });

  it('rejects fields the server derives itself, such as the package', async () => {
    const { accessToken, organisationId } = await createAuthenticatedUser();
    const res = await app.request(orgUrl(organisationId), {
      method: 'PATCH',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ packageType: 'with-dashboard', keyPassesAllocated: 999 }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects an empty update and an unknown staff band', async () => {
    const { accessToken, organisationId } = await createAuthenticatedUser();
    for (const body of [{}, { employeeCount: 'lots' }]) {
      const res = await app.request(orgUrl(organisationId), {
        method: 'PATCH', headers: authHeaders(accessToken), body: JSON.stringify(body),
      });
      expect(res.status).toBe(400);
    }
  });

  it('does not reveal or change another organisation', async () => {
    const a = await createAuthenticatedUser();
    const b = await createAuthenticatedUser({ organisationName: 'Other Org' });
    const get = await app.request(orgUrl(b.organisationId), { headers: authHeaders(a.accessToken) });
    expect(get.status).toBe(404);
    const patch = await app.request(orgUrl(b.organisationId), {
      method: 'PATCH', headers: authHeaders(a.accessToken), body: JSON.stringify({ name: 'Hijacked' }),
    });
    expect(patch.status).toBe(404);

    const still = (await (await app.request(orgUrl(b.organisationId), { headers: authHeaders(b.accessToken) })).json()) as any;
    expect(still.data.name).toBe('Other Org');
  });

  it('requires authentication', async () => {
    const { organisationId } = await createAuthenticatedUser();
    const res = await app.request(orgUrl(organisationId));
    expect(res.status).toBe(401);
  });
});
