/// <reference types="jest" />

import { app, createAuthenticatedUser, authHeaders } from './helpers';

describe('Workshop endpoints', () => {
  // ── GET /workshop/profile ───────────────────────────────────

  describe('GET /workshop/profile', () => {
    it('returns null data when no database is configured', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/profile', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data).toBeNull();
    });

    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/profile');
      expect(res.status).toBe(401);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects request with invalid token', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/profile', {
        headers: { Authorization: 'Bearer invalid.token.here' },
      });
      expect(res.status).toBe(401);
    });
  });

  // ── PUT /workshop/profile ───────────────────────────────────

  describe('PUT /workshop/profile', () => {
    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Test',
          organizationName: 'Org',
          sector: 'public',
        }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects invalid profile data', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/profile', {
        method: 'PUT',
        headers: authHeaders(accessToken),
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 503 NO_DATABASE when DB not configured', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/profile', {
        method: 'PUT',
        headers: authHeaders(accessToken),
        body: JSON.stringify({
          fullName: 'Test User',
          organizationName: 'Test Org',
          sector: 'public',
        }),
      });
      expect(res.status).toBe(503);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NO_DATABASE');
    });

    it('rejects invalid sector value', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/profile', {
        method: 'PUT',
        headers: authHeaders(accessToken),
        body: JSON.stringify({
          fullName: 'Test User',
          organizationName: 'Test Org',
          sector: 'invalid_sector',
        }),
      });
      expect(res.status).toBe(400);
    });
  });

  // ── GET /workshop/roles ─────────────────────────────────────

  describe('GET /workshop/roles', () => {
    it('returns empty array when no database', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/roles', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
    });

    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/roles');
      expect(res.status).toBe(401);
    });
  });

  // ── GET /workshop/sessions ──────────────────────────────────

  describe('GET /workshop/sessions', () => {
    it('returns empty array when no database', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/sessions', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
    });

    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/sessions');
      expect(res.status).toBe(401);
    });
  });

  // ── POST /workshop/sessions ─────────────────────────────────

  describe('POST /workshop/sessions', () => {
    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'My Session' }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects missing title', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/sessions', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 503 when DB not configured', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/sessions', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ title: 'Workshop Session' }),
      });
      expect(res.status).toBe(503);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NO_DATABASE');
    });
  });

  // ── GET /workshop/sessions/:id ──────────────────────────────

  describe('GET /workshop/sessions/:id', () => {
    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/sessions/00000000-0000-0000-0000-000000000001');
      expect(res.status).toBe(401);
    });

    it('returns 404 when no database', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/sessions/00000000-0000-0000-0000-000000000000', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(404);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NOT_FOUND');
    });
  });

  // ── GET /workshop/sessions/code/:code ───────────────────────

  describe('GET /workshop/sessions/code/:code', () => {
    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/sessions/code/ABC123');
      expect(res.status).toBe(401);
    });

    it('returns 404 when no database', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/sessions/code/ABC123', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(404);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NOT_FOUND');
    });
  });

  // ── PATCH /workshop/sessions/:id ────────────────────────────

  describe('PATCH /workshop/sessions/:id', () => {
    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/sessions/00000000-0000-0000-0000-000000000001', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Updated' }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects invalid update data', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/sessions/00000000-0000-0000-0000-000000000001', {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ currentSlide: 'not-a-number' }),
      });
      expect(res.status).toBe(400);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 503 when DB not configured', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/sessions/00000000-0000-0000-0000-000000000001', {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ title: 'Updated Title' }),
      });
      expect(res.status).toBe(503);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NO_DATABASE');
    });
  });

  // ── POST /workshop/sessions/:id/end ─────────────────────────

  describe('POST /workshop/sessions/:id/end', () => {
    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/sessions/00000000-0000-0000-0000-000000000001/end', {
        method: 'POST',
      });
      expect(res.status).toBe(401);
    });

    it('returns 503 when DB not configured', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/sessions/00000000-0000-0000-0000-000000000001/end', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(503);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NO_DATABASE');
    });
  });

  // ── POST /workshop/sessions/:id/join ────────────────────────

  describe('POST /workshop/sessions/:id/join', () => {
    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/sessions/00000000-0000-0000-0000-000000000001/join', {
        method: 'POST',
      });
      expect(res.status).toBe(401);
    });

    it('returns 503 when DB not configured', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/sessions/00000000-0000-0000-0000-000000000001/join', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(503);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NO_DATABASE');
    });
  });

  // ── GET /workshop/sessions/:id/participants ─────────────────

  describe('GET /workshop/sessions/:id/participants', () => {
    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/sessions/00000000-0000-0000-0000-000000000001/participants');
      expect(res.status).toBe(401);
    });

    it('returns count 0 when no database', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/sessions/00000000-0000-0000-0000-000000000001/participants', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data.count).toBe(0);
    });
  });

  // ── GET /workshop/progress ──────────────────────────────────

  describe('GET /workshop/progress', () => {
    it('returns null when no database', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/progress', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data).toBeNull();
    });

    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/progress');
      expect(res.status).toBe(401);
    });
  });

  // ── POST /workshop/progress ─────────────────────────────────

  describe('POST /workshop/progress', () => {
    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
    });

    it('returns 503 when DB not configured', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/progress', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(503);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NO_DATABASE');
    });
  });

  // ── PATCH /workshop/progress/:id ────────────────────────────

  describe('PATCH /workshop/progress/:id', () => {
    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/progress/00000000-0000-0000-0000-000000000001', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentSection: 1 }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects invalid data', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/progress/00000000-0000-0000-0000-000000000001', {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ currentSection: 'not-a-number' }),
      });
      expect(res.status).toBe(400);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 503 when DB not configured', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/progress/00000000-0000-0000-0000-000000000001', {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ currentSection: 2 }),
      });
      expect(res.status).toBe(503);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NO_DATABASE');
    });
  });

  // ── GET /workshop/sessions/:sessionId/polls ─────────────────

  describe('GET /workshop/sessions/:sessionId/polls', () => {
    it('returns empty array when no database', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/sessions/00000000-0000-0000-0000-000000000001/polls', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
    });

    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/sessions/00000000-0000-0000-0000-000000000001/polls');
      expect(res.status).toBe(401);
    });
  });

  // ── GET /workshop/sessions/:sessionId/polls/active ──────────

  describe('GET /workshop/sessions/:sessionId/polls/active', () => {
    it('returns null when no database', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/sessions/00000000-0000-0000-0000-000000000001/polls/active', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data).toBeNull();
    });
  });

  // ── POST /workshop/sessions/:sessionId/polls ────────────────

  describe('POST /workshop/sessions/:sessionId/polls', () => {
    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/sessions/00000000-0000-0000-0000-000000000001/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: 'Test?', options: ['A', 'B'] }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects invalid poll data (missing options)', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/sessions/00000000-0000-0000-0000-000000000001/polls', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ question: 'Test?' }),
      });
      expect(res.status).toBe(400);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 503 when DB not configured', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/sessions/00000000-0000-0000-0000-000000000001/polls', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ question: 'Test?', options: ['A', 'B'] }),
      });
      expect(res.status).toBe(503);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NO_DATABASE');
    });
  });

  // ── PATCH /workshop/polls/:pollId ───────────────────────────

  describe('PATCH /workshop/polls/:pollId', () => {
    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/polls/00000000-0000-0000-0000-000000000001', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects invalid data', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/polls/00000000-0000-0000-0000-000000000001', {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ isActive: 'not-boolean' }),
      });
      expect(res.status).toBe(400);
    });

    it('returns 503 when DB not configured', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/polls/00000000-0000-0000-0000-000000000001', {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ isActive: false }),
      });
      expect(res.status).toBe(503);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NO_DATABASE');
    });
  });

  // ── POST /workshop/polls/:pollId/respond ────────────────────

  describe('POST /workshop/polls/:pollId/respond', () => {
    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/polls/00000000-0000-0000-0000-000000000001/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedOption: 0 }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects invalid data', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/polls/00000000-0000-0000-0000-000000000001/respond', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ selectedOption: 'not-number' }),
      });
      expect(res.status).toBe(400);
    });

    it('returns 503 when DB not configured', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/polls/00000000-0000-0000-0000-000000000001/respond', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ selectedOption: 0 }),
      });
      expect(res.status).toBe(503);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NO_DATABASE');
    });
  });

  // ── GET /workshop/sessions/:sessionId/questions ─────────────

  describe('GET /workshop/sessions/:sessionId/questions', () => {
    it('returns empty array when no database', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/sessions/00000000-0000-0000-0000-000000000001/questions', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data).toEqual([]);
    });

    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/sessions/00000000-0000-0000-0000-000000000001/questions');
      expect(res.status).toBe(401);
    });
  });

  // ── POST /workshop/sessions/:sessionId/questions ────────────

  describe('POST /workshop/sessions/:sessionId/questions', () => {
    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/sessions/00000000-0000-0000-0000-000000000001/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionText: 'How?' }),
      });
      expect(res.status).toBe(401);
    });

    it('rejects missing questionText', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/sessions/00000000-0000-0000-0000-000000000001/questions', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it('returns 503 when DB not configured', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/sessions/00000000-0000-0000-0000-000000000001/questions', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ questionText: 'How does fraud work?' }),
      });
      expect(res.status).toBe(503);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NO_DATABASE');
    });
  });

  // ── PATCH /workshop/questions/:questionId ───────────────────

  describe('PATCH /workshop/questions/:questionId', () => {
    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/questions/00000000-0000-0000-0000-000000000001', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAnswered: true }),
      });
      expect(res.status).toBe(401);
    });

    it('returns 503 when DB not configured', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/questions/00000000-0000-0000-0000-000000000001', {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ isAnswered: true }),
      });
      expect(res.status).toBe(503);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NO_DATABASE');
    });
  });

  // ── POST /workshop/questions/:questionId/upvote ─────────────

  describe('POST /workshop/questions/:questionId/upvote', () => {
    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/questions/00000000-0000-0000-0000-000000000001/upvote', {
        method: 'POST',
      });
      expect(res.status).toBe(401);
    });

    it('returns 503 when DB not configured', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/questions/00000000-0000-0000-0000-000000000001/upvote', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(503);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NO_DATABASE');
    });
  });

  // ── GET /workshop/action-plans ──────────────────────────────

  describe('GET /workshop/action-plans', () => {
    it('returns null when no database', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/action-plans', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data).toBeNull();
    });

    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/action-plans');
      expect(res.status).toBe(401);
    });
  });

  // ── POST /workshop/action-plans ─────────────────────────────

  describe('POST /workshop/action-plans', () => {
    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/action-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionItems: [] }),
      });
      expect(res.status).toBe(401);
    });

    it('returns 503 when DB not configured', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/action-plans', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ actionItems: [{ task: 'Review policy' }] }),
      });
      expect(res.status).toBe(503);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NO_DATABASE');
    });
  });

  // ── PATCH /workshop/action-plans/:id ────────────────────────

  describe('PATCH /workshop/action-plans/:id', () => {
    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/action-plans/00000000-0000-0000-0000-000000000001', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionItems: [] }),
      });
      expect(res.status).toBe(401);
    });

    it('returns 503 when DB not configured', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/action-plans/00000000-0000-0000-0000-000000000001', {
        method: 'PATCH',
        headers: authHeaders(accessToken),
        body: JSON.stringify({ actionItems: [] }),
      });
      expect(res.status).toBe(503);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NO_DATABASE');
    });
  });

  // ── GET /workshop/certificates ──────────────────────────────

  describe('GET /workshop/certificates', () => {
    it('returns null when no database', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/certificates', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
      expect(json.data).toBeNull();
    });

    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/certificates');
      expect(res.status).toBe(401);
    });
  });

  // ── POST /workshop/certificates ─────────────────────────────

  describe('POST /workshop/certificates', () => {
    it('rejects request without auth', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(401);
    });

    it('returns 503 when DB not configured', async () => {
      const { accessToken } = await createAuthenticatedUser();
      const res = await app.request('http://localhost/api/v1/workshop/certificates', {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(503);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('NO_DATABASE');
    });
  });

  // ── GET /workshop/sessions/:sessionId/events (SSE) ──────────

  describe('GET /workshop/sessions/:sessionId/events', () => {
    it('rejects request without auth token', async () => {
      const res = await app.request('http://localhost/api/v1/workshop/sessions/00000000-0000-0000-0000-000000000001/events');
      expect(res.status).toBe(401);
      const json = (await res.json()) as any;
      expect(json.error.code).toBe('UNAUTHORIZED');
    });
  });
});
