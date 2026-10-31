/// <reference types="jest" />

import { describe, expect, it } from '@jest/globals';
import { app, authHeaders, createPaidUser, seedPurchase } from './helpers';
import { assessmentsById } from '../src/stores';
import { SCORING_METHOD_VERSION } from '../src/assessment-result';

const API = 'http://localhost/api/v1';
const send = (method: string, path: string, token: string, body?: unknown) =>
  app.request(`${API}${path}`, { method, headers: authHeaders(token), body: body === undefined ? undefined : JSON.stringify(body) });
const json = async (res: Response) => ((await res.json()) as any).data;

const HIGH_RISK = {
  'procurement.dueDiligenceLevel': 1, 'procurement.monthlySpend': 750000,
  'procurement.recentFraud': 'yes', 'procurement.controlMaturity': 2,
};
const LOW_RISK = { 'procurement.dueDiligenceLevel': 5, 'procurement.controlMaturity': 5, 'procurement.recentFraud': 'no' };

async function submitted(packageId = 'pkg_basic') {
  const user = await createPaidUser(packageId);
  const created = await json(await send('POST', '/assessments', user.accessToken, { title: 'FRA', answers: HIGH_RISK }));
  const done = await json(await send('POST', `/assessments/${created.id}/submit`, user.accessToken));
  return { user, id: created.id as string, done };
}

describe('the result is saved when the assessment is submitted', () => {
  it('keeps the score, level, areas and register view with the method version', async () => {
    const { id, done } = await submitted();
    expect(done.result).toMatchObject({ methodVersion: SCORING_METHOD_VERSION, results: { assessmentId: id }, risk: { level: 'high' } });
    expect(done.result.results.modules.find((m: any) => m.id === 'procurement')).toMatchObject({ score: 95, level: 'High' });
  });

  it('shows the saved result even if the answers or the method would now give another one', async () => {
    const { user, id } = await submitted();
    const before = await json(await send('GET', `/assessments/${id}/results`, user.accessToken));
    // Simulate a later change to the scoring: what is stored must not move
    const stored = assessmentsById.get(id)!;
    assessmentsById.set(id, { ...stored, answers: LOW_RISK });
    const after = await json(await send('GET', `/assessments/${id}/results`, user.accessToken));
    expect(after).toEqual(before);
    expect(after.methodVersion).toBe(SCORING_METHOD_VERSION);
  });

  it('saves the result of an assessment submitted before results were kept, once', async () => {
    const { user, id } = await submitted();
    const stored = assessmentsById.get(id)!;
    assessmentsById.set(id, { ...stored, result: undefined });
    const res = await json(await send('GET', `/assessments/${id}/results`, user.accessToken));
    expect(res.overallScore).toBeGreaterThan(0);
    expect(assessmentsById.get(id)!.result).toBeDefined();
    expect(assessmentsById.get(id)!.updatedAt).toBe(stored.updatedAt);
  });

  it('is saved when the mobile app submits through PATCH too', async () => {
    const user = await createPaidUser('pkg_basic');
    const created = await json(await send('POST', '/assessments', user.accessToken, { title: 'FRA', answers: HIGH_RISK }));
    const done = await json(await send('PATCH', `/assessments/${created.id}`, user.accessToken, { status: 'submitted' }));
    expect(done.result.methodVersion).toBe(SCORING_METHOD_VERSION);
  });
});

describe('answers are locked once submitted', () => {
  it('refuses new answers, but allows the title and completing it', async () => {
    const { user, id } = await submitted();
    const res = await send('PATCH', `/assessments/${id}`, user.accessToken, { answers: LOW_RISK });
    expect(res.status).toBe(409);
    expect(((await res.json()) as any).error.code).toBe('ANSWERS_LOCKED');
    expect(assessmentsById.get(id)!.answers).toEqual(HIGH_RISK);

    expect((await send('PATCH', `/assessments/${id}`, user.accessToken, { title: 'FRA 2026' })).status).toBe(200);
    const completed = await json(await send('PATCH', `/assessments/${id}`, user.accessToken, { status: 'completed' }));
    expect(completed.result.risk.level).toBe('high');
  });

  it('keeps the Starter result when the organisation moves up to Professional', async () => {
    const { user, id } = await submitted('pkg_basic');
    seedPurchase(user.organisationId, user.userId, 'pkg_training');
    const list = await json(await send('GET', '/assessments', user.accessToken));
    expect(list.find((a: any) => a.id === id).result.risk.level).toBe('high');
  });
});

describe('Enterprise: the risk register starts from the assessment', () => {
  it('suggests the high and medium risks not yet in the register, and imports them for review', async () => {
    const { user } = await submitted('pkg_full');
    const suggestions = await json(await send('GET', '/risk-register/from-assessment', user.accessToken));
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions[0]).toMatchObject({ riskArea: 'procurement', priority: 'high', raisedBy: 1 });

    const created = await json(await send('POST', '/risk-register/from-assessment', user.accessToken, { titles: [suggestions[0].title] }));
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ title: suggestions[0].title, status: 'open', priority: 'HIGH' });
    expect(created[0].ownerUserId).toBeUndefined();

    // Already in the register: not suggested again
    const again = await json(await send('GET', '/risk-register/from-assessment', user.accessToken));
    expect(again.map((s: any) => s.title)).not.toContain(suggestions[0].title);
  });

  it('is for Enterprise employers', async () => {
    const { user } = await submitted('pkg_training');
    expect((await send('GET', '/risk-register/from-assessment', user.accessToken)).status).toBe(403);
  });
});
