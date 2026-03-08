/// <reference types="jest" />

import { app } from './helpers';

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.request(`http://localhost/api/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function get(path: string, headers: Record<string, string> = {}) {
  return app.request(`http://localhost/api/v1${path}`, { headers });
}

function patch(path: string, body: unknown, headers: Record<string, string> = {}) {
  return app.request(`http://localhost/api/v1${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe('Integration flows', () => {
  // ── 4.5: Full auth flow ────────────────────────────────────────

  describe('Full auth flow: signup → login → refresh → logout', () => {
    it('completes the full auth lifecycle', async () => {
      const email = `flow+auth+${Date.now()}@example.com`;
      const password = 'FlowTestPass1!';

      // 1. Signup
      const signupRes = await post('/auth/signup', {
        email,
        password,
        name: 'Auth Flow User',
        organisationName: 'Flow Org',
      });
      expect(signupRes.status).toBe(200);
      const signupJson = (await signupRes.json()) as any;
      const signupAccessToken = signupJson.data.accessToken;
      const signupRefreshToken = signupJson.data.refreshToken;

      // 2. Verify auth/me works with signup token
      const me1Res = await get('/auth/me', auth(signupAccessToken));
      expect(me1Res.status).toBe(200);
      const me1 = (await me1Res.json()) as any;
      expect(me1.data.email).toBe(email.toLowerCase());

      // 3. Login with credentials
      const loginRes = await post('/auth/login', { email, password });
      expect(loginRes.status).toBe(200);
      const loginJson = (await loginRes.json()) as any;
      const loginAccessToken = loginJson.data.accessToken;
      const loginRefreshToken = loginJson.data.refreshToken;

      // 4. Verify auth/me works with login token
      const me2Res = await get('/auth/me', auth(loginAccessToken));
      expect(me2Res.status).toBe(200);

      // 5. Refresh the login token
      const refreshRes = await post('/auth/refresh', { refreshToken: loginRefreshToken });
      expect(refreshRes.status).toBe(200);
      const refreshJson = (await refreshRes.json()) as any;
      const newAccessToken = refreshJson.data.accessToken;
      const newRefreshToken = refreshJson.data.refreshToken;

      // 6. New access token works
      const me3Res = await get('/auth/me', auth(newAccessToken));
      expect(me3Res.status).toBe(200);

      // 7. New refresh token also works (chain)
      const chainRefreshRes = await post('/auth/refresh', { refreshToken: newRefreshToken });
      expect(chainRefreshRes.status).toBe(200);
      const chainJson = (await chainRefreshRes.json()) as any;
      const chainRefreshToken = chainJson.data.refreshToken;

      // 8. Logout with chained refresh token
      const logoutRes = await post('/auth/logout', { refreshToken: chainRefreshToken });
      expect(logoutRes.status).toBe(200);

      // 9. Refresh with logged-out token fails
      const postLogoutRefresh = await post('/auth/refresh', { refreshToken: chainRefreshToken });
      expect(postLogoutRefresh.status).toBe(401);
    });
  });

  // ── 4.6: Full assessment flow ──────────────────────────────────

  describe('Full assessment flow: create → update → submit', () => {
    it('completes the full assessment lifecycle', async () => {
      const email = `flow+assess+${Date.now()}@example.com`;

      // Signup
      const signupRes = await post('/auth/signup', {
        email,
        password: 'FlowTestPass1!',
        name: 'Assess Flow',
        organisationName: 'Assess Org',
      });
      const { accessToken } = ((await signupRes.json()) as any).data;
      const h = auth(accessToken);

      // 1. Create assessment
      const createRes = await post('/assessments', { title: 'Q1 FRA' }, h);
      expect(createRes.status).toBe(201);
      const created = (await createRes.json()) as any;
      const assessmentId = created.data.id;
      expect(created.data.status).toBe('draft');

      // 2. List assessments — should include the new one
      const listRes = await get('/assessments', h);
      expect(listRes.status).toBe(200);
      const list = (await listRes.json()) as any;
      expect(list.data.some((a: any) => a.id === assessmentId)).toBe(true);

      // 3. Get by ID
      const getRes = await get(`/assessments/${assessmentId}`, h);
      expect(getRes.status).toBe(200);
      const got = (await getRes.json()) as any;
      expect(got.data.title).toBe('Q1 FRA');

      // 4. Update title
      const patchTitleRes = await patch(`/assessments/${assessmentId}`, { title: 'Q1 FRA Updated' }, h);
      expect(patchTitleRes.status).toBe(200);
      expect(((await patchTitleRes.json()) as any).data.title).toBe('Q1 FRA Updated');

      // 5. Update answers
      const answers = { section1: { q1: 'low', q2: 'medium' }, section2: { q3: 'high' } };
      const patchAnswersRes = await patch(`/assessments/${assessmentId}`, { answers }, h);
      expect(patchAnswersRes.status).toBe(200);
      const patchedAnswers = (await patchAnswersRes.json()) as any;
      expect(patchedAnswers.data.answers.section1.q1).toBe('low');

      // 6. Move to in_progress
      const progressRes = await patch(`/assessments/${assessmentId}`, { status: 'in_progress' }, h);
      expect(progressRes.status).toBe(200);
      expect(((await progressRes.json()) as any).data.status).toBe('in_progress');

      // 7. Submit
      const submitRes = await post(`/assessments/${assessmentId}/submit`, {}, h);
      expect(submitRes.status).toBe(200);
      const submitted = (await submitRes.json()) as any;
      expect(submitted.data.status).toBe('submitted');
      expect(submitted.data.submittedAt).toBeTruthy();

      // 8. Verify via GET
      const verifyRes = await get(`/assessments/${assessmentId}`, h);
      const verified = (await verifyRes.json()) as any;
      expect(verified.data.status).toBe('submitted');
      expect(verified.data.submittedAt).toBeTruthy();

      // 9. Analytics should reflect the assessment
      const analyticsRes = await get('/analytics/overview', h);
      const analytics = (await analyticsRes.json()) as any;
      expect(analytics.data.totals.assessments).toBeGreaterThanOrEqual(1);

      const timelineRes = await get('/analytics/assessments', h);
      const timeline = (await timelineRes.json()) as any;
      expect(timeline.data.items.some((i: any) => i.id === assessmentId)).toBe(true);
    });
  });

  // ── 4.7: Full payment flow ─────────────────────────────────────

  describe('Full payment flow: package → purchase → keypasses → employee', () => {
    it('completes the full payment and onboarding lifecycle', async () => {
      const employerEmail = `flow+employer+${Date.now()}@example.com`;

      // 1. Employer signs up
      const signupRes = await post('/auth/signup', {
        email: employerEmail,
        password: 'FlowTestPass1!',
        name: 'Employer Flow',
        organisationName: 'Payment Org',
      });
      const signupData = ((await signupRes.json()) as any).data;
      const h = auth(signupData.accessToken);
      const orgId = signupData.organisation.organisationId;

      // 2. List packages
      const pkgRes = await get('/packages', h);
      expect(pkgRes.status).toBe(200);
      const packages = (await pkgRes.json()) as any;
      expect(packages.data.length).toBeGreaterThan(0);
      const trainingPkg = packages.data.find((p: any) => p.id === 'pkg_training') ?? packages.data[0];

      // 3. Get recommended package
      const recRes = await get('/packages/recommended', h);
      expect(recRes.status).toBe(200);

      // 4. Create purchase
      const purchaseRes = await post('/purchases', { packageId: trainingPkg.id }, h);
      expect(purchaseRes.status).toBe(200);
      const purchase = (await purchaseRes.json()) as any;
      expect(purchase.data.status).toBe('requires_confirmation');
      const purchaseId = purchase.data.purchaseId;

      // 5. Confirm purchase
      const confirmRes = await post(`/purchases/${purchaseId}/confirm`, {
        paymentIntentId: purchase.data.paymentIntentId,
      }, h);
      expect(confirmRes.status).toBe(200);
      const confirmed = (await confirmRes.json()) as any;
      expect(confirmed.data.status).toBe('succeeded');

      // 6. Verify purchase via GET
      const getPurchaseRes = await get(`/purchases/${purchaseId}`, h);
      expect(getPurchaseRes.status).toBe(200);

      // 7. List org purchases
      const listPurchasesRes = await get(`/purchases/organisation/${orgId}`, h);
      expect(listPurchasesRes.status).toBe(200);
      const listedPurchases = (await listPurchasesRes.json()) as any;
      expect(listedPurchases.data.length).toBeGreaterThanOrEqual(1);

      // 8. Allocate keypasses for employees
      const allocRes = await post('/keypasses/allocate', { quantity: 3, expiresInDays: 30 }, h);
      expect(allocRes.status).toBe(200);
      const allocated = (await allocRes.json()) as any;
      expect(allocated.data.codes).toHaveLength(3);

      // 9. Check org keypass stats
      const statsRes = await get(`/keypasses/organisation/${orgId}/stats`, h);
      expect(statsRes.status).toBe(200);
      const stats = (await statsRes.json()) as any;
      expect(stats.data.totals).toBeGreaterThanOrEqual(3);

      // 10. Validate a keypass code
      const code = allocated.data.codes[0];
      const validateRes = await post('/keypasses/validate', { code });
      expect(validateRes.status).toBe(200);
      const validated = (await validateRes.json()) as any;
      expect(validated.data.valid).toBe(true);

      // 11. Employee uses keypass to create account
      const empEmail = `flow+emp+${Date.now()}@example.com`;
      const useRes = await post('/keypasses/use', { code, email: empEmail, name: 'Employee Flow' });
      expect(useRes.status).toBe(200);
      const useData = (await useRes.json()) as any;
      expect(useData.data.accessToken).toBeTruthy();
      expect(useData.data.refreshToken).toBeTruthy();

      // 12. Employee can access authenticated endpoints
      const empMeRes = await get('/auth/me', auth(useData.data.accessToken));
      expect(empMeRes.status).toBe(200);
      const empMe = (await empMeRes.json()) as any;
      expect(empMe.data.email).toBe(empEmail.toLowerCase());

      // 13. Used keypass is no longer valid (returns 400 USED)
      const revalidateRes = await post('/keypasses/validate', { code });
      expect(revalidateRes.status).toBe(400);
      const revalidated = (await revalidateRes.json()) as any;
      expect(revalidated.error.code).toBe('USED');

      // 14. List org keypasses
      const listKpRes = await get(`/keypasses/organisation/${orgId}`, h);
      expect(listKpRes.status).toBe(200);
      const kpList = (await listKpRes.json()) as any;
      expect(kpList.data.length).toBeGreaterThanOrEqual(3);
    });
  });
});
