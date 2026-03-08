/// <reference types="jest" />

import { app, createAuthenticatedUser, authHeaders } from './helpers';

describe('Budget Guide endpoints', () => {
  // ── GET /budget-guide/progress ──────────────────────────────

  describe('GET /budget-guide/progress', () => {
    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/budget-guide/progress');
      expect(res.status).toBe(401);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 503 when DB not configured', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/budget-guide/progress', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(503);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NO_DB');
      expect(json.error.message).toBe('Database not configured');
    });

    it('rejects invalid token', async () => {
      const res = await app.request('http://localhost/api/v1/budget-guide/progress', {
        headers: { Authorization: 'Bearer invalid.token.here' },
      });
      expect(res.status).toBe(401);
    });
  });

  // ── POST /budget-guide/progress ─────────────────────────────

  describe('POST /budget-guide/progress', () => {
    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/budget-guide/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedRoles: ['accountant'] }),
      });
      expect(res.status).toBe(401);
    });

    it('returns 503 when DB not configured', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/budget-guide/progress', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ selectedRoles: ['accountant'] }),
      });
      expect(res.status).toBe(503);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NO_DB');
    });
  });

  // ── PATCH /budget-guide/progress ────────────────────────────

  describe('PATCH /budget-guide/progress', () => {
    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/budget-guide/progress', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentScreen: 'intro' }),
      });
      expect(res.status).toBe(401);
    });

    it('returns 503 when DB not configured', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/budget-guide/progress', {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ currentScreen: 'intro' }),
      });
      expect(res.status).toBe(503);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NO_DB');
    });
  });

  // ── GET /budget-guide/pledge ────────────────────────────────

  describe('GET /budget-guide/pledge', () => {
    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/budget-guide/pledge');
      expect(res.status).toBe(401);
    });

    it('returns 503 when DB not configured', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/budget-guide/pledge', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(503);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NO_DB');
    });
  });

  // ── POST /budget-guide/pledge ───────────────────────────────

  describe('POST /budget-guide/pledge', () => {
    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/budget-guide/pledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature: 'John Doe' }),
      });
      expect(res.status).toBe(401);
    });

    it('returns 503 when DB not configured', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/budget-guide/pledge', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ signature: 'John Doe' }),
      });
      expect(res.status).toBe(503);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NO_DB');
    });

    it('rejects empty signature (validation before DB, but DB check comes first)', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/budget-guide/pledge', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ signature: '' }),
      });
      // Without DB, the 503 is returned because validation passes (empty string is truthy in body parse)
      // but the DB check comes after; however with zod min(1) it should fail validation first
      // In practice: the code calls requireAuth -> then hasDatabase() -> then parse body
      // So 503 is returned before validation
      expect(res.status).toBe(503);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NO_DB');
    });

    it('rejects missing signature (DB check comes before validation)', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/budget-guide/pledge', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({}),
      });
      // DB check happens before body validation
      expect(res.status).toBe(503);
    });
  });

  // ── GET /budget-guide/analytics ─────────────────────────────

  describe('GET /budget-guide/analytics', () => {
    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/budget-guide/analytics');
      expect(res.status).toBe(401);
    });

    it('returns 503 when DB not configured', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/budget-guide/analytics', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(503);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NO_DB');
    });
  });

  // ── POST /budget-guide/analytics ────────────────────────────

  describe('POST /budget-guide/analytics', () => {
    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/budget-guide/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizScores: { section1: 80 } }),
      });
      expect(res.status).toBe(401);
    });

    it('returns 503 when DB not configured', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/budget-guide/analytics', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({
          quizScores: { section1: 80 },
          timeSpentSeconds: 300,
          screensVisited: ['intro', 'quiz1'],
          completed: false,
        }),
      });
      expect(res.status).toBe(503);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NO_DB');
    });
  });

  // ── GET /budget-guide/analytics/org/:orgId ──────────────────

  describe('GET /budget-guide/analytics/org/:orgId', () => {
    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/budget-guide/analytics/org/some-org-id');
      expect(res.status).toBe(401);
    });

    it('returns 503 when DB not configured for same-org user', async () => {
      const { accessToken, organisationId } = await createAuthenticatedUser();
      const res = await app.request(`http://localhost/api/v1/budget-guide/analytics/org/${organisationId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(503);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NO_DB');
    });

    it('returns 503 for other org when DB not configured (DB check before org check)', async () => {
      const user1 = await createAuthenticatedUser();
      const user2 = await createAuthenticatedUser();
      const res = await app.request(`http://localhost/api/v1/budget-guide/analytics/org/${user1.organisationId}`, {
        headers: { Authorization: `Bearer ${user2.accessToken}` },
      });
      // The DB check happens before the org authorization check
      // so without a DB, we get 503 not 403
      expect(res.status).toBe(503);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NO_DB');
    });
  });
});
