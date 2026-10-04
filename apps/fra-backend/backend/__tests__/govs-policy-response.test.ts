/// <reference types="jest" />

import { describe, expect, it } from '@jest/globals';
import { app, authHeaders, createPaidUser } from './helpers';
import { incidentsById } from '../src/stores';

const API = 'http://localhost/api/v1';
const get = (path: string, token: string) => app.request(`${API}${path}`, { headers: authHeaders(token) });
const send = (method: string, path: string, token: string, body: unknown = {}) =>
  app.request(`${API}${path}`, { method, headers: authHeaders(token), body: JSON.stringify(body) });
const json = async (res: Response) => ((await res.json()) as any).data;

const DAY = 86_400_000;
const day = (offset = 0) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
const govs4 = async (token: string) =>
  (await json(await get('/compliance/report', token))).govs013.requirements.find((r: any) => r.id === 'govs-4');

const addPolicy = (token: string, policyType: string, title: string, reviewDue = day(300)) =>
  send('POST', '/compliance/records', token, { kind: 'policy', data: { policyType, title, approvedAt: day(-60), reviewDue } });

async function submit(token: string, answers: Record<string, unknown>) {
  const created = await json(await send('POST', '/assessments', token, { title: 'FRA', answers }));
  await send('POST', `/assessments/${created.id}/submit`, token);
}

describe('GovS 013 component 4: fraud policy and response plan', () => {
  it('is not met with nothing recorded', async () => {
    const { accessToken } = await createPaidUser();
    expect(await govs4(accessToken)).toMatchObject({
      name: 'Fraud policy and response plan', status: 'not_met',
      evidence: 'No counter fraud policy recorded; no fraud response plan recorded.',
      recommendation: expect.stringContaining('Record the fraud response plan'),
    });
  });

  it('is met with both documents in date and no serious incident left open', async () => {
    const { accessToken } = await createPaidUser();
    await addPolicy(accessToken, 'counter_fraud', 'Anti-fraud policy');
    expect(await govs4(accessToken)).toMatchObject({ status: 'partial', evidence: expect.stringContaining('no fraud response plan recorded') });

    await addPolicy(accessToken, 'response_plan', 'Fraud response plan');
    const result = await govs4(accessToken);
    expect(result.status).toBe('met');
    expect(result.evidence).toMatch(/^Counter fraud policy "Anti-fraud policy" approved .*; fraud response plan "Fraud response plan" approved .*\.$/);
    expect(result.recommendation).toBeUndefined();
  });

  it('drops to partial when a document passes its review date', async () => {
    const { accessToken } = await createPaidUser();
    await addPolicy(accessToken, 'counter_fraud', 'Anti-fraud policy');
    await send('POST', '/compliance/records', accessToken, { kind: 'policy', data: { policyType: 'response_plan', title: 'Old plan', approvedAt: day(-800), reviewDue: day(-10) } });
    expect(await govs4(accessToken)).toMatchObject({ status: 'partial', evidence: expect.stringContaining('fraud response plan past its review date') });
  });

  it('needs serious incidents dealt with inside 30 days for the plan to count as working', async () => {
    const { accessToken } = await createPaidUser();
    await addPolicy(accessToken, 'counter_fraud', 'Anti-fraud policy');
    await addPolicy(accessToken, 'response_plan', 'Fraud response plan');
    const incident = await json(await send('POST', '/compliance/incidents', accessToken, { type: 'fraud_incident', severity: 'high', description: 'Duplicate supplier invoice paid' }));
    expect((await govs4(accessToken)).status).toBe('met');

    incidentsById.get(incident.id)!.reportedAt = new Date(Date.now() - 40 * DAY).toISOString();
    expect(await govs4(accessToken)).toMatchObject({ status: 'partial', evidence: expect.stringContaining('1 serious incident(s) open over 30 days') });

    await send('PATCH', `/compliance/incidents/${incident.id}`, accessToken, { resolved: true, resolutionNotes: 'Recovered' });
    expect((await govs4(accessToken)).status).toBe('met');
  });

  it('gives partial credit when the assessment says a plan exists but none is recorded', async () => {
    const web = await createPaidUser();
    await submit(web.accessToken, { 'fraudResponse.responsePlan': 'yes' });
    expect(await govs4(web.accessToken)).toMatchObject({ status: 'partial', evidence: expect.stringContaining('the latest assessment says a response plan exists, but it is not recorded') });

    const mobile = await createPaidUser();
    await submit(mobile.accessToken, { fraudResponse: { responsePlan: 'yes' } });
    expect((await govs4(mobile.accessToken)).status).toBe('partial');

    const none = await createPaidUser();
    await submit(none.accessToken, { 'fraudResponse.responsePlan': 'no' });
    expect((await govs4(none.accessToken)).status).toBe('not_met');
  });
});
