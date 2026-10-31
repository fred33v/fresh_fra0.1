/// <reference types="jest" />

import crypto from 'node:crypto';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { app, authHeaders, createAuthenticatedUser, createPaidUser } from './helpers';
import { toCsv } from '../src/csv';
import { signPayload, validateWebhookUrl, emitOrgEvent } from '../src/webhooks-out';
import { scoreRisk } from '../src/routes/risk-register';

const API = 'http://localhost/api/v1';
const get = (path: string, token: string) => app.request(`${API}${path}`, { headers: authHeaders(token) });
const send = (method: string, path: string, token: string, body: unknown = {}) =>
  app.request(`${API}${path}`, { method, headers: authHeaders(token), body: JSON.stringify(body) });

const risk = {
  title: 'Supplier invoice fraud', riskArea: 'procurement',
  impact: 5, likelihood: 4, controlEffectiveness: 'reasonably_strong',
};

describe('CSV helper', () => {
  it('quotes separators and neutralises spreadsheet formulas', () => {
    const csv = toCsv([{ a: 'x,y', b: '=HYPERLINK("evil")', c: null }]);
    expect(csv).toBe('a,b,c\r\n"x,y","\'=HYPERLINK(""evil"")",\r\n');
  });
});

describe('Risk scoring', () => {
  it('follows impact × likelihood with control reductions', () => {
    expect(scoreRisk(5, 4, 'none')).toEqual({ inherentScore: 20, residualScore: 20, priority: 'HIGH' });
    expect(scoreRisk(5, 4, 'reasonably_strong')).toEqual({ inherentScore: 20, residualScore: 16, priority: 'HIGH' });
    expect(scoreRisk(5, 4, 'very_strong')).toEqual({ inherentScore: 20, residualScore: 12, priority: 'MEDIUM' });
    expect(scoreRisk(2, 3, 'some_gaps')).toEqual({ inherentScore: 6, residualScore: 6, priority: 'LOW' });
  });
});

describe('Risk register', () => {
  it('requires Enterprise', async () => {
    const pro = await createPaidUser('pkg_training');
    expect((await get('/risk-register', pro.accessToken)).status).toBe(403);
  });

  it('creates, scores, updates, summarises, exports and deletes risks', async () => {
    const { accessToken, userId } = await createPaidUser();

    const created = await send('POST', '/risk-register', accessToken, { ...risk, ownerUserId: userId, dueDate: '2020-01-01' });
    expect(created.status).toBe(201);
    const entry = ((await created.json()) as any).data;
    expect(entry).toMatchObject({ inherentScore: 20, residualScore: 16, priority: 'HIGH', status: 'open' });

    const patched = await send('PATCH', `/risk-register/${entry.id}`, accessToken, { controlEffectiveness: 'very_strong', status: 'in_progress' });
    expect(((await patched.json()) as any).data).toMatchObject({ residualScore: 12, priority: 'MEDIUM', status: 'in_progress' });

    const summary = ((await (await get('/risk-register/summary', accessToken)).json()) as any).data;
    expect(summary).toMatchObject({ total: 1, overdue: 1, unowned: 0 });
    expect(summary.byPriority.MEDIUM).toBe(1);
    expect(summary.heatMap[4][3]).toBe(1);

    const csv = await get('/risk-register?format=csv', accessToken);
    expect(csv.headers.get('content-type')).toContain('text/csv');
    expect(await csv.text()).toContain('Supplier invoice fraud');

    expect((await send('DELETE', `/risk-register/${entry.id}`, accessToken)).status).toBe(200);
    expect((await get(`/risk-register/${entry.id}`, accessToken)).status).toBe(404);
  });

  it('rejects owners from another organisation', async () => {
    const { accessToken } = await createPaidUser();
    const outsider = await createAuthenticatedUser();
    const res = await send('POST', '/risk-register', accessToken, { ...risk, ownerUserId: outsider.userId });
    expect(res.status).toBe(400);
    expect(((await res.json()) as any).error.code).toBe('INVALID_OWNER');
  });

  it('keeps each organisation\'s register private', async () => {
    const a = await createPaidUser();
    const b = await createPaidUser();
    const entry = ((await (await send('POST', '/risk-register', a.accessToken, risk)).json()) as any).data;
    expect((await get(`/risk-register/${entry.id}`, b.accessToken)).status).toBe(404);
  });
});

describe('My actions (Enterprise employees)', () => {
  /** An employer on Enterprise and one employee who joined with a key-pass */
  async function team() {
    const boss = await createPaidUser();
    const codes = ((await (await send('POST', '/keypasses/generate', boss.accessToken, { quantity: 1, expiresInDays: 30 })).json()) as any).data.codes;
    const email = `sam+${crypto.randomUUID()}@example.com`;
    const joined = await app.request(`${API}/keypasses/use`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: codes[0], email, password: 'Employee-Pass-2026', name: 'Sam' }),
    });
    const body = (await joined.json()) as any;
    return { boss, employee: { accessToken: body.data.accessToken as string, userId: body.data.user.userId as string } };
  }

  it('shows an employee only the risks they own, and the reporting link', async () => {
    const { boss, employee } = await team();
    const mine = ((await (await send('POST', '/risk-register', boss.accessToken, { ...risk, ownerUserId: employee.userId, actionPlan: 'Call back on bank changes', dueDate: '2030-01-01' })).json()) as any).data;
    await send('POST', '/risk-register', boss.accessToken, { ...risk, title: 'Not theirs', ownerUserId: boss.userId });
    await send('PUT', '/compliance/speak-up/intake', boss.accessToken, { enabled: true });

    // The full register stays with the employer
    expect((await get('/risk-register', employee.accessToken)).status).toBe(403);

    const res = await get('/my-actions', employee.accessToken);
    expect(res.status).toBe(200);
    const data = ((await res.json()) as any).data;
    expect(data.risks.map((r: any) => r.id)).toEqual([mine.id]);
    expect(data.risks[0].actionPlan).toBe('Call back on bank changes');
    expect(data.speakUpToken).toEqual(expect.any(String));
  });

  it('lets the owner report progress, and the employer approve or reopen it', async () => {
    const { boss, employee } = await team();
    const entry = ((await (await send('POST', '/risk-register', boss.accessToken, { ...risk, ownerUserId: employee.userId })).json()) as any).data;

    const done = await send('POST', `/my-actions/${entry.id}/progress`, employee.accessToken, { status: 'done', note: 'Call-back check in place since 1 Nov' });
    expect(done.status).toBe(200);
    const saved = ((await done.json()) as any).data;
    expect(saved.status).toBe('mitigated');
    expect(saved.reviewPending).toBe(true);
    expect(saved.ownerNote).toBe('Call-back check in place since 1 Nov');

    const summary = ((await (await get('/risk-register/summary', boss.accessToken)).json()) as any).data;
    expect(summary.awaitingReview).toBe(1);

    const reopened = ((await (await send('POST', `/risk-register/${entry.id}/review`, boss.accessToken, { decision: 'reopen' })).json()) as any).data;
    expect(reopened.status).toBe('in_progress');
    expect(reopened.reviewPending).toBe(false);

    await send('POST', `/my-actions/${entry.id}/progress`, employee.accessToken, { status: 'done' });
    const approved = ((await (await send('POST', `/risk-register/${entry.id}/review`, boss.accessToken, { decision: 'approve' })).json()) as any).data;
    expect(approved.status).toBe('mitigated');
    expect(approved.reviewPending).toBe(false);
    expect((await send('POST', `/risk-register/${entry.id}/review`, boss.accessToken, { decision: 'approve' })).status).toBe(409);
  });

  it('keeps an owner update waiting when the employer edits other fields', async () => {
    const { boss, employee } = await team();
    const entry = ((await (await send('POST', '/risk-register', boss.accessToken, { ...risk, ownerUserId: employee.userId })).json()) as any).data;
    await send('POST', `/my-actions/${entry.id}/progress`, employee.accessToken, { status: 'done' });
    // The edit form always sends the status it shows
    const edited = ((await (await send('PATCH', `/risk-register/${entry.id}`, boss.accessToken, { title: 'Renamed', status: 'mitigated' })).json()) as any).data;
    expect(edited.reviewPending).toBe(true);
    const closed = ((await (await send('PATCH', `/risk-register/${entry.id}`, boss.accessToken, { status: 'closed' })).json()) as any).data;
    expect(closed.reviewPending).toBe(false);
  });

  it('refuses updates to a risk someone else owns, and employees cannot review', async () => {
    const { boss, employee } = await team();
    const entry = ((await (await send('POST', '/risk-register', boss.accessToken, { ...risk, ownerUserId: boss.userId })).json()) as any).data;
    expect((await send('POST', `/my-actions/${entry.id}/progress`, employee.accessToken, { status: 'done' })).status).toBe(404);
    expect((await send('POST', `/risk-register/${entry.id}/review`, employee.accessToken, { decision: 'approve' })).status).toBe(403);
  });

  it('is part of Enterprise only', async () => {
    const pro = await createPaidUser('pkg_training');
    expect((await get('/my-actions', pro.accessToken)).status).toBe(403);
  });
});

describe('API keys', () => {
  async function newKey() {
    const user = await createPaidUser();
    const res = await send('POST', '/api-keys', user.accessToken, { name: 'GRC sync' });
    expect(res.status).toBe(201);
    const data = ((await res.json()) as any).data;
    return { user, key: data.key as string, id: data.id as string };
  }

  it('returns the key once and never lists the secret or hash', async () => {
    const { user, key } = await newKey();
    expect(key).toMatch(/^sfra_[a-f0-9]{64}$/);
    const list = ((await (await get('/api-keys', user.accessToken)).json()) as any).data;
    expect(list).toHaveLength(1);
    expect(JSON.stringify(list)).not.toContain(key);
    expect(list[0].keyHash).toBeUndefined();
  });

  it('reads reporting endpoints for its own organisation', async () => {
    const { key } = await newKey();
    expect((await get('/analytics/dashboard', key)).status).toBe(200);
    expect((await get('/risk-register', key)).status).toBe(200);
    expect((await get('/compliance/report', key)).status).toBe(200);
    const csv = await get('/analytics/employees?format=csv', key);
    expect(csv.status).toBe(200);
    expect(await csv.text()).toContain('userId,userName,email');
  });

  it('is read-only and limited to reporting endpoints', async () => {
    const { key } = await newKey();
    expect((await send('POST', '/risk-register', key, risk)).status).toBe(403);
    expect((await get('/workshop/sessions', key)).status).toBe(403);
    expect((await get('/api-keys', key)).status).toBe(403);
    expect((await get('/auth/me', key)).status).toBe(403);
  });

  it('stops working once revoked', async () => {
    const { user, key, id } = await newKey();
    expect((await send('DELETE', `/api-keys/${id}`, user.accessToken)).status).toBe(200);
    expect((await get('/analytics/dashboard', key)).status).toBe(401);
  });

  it('rejects unknown keys', async () => {
    expect((await get('/analytics/dashboard', `sfra_${'0'.repeat(64)}`)).status).toBe(401);
  });

  it('can only be created on Enterprise', async () => {
    const pro = await createPaidUser('pkg_training');
    expect((await send('POST', '/api-keys', pro.accessToken, { name: 'x' })).status).toBe(403);
  });
});

describe('Compliance CSV export', () => {
  it('exports a dataset as CSV and validates the dataset name', async () => {
    const { accessToken } = await createPaidUser();
    await send('POST', '/assessments', accessToken, { title: 'Exported' });
    const res = await get('/compliance/export?format=csv&dataset=assessments', accessToken);
    expect(res.headers.get('content-type')).toContain('text/csv');
    const text = await res.text();
    expect(text).toContain('Exported');
    expect(text).not.toContain('answers');
    expect((await get('/compliance/export?format=csv&dataset=users', accessToken)).status).toBe(400);
  });
});

describe('Outgoing webhooks', () => {
  const fetchMock = jest.fn<typeof fetch>();
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
    fetchMock.mockReset();
  });

  it('validates endpoint URLs', () => {
    expect(validateWebhookUrl('https://siem.example.com/hook')).toBeNull();
    expect(validateWebhookUrl('http://localhost:8080/x')).not.toBeNull();
    expect(validateWebhookUrl('https://10.0.0.5/x')).not.toBeNull();
    expect(validateWebhookUrl('https://169.254.169.254/latest')).not.toBeNull();
    expect(validateWebhookUrl('https://[::1]/x')).not.toBeNull();
    expect(validateWebhookUrl('ftp://example.com')).not.toBeNull();
    expect(validateWebhookUrl('https://user:pw@example.com')).not.toBeNull();
  });

  it('registers an endpoint, returns the secret once, and delivers signed events', async () => {
    const { accessToken, organisationId } = await createPaidUser();
    const created = await send('POST', '/webhook-endpoints', accessToken, {
      url: 'https://siem.example.com/hook', events: ['risk.created', 'risk.high_priority'],
    });
    expect(created.status).toBe(201);
    const { secret } = ((await created.json()) as any).data;
    expect(secret).toMatch(/^whsec_/);
    const listed = ((await (await get('/webhook-endpoints', accessToken)).json()) as any).data;
    expect(listed[0].secret).toBeUndefined();

    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    global.fetch = fetchMock;
    await emitOrgEvent(organisationId, 'risk.created', { hello: 'world' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://siem.example.com/hook');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-StopFRA-Event']).toBe('risk.created');

    const [t, v1] = headers['X-StopFRA-Signature'].split(',').map((p) => p.split('=')[1]);
    const expected = crypto.createHmac('sha256', secret).update(`${t}.${init.body}`).digest('hex');
    expect(v1).toBe(expected);
    expect(signPayload(secret, init.body as string, Number(t))).toBe(headers['X-StopFRA-Signature']);
  });

  it('does not send events the endpoint did not subscribe to', async () => {
    const { accessToken, organisationId } = await createPaidUser();
    await send('POST', '/webhook-endpoints', accessToken, { url: 'https://siem.example.com/a', events: ['keypass.used'] });
    global.fetch = fetchMock;
    await emitOrgEvent(organisationId, 'risk.created', {});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects private URLs and unknown events', async () => {
    const { accessToken } = await createPaidUser();
    expect((await send('POST', '/webhook-endpoints', accessToken, { url: 'http://127.0.0.1/x', events: ['risk.created'] })).status).toBe(400);
    expect((await send('POST', '/webhook-endpoints', accessToken, { url: 'https://ok.example.com', events: ['user.deleted'] })).status).toBe(400);
  });
});
