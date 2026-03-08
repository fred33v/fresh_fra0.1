/// <reference types="jest" />

import { app, createAuthenticatedUser, authHeaders } from './helpers';

describe('S3 endpoints', () => {
  // ── POST /uploads/presign ──────────────────────────────────────

  describe('POST /uploads/presign', () => {
    it('rejects without auth', async () => {
      const res = await app.request('http://localhost/api/v1/uploads/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'test.pdf', contentType: 'application/pdf', sizeBytes: 1024 }),
      });
      expect(res.status).toBe(401);
    });

    it('returns 501 when S3 is not configured', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/uploads/presign', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ filename: 'test.pdf', contentType: 'application/pdf', sizeBytes: 1024 }),
      });
      expect(res.status).toBe(501);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('S3_NOT_CONFIGURED');
    });

    it('rejects invalid token', async () => {
      const res = await app.request('http://localhost/api/v1/uploads/presign', {
        method: 'POST',
        headers: authHeaders('invalid.token.here'),
        body: JSON.stringify({ filename: 'test.pdf', contentType: 'application/pdf', sizeBytes: 1024 }),
      });
      expect(res.status).toBe(401);
    });
  });

  // ── POST /uploads/promote ──────────────────────────────────────

  describe('POST /uploads/promote', () => {
    it('rejects without auth', async () => {
      const res = await app.request('http://localhost/api/v1/uploads/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceKey: 'private/uploads/org1/file.pdf' }),
      });
      expect(res.status).toBe(401);
    });

    it('returns 501 when S3 is not configured', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/uploads/promote', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ sourceKey: 'private/uploads/org1/file.pdf' }),
      });
      expect(res.status).toBe(501);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('S3_NOT_CONFIGURED');
    });
  });

  // ── POST /downloads/presign ────────────────────────────────────

  describe('POST /downloads/presign', () => {
    it('rejects without auth', async () => {
      const res = await app.request('http://localhost/api/v1/downloads/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'private/uploads/org1/file.pdf' }),
      });
      expect(res.status).toBe(401);
    });

    it('returns 501 when S3 is not configured', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/downloads/presign', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ key: 'private/uploads/org1/file.pdf' }),
      });
      expect(res.status).toBe(501);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('S3_NOT_CONFIGURED');
    });
  });
});
