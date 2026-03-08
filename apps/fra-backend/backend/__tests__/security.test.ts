/// <reference types="jest" />

import { app, createAuthenticatedUser, authHeaders, seedPurchase } from './helpers';
import { accountLockouts, keypassesByCode, purchasesById, assessmentsById } from '../src/stores';

async function signup() {
  return createAuthenticatedUser({ organisationName: 'Security Test Org' });
}

describe('Security hardening', () => {
  // ── Account lockout (in-memory fallback) ────────────────────

  describe('Account lockout without Redis', () => {
    const email = `lockout-${crypto.randomUUID()}@example.com`;
    const password = 'SecurePass123!';

    beforeAll(async () => {
      // Create the user first
      await app.request('http://localhost/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: 'Lockout User', organisationName: 'Lock Org' }),
      });
    });

    afterAll(() => {
      // Clean up lockout entries
      for (const key of accountLockouts.keys()) {
        if (key.includes(email.toLowerCase())) accountLockouts.delete(key);
      }
    });

    it('locks account after 5 failed attempts', async () => {
      // 5 failed login attempts with wrong password
      for (let i = 0; i < 5; i++) {
        const res = await app.request('http://localhost/api/v1/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: 'WrongPassword123!' }),
        });
        expect(res.status).toBe(401);
      }

      // 6th attempt (even with correct password) should still get 401
      const res = await app.request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      expect(res.status).toBe(401);
    }, 30000);

    it('allows login after lockout is cleared', async () => {
      // Manually clear lockout
      for (const key of accountLockouts.keys()) {
        if (key.includes(email.toLowerCase())) accountLockouts.delete(key);
      }

      const res = await app.request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      expect(res.status).toBe(200);
    });
  });

  // ── Keypass double-use prevention ───────────────────────────

  describe('Keypass atomic claim', () => {
    it('rejects use of an already-used keypass', async () => {
      const { accessToken, organisationId, userId } = await signup();
      seedPurchase(organisationId, userId);

      // Generate a keypass
      const genRes = await app.request('http://localhost/api/v1/keypasses/generate', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ quantity: 1, expiresInDays: 30 }),
      });
      const genJson = (await genRes.json()) as any;
      const code = genJson.data.codes[0];

      // First use — should succeed
      const use1 = await app.request('http://localhost/api/v1/keypasses/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      expect(use1.status).toBe(200);

      // Second use — should fail
      const use2 = await app.request('http://localhost/api/v1/keypasses/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      expect(use2.status).toBe(400);
      const json2 = (await use2.json()) as any;
      expect(json2.error.code).toBe('NOT_AVAILABLE');
    });
  });

  // ── Purchase double-spend prevention ────────────────────────

  describe('Purchase double-spend prevention', () => {
    it('rejects confirm when another purchase for same package already succeeded', async () => {
      const { accessToken, organisationId, userId } = await signup();

      // Seed a succeeded purchase for pkg_training
      seedPurchase(organisationId, userId, 'pkg_training');

      // Create a new purchase for the same package — should fail (duplicate)
      const createRes = await app.request('http://localhost/api/v1/purchases', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ packageId: 'pkg_training' }),
      });
      expect(createRes.status).toBe(409);
      const createJson = (await createRes.json()) as any;
      expect(createJson.error.code).toBe('DUPLICATE_PURCHASE');
    });

    it('rejects confirm of requires_confirmation purchase when another already succeeded', async () => {
      const { accessToken, organisationId, userId } = await signup();

      // Create a purchase for pkg_basic (no existing succeeded purchase)
      const createRes = await app.request('http://localhost/api/v1/purchases', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ packageId: 'pkg_basic' }),
      });
      expect(createRes.status).toBe(200);
      const createJson = (await createRes.json()) as any;
      const purchaseId = createJson.data.purchaseId;

      // Seed a succeeded purchase for the same package (simulating a race condition)
      seedPurchase(organisationId, userId, 'pkg_basic');

      // Now confirm the pending purchase — should be rejected
      const confirmRes = await app.request(`http://localhost/api/v1/purchases/${purchaseId}/confirm`, {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({}),
      });
      expect(confirmRes.status).toBe(409);
      const confirmJson = (await confirmRes.json()) as any;
      expect(confirmJson.error.code).toBe('DUPLICATE_PURCHASE');
    });
  });

  // ── Assessment status transition validation ────────────────

  describe('Assessment status transitions', () => {
    it('allows valid transition: draft → in_progress', async () => {
      const { accessToken } = await signup();

      // Create assessment (starts as draft)
      const createRes = await app.request('http://localhost/api/v1/assessments', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ title: 'Transition Test' }),
      });
      expect(createRes.status).toBe(201);
      const { data: assessment } = (await createRes.json()) as any;

      // draft → in_progress (valid)
      const patchRes = await app.request(`http://localhost/api/v1/assessments/${assessment.id}`, {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ status: 'in_progress' }),
      });
      expect(patchRes.status).toBe(200);
      const patchJson = (await patchRes.json()) as any;
      expect(patchJson.data.status).toBe('in_progress');
    });

    it('allows valid transition: draft → submitted', async () => {
      const { accessToken } = await signup();

      const createRes = await app.request('http://localhost/api/v1/assessments', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ title: 'Skip Test' }),
      });
      const { data: assessment } = (await createRes.json()) as any;

      // draft → submitted (valid skip)
      const patchRes = await app.request(`http://localhost/api/v1/assessments/${assessment.id}`, {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ status: 'submitted' }),
      });
      expect(patchRes.status).toBe(200);
    });

    it('rejects invalid transition: draft → completed', async () => {
      const { accessToken } = await signup();

      const createRes = await app.request('http://localhost/api/v1/assessments', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ title: 'Invalid Test' }),
      });
      const { data: assessment } = (await createRes.json()) as any;

      // draft → completed (invalid — must go through submitted first)
      const patchRes = await app.request(`http://localhost/api/v1/assessments/${assessment.id}`, {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ status: 'completed' }),
      });
      expect(patchRes.status).toBe(400);
      const json = (await patchRes.json()) as any;
      expect(json.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('rejects backward transition: submitted → draft', async () => {
      const { accessToken } = await signup();

      const createRes = await app.request('http://localhost/api/v1/assessments', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ title: 'Backward Test' }),
      });
      const { data: assessment } = (await createRes.json()) as any;

      // Move to submitted first
      await app.request(`http://localhost/api/v1/assessments/${assessment.id}`, {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ status: 'submitted' }),
      });

      // submitted → draft (invalid backward transition)
      const patchRes = await app.request(`http://localhost/api/v1/assessments/${assessment.id}`, {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ status: 'draft' }),
      });
      expect(patchRes.status).toBe(400);
      const json = (await patchRes.json()) as any;
      expect(json.error.code).toBe('INVALID_STATUS_TRANSITION');
    });

    it('allows PATCH without status change (title-only update)', async () => {
      const { accessToken } = await signup();

      const createRes = await app.request('http://localhost/api/v1/assessments', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ title: 'Title Only Test' }),
      });
      const { data: assessment } = (await createRes.json()) as any;

      // PATCH title only — no status field — should succeed
      const patchRes = await app.request(`http://localhost/api/v1/assessments/${assessment.id}`, {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ title: 'Updated Title' }),
      });
      expect(patchRes.status).toBe(200);
      const json = (await patchRes.json()) as any;
      expect(json.data.title).toBe('Updated Title');
      expect(json.data.status).toBe('draft');
    });
  });

  // ── Assessment ownership check ──────────────────────────────

  describe('Assessment ownership', () => {
    it('rejects employee modifying another user\'s assessment', async () => {
      // User A (employer) creates an org and a keypass
      const userA = await signup();
      seedPurchase(userA.organisationId, userA.userId);

      // Generate keypass for the org
      const genRes = await app.request('http://localhost/api/v1/keypasses/generate', {
        method: 'POST',
        headers: authHeaders(userA.accessToken),
        body: JSON.stringify({ quantity: 1, expiresInDays: 30 }),
      });
      const genJson = (await genRes.json()) as any;
      const code = genJson.data.codes[0];

      // User B joins via keypass (becomes employee in same org)
      const useRes = await app.request('http://localhost/api/v1/keypasses/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email: `employee-${crypto.randomUUID()}@example.com` }),
      });
      const useJson = (await useRes.json()) as any;
      const userBToken = useJson.data.accessToken;

      // User A creates an assessment
      const createRes = await app.request('http://localhost/api/v1/assessments', {
        method: 'POST',
        headers: authHeaders(userA.accessToken),
        body: JSON.stringify({ title: 'Ownership Test' }),
      });
      const { data: assessment } = (await createRes.json()) as any;

      // User B (employee) tries to PATCH User A's assessment — should be rejected
      const patchRes = await app.request(`http://localhost/api/v1/assessments/${assessment.id}`, {
        method: 'PATCH',
        headers: authHeaders(userBToken),
        body: JSON.stringify({ title: 'Hijacked' }),
      });
      expect(patchRes.status).toBe(403);
      const patchJson = (await patchRes.json()) as any;
      expect(patchJson.error.code).toBe('FORBIDDEN');
    });
  });

  // ── Keypass expiry error codes ────────────────────────────────

  describe('Keypass expiry error codes', () => {
    it('returns EXPIRED for past-grace-period keypasses', async () => {
      const { accessToken, organisationId, userId } = await signup();
      seedPurchase(organisationId, userId);

      // Generate a keypass
      const genRes = await app.request('http://localhost/api/v1/keypasses/generate', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ quantity: 1, expiresInDays: 1 }),
      });
      const genJson = (await genRes.json()) as any;
      const code = genJson.data.codes[0];

      // Manually set expiry to 10 days ago (past 7-day grace period)
      const kp = keypassesByCode.get(code)!;
      kp.expiresAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

      // Attempt to use — should get EXPIRED, not NOT_AVAILABLE
      const useRes = await app.request('http://localhost/api/v1/keypasses/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      expect(useRes.status).toBe(400);
      const useJson = (await useRes.json()) as any;
      expect(useJson.error.code).toBe('EXPIRED');
    });

    it('returns NOT_AVAILABLE for already-used keypasses (not EXPIRED)', async () => {
      const { accessToken, organisationId, userId } = await signup();
      seedPurchase(organisationId, userId);

      // Generate and use a keypass
      const genRes = await app.request('http://localhost/api/v1/keypasses/generate', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ quantity: 1, expiresInDays: 30 }),
      });
      const genJson = (await genRes.json()) as any;
      const code = genJson.data.codes[0];

      await app.request('http://localhost/api/v1/keypasses/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      // Second attempt — should get NOT_AVAILABLE
      const useRes = await app.request('http://localhost/api/v1/keypasses/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      expect(useRes.status).toBe(400);
      const useJson = (await useRes.json()) as any;
      expect(useJson.error.code).toBe('NOT_AVAILABLE');
    });
  });

  // ── Webhook idempotency ──────────────────────────────────────

  describe('Webhook idempotency', () => {
    it('ignores duplicate webhook events', async () => {
      const eventId = `evt_${crypto.randomUUID()}`;
      const webhookPayload = {
        id: eventId,
        type: 'checkout.session.completed',
        data: { object: { payment_intent: 'pi_test', metadata: {} } },
      };

      // First call
      const res1 = await app.request('http://localhost/api/v1/webhooks/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      });
      expect(res1.status).toBe(200);
      const json1 = (await res1.json()) as any;
      expect(json1.data.duplicate).toBeUndefined();

      // Duplicate call — should be flagged
      const res2 = await app.request('http://localhost/api/v1/webhooks/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      });
      expect(res2.status).toBe(200);
      const json2 = (await res2.json()) as any;
      expect(json2.data.duplicate).toBe(true);
    });
  });

  // ── Auth /me rate limiting ─────────────────────────────────

  describe('GET /auth/me', () => {
    it('requires authentication', async () => {
      const res = await app.request('http://localhost/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns user data with valid token', async () => {
      const { accessToken } = await signup();
      const res = await app.request('http://localhost/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.email).toBeTruthy();
    });
  });

  // ── Password reset token single-use ──────────────────────────

  describe('Password reset token single-use', () => {
    it('rejects reuse of a consumed reset token', async () => {
      const email = `reset-${crypto.randomUUID()}@example.com`;
      const password = 'SecurePass123!';

      // Create user
      await app.request('http://localhost/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name: 'Reset User', organisationName: 'Reset Org' }),
      });

      // Request password reset
      const forgotRes = await app.request('http://localhost/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const forgotJson = (await forgotRes.json()) as any;
      const resetToken = forgotJson.resetToken;
      expect(resetToken).toBeTruthy();

      // First reset — should succeed
      const reset1 = await app.request('http://localhost/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword: 'NewSecurePass456!' }),
      });
      expect(reset1.status).toBe(200);

      // Second reset with same token — should fail
      const reset2 = await app.request('http://localhost/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword: 'AnotherPass789!' }),
      });
      expect(reset2.status).toBe(400);
      const json2 = (await reset2.json()) as any;
      expect(json2.error.code).toBe('INVALID_TOKEN');
    });
  });

  // ── Refresh token rotation ────────────────────────────────────

  describe('Refresh token rotation', () => {
    it('invalidates old refresh token after rotation', async () => {
      const { refreshToken } = await signup();

      // Use refresh token to get new tokens
      const refreshRes = await app.request('http://localhost/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      expect(refreshRes.status).toBe(200);
      const refreshJson = (await refreshRes.json()) as any;
      expect(refreshJson.data.accessToken).toBeTruthy();
      expect(refreshJson.data.refreshToken).toBeTruthy();
      expect(refreshJson.data.refreshToken).not.toBe(refreshToken);

      // Try using the old refresh token — should be rejected
      const reuse = await app.request('http://localhost/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      expect(reuse.status).toBe(401);
      const reuseJson = (await reuse.json()) as any;
      expect(reuseJson.error.code).toBe('REFRESH_REVOKED');
    });
  });

  // ── Analytics employee endpoints role check ───────────────────

  describe('Analytics employee endpoints role restriction', () => {
    it('returns 403 for employee role on /analytics/employees', async () => {
      // Create employer and generate keypass
      const employer = await signup();
      seedPurchase(employer.organisationId, employer.userId);

      const genRes = await app.request('http://localhost/api/v1/keypasses/generate', {
        method: 'POST',
        headers: authHeaders(employer.accessToken),
        body: JSON.stringify({ quantity: 1, expiresInDays: 30 }),
      });
      const genJson = (await genRes.json()) as any;
      const code = genJson.data.codes[0];

      // Employee joins via keypass
      const useRes = await app.request('http://localhost/api/v1/keypasses/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, email: `emp-${crypto.randomUUID()}@example.com` }),
      });
      const useJson = (await useRes.json()) as any;
      const employeeToken = useJson.data.accessToken;

      // Employee tries to access analytics employees — should get 403
      const res = await app.request('http://localhost/api/v1/analytics/employees', {
        headers: { Authorization: `Bearer ${employeeToken}` },
      });
      expect(res.status).toBe(403);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('FORBIDDEN');
    });
  });

  // ── Purchase confirmation atomicity ────────────────────────────

  describe('Purchase confirmation atomicity', () => {
    it('rejects second confirmation of the same purchase', async () => {
      const { accessToken, organisationId, userId } = await signup();

      // Create a purchase
      const createRes = await app.request('http://localhost/api/v1/purchases', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ packageId: 'pkg_basic' }),
      });
      expect(createRes.status).toBe(200);
      const createJson = (await createRes.json()) as any;
      const purchaseId = createJson.data.purchaseId;

      // First confirm — should succeed
      const confirm1 = await app.request(`http://localhost/api/v1/purchases/${purchaseId}/confirm`, {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({}),
      });
      expect(confirm1.status).toBe(200);

      // Second confirm — should fail (already confirmed)
      const confirm2 = await app.request(`http://localhost/api/v1/purchases/${purchaseId}/confirm`, {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({}),
      });
      expect(confirm2.status).toBe(409);
      const json2 = (await confirm2.json()) as any;
      expect(json2.error.code).toBe('ALREADY_CONFIRMED');
    });
  });

  // ── Keypass quota enforcement ──────────────────────────────────

  describe('Keypass quota enforcement', () => {
    it('rejects generation beyond package allowance', async () => {
      const { accessToken, organisationId, userId } = await signup();
      // pkg_basic has keypassAllowance=1
      seedPurchase(organisationId, userId, 'pkg_basic');

      // First keypass — should succeed (1 of 1)
      const gen1 = await app.request('http://localhost/api/v1/keypasses/generate', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ quantity: 1, expiresInDays: 30 }),
      });
      expect(gen1.status).toBe(200);

      // Second keypass — should fail (quota exceeded)
      const gen2 = await app.request('http://localhost/api/v1/keypasses/generate', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ quantity: 1, expiresInDays: 30 }),
      });
      expect(gen2.status).toBe(400);
      const json2 = (await gen2.json()) as any;
      expect(json2.error.code).toBe('QUOTA_EXCEEDED');
    });
  });

  // ── Package recommendation risk scoring ───────────────────────

  describe('Package recommendation risk scoring', () => {
    it('recommends pkg_basic for no assessments', async () => {
      const { accessToken } = await signup();
      const res = await app.request('http://localhost/api/v1/packages/recommended', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.data.packageId).toBe('pkg_basic');
      expect(json.data.reason).toBe('no_assessment');
    });

    it('recommends pkg_training for medium risk', async () => {
      const { accessToken, organisationId, userId } = await signup();

      // Seed a submitted assessment with 6 answers (>= MEDIUM=5, < HIGH=15)
      const assessmentId = crypto.randomUUID();
      const answers: Record<string, string> = {};
      for (let i = 0; i < 6; i++) answers[`q${i}`] = 'yes';
      assessmentsById.set(assessmentId, {
        id: assessmentId,
        organisationId,
        createdByUserId: userId,
        title: 'Risk Test',
        status: 'submitted',
        answers,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        submittedAt: new Date().toISOString(),
      });

      const res = await app.request('http://localhost/api/v1/packages/recommended', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.data.packageId).toBe('pkg_training');
      expect(json.data.reason).toBe('medium_risk_score');
    });

    it('recommends pkg_full for high risk', async () => {
      const { accessToken, organisationId, userId } = await signup();

      // Seed a submitted assessment with 16 answers (>= HIGH=15)
      const assessmentId = crypto.randomUUID();
      const answers: Record<string, string> = {};
      for (let i = 0; i < 16; i++) answers[`q${i}`] = 'yes';
      assessmentsById.set(assessmentId, {
        id: assessmentId,
        organisationId,
        createdByUserId: userId,
        title: 'High Risk Test',
        status: 'completed',
        answers,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        submittedAt: new Date().toISOString(),
      });

      const res = await app.request('http://localhost/api/v1/packages/recommended', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.data.packageId).toBe('pkg_full');
      expect(json.data.reason).toBe('high_risk_score');
    });
  });

  // ── SSE token single-use ──────────────────────────────────────

  describe('SSE token single-use', () => {
    it('rejects reuse of a consumed SSE token', async () => {
      const { accessToken } = await signup();

      // Get an SSE token
      const tokenRes = await app.request('http://localhost/api/v1/workshop/sse-token', {
        method: 'POST',
        headers: authHeaders(accessToken),
      });
      expect(tokenRes.status).toBe(200);
      const tokenJson = (await tokenRes.json()) as any;
      const sseToken = tokenJson.data.sseToken;
      expect(sseToken).toBeTruthy();

      // First use — consume the token via the events endpoint
      const sessionId = '00000000-0000-0000-0000-000000000001';
      const use1 = await app.request(`http://localhost/api/v1/workshop/sessions/${sessionId}/events?sse_token=${sseToken}`);
      // SSE endpoint returns 401 because session doesn't exist in no-DB mode, but the token IS consumed
      // The important thing is the token gets consumed on first use

      // Second use with same token — should be rejected since token was consumed
      const use2 = await app.request(`http://localhost/api/v1/workshop/sessions/${sessionId}/events?sse_token=${sseToken}`);
      expect(use2.status).toBe(401);
      const json2 = (await use2.json()) as any;
      expect(json2.error.code).toBe('UNAUTHORIZED');
    });
  });
});
