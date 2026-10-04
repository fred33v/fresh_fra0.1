/// <reference types="jest" />

import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import { app, createPaidUser, authHeaders } from './helpers';

async function signup() {
  const { accessToken, email } = await createPaidUser("pkg_full", { organisationName: "Assess Org" });
  return { accessToken, email };
}

describe('Assessments endpoints', () => {
  // ── POST /assessments ──────────────────────────────────────────

  describe('POST /assessments', () => {
    it('creates an assessment', async () => {
      const { accessToken } = await signup();
      const res = await app.request('http://localhost/api/v1/assessments', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ title: 'Risk Assessment Q1' }),
      });
      expect(res.status).toBe(201);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.id).toBeTruthy();
      expect(json.data.title).toBe('Risk Assessment Q1');
      expect(json.data.status).toBe('draft');
    });

    it('creates assessment with default title', async () => {
      const { accessToken } = await signup();
      const res = await app.request('http://localhost/api/v1/assessments', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(201);
      const json = (await res.json()) as any;
      expect(json.data.title).toBe('Fraud Risk Assessment');
    });

    it('rejects without auth', async () => {
      const res = await app.request('http://localhost/api/v1/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'No Auth' }),
      });
      expect(res.status).toBe(401);
    });
  });

  // ── GET /assessments ──────────────────────────────────────────

  describe('GET /assessments', () => {
    it('lists assessments for the organisation', async () => {
      const { accessToken } = await signup();
      // Create two assessments
      await app.request('http://localhost/api/v1/assessments', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ title: 'A1' }),
      });
      await app.request('http://localhost/api/v1/assessments', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ title: 'A2' }),
      });

      const res = await app.request('http://localhost/api/v1/assessments', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.length).toBeGreaterThanOrEqual(2);
    });

    it('does not return assessments from other orgs', async () => {
      const user1 = await signup();
      const user2 = await signup();

      await app.request('http://localhost/api/v1/assessments', {
        method: 'POST',
        headers: authHeaders(user1.accessToken),
        body: JSON.stringify({ title: 'Org1 Only' }),
      });

      const res = await app.request('http://localhost/api/v1/assessments', {
        headers: { Authorization: `Bearer ${user2.accessToken}` },
      });
      const json = (await res.json()) as any;
      const titles = json.data.map((a: any) => a.title);
      expect(titles).not.toContain('Org1 Only');
    });

    it('rejects without auth', async () => {
      const res = await app.request('http://localhost/api/v1/assessments');
      expect(res.status).toBe(401);
    });
  });

  // ── GET /assessments/:id ──────────────────────────────────────

  describe('GET /assessments/:id', () => {
    it('gets a specific assessment', async () => {
      const { accessToken } = await signup();
      const createRes = await app.request('http://localhost/api/v1/assessments', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ title: 'Specific' }),
      });
      const created = (await createRes.json()) as any;

      const res = await app.request(`http://localhost/api/v1/assessments/${created.data.id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.data.title).toBe('Specific');
    });

    it('returns 404 for non-existent assessment', async () => {
      const { accessToken } = await signup();
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await app.request(`http://localhost/api/v1/assessments/${fakeId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(404);
    });

    it('rejects invalid UUID param', async () => {
      const { accessToken } = await signup();
      const res = await app.request('http://localhost/api/v1/assessments/not-a-uuid', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(400);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('INVALID_PARAM');
    });
  });

  // ── PATCH /assessments/:id ────────────────────────────────────

  describe('PATCH /assessments/:id', () => {
    it('updates assessment title', async () => {
      const { accessToken } = await signup();
      const createRes = await app.request('http://localhost/api/v1/assessments', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ title: 'Original' }),
      });
      const created = (await createRes.json()) as any;

      const res = await app.request(`http://localhost/api/v1/assessments/${created.data.id}`, {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ title: 'Updated' }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.data.title).toBe('Updated');
    });

    it('updates assessment answers', async () => {
      const { accessToken } = await signup();
      const createRes = await app.request('http://localhost/api/v1/assessments', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ title: 'Answers Test' }),
      });
      const created = (await createRes.json()) as any;

      const answers = { q1: 'yes', q2: 'no' };
      const res = await app.request(`http://localhost/api/v1/assessments/${created.data.id}`, {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ answers }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.data.answers.q1).toBe('yes');
    });

    it('updates assessment status', async () => {
      const { accessToken } = await signup();
      const createRes = await app.request('http://localhost/api/v1/assessments', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ title: 'Status Test' }),
      });
      const created = (await createRes.json()) as any;

      const res = await app.request(`http://localhost/api/v1/assessments/${created.data.id}`, {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ status: 'in_progress' }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.data.status).toBe('in_progress');
    });

    it('sets submittedAt when status changes to submitted via PATCH', async () => {
      const { accessToken } = await signup();
      const createRes = await app.request('http://localhost/api/v1/assessments', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ title: 'PATCH Submit Test' }),
      });
      const created = (await createRes.json()) as any;
      expect(created.data.submittedAt).toBeFalsy();

      const res = await app.request(`http://localhost/api/v1/assessments/${created.data.id}`, {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ status: 'submitted' }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.data.status).toBe('submitted');
      expect(json.data.submittedAt).toBeTruthy();
    });

    it('returns 404 for non-existent assessment', async () => {
      const { accessToken } = await signup();
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await app.request(`http://localhost/api/v1/assessments/${fakeId}`, {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ title: 'Nope' }),
      });
      expect(res.status).toBe(404);
    });
  });

  // ── POST /assessments/:id/submit ──────────────────────────────

  describe('POST /assessments/:id/submit', () => {
    it('submits an assessment', async () => {
      const { accessToken } = await signup();
      const createRes = await app.request('http://localhost/api/v1/assessments', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ title: 'Submit Me' }),
      });
      const created = (await createRes.json()) as any;

      const res = await app.request(`http://localhost/api/v1/assessments/${created.data.id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.data.status).toBe('submitted');
      expect(json.data.submittedAt).toBeTruthy();
    });

    it('returns 404 for non-existent assessment', async () => {
      const { accessToken } = await signup();
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await app.request(`http://localhost/api/v1/assessments/${fakeId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(404);
    });
  });

  // ── GET /assessments/modules ──────────────────────────────────

  describe('GET /assessments/modules', () => {
    it('returns module definitions whose question IDs map onto the scorer input', async () => {
      const { accessToken } = await signup();
      const res = await app.request('http://localhost/api/v1/assessments/modules', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      // The 13 modules, in the mobile app's order
      expect(json.data.map((m: any) => m.id)).toEqual([
        'riskAppetite', 'fraudTriangle', 'procurement', 'cashBanking', 'payrollHR', 'revenue', 'itSystems',
        'peopleCulture', 'controlsTechnology', 'trainingAwareness', 'monitoringEvaluation', 'complianceMapping', 'fraudResponse',
      ]);
      for (const module of json.data) {
        expect(module.questions.length).toBeGreaterThan(0);
        for (const q of module.questions) expect(q.id.startsWith(`${module.id}.`)).toBe(true);
      }
    });

    it('rejects without auth', async () => {
      const res = await app.request('http://localhost/api/v1/assessments/modules');
      expect(res.status).toBe(401);
    });
  });

  // ── GET /assessments/:id/results ──────────────────────────────

  describe('GET /assessments/:id/results', () => {
    async function createWithAnswers(accessToken: string, answers: Record<string, unknown>) {
      const res = await app.request('http://localhost/api/v1/assessments', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ answers }),
      });
      return ((await res.json()) as any).data.id as string;
    }

    it('returns 409 before the assessment is submitted', async () => {
      const { accessToken } = await signup();
      const id = await createWithAnswers(accessToken, {});
      const res = await app.request(`http://localhost/api/v1/assessments/${id}/results`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(409);
      expect(((await res.json()) as any).error.code).toBe('NOT_SUBMITTED');
    });

    it('scores stored answers once submitted', async () => {
      const { accessToken } = await signup();
      const id = await createWithAnswers(accessToken, {
        'procurement.dueDiligenceLevel': 1,
        'procurement.monthlySpend': 750000,
        'procurement.recentFraud': 'yes',
        'procurement.controlMaturity': 2,
      });
      await app.request(`http://localhost/api/v1/assessments/${id}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const res = await app.request(`http://localhost/api/v1/assessments/${id}/results`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.data.assessmentId).toBe(id);
      const procurement = json.data.modules.find((m: any) => m.id === 'procurement');
      // base 20 + due diligence 15 + spend 20 + recent fraud 25 + controls 15
      expect(procurement).toMatchObject({ title: 'Procurement', score: 95, level: 'High' });
      expect(json.data.topRisks[0]).toMatchObject({ module: 'procurement', moduleTitle: 'Procurement', severity: 'Critical' });
      expect(['Low', 'Medium', 'High']).toContain(json.data.riskLevel);
    });

    it('returns 404 for another organisation\'s assessment', async () => {
      const owner = await signup();
      const other = await signup();
      const id = await createWithAnswers(owner.accessToken, {});
      const res = await app.request(`http://localhost/api/v1/assessments/${id}/results`, {
        headers: { Authorization: `Bearer ${other.accessToken}` },
      });
      expect(res.status).toBe(404);
    });
  });
});
