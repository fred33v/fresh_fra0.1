/// <reference types="jest" />

import { app, createAuthenticatedUser, authHeaders, seedPurchase } from './helpers';

describe('GET /analytics/dashboard', () => {
  it('returns 401 without auth', async () => {
    const res = await app.request('http://localhost/api/v1/analytics/dashboard');
    expect(res.status).toBe(401);
  });

  it('returns 403 without pkg_full', async () => {
    const { accessToken, organisationId, userId } = await createAuthenticatedUser();
    seedPurchase(organisationId, userId, 'pkg_training');

    const res = await app.request('http://localhost/api/v1/analytics/dashboard', {
      headers: authHeaders(accessToken),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as any;
    expect(body.error?.code).toBe('PACKAGE_REQUIRED');
  });

  it('returns dashboard aggregates with pkg_full', async () => {
    const { accessToken, organisationId, userId } = await createAuthenticatedUser();
    seedPurchase(organisationId, userId, 'pkg_full');

    // Create an assessment so totals are non-zero
    await app.request('http://localhost/api/v1/assessments', {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ title: 'Dashboard Test Assessment' }),
    });

    const res = await app.request('http://localhost/api/v1/analytics/dashboard', {
      headers: authHeaders(accessToken),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);

    // assessments aggregate
    expect(body.data.assessments).toBeDefined();
    expect(typeof body.data.assessments.total).toBe('number');
    expect(body.data.assessments.total).toBeGreaterThanOrEqual(1);
    expect(body.data.assessments.byStatus).toBeDefined();
    expect(typeof body.data.assessments.byStatus.draft).toBe('number');
    expect(typeof body.data.assessments.byStatus.in_progress).toBe('number');
    expect(typeof body.data.assessments.byStatus.submitted).toBe('number');
    expect(typeof body.data.assessments.byStatus.completed).toBe('number');

    // keypasses aggregate
    expect(body.data.keypasses).toBeDefined();
    expect(typeof body.data.keypasses.total).toBe('number');
    expect(body.data.keypasses.byStatus).toBeDefined();

    // purchases aggregate
    expect(body.data.purchases).toBeDefined();
    expect(typeof body.data.purchases.total).toBe('number');
    expect(typeof body.data.purchases.active).toBe('number');
    expect(body.data.purchases.active).toBeGreaterThanOrEqual(1);
  });
});

describe('GET /analytics/overview', () => {
  it('returns 401 without auth', async () => {
    const res = await app.request('http://localhost/api/v1/analytics/overview');
    expect(res.status).toBe(401);
  });

  it('returns overview with assessment totals', async () => {
    const { accessToken, organisationId } = await createAuthenticatedUser();

    const res = await app.request('http://localhost/api/v1/analytics/overview', {
      headers: authHeaders(accessToken),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.organisationId).toBe(organisationId);
    expect(body.data.totals).toBeDefined();
    expect(typeof body.data.totals.assessments).toBe('number');
    expect(body.data.byStatus).toBeDefined();
    expect(typeof body.data.byStatus.draft).toBe('number');
    expect(typeof body.data.byStatus.in_progress).toBe('number');
    expect(typeof body.data.byStatus.submitted).toBe('number');
    expect(typeof body.data.byStatus.completed).toBe('number');
    expect(body.data).toHaveProperty('latestUpdatedAt');
  });

  it('counts assessments by status after creating and submitting one', async () => {
    const { accessToken, organisationId, userId } = await createAuthenticatedUser();
    seedPurchase(organisationId, userId, 'pkg_full');

    // Create an assessment (will be in draft status)
    const createRes = await app.request('http://localhost/api/v1/assessments', {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ title: 'Overview Status Test' }),
    });
    const created = (await createRes.json()) as any;
    const assessmentId = created.data.id;

    // Check overview reflects the draft
    const overviewBeforeSubmit = await app.request('http://localhost/api/v1/analytics/overview', {
      headers: authHeaders(accessToken),
    });
    const beforeBody = (await overviewBeforeSubmit.json()) as any;
    expect(beforeBody.data.totals.assessments).toBeGreaterThanOrEqual(1);
    expect(beforeBody.data.byStatus.draft).toBeGreaterThanOrEqual(1);

    // Save answers and submit the assessment
    const answers: Record<string, string> = {};
    for (let i = 0; i < 3; i++) {
      answers[`q${i}`] = `answer${i}`;
    }
    await app.request(`http://localhost/api/v1/assessments/${assessmentId}/answers`, {
      method: 'PUT',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ answers }),
    });
    await app.request(`http://localhost/api/v1/assessments/${assessmentId}/submit`, {
      method: 'POST',
      headers: authHeaders(accessToken),
    });

    // Check overview reflects the submitted assessment
    const overviewAfterSubmit = await app.request('http://localhost/api/v1/analytics/overview', {
      headers: authHeaders(accessToken),
    });
    const afterBody = (await overviewAfterSubmit.json()) as any;
    expect(afterBody.data.totals.assessments).toBeGreaterThanOrEqual(1);
    expect(afterBody.data.byStatus.submitted).toBeGreaterThanOrEqual(1);
    expect(afterBody.data.latestUpdatedAt).toBeTruthy();
  });
});
