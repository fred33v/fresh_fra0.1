/// <reference types="jest" />

import { app, createAuthenticatedUser, authHeaders } from './helpers';

async function signup() {
  const { accessToken, email } = await createAuthenticatedUser({ organisationName: 'Assess Org' });
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
});
