/// <reference types="jest" />

import { app, createAuthenticatedUser, authHeaders, seedPurchase } from './helpers';

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
        body: JSON.stringify({ code, email: empEmail, name: 'Employee One' }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.accessToken).toBeTruthy();
      expect(json.data.refreshToken).toBeTruthy();
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
        body: JSON.stringify({ code, email: `emp1+${Date.now()}@example.com`, name: 'Emp 1' }),
      });

      // Try to use again
      const res = await app.request('http://localhost/api/v1/keypasses/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email: `emp2+${Date.now()}@example.com`, name: 'Emp 2' }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects non-existent keypass code', async () => {
      const res = await app.request('http://localhost/api/v1/keypasses/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'NONEXISTENT1234', email: 'emp@example.com', name: 'Emp' }),
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
});
