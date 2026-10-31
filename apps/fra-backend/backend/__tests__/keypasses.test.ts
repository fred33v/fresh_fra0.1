/// <reference types="jest" />

import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import { app, createAuthenticatedUser, authHeaders, seedPurchase } from './helpers';
import { purchasesById } from '../src/stores';
import { RATE_LIMITS } from '../src/types';

async function signup() {
  const { accessToken, email, organisationId, userId } = await createAuthenticatedUser({ name: 'KP User', organisationName: 'KP Org' });
  seedPurchase(organisationId, userId);
  return { accessToken, email, organisationId };
}

describe('Keypasses endpoints', () => {
  // ── POST /keypasses/allocate ──────────────────────────────────

  describe('POST /keypasses/allocate', () => {
    it('allocates keypasses', async () => {
      const { accessToken } = await signup();
      const res = await app.request('http://localhost/api/v1/keypasses/allocate', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ quantity: 3, expiresInDays: 30 }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.codes).toHaveLength(3);
      expect(json.data.expiresAt).toBeTruthy();
    });

    it('uses defaults for quantity and expiry', async () => {
      const { accessToken } = await signup();
      const res = await app.request('http://localhost/api/v1/keypasses/allocate', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.data.codes).toHaveLength(1);
    });

    it('rejects without auth', async () => {
      const res = await app.request('http://localhost/api/v1/keypasses/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: 1 }),
      });
      expect(res.status).toBe(401);
    });
  });

  // ── POST /keypasses/generate ──────────────────────────────────

  describe('POST /keypasses/generate', () => {
    it('generates keypasses', async () => {
      const { accessToken } = await signup();
      const res = await app.request('http://localhost/api/v1/keypasses/generate', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ quantity: 2, expiresInDays: 7 }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.codes).toHaveLength(2);
    });
  });

  // ── POST /keypasses/validate ──────────────────────────────────

  describe('POST /keypasses/validate', () => {
    it('validates a valid keypass', async () => {
      const { accessToken } = await signup();
      const allocRes = await app.request('http://localhost/api/v1/keypasses/allocate', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ quantity: 1 }),
      });
      const allocJson = (await allocRes.json()) as any;
      const code = allocJson.data.codes[0];

      const res = await app.request('http://localhost/api/v1/keypasses/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.data.valid).toBe(true);
    });

    it('returns 404 for unknown code', async () => {
      const res = await app.request('http://localhost/api/v1/keypasses/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'INVALIDCODE999' }),
      });
      expect(res.status).toBe(404);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NOT_FOUND');
    });

    it('rejects missing code', async () => {
      const res = await app.request('http://localhost/api/v1/keypasses/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(res.status).toBe(400);
    });
  });

  // ── POST /keypasses/use ───────────────────────────────────────

  describe('POST /keypasses/use', () => {
    it('uses a keypass and creates employee account', async () => {
      const { accessToken } = await signup();
      const allocRes = await app.request('http://localhost/api/v1/keypasses/allocate', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ quantity: 1 }),
      });
      const code = ((await allocRes.json()) as any).data.codes[0];

      const empEmail = `employee+${Date.now()}@example.com`;
      const res = await app.request('http://localhost/api/v1/keypasses/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email: empEmail, name: 'Employee One', password: 'Employee-Pass-2026' }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.accessToken).toBeTruthy();
      expect(json.data.refreshToken).toBeTruthy();

      // The web app needs a profile to show the employee's pages; key-pass sign-up does not create one
      const me = (await (await app.request('http://localhost/api/v1/auth/me', { headers: authHeaders(json.data.accessToken) })).json()) as any;
      expect(me.data.profile).toMatchObject({ full_name: 'Employee One', organization_name: 'KP Org', sector: 'private', job_title: null });
    });

    it('rejects already-used keypass', async () => {
      const { accessToken } = await signup();
      const allocRes = await app.request('http://localhost/api/v1/keypasses/allocate', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ quantity: 1 }),
      });
      const code = ((await allocRes.json()) as any).data.codes[0];

      // Use once
      await app.request('http://localhost/api/v1/keypasses/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email: `emp1+${Date.now()}@example.com`, name: 'Emp 1', password: 'Employee-Pass-2026' }),
      });

      // Try to use again
      const res = await app.request('http://localhost/api/v1/keypasses/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email: `emp2+${Date.now()}@example.com`, name: 'Emp 2', password: 'Employee-Pass-2026' }),
      });
      expect(res.status).toBe(400);
    });

    it('does not sign in to an existing account and leaves the keypass unused', async () => {
      const { accessToken, email: employerEmail } = await signup();
      const allocRes = await app.request('http://localhost/api/v1/keypasses/allocate', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ quantity: 1 }),
      });
      const code = ((await allocRes.json()) as any).data.codes[0];

      const res = await app.request('http://localhost/api/v1/keypasses/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email: employerEmail, name: 'Not The Employer', password: 'Employee-Pass-2026' }),
      });
      expect(res.status).toBe(409);
      const json = (await res.json()) as any;
      expect(json.data?.accessToken).toBeUndefined();

      const retry = await app.request('http://localhost/api/v1/keypasses/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email: `emp+${Date.now()}@example.com`, name: 'Emp', password: 'Employee-Pass-2026' }),
      });
      expect(retry.status).toBe(200);
    });

    it('rejects non-existent keypass code', async () => {
      const res = await app.request('http://localhost/api/v1/keypasses/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'NONEXISTENT1234', email: 'emp@example.com', name: 'Emp', password: 'Employee-Pass-2026' }),
      });
      // Returns 400 or 404 depending on code lookup
      expect([400, 404]).toContain(res.status);
    });
  });

  // ── POST /keypasses/revoke ────────────────────────────────────

  describe('POST /keypasses/revoke', () => {
    it('revokes a keypass', async () => {
      const { accessToken } = await signup();
      const allocRes = await app.request('http://localhost/api/v1/keypasses/allocate', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ quantity: 1 }),
      });
      const code = ((await allocRes.json()) as any).data.codes[0];

      const res = await app.request('http://localhost/api/v1/keypasses/revoke', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ code }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);

      // Validate shows revoked after revoke
      const valRes = await app.request('http://localhost/api/v1/keypasses/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      expect(valRes.status).toBe(400);
      const valJson = (await valRes.json()) as any;
      expect(valJson.error.code).toBe('REVOKED');
    });
  });

  // ── GET /keypasses/organisation/:orgId ─────────────────────────

  describe('GET /keypasses/organisation/:orgId', () => {
    it('lists keypasses for the org', async () => {
      const { accessToken, organisationId } = await signup();
      await app.request('http://localhost/api/v1/keypasses/allocate', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ quantity: 2 }),
      });

      const res = await app.request(`http://localhost/api/v1/keypasses/organisation/${organisationId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(2);
    });

    it('rejects access to other org keypasses', async () => {
      const user1 = await signup();
      const user2 = await signup();

      const res = await app.request(`http://localhost/api/v1/keypasses/organisation/${user1.organisationId}`, {
        headers: { Authorization: `Bearer ${user2.accessToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('hides the code list and stats from employees of the same org', async () => {
      const { accessToken, organisationId } = await signup();
      const allocRes = await app.request('http://localhost/api/v1/keypasses/allocate', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ quantity: 2 }),
      });
      const [code] = ((await allocRes.json()) as any).data.codes;

      const useRes = await app.request('http://localhost/api/v1/keypasses/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email: `staff-${Date.now()}@example.com`, password: 'Employee-Pass-2026' }),
      });
      expect(useRes.status).toBe(200);
      const employeeToken = ((await useRes.json()) as any).data.accessToken;

      for (const path of ['', '/stats']) {
        const res = await app.request(`http://localhost/api/v1/keypasses/organisation/${organisationId}${path}`, {
          headers: { Authorization: `Bearer ${employeeToken}` },
        });
        expect(res.status).toBe(403);
      }
    });
  });

  // ── GET /keypasses/organisation/:orgId/stats ───────────────────

  describe('GET /keypasses/organisation/:orgId/stats', () => {
    it('returns stats', async () => {
      const { accessToken, organisationId } = await signup();
      await app.request('http://localhost/api/v1/keypasses/allocate', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ quantity: 3 }),
      });

      const res = await app.request(`http://localhost/api/v1/keypasses/organisation/${organisationId}/stats`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(typeof json.data.totals).toBe('number');
      expect(json.data.totals).toBeGreaterThanOrEqual(3);
    });
  });

  // ── POST /keypasses/bulk-revoke ────────────────────────────────

  describe('POST /keypasses/bulk-revoke', () => {
    it('refuses redeemed codes so their slots stay counted', async () => {
      const { accessToken, organisationId } = await signup();
      const allocRes = await app.request('http://localhost/api/v1/keypasses/allocate', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ quantity: 2 }),
      });
      const [usedCode, spareCode] = ((await allocRes.json()) as any).data.codes;

      const useRes = await app.request('http://localhost/api/v1/keypasses/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: usedCode, email: `staff-${Date.now()}@example.com`, password: 'Employee-Pass-2026' }),
      });
      expect(useRes.status).toBe(200);

      const res = await app.request('http://localhost/api/v1/keypasses/bulk-revoke', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ codes: [usedCode, spareCode] }),
      });
      expect(res.status).toBe(200);
      const { results } = ((await res.json()) as any).data;
      expect(results).toEqual([
        { code: usedCode, revoked: false, reason: 'already_used' },
        { code: spareCode, revoked: true },
      ]);

      const quotaRes = await app.request(`http://localhost/api/v1/keypasses/organisation/${organisationId}/quota`, {
        headers: authHeaders(accessToken),
      });
      expect(((await quotaRes.json()) as any).data.used).toBe(1);
    });
  });

  // ── Employees sign back in after joining ───────────────────────

  describe('employee sign-in after redeeming', () => {
    it('lets the employee sign in with the password they chose', async () => {
      const { accessToken } = await signup();
      const allocRes = await app.request('http://localhost/api/v1/keypasses/allocate', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ quantity: 1 }),
      });
      const [code] = ((await allocRes.json()) as any).data.codes;
      const email = `returning-${Date.now()}@example.com`;

      const useRes = await app.request('http://localhost/api/v1/keypasses/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email, password: 'Employee-Pass-2026' }),
      });
      expect(useRes.status).toBe(200);

      const loginRes = await app.request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'Employee-Pass-2026' }),
      });
      expect(loginRes.status).toBe(200);
      expect(((await loginRes.json()) as any).data.user.role).toBe('employee');
    });

    it('requires an email and a strong password', async () => {
      const { accessToken } = await signup();
      const allocRes = await app.request('http://localhost/api/v1/keypasses/allocate', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ quantity: 1 }),
      });
      const [code] = ((await allocRes.json()) as any).data.codes;

      for (const body of [{ code }, { code, email: 'a@example.com' }, { code, email: 'a@example.com', password: 'short' }]) {
        const res = await app.request('http://localhost/api/v1/keypasses/use', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        expect(res.status).toBe(400);
      }
    });
  });

  // ── Package limits ─────────────────────────────────────────────

  describe('package limits', () => {
    const DAY_MS = 24 * 60 * 60 * 1000;

    async function allocate(accessToken: string, body: Record<string, unknown> = { quantity: 1, expiresInDays: 365 }, path = 'allocate') {
      const res = await app.request(`http://localhost/api/v1/keypasses/${path}`, {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify(body),
      });
      return { res, json: (await res.json()) as any };
    }

    it('does not let a code outlive the package that paid for it', async () => {
      // pkg_full runs for 365 days; this one was bought 360 days ago, so 5 days remain
      const user = await createAuthenticatedUser({ name: 'KP User', organisationName: 'KP Org' });
      const boughtAt = new Date(Date.now() - 360 * DAY_MS);
      seedPurchase(user.organisationId, user.userId, 'pkg_full', boughtAt.toISOString());

      const { res, json } = await allocate(user.accessToken, { quantity: 1, expiresInDays: 365 });
      expect(res.status).toBe(200);
      const packageEnd = boughtAt.getTime() + 365 * DAY_MS;
      expect(new Date(json.data.expiresAt).getTime()).toBeLessThanOrEqual(packageEnd);
      expect(new Date(json.data.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it('keeps the requested expiry when the package lasts longer', async () => {
      const { accessToken } = await signup();
      const { json } = await allocate(accessToken, { quantity: 1, expiresInDays: 30 });
      const days = (new Date(json.data.expiresAt).getTime() - Date.now()) / DAY_MS;
      expect(days).toBeGreaterThan(29);
      expect(days).toBeLessThanOrEqual(30);
    });

    it('caps codes at the yearly package end even when a one-time Starter is also active', async () => {
      // Starter never ends; Professional (365 days) was bought 335 days ago, so 30 days remain
      const user = await createAuthenticatedUser({ name: 'KP User', organisationName: 'KP Org' });
      seedPurchase(user.organisationId, user.userId, 'pkg_basic', new Date(Date.now() - 400 * DAY_MS).toISOString());
      const boughtAt = new Date(Date.now() - 335 * DAY_MS);
      seedPurchase(user.organisationId, user.userId, 'pkg_training', boughtAt.toISOString());

      const { res, json } = await allocate(user.accessToken, { quantity: 1, expiresInDays: 365 });
      expect(res.status).toBe(200);
      expect(new Date(json.data.expiresAt).getTime()).toBeLessThanOrEqual(boughtAt.getTime() + 365 * DAY_MS);

      const quota = await app.request(`http://localhost/api/v1/keypasses/organisation/${user.organisationId}/quota`, { headers: authHeaders(user.accessToken) });
      const q = (await quota.json()) as any;
      expect(new Date(q.data.packageEndsAt).getTime()).toBe(boughtAt.getTime() + 365 * DAY_MS);
    });

    it('counts a renewal already paid for when capping codes', async () => {
      // Current term ends in 30 days; an early renewal adds another year after it
      const user = await createAuthenticatedUser({ name: 'KP User', organisationName: 'KP Org' });
      const boughtAt = new Date(Date.now() - 335 * DAY_MS);
      seedPurchase(user.organisationId, user.userId, 'pkg_training', boughtAt.toISOString());
      seedPurchase(user.organisationId, user.userId, 'pkg_training', new Date(Date.now() - DAY_MS).toISOString());

      const { json } = await allocate(user.accessToken, { quantity: 1, expiresInDays: 90 });
      const days = (new Date(json.data.expiresAt).getTime() - Date.now()) / DAY_MS;
      expect(days).toBeGreaterThan(89);
    });

    it('stops codes from a lapsed Professional working once Starter\'s single key-pass is used', async () => {
      const user = await createAuthenticatedUser({ name: 'KP User', organisationName: 'KP Org' });
      seedPurchase(user.organisationId, user.userId, 'pkg_basic', new Date(Date.now() - 400 * DAY_MS).toISOString());
      const proId = seedPurchase(user.organisationId, user.userId, 'pkg_training') as string;
      const { json } = await allocate(user.accessToken, { quantity: 2, expiresInDays: 30 });
      const [first, second] = json.data.codes;

      // Professional ends; only Starter (1 key-pass) remains
      purchasesById.get(proId)!.createdAt = new Date(Date.now() - 400 * DAY_MS).toISOString();

      const join = (code: string, tag: string) => app.request('http://localhost/api/v1/keypasses/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email: `${tag}+${Date.now()}@example.com`, password: 'Employee-Pass-2026', name: tag }),
      });
      expect((await join(first, 'one')).status).toBe(200);
      const refused = await join(second, 'two');
      expect(refused.status).toBe(403);
      expect(((await refused.json()) as any).error.code).toBe('PACKAGE_INACTIVE');
    });

    it('refuses to redeem or validate a code once the package has lapsed, and leaves the code unused', async () => {
      const user = await createAuthenticatedUser({ name: 'KP User', organisationName: 'KP Org' });
      const purchaseId = seedPurchase(user.organisationId, user.userId) as string;
      const { json } = await allocate(user.accessToken, { quantity: 1, expiresInDays: 30 });
      const code = json.data.codes[0];

      // The package ends: bought more than a year ago
      purchasesById.get(purchaseId)!.createdAt = new Date(Date.now() - 400 * DAY_MS).toISOString();

      const use = await app.request('http://localhost/api/v1/keypasses/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email: `late+${Date.now()}@example.com`, password: 'Employee-Pass-2026', name: 'Late' }),
      });
      expect(use.status).toBe(403);
      expect(((await use.json()) as any).error.code).toBe('PACKAGE_INACTIVE');

      const validate = await app.request('http://localhost/api/v1/keypasses/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      expect(validate.status).toBe(403);

      // Renewing the package makes the same code work again, so it was not burned
      seedPurchase(user.organisationId, user.userId);
      const retry = await app.request('http://localhost/api/v1/keypasses/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email: `renewed+${Date.now()}@example.com`, password: 'Employee-Pass-2026', name: 'Back' }),
      });
      expect(retry.status).toBe(200);
    });

    it('issues codes under both /generate and /allocate', async () => {
      const { accessToken } = await signup();
      for (const path of ['generate', 'allocate']) {
        const { res, json } = await allocate(accessToken, { quantity: 1 }, path);
        expect(res.status).toBe(200);
        expect(json.data.codes).toHaveLength(1);
      }
    });

    it('does not return the internal organisation id when validating a code', async () => {
      const { accessToken } = await signup();
      const { json } = await allocate(accessToken, { quantity: 1 });
      const res = await app.request('http://localhost/api/v1/keypasses/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: json.data.codes[0] }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.valid).toBe(true);
      expect(body.data.organisationId).toBeUndefined();
    });

    it('allows about 20 redemption attempts a minute so shared offices are not locked out', () => {
      expect(RATE_LIMITS.KEYPASS_MAX).toBeGreaterThanOrEqual(20);
    });
  });
});
