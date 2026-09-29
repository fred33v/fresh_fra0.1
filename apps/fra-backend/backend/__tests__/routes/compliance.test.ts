/// <reference types="jest" />

import { describe, expect, it } from '@jest/globals';
import { app, createAuthenticatedUser, authHeaders, seedPurchase } from '../helpers';

describe('Compliance endpoints', () => {
  // ── GET /api/v1/compliance/report ──────────────────────────────

  describe('GET /api/v1/compliance/report', () => {
    it('returns 403 for non-Enterprise users', async () => {
      const { accessToken, organisationId, userId } = await createAuthenticatedUser();
      // Seed Professional package (not Enterprise)
      seedPurchase(organisationId, userId, 'pkg_training');

      const res = await app.request('http://localhost/api/v1/compliance/report', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });

      expect(res.status).toBe(403);
      const json = await res.json() as any;
      expect(json.success).toBe(false);
      expect(json.error?.code).toBe('PACKAGE_REQUIRED');
    });

    it('returns compliance report for Enterprise users', async () => {
      const { accessToken, organisationId, userId } = await createAuthenticatedUser();
      // Seed Enterprise package
      seedPurchase(organisationId, userId, 'pkg_full');

      const res = await app.request('http://localhost/api/v1/compliance/report', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });

      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty('govs013');
      expect(json.data).toHaveProperty('eccta2023');
      expect(json.data).toHaveProperty('incidents');
      expect(json.data).toHaveProperty('generatedAt');
    });
  });

  // ── GET /api/v1/compliance/senior-management ───────────────────

  describe('GET /api/v1/compliance/senior-management', () => {
    it('returns 403 for non-Enterprise users', async () => {
      const { accessToken, organisationId, userId } = await createAuthenticatedUser();
      seedPurchase(organisationId, userId, 'pkg_training');

      const res = await app.request('http://localhost/api/v1/compliance/senior-management', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });

      expect(res.status).toBe(403);
    });

    it('returns senior management data for Enterprise users', async () => {
      const { accessToken, organisationId, userId } = await createAuthenticatedUser();
      seedPurchase(organisationId, userId, 'pkg_full');

      const res = await app.request('http://localhost/api/v1/compliance/senior-management', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });

      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  // ── GET /api/v1/compliance/risk-assessment ─────────────────────

  describe('GET /api/v1/compliance/risk-assessment', () => {
    it('returns 403 for non-Enterprise users', async () => {
      const { accessToken, organisationId, userId } = await createAuthenticatedUser();
      seedPurchase(organisationId, userId, 'pkg_training');

      const res = await app.request('http://localhost/api/v1/compliance/risk-assessment', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });

      expect(res.status).toBe(403);
    });

    it('returns risk assessment summary for Enterprise users', async () => {
      const { accessToken, organisationId, userId } = await createAuthenticatedUser();
      seedPurchase(organisationId, userId, 'pkg_full');

      const res = await app.request('http://localhost/api/v1/compliance/risk-assessment', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });

      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty('totalAssessments');
      expect(json.data).toHaveProperty('averageRiskScore');
      expect(json.data).toHaveProperty('topRisks');
    });
  });

  // ── GET /api/v1/compliance/incidents ───────────────────────────

  describe('GET /api/v1/compliance/incidents', () => {
    it('returns 403 for non-Enterprise users', async () => {
      const { accessToken, organisationId, userId } = await createAuthenticatedUser();
      seedPurchase(organisationId, userId, 'pkg_training');

      const res = await app.request('http://localhost/api/v1/compliance/incidents', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });

      expect(res.status).toBe(403);
    });

    it('returns incident data for Enterprise users', async () => {
      const { accessToken, organisationId, userId } = await createAuthenticatedUser();
      seedPurchase(organisationId, userId, 'pkg_full');

      const res = await app.request('http://localhost/api/v1/compliance/incidents', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });

      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  // ── GET /api/v1/compliance/gap-analysis ────────────────────────

  describe('GET /api/v1/compliance/gap-analysis', () => {
    it('returns 403 for non-Enterprise users', async () => {
      const { accessToken, organisationId, userId } = await createAuthenticatedUser();
      seedPurchase(organisationId, userId, 'pkg_training');

      const res = await app.request('http://localhost/api/v1/compliance/gap-analysis', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });

      expect(res.status).toBe(403);
    });

    it('returns gap analysis for Enterprise users', async () => {
      const { accessToken, organisationId, userId } = await createAuthenticatedUser();
      seedPurchase(organisationId, userId, 'pkg_full');

      const res = await app.request('http://localhost/api/v1/compliance/gap-analysis', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });

      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty('totalGaps');
      expect(json.data).toHaveProperty('criticalGaps');
      expect(json.data).toHaveProperty('recommendations');
    });
  });

  // ── GET /api/v1/compliance/training ────────────────────────────

  describe('GET /api/v1/compliance/training', () => {
    it('returns 403 for non-Enterprise users', async () => {
      const { accessToken, organisationId, userId } = await createAuthenticatedUser();
      seedPurchase(organisationId, userId, 'pkg_training');

      const res = await app.request('http://localhost/api/v1/compliance/training', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });

      expect(res.status).toBe(403);
    });

    it('returns training data for Enterprise users', async () => {
      const { accessToken, organisationId, userId } = await createAuthenticatedUser();
      seedPurchase(organisationId, userId, 'pkg_full');

      const res = await app.request('http://localhost/api/v1/compliance/training', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });

      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty('completionRate');
      expect(json.data).toHaveProperty('totalUsers');
      expect(json.data).toHaveProperty('completedTraining');
      expect(Array.isArray(json.data.staff)).toBe(true);
    });
  });

  // ── GET /api/v1/compliance/audit-trail ─────────────────────────

  describe('GET /api/v1/compliance/audit-trail', () => {
    it('returns 403 for non-Enterprise users', async () => {
      const { accessToken, organisationId, userId } = await createAuthenticatedUser();
      seedPurchase(organisationId, userId, 'pkg_training');

      const res = await app.request('http://localhost/api/v1/compliance/audit-trail', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });

      expect(res.status).toBe(403);
    });

    it('returns audit trail data for Enterprise users', async () => {
      const { accessToken, organisationId, userId } = await createAuthenticatedUser();
      seedPurchase(organisationId, userId, 'pkg_full');

      const res = await app.request('http://localhost/api/v1/compliance/audit-trail', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });

      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });

  // ── GET /api/v1/compliance/export ──────────────────────────────

  describe('GET /api/v1/compliance/export', () => {
    it('returns 403 for non-Enterprise users', async () => {
      const { accessToken, organisationId, userId } = await createAuthenticatedUser();
      seedPurchase(organisationId, userId, 'pkg_training');

      const res = await app.request('http://localhost/api/v1/compliance/export', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });

      expect(res.status).toBe(403);
    });

    it('returns exported data for Enterprise users', async () => {
      const { accessToken, organisationId, userId } = await createAuthenticatedUser();
      seedPurchase(organisationId, userId, 'pkg_full');

      const res = await app.request('http://localhost/api/v1/compliance/export', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });

      expect(res.status).toBe(200);
      const json = await res.json() as any;
      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty('organisationId');
      expect(json.data).toHaveProperty('assessments');
      expect(json.data).toHaveProperty('exportedAt');
    });
  });
});