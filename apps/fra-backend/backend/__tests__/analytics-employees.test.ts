/// <reference types="jest" />

import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import { app, createAuthenticatedUser, authHeaders, seedPurchase } from './helpers';

describe('GET /analytics/employees', () => {
  it('returns 401 without auth', async () => {
    const res = await app.request('http://localhost/api/v1/analytics/employees');
    expect(res.status).toBe(401);
  });

  it('returns 403 without pkg_full', async () => {
    const { accessToken, organisationId, userId } = await createAuthenticatedUser();
    // Seed only pkg_training (not sufficient)
    seedPurchase(organisationId, userId, 'pkg_training');

    const res = await app.request('http://localhost/api/v1/analytics/employees', {
      headers: authHeaders(accessToken),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.error?.code).toBe('PACKAGE_REQUIRED');
  });

  it('returns employee list with pkg_full', async () => {
    const { accessToken, organisationId, userId } = await createAuthenticatedUser();
    seedPurchase(organisationId, userId, 'pkg_full');

    const res = await app.request('http://localhost/api/v1/analytics/employees', {
      headers: authHeaders(accessToken),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toBeDefined();
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.total).toBeGreaterThanOrEqual(1);

    // The authenticated user should be in the list
    const self = body.data.find((e: any) => e.userId === userId);
    expect(self).toBeDefined();
    expect(self.email).toBeTruthy();
    expect(self.status).toBe('not-started');
    expect(self.riskLevel).toBeNull();
  });

  it('returns employee with completed assessment and risk level', async () => {
    const { accessToken, organisationId, userId } = await createAuthenticatedUser();
    seedPurchase(organisationId, userId, 'pkg_full');

    // Create and submit an assessment with enough answers for medium risk
    const createRes = await app.request('http://localhost/api/v1/assessments', {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ title: 'Risk Assessment' }),
    });
    const created = (await createRes.json()) as any;
    const assessmentId = created.data.id;

    // Structured answers as saved by the assessment apps: weak procurement and IT controls
    await app.request(`http://localhost/api/v1/assessments/${assessmentId}`, {
      method: 'PATCH',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ answers: {
        fraudTriangle: { controlStrength: 'some-gaps' },
        procurement: { q1: 'never' },
        itSystems: { q1: 'rarely' },
      } }),
    });

    // Submit the assessment
    await app.request(`http://localhost/api/v1/assessments/${assessmentId}/submit`, {
      method: 'POST',
      headers: authHeaders(accessToken),
    });

    const res = await app.request('http://localhost/api/v1/analytics/employees', {
      headers: authHeaders(accessToken),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    const self = body.data.find((e: any) => e.userId === userId);
    expect(self).toBeDefined();
    expect(self.status).toBe('completed');
    expect(self.assessmentCount).toBeGreaterThanOrEqual(1);
    // Scored from the answers (impact × likelihood), not from how many questions were answered
    expect(self.riskLevel).toBe('high');
    expect(self.highRiskCount).toBe(2);
    expect(self.topRisk).toBe('Cyber fraud');
  });

  it('leaves risk unscored when answers are not in the assessment format', async () => {
    const { accessToken, organisationId, userId } = await createAuthenticatedUser();
    seedPurchase(organisationId, userId, 'pkg_full');
    const created = (await (await app.request('http://localhost/api/v1/assessments', {
      method: 'POST', headers: authHeaders(accessToken),
      body: JSON.stringify({ title: 'Free text', answers: { q1: 'a', q2: 'b', q3: 'c', q4: 'd', q5: 'e', q6: 'f' } }),
    })).json()) as any;
    await app.request(`http://localhost/api/v1/assessments/${created.data.id}/submit`, { method: 'POST', headers: authHeaders(accessToken) });

    const body = (await (await app.request('http://localhost/api/v1/analytics/employees', { headers: authHeaders(accessToken) })).json()) as any;
    expect(body.data.find((e: any) => e.userId === userId).riskLevel).toBeNull();
  });

  it('supports pagination', async () => {
    const { accessToken, organisationId, userId } = await createAuthenticatedUser();
    seedPurchase(organisationId, userId, 'pkg_full');

    const res = await app.request('http://localhost/api/v1/analytics/employees?page=1&pageSize=1', {
      headers: authHeaders(accessToken),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.pagination.pageSize).toBe(1);
    expect(body.data.length).toBeLessThanOrEqual(1);
  });
});

describe('GET /analytics/employees/:userId', () => {
  it('returns 401 without auth', async () => {
    const res = await app.request('http://localhost/api/v1/analytics/employees/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid UUID', async () => {
    const { accessToken, organisationId, userId } = await createAuthenticatedUser();
    seedPurchase(organisationId, userId, 'pkg_full');

    const res = await app.request('http://localhost/api/v1/analytics/employees/not-a-uuid', {
      headers: authHeaders(accessToken),
    });
    expect(res.status).toBe(400);
  });

  it('returns 403 without pkg_full', async () => {
    const { accessToken, userId, organisationId } = await createAuthenticatedUser();
    seedPurchase(organisationId, userId, 'pkg_training');

    const res = await app.request(`http://localhost/api/v1/analytics/employees/${userId}`, {
      headers: authHeaders(accessToken),
    });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent user', async () => {
    const { accessToken, organisationId, userId } = await createAuthenticatedUser();
    seedPurchase(organisationId, userId, 'pkg_full');

    const res = await app.request('http://localhost/api/v1/analytics/employees/00000000-0000-0000-0000-000000000000', {
      headers: authHeaders(accessToken),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error?.code).toBe('NOT_FOUND');
  });

  it('returns employee detail with assessments and keypasses', async () => {
    const { accessToken, organisationId, userId } = await createAuthenticatedUser();
    seedPurchase(organisationId, userId, 'pkg_full');

    // Create an assessment
    await app.request('http://localhost/api/v1/assessments', {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ title: 'Detail Test' }),
    });

    const res = await app.request(`http://localhost/api/v1/analytics/employees/${userId}`, {
      headers: authHeaders(accessToken),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.userId).toBe(userId);
    expect(body.data.userName).toBeTruthy();
    expect(body.data.email).toBeTruthy();
    expect(Array.isArray(body.data.assessments)).toBe(true);
    expect(body.data.assessments.length).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(body.data.keypasses)).toBe(true);

    const assessment = body.data.assessments[0];
    expect(assessment.id).toBeTruthy();
    expect(assessment.title).toBe('Detail Test');
    expect(assessment.status).toBeTruthy();
  });

  it('prevents cross-org access', async () => {
    const org1 = await createAuthenticatedUser({ email: `org1-${Date.now()}@example.com`, organisationName: 'Org One' });
    const org2 = await createAuthenticatedUser({ email: `org2-${Date.now()}@example.com`, organisationName: 'Org Two' });
    seedPurchase(org1.organisationId, org1.userId, 'pkg_full');
    seedPurchase(org2.organisationId, org2.userId, 'pkg_full');

    // org1 trying to access org2's user
    const res = await app.request(`http://localhost/api/v1/analytics/employees/${org2.userId}`, {
      headers: authHeaders(org1.accessToken),
    });
    expect(res.status).toBe(404);
  });
});
