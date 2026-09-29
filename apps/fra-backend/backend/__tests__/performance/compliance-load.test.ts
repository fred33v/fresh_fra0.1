/// <reference types="jest" />

import { describe, expect, it, jest } from '@jest/globals';
import { app, createAuthenticatedUser, authHeaders, seedPurchase } from '../helpers';

// Increase timeout for load tests
jest.setTimeout(30000);

// ── Helpers ────────────────────────────────────────────────────────────────

async function withEnterprise() {
  const user = await createAuthenticatedUser();
  seedPurchase(user.organisationId, user.userId, 'pkg_full');
  return user;
}

// ── In-process response time thresholds ───────────────────────────────────
// All endpoints hit the in-memory fallback path (no DB), so P99 should be
// comfortably under 300 ms even on a slow CI machine.

const RESPONSE_TIME_THRESHOLD_MS = 300;

describe('Compliance endpoints — response time (in-memory path)', () => {
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
    it(`${endpoint} responds in < ${RESPONSE_TIME_THRESHOLD_MS}ms`, async () => {
      const { accessToken } = await withEnterprise();

      const start = Date.now();
      const res = await app.request(`http://localhost${endpoint}`, {
        method: 'GET',
        headers: authHeaders(accessToken),
      });
      const elapsed = Date.now() - start;

      expect(res.status).toBe(200);
      expect(elapsed).toBeLessThan(RESPONSE_TIME_THRESHOLD_MS);
    });
  }
});

// ── Concurrent load — single user, many requests ──────────────────────────

describe('Compliance endpoints — concurrent requests (single user)', () => {
  it('handles 20 simultaneous /report requests without failure', async () => {
    const { accessToken } = await withEnterprise();
    const concurrency = 20;

    const responses = await Promise.all(
      Array.from({ length: concurrency }).map(() =>
        app.request('http://localhost/api/v1/compliance/report', {
          method: 'GET',
          headers: authHeaders(accessToken),
        })
      )
    );

    for (const res of responses) {
      expect(res.status).toBe(200);
      const json = (await res.json()) as any;
      expect(json.success).toBe(true);
    }
  });

  it('handles 20 simultaneous /training requests without failure', async () => {
    const { accessToken } = await withEnterprise();
    const concurrency = 20;

    const responses = await Promise.all(
      Array.from({ length: concurrency }).map(() =>
        app.request('http://localhost/api/v1/compliance/training', {
          method: 'GET',
          headers: authHeaders(accessToken),
        })
      )
    );

    for (const res of responses) {
      expect(res.status).toBe(200);
    }
  });

  it('handles 20 simultaneous /gap-analysis requests without failure', async () => {
    const { accessToken } = await withEnterprise();
    const concurrency = 20;

    const responses = await Promise.all(
      Array.from({ length: concurrency }).map(() =>
        app.request('http://localhost/api/v1/compliance/gap-analysis', {
          method: 'GET',
          headers: authHeaders(accessToken),
        })
      )
    );

    for (const res of responses) {
      expect(res.status).toBe(200);
    }
  });
});

// ── Concurrent load — many users (simulated Enterprise scale) ─────────────

describe('Compliance endpoints — Enterprise scale (simulated 50-user org)', () => {
  it('handles 50 concurrent users each calling /report', async () => {
    // Provision 50 enterprise users in parallel
    const users = await Promise.all(
      Array.from({ length: 50 }).map(() => withEnterprise())
    );

    const start = Date.now();
    const responses = await Promise.all(
      users.map((u) =>
        app.request('http://localhost/api/v1/compliance/report', {
          method: 'GET',
          headers: authHeaders(u.accessToken),
        })
      )
    );
    const totalMs = Date.now() - start;

    let successCount = 0;
    for (const res of responses) {
      if (res.status === 200) successCount++;
    }

    // All 50 should succeed
    expect(successCount).toBe(50);

    // 50 in-process requests should complete in well under 5 s
    expect(totalMs).toBeLessThan(5000);
  });

  it('handles 50 concurrent users each calling /audit-trail', async () => {
    const users = await Promise.all(
      Array.from({ length: 50 }).map(() => withEnterprise())
    );

    const responses = await Promise.all(
      users.map((u) =>
        app.request('http://localhost/api/v1/compliance/audit-trail', {
          method: 'GET',
          headers: authHeaders(u.accessToken),
        })
      )
    );

    let successCount = 0;
    for (const res of responses) {
      if (res.status === 200) successCount++;
    }
    expect(successCount).toBe(50);
  });
});

// ── Mixed endpoint burst ───────────────────────────────────────────────────

describe('Compliance endpoints — mixed burst across all endpoints', () => {
  it('handles simultaneous requests to all 8 endpoints', async () => {
    const users = await Promise.all(
      Array.from({ length: 8 }).map(() => withEnterprise())
    );

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

    const responses = await Promise.all(
      endpoints.map((endpoint, i) =>
        app.request(`http://localhost${endpoint}`, {
          method: 'GET',
          headers: authHeaders(users[i].accessToken),
        })
      )
    );

    for (let i = 0; i < responses.length; i++) {
      expect(responses[i].status).toBe(200);
    }
  });
});
