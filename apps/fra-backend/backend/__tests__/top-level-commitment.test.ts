/// <reference types="jest" />

import { describe, expect, it } from '@jest/globals';
import { app, authHeaders, createPaidUser } from './helpers';

const API = 'http://localhost/api/v1';
const get = (path: string, token: string) => app.request(`${API}${path}`, { headers: authHeaders(token) });
const send = (method: string, path: string, token: string, body: unknown = {}) =>
  app.request(`${API}${path}`, { method, headers: authHeaders(token), body: JSON.stringify(body) });
const day = (offset = 0) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const eccta1 = async (token: string) =>
  ((await (await get('/compliance/report', token)).json()) as any).data.eccta2023.requirements.find((r: any) => r.id === 'eccta-1');

const MINUTE = { meetingDate: day(-20), body: 'audit_committee', itemsDiscussed: 'Fraud risk register and the speak-up case log', decisions: 'Approved the counter fraud policy' };
const TONE = { title: 'Zero tolerance of fraud', issuedBy: 'Chief Executive', issuedAt: day(-10), audience: 'staff_and_associates', channel: 'intranet', statement: 'We will not tolerate fraud by anyone acting for us, even if it would benefit the organisation.' };

describe('Top-level commitment (ECCTA principle 1)', () => {
  it('needs reviewed senior managers, board oversight and a tone-from-the-top statement', async () => {
    const { accessToken, userId } = await createPaidUser();
    expect((await eccta1(accessToken)).status).toBe('not_met');

    await send('POST', '/compliance/senior-management', accessToken, { userId, role: 'CEO', lastReviewed: day() });
    expect(await eccta1(accessToken)).toMatchObject({ status: 'partial', evidence: expect.stringContaining('no tone-from-the-top statement') });

    expect((await send('POST', '/compliance/records', accessToken, { kind: 'board_minute', data: MINUTE })).status).toBe(201);
    expect((await send('POST', '/compliance/records', accessToken, { kind: 'tone_statement', data: TONE })).status).toBe(201);
    expect(await eccta1(accessToken)).toMatchObject({ status: 'met', evidence: expect.stringContaining('fraud discussed at 1 board or committee meeting') });
  });

  it('does not count senior leadership meetings or anything older than 12 months', async () => {
    const { accessToken, userId } = await createPaidUser();
    await send('POST', '/compliance/senior-management', accessToken, { userId, role: 'CEO', lastReviewed: day() });
    await send('POST', '/compliance/records', accessToken, { kind: 'board_minute', data: { ...MINUTE, body: 'senior_leadership' } });
    await send('POST', '/compliance/records', accessToken, { kind: 'board_minute', data: { ...MINUTE, meetingDate: day(-400) } });
    await send('POST', '/compliance/records', accessToken, { kind: 'tone_statement', data: TONE });
    expect(await eccta1(accessToken)).toMatchObject({ status: 'partial', evidence: expect.stringContaining('no board or committee minutes on fraud') });
  });

  it('validates the records and includes them in exports', async () => {
    const { accessToken } = await createPaidUser();
    expect((await send('POST', '/compliance/records', accessToken, { kind: 'board_minute', data: { ...MINUTE, body: 'staff_party' } })).status).toBe(400);
    expect((await send('POST', '/compliance/records', accessToken, { kind: 'tone_statement', data: { ...TONE, statement: '' } })).status).toBe(400);
    expect((await send('POST', '/compliance/records', accessToken, { kind: 'tone_statement', data: { ...TONE, documentUrl: 'http://intranet/tone' } })).status).toBe(400);

    await send('POST', '/compliance/records', accessToken, { kind: 'tone_statement', data: TONE });
    const exported = ((await (await get('/compliance/export', accessToken)).json()) as any).data;
    expect(exported.tone_statement).toHaveLength(1);
    expect(exported.board_minute).toEqual([]);
  });
});
