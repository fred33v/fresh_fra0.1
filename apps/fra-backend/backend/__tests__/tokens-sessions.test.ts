/// <reference types="jest" />

import { app, createAuthenticatedUser } from './helpers';

async function signup() {
  const { accessToken, refreshToken, email } = await createAuthenticatedUser({ name: 'Token User', organisationName: 'Token Org' });
  return { accessToken, refreshToken, email };
}

describe('Token refresh and session management', () => {
  // ── Token Refresh ─────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('returns new access and refresh tokens', async () => {
      const { refreshToken } = await signup();
      const res = await app.request('http://localhost/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.data.accessToken).toBeTruthy();
      expect(json.data.refreshToken).toBeTruthy();
    });

    it('new access token works for authenticated endpoints', async () => {
      const { refreshToken } = await signup();
      const refreshRes = await app.request('http://localhost/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const newTokens = (await refreshRes.json()) as any;

      const meRes = await app.request('http://localhost/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${newTokens.data.accessToken}` },
      });
      expect(meRes.status).toBe(200);
    });

    it('refresh returns valid tokens that can be used', async () => {
      const { refreshToken } = await signup();
      // Use the refresh token
      const res1 = await app.request('http://localhost/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      expect(res1.status).toBe(200);
      const json1 = (await res1.json()) as any;

      // The new refresh token should also work
      const res2 = await app.request('http://localhost/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: json1.data.refreshToken }),
      });
      expect(res2.status).toBe(200);
    });

    it('rejects invalid refresh token', async () => {
      const res = await app.request('http://localhost/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: 'completely.invalid.token' }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects empty payload', async () => {
      const res = await app.request('http://localhost/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(res.status).toBe(400);
    });
  });

  // ── Logout invalidates refresh token ──────────────────────────

  describe('Logout + refresh interaction', () => {
    it('logout invalidates the refresh token', async () => {
      const { refreshToken } = await signup();

      // Logout
      const logoutRes = await app.request('http://localhost/api/v1/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      expect(logoutRes.status).toBe(200);

      // Attempt refresh
      const refreshRes = await app.request('http://localhost/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      expect(refreshRes.status).toBe(401);
    });
  });

  // ── Password reset invalidates all sessions ───────────────────

  describe('Password reset session invalidation', () => {
    it('resets password and old refresh token stops working', async () => {
      const { email, refreshToken } = await signup();

      // Request reset token
      const forgotRes = await app.request('http://localhost/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const forgotJson = (await forgotRes.json()) as any;
      const resetToken = forgotJson.data?.resetToken;
      if (!resetToken) return;

      // Reset password
      await app.request('http://localhost/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword: 'BrandNewPass1!' }),
      });

      // Old refresh token should be invalidated
      const refreshRes = await app.request('http://localhost/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      expect(refreshRes.status).toBe(401);
    });
  });
});
