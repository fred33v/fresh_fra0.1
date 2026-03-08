/// <reference types="jest" />

import { app, createAuthenticatedUser, authHeaders, seedPurchase } from './helpers';

async function signup() {
  const { accessToken, email, organisationId, userId } = await createAuthenticatedUser({ name: 'Pay User', organisationName: 'Pay Org' });
  return { accessToken, email, organisationId, userId };
}

describe('Payments & Packages endpoints', () => {
  // ── POST /payments/create-intent ──────────────────────────────

  describe('POST /payments/create-intent', () => {
    it('creates a payment intent', async () => {
      const { accessToken } = await signup();
      const res = await app.request('http://localhost/api/v1/payments/create-intent', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ packageId: 'pkg_basic', currency: 'gbp' }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.clientSecret).toBeTruthy();
      expect(json.data.packageId).toBe('pkg_basic');
    });

    it('rejects without auth', async () => {
      const res = await app.request('http://localhost/api/v1/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: 'pkg_basic' }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects invalid payload', async () => {
      const { accessToken } = await signup();
      const res = await app.request('http://localhost/api/v1/payments/create-intent', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: '{}',
      });
      expect(res.status).toBe(400);
    });
  });

  // ── GET /packages ─────────────────────────────────────────────

  describe('GET /packages', () => {
    it('lists packages', async () => {
      const { accessToken } = await signup();
      const res = await app.request('http://localhost/api/v1/packages', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.data.length).toBeGreaterThan(0);
    });

    it('includes expected package fields', async () => {
      const { accessToken } = await signup();
      const res = await app.request('http://localhost/api/v1/packages', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json = (await res.json()) as any;
      const pkg = json.data[0];
      expect(pkg.id).toBeTruthy();
      expect(pkg.name).toBeTruthy();
      expect(typeof pkg.price).toBe('number');
    });
  });

  // ── GET /packages/recommended ──────────────────────────────────

  describe('GET /packages/recommended', () => {
    it('returns recommended package', async () => {
      const { accessToken } = await signup();
      const res = await app.request('http://localhost/api/v1/packages/recommended', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.packageId).toBe('pkg_basic');
    });
  });

  // ── POST /purchases ───────────────────────────────────────────

  describe('POST /purchases', () => {
    it('creates a purchase', async () => {
      const { accessToken } = await signup();
      const res = await app.request('http://localhost/api/v1/purchases', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ packageId: 'pkg_training' }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.purchaseId).toBeTruthy();
      expect(json.data.packageId).toBe('pkg_training');
      expect(json.data.status).toBe('requires_confirmation');
      expect(json.data.clientSecret).toBeTruthy();
    });

    it('rejects without auth', async () => {
      const res = await app.request('http://localhost/api/v1/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: 'pkg_basic' }),
      });
      expect(res.status).toBe(401);
    });
  });

  // ── POST /purchases/:id/confirm ───────────────────────────────

  describe('POST /purchases/:id/confirm', () => {
    it('confirms a purchase', async () => {
      const { accessToken } = await signup();
      const createRes = await app.request('http://localhost/api/v1/purchases', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ packageId: 'pkg_basic' }),
      });
      const created = (await createRes.json()) as any;

      const res = await app.request(`http://localhost/api/v1/purchases/${created.data.purchaseId}/confirm`, {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ paymentIntentId: created.data.paymentIntentId }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.status).toBe('succeeded');
    });
  });

  // ── GET /purchases/:id ────────────────────────────────────────

  describe('GET /purchases/:id', () => {
    it('gets a purchase by id', async () => {
      const { accessToken } = await signup();
      const createRes = await app.request('http://localhost/api/v1/purchases', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ packageId: 'pkg_full' }),
      });
      const created = (await createRes.json()) as any;

      const res = await app.request(`http://localhost/api/v1/purchases/${created.data.purchaseId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(created.data.purchaseId);
    });

    it('returns 404 for non-existent purchase', async () => {
      const { accessToken } = await signup();
      const res = await app.request('http://localhost/api/v1/purchases/00000000-0000-0000-0000-000000000000', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(404);
    });
  });

  // ── GET /purchases/organisation/:orgId ─────────────────────────

  describe('GET /purchases/organisation/:orgId', () => {
    it('lists purchases for the org', async () => {
      const { accessToken, organisationId } = await signup();
      await app.request('http://localhost/api/v1/purchases', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ packageId: 'pkg_basic' }),
      });

      const res = await app.request(`http://localhost/api/v1/purchases/organisation/${organisationId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(1);
    });

    it('rejects access to other org purchases', async () => {
      const user1 = await signup();
      const user2 = await signup();

      const res = await app.request(`http://localhost/api/v1/purchases/organisation/${user1.organisationId}`, {
        headers: { Authorization: `Bearer ${user2.accessToken}` },
      });
      expect(res.status).toBe(403);
    });
  });

  // ── POST /webhooks/stripe ─────────────────────────────────────

  describe('POST /webhooks/stripe', () => {
    it('accepts a valid webhook payload', async () => {
      const res = await app.request('http://localhost/api/v1/webhooks/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'evt_test_001', type: 'payment_intent.succeeded', data: {} }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.data.received).toBe(true);
    });

    it('rejects invalid payload', async () => {
      const res = await app.request('http://localhost/api/v1/webhooks/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(res.status).toBe(400);
    });

    it('rejects webhook in production when STRIPE_WEBHOOK_SECRET is missing', async () => {
      const origEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      try {
        const res = await app.request('http://localhost/api/v1/webhooks/stripe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: 'evt_test_prod', type: 'payment_intent.succeeded', data: {} }),
        });
        expect(res.status).toBe(500);
        const json = (await res.json()) as any;
        expect(json.error.code).toBe('CONFIGURATION_ERROR');
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });
  });

  // ── Analytics & Reports ────────────────────────────────────────

  describe('GET /analytics/overview', () => {
    it('returns analytics overview', async () => {
      const { accessToken } = await signup();
      const res = await app.request('http://localhost/api/v1/analytics/overview', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.totals).toBeDefined();
      expect(json.data.byStatus).toBeDefined();
    });
  });

  describe('GET /analytics/assessments', () => {
    it('returns assessments timeline', async () => {
      const { accessToken } = await signup();
      // Create an assessment first
      await app.request('http://localhost/api/v1/assessments', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ title: 'For Analytics' }),
      });

      const res = await app.request('http://localhost/api/v1/analytics/assessments', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.items.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /reports/generate', () => {
    it('generates a report', async () => {
      const { accessToken, organisationId, userId } = await signup();
      seedPurchase(organisationId, userId, 'pkg_training');
      const res = await app.request('http://localhost/api/v1/reports/generate', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.reportId).toBeTruthy();
      expect(json.data.status).toBe('generated');
    });

    it('rejects without auth', async () => {
      const res = await app.request('http://localhost/api/v1/reports/generate');
      expect(res.status).toBe(401);
    });
  });
});
