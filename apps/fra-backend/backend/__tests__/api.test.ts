/// <reference types="jest" />

import { app, createAuthenticatedUser, authHeaders, seedPurchase } from './helpers';

describe('Backend API', () => {
  it('GET /health returns ok', async () => {
    const res = await app.request('http://localhost/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe('ok');
    expect(body.checks).toBeDefined();
    expect(typeof body.uptime).toBe('number');
  });

  it('auth signup/login/assessments flow', async () => {
    const email = `test+${Date.now()}@example.com`;

    const signupRes = await app.request('http://localhost/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'SecurePass123!',
        name: 'Test User',
        organisationName: 'Test Org',
      }),
    });

    expect(signupRes.status).toBe(200);
    const signupJson = (await signupRes.json()) as any;
    expect(signupJson.success).toBe(true);
    expect(signupJson.data?.accessToken).toBeTruthy();

    const accessToken: string = signupJson.data.accessToken;

    const createAssessmentRes = await app.request('http://localhost/api/v1/assessments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ title: 'My Assessment' }),
    });

    expect(createAssessmentRes.status).toBe(201);
    const created = (await createAssessmentRes.json()) as any;
    expect(created.success).toBe(true);
    expect(created.data?.id).toBeTruthy();

    const listRes = await app.request('http://localhost/api/v1/assessments', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(listRes.status).toBe(200);
    const listJson = (await listRes.json()) as any;
    expect(listJson.success).toBe(true);
    expect(Array.isArray(listJson.data)).toBe(true);
  });

  it('auth refresh and auth me work', async () => {
    const email = `test+refresh+${Date.now()}@example.com`;

    const signupRes = await app.request('http://localhost/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'SecurePass123!',
        name: 'Test User',
        organisationName: 'Test Org',
      }),
    });

    expect(signupRes.status).toBe(200);
    const signupJson = (await signupRes.json()) as any;

    const meRes = await app.request('http://localhost/api/v1/auth/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${signupJson.data.accessToken}`,
      },
    });

    expect(meRes.status).toBe(200);
    const meJson = (await meRes.json()) as any;
    expect(meJson.success).toBe(true);
    expect(meJson.data?.email).toBe(email);

    const refreshRes = await app.request('http://localhost/api/v1/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: signupJson.data.refreshToken }),
    });

    expect(refreshRes.status).toBe(200);
    const refreshJson = (await refreshRes.json()) as any;
    expect(refreshJson.success).toBe(true);
    expect(refreshJson.data?.accessToken).toBeTruthy();
    expect(refreshJson.data?.refreshToken).toBeTruthy();
  });

  it('keypass allocate/validate/use flow works', async () => {
    const email = `test+kp+${Date.now()}@example.com`;

    const signupRes = await app.request('http://localhost/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'SecurePass123!',
        name: 'Employer',
        organisationName: 'KP Org',
      }),
    });
    const signupJson = (await signupRes.json()) as any;
    const accessToken: string = signupJson.data.accessToken;
    const organisationId: string = signupJson.data.organisation.organisationId;
    const userId: string = signupJson.data.user.userId;
    seedPurchase(organisationId, userId);

    const allocateRes = await app.request('http://localhost/api/v1/keypasses/allocate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ quantity: 2, expiresInDays: 30 }),
    });
    expect(allocateRes.status).toBe(200);
    const allocateJson = (await allocateRes.json()) as any;
    expect(allocateJson.success).toBe(true);
    expect(Array.isArray(allocateJson.data?.codes)).toBe(true);
    const code: string = allocateJson.data.codes[0];

    const validateRes = await app.request('http://localhost/api/v1/keypasses/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    expect(validateRes.status).toBe(200);
    const validateJson = (await validateRes.json()) as any;
    expect(validateJson.success).toBe(true);
    expect(validateJson.data?.valid).toBe(true);

    const useRes = await app.request('http://localhost/api/v1/keypasses/use', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, email: `employee+${Date.now()}@example.com`, name: 'Employee' }),
    });

    expect(useRes.status).toBe(200);
    const useJson = (await useRes.json()) as any;
    expect(useJson.success).toBe(true);
    expect(useJson.data?.accessToken).toBeTruthy();
    expect(useJson.data?.refreshToken).toBeTruthy();
  });

  it('payments and reports endpoints respond', async () => {
    const email = `test+pay+${Date.now()}@example.com`;

    const signupRes = await app.request('http://localhost/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'SecurePass123!',
        name: 'Pay User',
        organisationName: 'Pay Org',
      }),
    });
    const signupJson = (await signupRes.json()) as any;
    const accessToken: string = signupJson.data.accessToken;
    const userId: string = signupJson.data.user.userId;
    const organisationId: string = signupJson.data.organisation.organisationId;
    seedPurchase(organisationId, userId, 'pkg_training');

    const intentRes = await app.request('http://localhost/api/v1/payments/create-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ packageId: 'pkg_basic', currency: 'gbp' }),
    });
    expect(intentRes.status).toBe(200);
    const intentJson = (await intentRes.json()) as any;
    expect(intentJson.success).toBe(true);
    expect(intentJson.data?.clientSecret).toBeTruthy();

    const reportRes = await app.request('http://localhost/api/v1/reports/generate', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    expect(reportRes.status).toBe(200);
    const reportJson = (await reportRes.json()) as any;
    expect(reportJson.success).toBe(true);
    expect(reportJson.data?.reportId).toBeTruthy();

    const overviewRes = await app.request('http://localhost/api/v1/analytics/overview', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    expect(overviewRes.status).toBe(200);
    const overviewJson = (await overviewRes.json()) as any;
    expect(overviewJson.success).toBe(true);
  });
});
