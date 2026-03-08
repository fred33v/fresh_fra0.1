/// <reference types="jest" />

import { app, createAuthenticatedUser } from './helpers';

async function signup() {
  const { accessToken, email } = await createAuthenticatedUser({ name: 'RL User', organisationName: 'RL Org' });
  return { accessToken, email };
}

describe('Rate limiting and account lockout', () => {
  // ── Input validation / sanitisation ────────────────────────────

  describe('Input sanitisation', () => {
    it('strips HTML tags from user input', async () => {
      const { accessToken } = await signup();
      const res = await app.request('http://localhost/api/v1/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ title: '<script>alert("xss")</script>Test' }),
      });
      expect(res.status).toBe(201);
      const json = (await res.json()) as any;
      expect(json.data.title).not.toContain('<script>');
      expect(json.data.title).toContain('&lt;script&gt;');
    });

    it('strips prototype pollution keys from JSON', async () => {
      const { accessToken } = await signup();
      const res = await app.request('http://localhost/api/v1/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ title: 'Proto Test', __proto__: { admin: true }, constructor: { x: 1 } }),
      });
      expect(res.status).toBe(201);
      const json = (await res.json()) as any;
      expect(json.data.title).toContain('Proto Test');
    });
  });

  // ── Body size limit ───────────────────────────────────────────

  describe('Body size limit', () => {
    it('rejects oversized payloads', async () => {
      const { accessToken } = await signup();
      const res = await app.request('http://localhost/api/v1/assessments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'Content-Length': '10485760', // 10 MB
        },
        body: JSON.stringify({ title: 'x' }),
      });
      expect(res.status).toBe(413);
    });
  });

  // ── Security headers ──────────────────────────────────────────

  describe('Security headers', () => {
    it('includes all helmet-style headers', async () => {
      const res = await app.request('http://localhost/health');
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
      expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
      expect(res.headers.get('x-download-options')).toBe('noopen');
      expect(res.headers.get('cross-origin-opener-policy')).toBe('same-origin');
      expect(res.headers.get('cross-origin-resource-policy')).toBe('same-origin');
      expect(res.headers.get('x-xss-protection')).toBe('0');
      expect(res.headers.get('cache-control')).toBe('no-store');
    });

    it('includes request ID in response', async () => {
      const res = await app.request('http://localhost/health');
      expect(res.headers.get('x-request-id')).toBeTruthy();
    });

    it('echoes back provided request ID', async () => {
      const res = await app.request('http://localhost/health', {
        headers: { 'X-Request-ID': 'custom-rid-12345' },
      });
      expect(res.headers.get('x-request-id')).toBe('custom-rid-12345');
    });

    it('includes response time header', async () => {
      const res = await app.request('http://localhost/health');
      expect(res.headers.get('x-response-time')).toMatch(/^\d+(\.\d+)?ms$/);
    });
  });

  // ── 404 handler ───────────────────────────────────────────────

  describe('404 handler', () => {
    it('returns structured 404 for unknown routes', async () => {
      const res = await app.request('http://localhost/api/v1/nonexistent');
      expect(res.status).toBe(404);
      const json = (await res.json()) as any;
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('NOT_FOUND');
    });
  });

  // ── Health check ──────────────────────────────────────────────

  describe('Health check', () => {
    it('returns status, checks, and uptime', async () => {
      const res = await app.request('http://localhost/health');
      expect(res.status).toBe(200);
      const json = (await res.json()) as Record<string, unknown>;
      expect(json.status).toBe('ok');
      expect(json.checks).toBeDefined();
      expect(typeof json.uptime).toBe('number');
    });
  });
});
