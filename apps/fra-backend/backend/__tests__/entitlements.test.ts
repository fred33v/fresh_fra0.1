/// <reference types="jest" />

import { describe, expect, it } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { app, createAuthenticatedUser, authHeaders } from './helpers';
import { purchasesById } from '../src/stores';
import { jwtSecret, getEntitlementWindows, hasPackageEntitlement, blocksRepurchase } from '../src/helpers';
import type { Purchase } from '../src/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const API = 'http://localhost/api/v1';

function purchase(packageId: string, daysAgo = 0, organisationId = 'org', userId = 'user'): Purchase {
  const at = new Date(Date.now() - daysAgo * DAY_MS).toISOString();
  return {
    id: crypto.randomUUID(), organisationId, userId, packageId, status: 'succeeded',
    amountCents: 0, currency: 'gbp', createdAt: at, confirmedAt: at,
  };
}

async function userWith(packageId: string | null, daysAgo = 0) {
  const user = await createAuthenticatedUser({ organisationName: `Ent ${packageId}` });
  if (packageId) {
    const p = purchase(packageId, daysAgo, user.organisationId, user.userId);
    purchasesById.set(p.id, p);
  }
  return user;
}

function tokenWithRole(user: { userId: string; email: string; organisationId: string }, role: string) {
  return jwt.sign(
    { sub: user.userId, email: user.email, role, organisationId: user.organisationId },
    jwtSecret, { algorithm: 'HS256', expiresIn: '5m' }
  );
}

const get = (path: string, token: string) => app.request(`${API}${path}`, { headers: authHeaders(token) });
const post = (path: string, token: string, body: unknown = {}) =>
  app.request(`${API}${path}`, { method: 'POST', headers: authHeaders(token), body: JSON.stringify(body) });

describe('Entitlement windows', () => {
  it('Starter never expires', () => {
    expect(hasPackageEntitlement([purchase('pkg_basic', 2000)], 'pkg_basic')).toBe(true);
  });

  it('annual packages expire after 365 days', () => {
    expect(hasPackageEntitlement([purchase('pkg_full', 364)], 'pkg_full')).toBe(true);
    expect(hasPackageEntitlement([purchase('pkg_full', 366)], 'pkg_full')).toBe(false);
  });

  it('a higher tier satisfies a lower requirement', () => {
    expect(hasPackageEntitlement([purchase('pkg_full')], 'pkg_training')).toBe(true);
    expect(hasPackageEntitlement([purchase('pkg_training')], 'pkg_full')).toBe(false);
  });

  it('renewals stack onto the remaining term', () => {
    const windows = getEntitlementWindows([purchase('pkg_training', 350), purchase('pkg_training', 1)]);
    const lastExpiry = windows[1].expiresAt!.getTime();
    const expected = Date.now() - 350 * DAY_MS + 2 * 365 * DAY_MS;
    expect(Math.abs(lastExpiry - expected)).toBeLessThan(1000);
  });

  it('ignores purchases that did not succeed', () => {
    expect(hasPackageEntitlement([{ ...purchase('pkg_full'), status: 'requires_confirmation' }], 'pkg_basic')).toBe(false);
  });

  it('allows renewal only in the last 30 days of a term', () => {
    expect(blocksRepurchase([purchase('pkg_full', 100)], 'pkg_full')).toBe(true);
    expect(blocksRepurchase([purchase('pkg_full', 340)], 'pkg_full')).toBe(false);
    expect(blocksRepurchase([purchase('pkg_basic', 5)], 'pkg_basic')).toBe(true);
    expect(blocksRepurchase([], 'pkg_full')).toBe(false);
  });
});

describe('Package gates', () => {
  it('unpaid organisations cannot start assessments or export reports', async () => {
    const { accessToken } = await userWith(null);
    const res = await post('/assessments', accessToken, { title: 'Free' });
    expect(res.status).toBe(403);
    expect(((await res.json()) as any).error.code).toBe('PACKAGE_REQUIRED');
    expect((await get('/reports/generate', accessToken)).status).toBe(403);
  });

  it('Starter allows a single assessment for the organisation', async () => {
    const { accessToken } = await userWith('pkg_basic');
    expect((await post('/assessments', accessToken, { title: 'First' })).status).toBe(201);
    const second = await post('/assessments', accessToken, { title: 'Second' });
    expect(second.status).toBe(403);
    expect(((await second.json()) as any).error.code).toBe('ASSESSMENT_LIMIT_REACHED');
  });

  it('Professional allows four assessments per person per year', async () => {
    const { accessToken } = await userWith('pkg_training');
    for (let i = 0; i < 4; i++) {
      expect((await post('/assessments', accessToken, { title: `Q${i + 1}` })).status).toBe(201);
    }
    expect((await post('/assessments', accessToken, { title: 'Q5' })).status).toBe(403);
  });

  it('training workshop requires Professional or higher', async () => {
    const starter = await userWith('pkg_basic');
    const res = await get('/workshop/sessions', starter.accessToken);
    expect(res.status).toBe(403);
    expect(((await res.json()) as any).error.code).toBe('PACKAGE_REQUIRED');
    // Onboarding profile stays open
    expect((await get('/workshop/profile', starter.accessToken)).status).toBe(200);

    const pro = await userWith('pkg_training');
    expect((await get('/workshop/sessions', pro.accessToken)).status).toBe(200);
    expect((await get('/workshop/certificates', pro.accessToken)).status).toBe(200);
  });

  it('dashboard and compliance require Enterprise', async () => {
    const pro = await userWith('pkg_training');
    expect((await get('/analytics/dashboard', pro.accessToken)).status).toBe(403);
    expect((await get('/compliance/report', pro.accessToken)).status).toBe(403);

    const ent = await userWith('pkg_full');
    expect((await get('/analytics/dashboard', ent.accessToken)).status).toBe(200);
    expect((await get('/compliance/report', ent.accessToken)).status).toBe(200);
  });

  it('compliance endpoints are closed to employees even on Enterprise', async () => {
    const ent = await userWith('pkg_full');
    const employeeToken = tokenWithRole(ent, 'employee');
    expect((await get('/compliance/audit-trail', employeeToken)).status).toBe(403);
    expect((await get('/compliance/export', employeeToken)).status).toBe(403);
  });

  it('an expired Enterprise subscription loses its features but keeps report access', async () => {
    const { accessToken } = await userWith('pkg_full', 400);
    expect((await get('/analytics/dashboard', accessToken)).status).toBe(403);
    expect((await post('/keypasses/generate', accessToken, { quantity: 1, expiresInDays: 7 })).status).toBe(403);
    expect((await post('/assessments', accessToken, { title: 'Lapsed' })).status).toBe(403);
    expect((await get('/reports/generate', accessToken)).status).toBe(200);
  });
});

describe('Key-pass allowance', () => {
  it('Enterprise key-passes are unlimited', async () => {
    const { accessToken, organisationId } = await userWith('pkg_full');
    expect((await post('/keypasses/generate', accessToken, { quantity: 60, expiresInDays: 7 })).status).toBe(200);
    const quota = (await (await get(`/keypasses/organisation/${organisationId}/quota`, accessToken)).json()) as any;
    expect(quota.data.unlimited).toBe(true);
    expect(quota.data.remaining).toBeNull();
  });

  it('Professional is capped at 50 key-passes', async () => {
    const { accessToken } = await userWith('pkg_training');
    const res = await post('/keypasses/generate', accessToken, { quantity: 51, expiresInDays: 7 });
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error.code).toBe('QUOTA_EXCEEDED');
  });
});

describe('GET /entitlements', () => {
  it('summarises the active package for the frontend', async () => {
    const { accessToken } = await userWith('pkg_training');
    const json = (await (await get('/entitlements', accessToken)).json()) as any;
    expect(json.data.packageId).toBe('pkg_training');
    expect(json.data.features).toMatchObject({ training: true, dashboard: false });
    expect(json.data.keypassAllowance).toBe(50);
    expect(json.data.assessments).toMatchObject({ allowed: true, limit: 4, used: 0 });
    expect(json.data.expiresAt).toBeTruthy();
  });

  it('reports no package for unpaid organisations', async () => {
    const { accessToken } = await userWith(null);
    const json = (await (await get('/entitlements', accessToken)).json()) as any;
    expect(json.data.packageId).toBeNull();
    expect(json.data.features.assessment).toBe(false);
  });
});

describe('Purchase renewal', () => {
  it('blocks buying an active subscription again', async () => {
    const { accessToken } = await userWith('pkg_full', 10);
    const res = await post('/purchases', accessToken, { packageId: 'pkg_full' });
    expect(res.status).toBe(409);
  });

  it('allows renewal in the last 30 days of the term', async () => {
    const { accessToken } = await userWith('pkg_full', 345);
    const res = await post('/purchases', accessToken, { packageId: 'pkg_full' });
    expect(res.status).toBe(200);
    const { data } = (await res.json()) as any;
    const confirm = await post(`/purchases/${data.purchaseId}/confirm`, accessToken, {});
    expect(confirm.status).toBe(200);
  });
});
