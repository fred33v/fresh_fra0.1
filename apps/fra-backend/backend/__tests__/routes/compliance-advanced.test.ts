/// <reference types="jest" />

import { describe, expect, it } from '@jest/globals';
import { app, createAuthenticatedUser, authHeaders, seedPurchase } from '../helpers';

// ── Helpers ────────────────────────────────────────────────────────────────

async function withEnterprise() {
  const user = await createAuthenticatedUser();
  seedPurchase(user.organisationId, user.userId, 'pkg_full');
  return user;
}

// ── 401 Unauthenticated access ─────────────────────────────────────────────

describe('Compliance endpoints — unauthenticated (401)', () => {
  const endpoints = [
    '/api/v1/compliance/report',
    '/api/v1/compliance/senior-management',
    '/api/v1/compliance/risk-assessment',
    '/api/v1/compliance/training',
    '/api/v1/compliance/incidents',
    '/api/v1/compliance/audit-trail',
    '/api/v1/compliance/export',
    '/api/v1/compliance/gap-analysis',
  ];

  for (const endpoint of endpoints) {
    it(`returns 401 for ${endpoint} without a token`, async () => {
      const res = await app.request(`http://localhost${endpoint}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(401);
    });

    it(`returns 401 for ${endpoint} with a malformed token`, async () => {
      const res = await app.request(`http://localhost${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer not.a.valid.jwt',
        },
      });
      expect(res.status).toBe(401);
    });
  }
});

// ── Response schema depth validation ──────────────────────────────────────

describe('Compliance endpoints — response schema validation', () => {
  describe('GET /api/v1/compliance/report schema', () => {
    it('govs013 and eccta2023 contain numeric scores', async () => {
      const { accessToken } = await withEnterprise();
      const res = await app.request('http://localhost/api/v1/compliance/report', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });
      expect(res.status).toBe(200);
      const { data } = (await res.json()) as any;
      expect(typeof data.govs013.score).toBe('number');
      expect(typeof data.eccta2023.score).toBe('number');
      expect(data.govs013.score).toBeGreaterThanOrEqual(0);
      expect(data.govs013.score).toBeLessThanOrEqual(100);
      expect(data.eccta2023.score).toBeGreaterThanOrEqual(0);
      expect(data.eccta2023.score).toBeLessThanOrEqual(100);
    });

    it('generatedAt is a valid ISO date string', async () => {
      const { accessToken } = await withEnterprise();
      const res = await app.request('http://localhost/api/v1/compliance/report', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });
      const { data } = (await res.json()) as any;
      expect(() => new Date(data.generatedAt).toISOString()).not.toThrow();
    });

    it('incidents is an array', async () => {
      const { accessToken } = await withEnterprise();
      const res = await app.request('http://localhost/api/v1/compliance/report', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });
      const { data } = (await res.json()) as any;
      expect(Array.isArray(data.incidents)).toBe(true);
    });
  });

  describe('GET /api/v1/compliance/senior-management schema', () => {
    it('returns an array with required fields on each entry', async () => {
      const { accessToken } = await withEnterprise();
      const res = await app.request('http://localhost/api/v1/compliance/senior-management', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });
      const { data } = (await res.json()) as any;
      expect(Array.isArray(data)).toBe(true);
      for (const entry of data) {
        expect(entry).toHaveProperty('id');
        expect(entry).toHaveProperty('role');
        expect(entry).toHaveProperty('compliance_score');
        expect(typeof entry.compliance_score).toBe('number');
        expect(entry.compliance_score).toBeGreaterThanOrEqual(0);
        expect(entry.compliance_score).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('GET /api/v1/compliance/risk-assessment schema', () => {
    it('numeric fields are numbers within expected ranges', async () => {
      const { accessToken } = await withEnterprise();
      const res = await app.request('http://localhost/api/v1/compliance/risk-assessment', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });
      const { data } = (await res.json()) as any;
      expect(typeof data.totalAssessments).toBe('number');
      expect(typeof data.averageRiskScore).toBe('number');
      expect(Array.isArray(data.topRisks)).toBe(true);
      expect(data.totalAssessments).toBeGreaterThanOrEqual(0);
      expect(data.averageRiskScore).toBeGreaterThanOrEqual(0);
    });

    it('topRisks entries have area and score', async () => {
      const { accessToken } = await withEnterprise();
      const res = await app.request('http://localhost/api/v1/compliance/risk-assessment', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });
      const { data } = (await res.json()) as any;
      for (const risk of data.topRisks) {
        expect(risk).toHaveProperty('area');
        expect(risk).toHaveProperty('score');
        expect(typeof risk.score).toBe('number');
      }
    });
  });

  describe('GET /api/v1/compliance/training schema', () => {
    it('completionRate is a number between 0 and 100', async () => {
      const { accessToken } = await withEnterprise();
      const res = await app.request('http://localhost/api/v1/compliance/training', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });
      const { data } = (await res.json()) as any;
      expect(typeof data.completionRate).toBe('number');
      expect(data.completionRate).toBeGreaterThanOrEqual(0);
      expect(data.completionRate).toBeLessThanOrEqual(100);
    });

    it('totalUsers and completedTraining are non-negative integers', async () => {
      const { accessToken } = await withEnterprise();
      const res = await app.request('http://localhost/api/v1/compliance/training', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });
      const { data } = (await res.json()) as any;
      expect(Number.isInteger(data.totalUsers)).toBe(true);
      expect(data.totalUsers).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(data.completedTraining)).toBe(true);
      expect(data.completedTraining).toBeGreaterThanOrEqual(0);
      expect(data.completedTraining).toBeLessThanOrEqual(data.totalUsers);
    });
  });

  describe('GET /api/v1/compliance/incidents schema', () => {
    it('each incident has required fields and a valid severity', async () => {
      const { accessToken } = await withEnterprise();
      const res = await app.request('http://localhost/api/v1/compliance/incidents', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });
      const { data } = (await res.json()) as any;
      for (const incident of data) {
        expect(incident).toHaveProperty('id');
        expect(incident).toHaveProperty('type');
        expect(incident).toHaveProperty('severity');
        expect(['low', 'medium', 'high', 'critical']).toContain(incident.severity);
        expect(incident).toHaveProperty('created_at');
        expect(() => new Date(incident.created_at).toISOString()).not.toThrow();
      }
    });
  });

  describe('GET /api/v1/compliance/audit-trail schema', () => {
    it('each audit entry has required fields', async () => {
      const { accessToken } = await withEnterprise();
      const res = await app.request('http://localhost/api/v1/compliance/audit-trail', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });
      const { data } = (await res.json()) as any;
      for (const entry of data) {
        expect(entry).toHaveProperty('id');
        expect(entry).toHaveProperty('eventType');
        expect(entry).toHaveProperty('createdAt');
        expect(() => new Date(entry.createdAt).toISOString()).not.toThrow();
      }
    });
  });

  describe('GET /api/v1/compliance/export schema', () => {
    it('export contains org-scoped data with arrays', async () => {
      const { accessToken, organisationId } = await withEnterprise();
      const res = await app.request('http://localhost/api/v1/compliance/export', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });
      const { data } = (await res.json()) as any;
      expect(data.organisationId).toBe(organisationId);
      expect(Array.isArray(data.assessments)).toBe(true);
      expect(Array.isArray(data.keypasses ?? data.assessments)).toBe(true);
      expect(() => new Date(data.exportedAt).toISOString()).not.toThrow();
    });
  });

  describe('GET /api/v1/compliance/gap-analysis schema', () => {
    it('gap counts are non-negative integers and recommendations is an array of strings', async () => {
      const { accessToken } = await withEnterprise();
      const res = await app.request('http://localhost/api/v1/compliance/gap-analysis', {
        method: 'GET',
        headers: authHeaders(accessToken),
      });
      const { data } = (await res.json()) as any;
      expect(Number.isInteger(data.totalGaps)).toBe(true);
      expect(data.totalGaps).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(data.criticalGaps)).toBe(true);
      expect(data.criticalGaps).toBeGreaterThanOrEqual(0);
      expect(data.criticalGaps).toBeLessThanOrEqual(data.totalGaps);
      expect(Array.isArray(data.recommendations)).toBe(true);
      for (const rec of data.recommendations) {
        expect(typeof rec).toBe('string');
        expect(rec.length).toBeGreaterThan(0);
      }
    });
  });
});

// ── Cross-organisation data isolation ─────────────────────────────────────

describe('Compliance endpoints — cross-org data isolation', () => {
  it('/export returns each org only their own organisationId', async () => {
    const [orgA, orgB] = await Promise.all([withEnterprise(), withEnterprise()]);

    const [resA, resB] = await Promise.all([
      app.request('http://localhost/api/v1/compliance/export', {
        method: 'GET',
        headers: authHeaders(orgA.accessToken),
      }),
      app.request('http://localhost/api/v1/compliance/export', {
        method: 'GET',
        headers: authHeaders(orgB.accessToken),
      }),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    const dataA = ((await resA.json()) as any).data;
    const dataB = ((await resB.json()) as any).data;

    expect(dataA.organisationId).toBe(orgA.organisationId);
    expect(dataB.organisationId).toBe(orgB.organisationId);
    expect(dataA.organisationId).not.toBe(dataB.organisationId);
  });

  it('org without Enterprise cannot access compliance even if another org has it', async () => {
    // Org A has Enterprise; Org B has only Professional
    const orgA = await withEnterprise();
    const orgB = await createAuthenticatedUser();
    seedPurchase(orgB.organisationId, orgB.userId, 'pkg_training');

    const resA = await app.request('http://localhost/api/v1/compliance/report', {
      method: 'GET',
      headers: authHeaders(orgA.accessToken),
    });
    const resB = await app.request('http://localhost/api/v1/compliance/report', {
      method: 'GET',
      headers: authHeaders(orgB.accessToken),
    });

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(403);
    const jsonB = (await resB.json()) as any;
    expect(jsonB.error.code).toBe('PACKAGE_REQUIRED');
  });
});
