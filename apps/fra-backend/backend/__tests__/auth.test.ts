/// <reference types="jest" />

import { app, createAuthenticatedUser, authHeaders } from './helpers';

// Helper to create a user and return tokens (keeps res/json shape for auth-specific tests)
async function signup(overrides: Record<string, unknown> = {}) {
  const email = overrides.email as string ?? `test+${Date.now()}+${Math.random().toString(36).slice(2)}@example.com`;
  const res = await app.request('http://localhost/api/v1/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: 'SecurePass123!',
      name: 'Test User',
      organisationName: 'Test Org',
      ...overrides,
    }),
  });
  const json = (await res.json()) as any;
  return { res, json, email };
}

describe('Auth endpoints', () => {
  // ── POST /auth/signup ──────────────────────────────────────────

  describe('POST /auth/signup', () => {
    it('creates a new user and returns tokens', async () => {
      const { res, json } = await signup();
      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.accessToken).toBeTruthy();
      expect(json.data.refreshToken).toBeTruthy();
      expect(json.data.user.userId).toBeTruthy();
      expect(json.data.user.role).toBe('employer');
      expect(json.data.organisation.organisationId).toBeTruthy();
    });

    it('rejects duplicate email', async () => {
      const { email } = await signup();
      const res = await app.request('http://localhost/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: 'SecurePass123!',
          name: 'Another User',
        }),
      });
      expect(res.status).toBe(409);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('SIGNUP_FAILED');
    });

    it('rejects weak password (too short)', async () => {
      const res = await app.request('http://localhost/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `weak+${Date.now()}@example.com`,
          password: 'Short1',
          name: 'User',
        }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects password without uppercase', async () => {
      const res = await app.request('http://localhost/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `weak+${Date.now()}@example.com`,
          password: 'lowercaseonly123',
          name: 'User',
        }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects invalid email', async () => {
      const res = await app.request('http://localhost/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'not-an-email',
          password: 'SecurePass123!',
          name: 'User',
        }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects empty body', async () => {
      const res = await app.request('http://localhost/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(res.status).toBe(400);
    });

    it('does not expose passwordHash in response', async () => {
      const { json } = await signup();
      expect(json.data.user.passwordHash).toBeUndefined();
      expect(json.data.user.password).toBeUndefined();
    });
  });

  // ── POST /auth/login ──────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('logs in an existing user', async () => {
      const { email } = await signup();
      const res = await app.request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'SecurePass123!' }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.accessToken).toBeTruthy();
      expect(json.data.refreshToken).toBeTruthy();
    });

    it('rejects wrong password', async () => {
      const { email } = await signup();
      const res = await app.request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'WrongPassword1!' }),
      });
      expect(res.status).toBe(401);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('rejects non-existent email', async () => {
      const res = await app.request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nope@nowhere.com', password: 'SecurePass123!' }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects empty body', async () => {
      const res = await app.request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(res.status).toBe(400);
    });
  });

  // ── GET /auth/me ──────────────────────────────────────────────

  describe('GET /auth/me', () => {
    it('returns current user with valid token', async () => {
      const { json: signupJson, email } = await signup();
      const res = await app.request('http://localhost/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${signupJson.data.accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.data.email).toBe(email.toLowerCase());
    });

    it('rejects request without token', async () => {
      const res = await app.request('http://localhost/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('rejects request with invalid token', async () => {
      const res = await app.request('http://localhost/api/v1/auth/me', {
        headers: { Authorization: 'Bearer invalid.token.here' },
      });
      expect(res.status).toBe(401);
    });
  });

  // ── POST /auth/logout ─────────────────────────────────────────

  describe('POST /auth/logout', () => {
    it('accepts logout with refresh token', async () => {
      const { json: signupJson } = await signup();
      const res = await app.request('http://localhost/api/v1/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: signupJson.data.refreshToken }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
    });

    it('accepts logout without refresh token', async () => {
      const res = await app.request('http://localhost/api/v1/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(res.status).toBe(200);
    });
  });

  // ── POST /auth/forgot-password ─────────────────────────────────

  describe('POST /auth/forgot-password', () => {
    it('returns success for existing user', async () => {
      const { email } = await signup();
      const res = await app.request('http://localhost/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
    });

    it('returns success for non-existent email (prevents enumeration)', async () => {
      const res = await app.request('http://localhost/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ghost@nowhere.com' }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
    });

    it('rejects invalid payload', async () => {
      const res = await app.request('http://localhost/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(res.status).toBe(400);
    });
  });

  // ── POST /auth/reset-password ──────────────────────────────────

  describe('POST /auth/reset-password', () => {
    it('resets password with valid token', async () => {
      const { email } = await signup();
      // Request a reset token
      const forgotRes = await app.request('http://localhost/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const forgotJson = (await forgotRes.json()) as any;
      const resetToken = forgotJson.data?.resetToken;
      if (!resetToken) return; // skip if no Redis (in-memory fallback stores tokens)

      const res = await app.request('http://localhost/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword: 'NewSecurePass1!' }),
      });
      expect(res.status).toBe(200);

      // Login with new password
      const loginRes = await app.request('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'NewSecurePass1!' }),
      });
      expect(loginRes.status).toBe(200);
    });

    it('rejects invalid reset token', async () => {
      const res = await app.request('http://localhost/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'invalid-token', newPassword: 'NewSecurePass1!' }),
      });
      expect(res.status).toBe(400);
    });
  });

  // ── PATCH /auth/profile ──────────────────────────────────────────

  describe('PATCH /auth/profile', () => {
    it('rejects without auth', async () => {
      const res = await app.request('http://localhost/api/v1/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects empty payload', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/auth/profile', {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it('updates name', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/auth/profile', {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ name: 'Updated Name' }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('Updated Name');
    });

    it('updates department', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/auth/profile', {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ department: 'Finance' }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.department).toBe('Finance');
    });

    it('updates both name and department', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/auth/profile', {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ name: 'Jane Doe', department: 'Engineering' }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.data.name).toBe('Jane Doe');
      expect(json.data.department).toBe('Engineering');
    });

    it('clears department with empty string', async () => {
      const { accessToken } = await createAuthenticatedUser();
      // Set department first
      await app.request('http://localhost/api/v1/auth/profile', {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ department: 'HR' }),
      });
      // Clear it
      const res = await app.request('http://localhost/api/v1/auth/profile', {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ department: '' }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.data.department).toBeNull();
    });

    it('rejects name over 255 characters', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/auth/profile', {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ name: 'a'.repeat(256) }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects empty name', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/auth/profile', {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ name: '' }),
      });
      expect(res.status).toBe(400);
    });

    it('persists changes visible in /auth/me', async () => {
      const { accessToken } = await createAuthenticatedUser();
      await app.request('http://localhost/api/v1/auth/profile', {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ name: 'Persisted Name' }),
      });
      const meRes = await app.request('http://localhost/api/v1/auth/me', {
        headers: authHeaders(accessToken),
      });
      expect(meRes.status).toBe(200);
      const meJson = (await meRes.json()) as any;
      expect(meJson.data.name).toBe('Persisted Name');
    });
  });
});
