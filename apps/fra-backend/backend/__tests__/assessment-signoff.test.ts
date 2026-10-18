/// <reference types="jest" />

import { describe, expect, it } from '@jest/globals';
import { app, authHeaders, createPaidUser } from './helpers';

const send = (method: string, path: string, token: string, body?: unknown) =>
  app.request(`http://localhost/api/v1${path}`, { method, headers: authHeaders(token), body: body === undefined ? undefined : JSON.stringify(body) });

async function submittedAssessment(token: string) {
  const created = (await (await send('POST', '/assessments', token, { title: 'Sign-off test' })).json()) as any;
  await send('POST', `/assessments/${created.data.id}/submit`, token, {});
  return created.data.id as string;
}

async function employeeOf(ownerToken: string) {
  const gen = (await (await send('POST', '/keypasses/generate', ownerToken, { quantity: 1, expiresInDays: 30 })).json()) as any;
  const res = await app.request('http://localhost/api/v1/keypasses/use', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: gen.data.codes[0], email: `emp-${crypto.randomUUID()}@example.com`, name: 'Staff Member' }),
  });
  return ((await res.json()) as any).data.accessToken as string;
}

const signOff = { signerName: 'Dana Director', signerRole: 'Finance Director', confirm: true };

describe('assessment sign-off', () => {
  it('lets a manager sign off a submitted assessment once, and records the statement', async () => {
    const owner = await createPaidUser('pkg_full');
    const id = await submittedAssessment(owner.accessToken);

    const first = await send('POST', `/assessments/${id}/sign-off`, owner.accessToken, signOff);
    expect(first.status).toBe(201);
    const record = ((await first.json()) as any).data;
    expect(record).toMatchObject({ signerName: 'Dana Director', signerRole: 'Finance Director', assessmentId: id });
    expect(record.statement).toMatch(/reviewed this fraud risk assessment/);

    const again = await send('POST', `/assessments/${id}/sign-off`, owner.accessToken, signOff);
    expect(again.status).toBe(409);

    const read = ((await (await send('GET', `/assessments/${id}/sign-off`, owner.accessToken)).json()) as any).data;
    expect(read.signOff.signerName).toBe('Dana Director');
  });

  it('requires the statement to be confirmed and a name', async () => {
    const owner = await createPaidUser('pkg_full');
    const id = await submittedAssessment(owner.accessToken);
    expect((await send('POST', `/assessments/${id}/sign-off`, owner.accessToken, { signerName: 'Dana', confirm: false })).status).toBe(400);
    expect((await send('POST', `/assessments/${id}/sign-off`, owner.accessToken, { signerName: '', confirm: true })).status).toBe(400);
  });

  it('cannot be done before the assessment is submitted', async () => {
    const owner = await createPaidUser('pkg_full');
    const created = (await (await send('POST', '/assessments', owner.accessToken, { title: 'Draft' })).json()) as any;
    const res = await send('POST', `/assessments/${created.data.id}/sign-off`, owner.accessToken, signOff);
    expect(res.status).toBe(409);
  });

  it('is only for managers', async () => {
    const owner = await createPaidUser('pkg_full');
    const id = await submittedAssessment(owner.accessToken);
    const employee = await employeeOf(owner.accessToken);
    expect((await send('POST', `/assessments/${id}/sign-off`, employee, signOff)).status).toBe(403);
  });

  it("cannot touch another organisation's assessment", async () => {
    const owner = await createPaidUser('pkg_full');
    const id = await submittedAssessment(owner.accessToken);
    const stranger = await createPaidUser('pkg_full');
    expect((await send('POST', `/assessments/${id}/sign-off`, stranger.accessToken, signOff)).status).toBe(404);
    expect((await send('GET', `/assessments/${id}/sign-off`, stranger.accessToken)).status).toBe(404);
  });
});

describe('assessment feedback', () => {
  it('saves a rating and comments from anyone in the organisation', async () => {
    const owner = await createPaidUser('pkg_full');
    const id = await submittedAssessment(owner.accessToken);
    const employee = await employeeOf(owner.accessToken);

    const res = await send('POST', `/assessments/${id}/feedback`, employee, { rating: 4, comments: 'Clear and useful' });
    expect(res.status).toBe(201);
    expect(((await res.json()) as any).data).toMatchObject({ rating: 4, comments: 'Clear and useful' });
  });

  it('only accepts ratings from 1 to 5', async () => {
    const owner = await createPaidUser('pkg_full');
    const id = await submittedAssessment(owner.accessToken);
    expect((await send('POST', `/assessments/${id}/feedback`, owner.accessToken, { rating: 6 })).status).toBe(400);
    expect((await send('POST', `/assessments/${id}/feedback`, owner.accessToken, { rating: 0 })).status).toBe(400);
  });
});
