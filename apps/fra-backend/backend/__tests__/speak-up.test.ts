/// <reference types="jest" />

import { describe, expect, it } from '@jest/globals';
import { app, authHeaders, createPaidUser } from './helpers';
import { auditEvents, speakUpReportsById } from '../src/stores';

const API = 'http://localhost/api/v1';
const JSON_HEADERS = { 'Content-Type': 'application/json' };
const get = (path: string, token: string) => app.request(`${API}${path}`, { headers: authHeaders(token) });
const send = (method: string, path: string, token: string, body: unknown = {}) =>
  app.request(`${API}${path}`, { method, headers: authHeaders(token), body: JSON.stringify(body) });
const publicPost = (path: string, body: unknown) =>
  app.request(`${API}/speak-up${path}`, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) });
const json = async (res: Response) => ((await res.json()) as any).data;

const REPORT = {
  category: 'procurement',
  description: 'A supplier is invoicing twice for the same deliveries and someone in accounts approves both.',
  relationship: 'employee',
  anonymous: true,
};

async function orgWithIntake() {
  const manager = await createPaidUser();
  const intake = await json(await send('PUT', '/compliance/speak-up/intake', manager.accessToken, { enabled: true, intro: 'Reports go to the audit committee chair.' }));
  return { ...manager, token: intake.token as string };
}

async function report(token: string, body: Record<string, unknown> = REPORT) {
  return json(await publicPost(`/${token}/reports`, body)) as Promise<{ reference: string; accessKey: string }>;
}

const caseFor = (reference: string) => Array.from(speakUpReportsById.values()).find((r) => r.reference === reference)!;

describe('Speak-up intake link', () => {
  it('shows the organisation and its introduction only while switched on', async () => {
    const { accessToken, token } = await orgWithIntake();
    const page = await json(await app.request(`${API}/speak-up/${token}`));
    expect(page).toMatchObject({ intro: 'Reports go to the audit committee chair.', categories: expect.arrayContaining(['fraud', 'bribery']) });
    expect(page.organisationName).toBeTruthy();

    await send('PUT', '/compliance/speak-up/intake', accessToken, { enabled: false });
    expect((await app.request(`${API}/speak-up/${token}`)).status).toBe(404);
  });

  it('stops the old link working when a new one is made', async () => {
    const { accessToken, token } = await orgWithIntake();
    const fresh = await json(await send('PUT', '/compliance/speak-up/intake', accessToken, { enabled: true, regenerateLink: true }));
    expect(fresh.token).not.toBe(token);
    expect((await app.request(`${API}/speak-up/${token}`)).status).toBe(404);
    expect((await app.request(`${API}/speak-up/${fresh.token}`)).status).toBe(200);
  });

  it('rejects unknown and malformed links', async () => {
    expect((await app.request(`${API}/speak-up/not-a-real-token-but-long-enough`)).status).toBe(404);
    expect((await app.request(`${API}/speak-up/x`)).status).toBe(404);
  });
});

describe('Making a report', () => {
  it('gives an anonymous reporter a reference and key, and keeps no contact details or address', async () => {
    const { token } = await orgWithIntake();
    const res = await publicPost(`/${token}/reports`, { ...REPORT, name: 'Should be dropped', email: 'dropped@example.test' });
    expect(res.status).toBe(201);
    const { reference, accessKey } = await json(res);
    expect(reference).toMatch(/^SU-[A-Z2-9]{8}$/);
    expect(accessKey).toHaveLength(20);

    const stored = caseFor(reference);
    expect(stored).toMatchObject({ anonymous: true, status: 'new' });
    expect(stored.reporterName).toBeUndefined();
    expect(stored.reporterEmail).toBeUndefined();
    expect(stored.accessKeyHash).not.toContain(accessKey);

    const event = auditEvents.filter((e) => e.eventType === 'speak_up.report_received').at(-1)!;
    expect(event.ipAddress).toBeUndefined();
    expect(event.actorId).toBeUndefined();
  });

  it('needs a way to reply to a named reporter, and a real description', async () => {
    const { token } = await orgWithIntake();
    expect((await publicPost(`/${token}/reports`, { ...REPORT, anonymous: false, name: 'Sam' })).status).toBe(400);
    expect((await publicPost(`/${token}/reports`, { ...REPORT, description: 'Too short' })).status).toBe(400);
    expect((await publicPost(`/${token}/reports`, { ...REPORT, ipAddress: '1.2.3.4' })).status).toBe(400);

    const named = await report(token, { ...REPORT, anonymous: false, name: 'Sam Lee', email: 'sam@example.test' });
    expect(caseFor(named.reference)).toMatchObject({ reporterName: 'Sam Lee', reporterEmail: 'sam@example.test' });
  });
});

describe('Following a case', () => {
  it('shows the reporter a plain status and the conversation, but only with the right key', async () => {
    const { accessToken, token } = await orgWithIntake();
    const { reference, accessKey } = await report(token);
    const id = caseFor(reference).id;

    const status = await json(await publicPost('/status', { reference: reference.toLowerCase(), accessKey }));
    expect(status).toEqual(expect.objectContaining({ reference, status: 'Received', messages: [] }));

    const wrongKey = await publicPost('/status', { reference, accessKey: 'AAAAAAAAAAAAAAAAAAAA' });
    const wrongRef = await publicPost('/status', { reference: 'SU-ZZZZZZZZ', accessKey });
    expect(wrongKey.status).toBe(404);
    expect(await wrongKey.json()).toEqual(await wrongRef.json());

    await send('POST', `/compliance/speak-up/reports/${id}/messages`, accessToken, { message: 'Thank you. Which supplier is it?' });
    const added = await publicPost('/messages', { reference, accessKey, message: 'Acme Supplies Ltd, since March.' });
    expect(added.status).toBe(201);
    expect((await json(added)).messages.map((m: any) => m.author)).toEqual(['handler', 'reporter']);

    const detail = await json(await get(`/compliance/speak-up/reports/${id}`, accessToken));
    expect(detail.messages.at(-1)).toMatchObject({ author: 'reporter', body: 'Acme Supplies Ltd, since March.' });
  });

  it('closes the conversation when the case is closed', async () => {
    const { accessToken, token } = await orgWithIntake();
    const { reference, accessKey } = await report(token);
    await send('PATCH', `/compliance/speak-up/reports/${caseFor(reference).id}`, accessToken, { status: 'closed', outcome: 'No fraud found' });
    expect((await publicPost('/messages', { reference, accessKey, message: 'More detail' })).status).toBe(409);
    expect((await json(await publicPost('/status', { reference, accessKey }))).status).toBe('Closed');
  });
});

describe('Handling cases', () => {
  it('treats a reply to a new report as reviewing it', async () => {
    const { accessToken, token } = await orgWithIntake();
    const { reference, accessKey } = await report(token);
    const stored = caseFor(reference);
    // An old report waiting for review is flagged
    stored.receivedAt = new Date(Date.now() - 10 * 86_400_000).toISOString();
    expect((await json(await get('/compliance/speak-up/reports', accessToken)))[0]).toMatchObject({ status: 'new', overdueForTriage: true });

    const replied = await json(await send('POST', `/compliance/speak-up/reports/${stored.id}/messages`, accessToken, { message: 'Thank you. Which supplier?' }));
    expect(replied).toMatchObject({ status: 'triage', overdueForTriage: false, acknowledgedAt: expect.any(String) });
    expect((await json(await publicPost('/status', { reference, accessKey }))).status).not.toBe('Received');

    // Later replies leave the status alone
    await send('PATCH', `/compliance/speak-up/reports/${stored.id}`, accessToken, { status: 'investigating' });
    const again = await json(await send('POST', `/compliance/speak-up/reports/${stored.id}/messages`, accessToken, { message: 'Any invoices you can share?' }));
    expect(again.status).toBe('investigating');
  });

  it('stamps acknowledgement and closure, and assigns only colleagues', async () => {
    const { accessToken, userId, token } = await orgWithIntake();
    const outsider = await createPaidUser();
    const { reference } = await report(token);
    const id = caseFor(reference).id;

    const triaged = await json(await send('PATCH', `/compliance/speak-up/reports/${id}`, accessToken, { status: 'triage', assignedUserId: userId }));
    expect(triaged.acknowledgedAt).toBeTruthy();
    expect(triaged.assignedUserName).toBeTruthy();
    expect((await send('PATCH', `/compliance/speak-up/reports/${id}`, accessToken, { assignedUserId: outsider.userId })).status).toBe(400);

    const closed = await json(await send('PATCH', `/compliance/speak-up/reports/${id}`, accessToken, { status: 'closed', referral: 'police' }));
    expect(closed).toMatchObject({ status: 'closed', referral: 'police' });
    expect(closed.closedAt).toBeTruthy();
    const reopened = await json(await send('PATCH', `/compliance/speak-up/reports/${id}`, accessToken, { status: 'investigating' }));
    expect(reopened.closedAt).toBeUndefined();
    expect(reopened.acknowledgedAt).toBe(triaged.acknowledgedAt);
  });

  it('turns a case into one incident', async () => {
    const { accessToken, token } = await orgWithIntake();
    const { reference } = await report(token);
    const id = caseFor(reference).id;

    const linked = await json(await send('POST', `/compliance/speak-up/reports/${id}/incident`, accessToken, { severity: 'high' }));
    expect(linked.incidentId).toBeTruthy();
    const incidents = await json(await get('/compliance/incidents', accessToken));
    expect(incidents.find((i: any) => i.id === linked.incidentId).description).toContain(reference);
    expect((await send('POST', `/compliance/speak-up/reports/${id}/incident`, accessToken, { severity: 'high' })).status).toBe(409);
  });

  it('keeps cases inside the organisation and records every view', async () => {
    const { token, accessToken } = await orgWithIntake();
    const other = await createPaidUser();
    const { reference } = await report(token);
    const id = caseFor(reference).id;

    expect((await get(`/compliance/speak-up/reports/${id}`, other.accessToken)).status).toBe(404);
    expect(await json(await get('/compliance/speak-up/reports', other.accessToken))).toEqual([]);

    await get(`/compliance/speak-up/reports/${id}`, accessToken);
    expect(auditEvents.some((e) => e.eventType === 'speak_up.case_viewed' && e.resourceId === id)).toBe(true);
  });

  it('exports the case log without report text or reporter identity', async () => {
    const { accessToken, token } = await orgWithIntake();
    await report(token, { ...REPORT, anonymous: false, name: 'Sam Lee', email: 'sam@example.test' });
    const csv = await (await get('/compliance/speak-up/reports?format=csv', accessToken)).text();
    expect(csv).toContain('reference');
    expect(csv).not.toContain('Sam Lee');
    expect(csv).not.toContain('sam@example.test');
    expect(csv).not.toContain('invoicing twice');
  });
});

describe('GovS 013 component 7: reporting routes', () => {
  const govs12 = async (token: string) =>
    (await json(await get('/compliance/report', token))).govs013.requirements.find((r: any) => r.id === 'govs-12');

  it('is partly met by a staff-only route, and met by the speak-up link', async () => {
    const manager = await createPaidUser();
    await send('POST', '/compliance/records', manager.accessToken, {
      kind: 'reporting_route', data: { name: 'Line manager', channel: 'in_person', contact: 'Your line manager', audience: 'staff', anonymousAllowed: 'no' },
    });
    expect(await govs12(manager.accessToken)).toMatchObject({ status: 'partial', evidence: expect.stringContaining('contractors or public') });

    await send('PUT', '/compliance/speak-up/intake', manager.accessToken, { enabled: true });
    expect((await govs12(manager.accessToken)).status).toBe('met');
  });

  it('drops to partly met while a report waits over 7 days for review', async () => {
    const { accessToken, token } = await orgWithIntake();
    const { reference } = await report(token);
    caseFor(reference).receivedAt = new Date(Date.now() - 8 * 86_400_000).toISOString();

    expect(await govs12(accessToken)).toMatchObject({ status: 'partial', evidence: expect.stringContaining('not reviewed within 7 days') });
    const list = await (await get('/compliance/speak-up/reports', accessToken)).json() as any;
    expect(list.summary).toMatchObject({ total: 1, open: 1, overdueForTriage: 1 });
  });
});
