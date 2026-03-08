/// <reference types="jest" />

import { app, createAuthenticatedUser, authHeaders, seedPurchase } from './helpers';

describe('GET /analytics/assessments', () => {
  it('returns 401 without auth', async () => {
    const res = await app.request('http://localhost/api/v1/analytics/assessments');
    expect(res.status).toBe(401);
  });

  it('returns paginated assessment timeline', async () => {
    const { accessToken, organisationId, userId } = await createAuthenticatedUser();
    seedPurchase(organisationId, userId, 'pkg_full');

    // Create an assessment
    await app.request('http://localhost/api/v1/assessments', {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ title: 'Timeline Test' }),
    });

    const res = await app.request('http://localhost/api/v1/analytics/assessments', {
      headers: authHeaders(accessToken),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.organisationId).toBe(organisationId);
    expect(Array.isArray(body.data.items)).toBe(true);
    expect(body.data.items.length).toBeGreaterThanOrEqual(1);
    expect(body.pagination).toBeDefined();
    expect(typeof body.pagination.page).toBe('number');
    expect(typeof body.pagination.total).toBe('number');
  });

  it('returns 400 for invalid "from" date', async () => {
    const { accessToken } = await createAuthenticatedUser();

    const res = await app.request('http://localhost/api/v1/analytics/assessments?from=not-a-date', {
      headers: authHeaders(accessToken),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('INVALID_DATE');
  });

  it('returns 400 for invalid "to" date', async () => {
    const { accessToken } = await createAuthenticatedUser();

    const res = await app.request('http://localhost/api/v1/analytics/assessments?to=xyz', {
      headers: authHeaders(accessToken),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('INVALID_DATE');
  });

  it('filters assessments by valid date range', async () => {
    const { accessToken, organisationId, userId } = await createAuthenticatedUser();
    seedPurchase(organisationId, userId, 'pkg_full');

    // Create an assessment
    await app.request('http://localhost/api/v1/assessments', {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ title: 'Date Range Test' }),
    });

    const today = new Date().toISOString().split('T')[0];

    // Should include today's assessment
    const res = await app.request(`http://localhost/api/v1/analytics/assessments?from=${today}&to=${today}`, {
      headers: authHeaders(accessToken),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.items.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty items for future date range', async () => {
    const { accessToken, organisationId, userId } = await createAuthenticatedUser();
    seedPurchase(organisationId, userId, 'pkg_full');

    // Create an assessment now
    await app.request('http://localhost/api/v1/assessments', {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ title: 'Future Range Test' }),
    });

    const res = await app.request('http://localhost/api/v1/analytics/assessments?from=2099-01-01&to=2099-12-31', {
      headers: authHeaders(accessToken),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.data.items.length).toBe(0);
  });

  it('respects pagination parameters', async () => {
    const { accessToken, organisationId, userId } = await createAuthenticatedUser();
    seedPurchase(organisationId, userId, 'pkg_full');

    // Create two assessments
    await app.request('http://localhost/api/v1/assessments', {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ title: 'Page Test 1' }),
    });
    await app.request('http://localhost/api/v1/assessments', {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: JSON.stringify({ title: 'Page Test 2' }),
    });

    const res = await app.request('http://localhost/api/v1/analytics/assessments?page=1&pageSize=1', {
      headers: authHeaders(accessToken),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.data.items.length).toBe(1);
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.pageSize).toBe(1);
    expect(body.pagination.total).toBeGreaterThanOrEqual(2);
    expect(body.pagination.totalPages).toBeGreaterThanOrEqual(2);
  });
});
