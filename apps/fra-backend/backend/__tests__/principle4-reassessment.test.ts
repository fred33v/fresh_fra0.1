/// <reference types="jest" />

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { app, authHeaders, createPaidUser } from './helpers';
import { assessmentsById, auditEvents } from '../src/stores';
import { dueDiligenceStatus } from '../src/counter-fraud';
import { reassessmentStatus, runReassessmentReminders, REASSESSMENT_INTERVAL_DAYS } from '../src/reassessment';
import type { Assessment, Purchase } from '../src/types';

const API = 'http://localhost/api/v1';
const get = (path: string, token: string) => app.request(`${API}${path}`, { headers: authHeaders(token) });
const send = (method: string, path: string, token: string, body: unknown = {}) =>
  app.request(`${API}${path}`, { method, headers: authHeaders(token), body: JSON.stringify(body) });
const json = async (res: Response) => ((await res.json()) as any).data;

const DAY = 86_400_000;
const today = (offset = 0) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
const eccta4 = async (token: string) =>
  (await json(await get('/compliance/report', token))).eccta2023.requirements.find((r: any) => r.id === 'eccta-4');

const SUPPLIER = {
  name: 'Acme Logistics Ltd', associateType: 'contractor', servicesProvided: 'Delivers goods and collects payments for us', riskLevel: 'medium',
};

describe('Associated persons and due diligence (ECCTA principle 4)', () => {
  it('requires more checks as the risk rises', () => {
    const medium = dueDiligenceStatus({ ...SUPPLIER, riskLevel: 'medium', identityVerified: 'yes', ownershipChecked: 'yes', sanctionsScreened: 'no', referencesChecked: 'no', contractClauses: 'no', trainingProvided: 'no' } as any);
    expect(medium).toEqual({ required: 4, done: 2, complete: false, outstanding: ['Sanctions and adverse media screened', 'Anti-fraud clauses in the contract'] });

    const low = dueDiligenceStatus({ ...SUPPLIER, riskLevel: 'low', identityVerified: 'yes', ownershipChecked: 'no', sanctionsScreened: 'no', referencesChecked: 'no', contractClauses: 'no', trainingProvided: 'no' } as any);
    expect(low.complete).toBe(true);

    const high = dueDiligenceStatus({ ...SUPPLIER, riskLevel: 'high', identityVerified: 'yes', ownershipChecked: 'yes', sanctionsScreened: 'yes', referencesChecked: 'not_applicable', contractClauses: 'yes', trainingProvided: 'no' } as any);
    expect(high).toMatchObject({ required: 6, done: 5, outstanding: ['Fraud prevention expectations communicated or trained'] });
  });

  it('returns each person with their due-diligence status and scores principle 4 from it', async () => {
    const { accessToken } = await createPaidUser();
    const created = await json(await send('POST', '/compliance/records', accessToken, { kind: 'associated_person', data: { ...SUPPLIER, identityVerified: 'yes' } }));
    expect(created.derived.dueDiligence).toMatchObject({ required: 4, done: 1, complete: false });
    expect(await eccta4(accessToken)).toMatchObject({ status: 'partial', evidence: expect.stringContaining('1 of 1 associated person') });

    const done = await json(await send('PATCH', `/compliance/records/${created.id}`, accessToken, {
      data: { ownershipChecked: 'yes', sanctionsScreened: 'yes', contractClauses: 'yes', reviewedAt: today() },
    }));
    expect(done.derived.dueDiligence.complete).toBe(true);
    expect((await json(await get('/compliance/records?kind=associated_person', accessToken)))[0].derived.dueDiligence.complete).toBe(true);
    expect((await eccta4(accessToken)).status).toBe('met');
  });

  it('needs medium and high risk relationships reviewed every year', async () => {
    const { accessToken } = await createPaidUser();
    await send('POST', '/compliance/records', accessToken, {
      kind: 'associated_person',
      data: { ...SUPPLIER, identityVerified: 'yes', ownershipChecked: 'yes', sanctionsScreened: 'yes', contractClauses: 'yes', reviewedAt: today(-400) },
    });
    expect((await eccta4(accessToken)).status).toBe('partial');
  });

  it('cannot be met from assessment answers alone', async () => {
    const { accessToken } = await createPaidUser();
    const created = await json(await send('POST', '/assessments', accessToken, { title: 'FRA', answers: { 'procurement.dueDiligenceLevel': 5, 'procurement.controlMaturity': 5, 'procurement.recentFraud': 'no' } }));
    await send('POST', `/assessments/${created.id}/submit`, accessToken);
    expect(await eccta4(accessToken)).toMatchObject({ status: 'partial', recommendation: expect.stringContaining('Record the agents') });
  });

  it('validates check answers', async () => {
    const { accessToken } = await createPaidUser();
    const res = await send('POST', '/compliance/records', accessToken, { kind: 'associated_person', data: { ...SUPPLIER, identityVerified: 'probably' } });
    expect(res.status).toBe(400);
  });
});

describe('Quarterly reassessment reminders', () => {
  const NOW = new Date('2026-10-04T09:00:00Z');
  const purchase = (packageId: string): Purchase => ({ id: 'p', organisationId: 'o', userId: 'u', packageId, status: 'succeeded', amountCents: 1, currency: 'gbp', createdAt: '2026-09-01T00:00:00Z' } as Purchase);
  const submitted = (daysAgo: number): Assessment => ({ id: 'a', organisationId: 'o', createdByUserId: 'u', status: 'submitted', answers: {}, submittedAt: new Date(NOW.getTime() - daysAgo * DAY).toISOString(), createdAt: '', updatedAt: '' } as unknown as Assessment);

  it('works out the next due date from the latest submitted assessment', () => {
    expect(reassessmentStatus([purchase('pkg_basic')], [submitted(10)], NOW).status).toBe('not_applicable');
    expect(reassessmentStatus([purchase('pkg_training')], [], NOW).status).toBe('not_started');
    expect(reassessmentStatus([purchase('pkg_training')], [submitted(30)], NOW)).toMatchObject({ status: 'ok', daysUntilDue: 60 });
    expect(reassessmentStatus([purchase('pkg_full')], [submitted(80)], NOW)).toMatchObject({ status: 'due_soon', daysUntilDue: 10 });
    expect(reassessmentStatus([purchase('pkg_full')], [submitted(100)], NOW)).toMatchObject({ status: 'overdue', daysUntilDue: -10 });
    expect(REASSESSMENT_INTERVAL_DAYS).toBe(90);
  });

  it('tells the organisation when it is next due', async () => {
    const { accessToken } = await createPaidUser('pkg_training');
    expect((await json(await get('/assessments/reassessment', accessToken))).status).toBe('not_started');
  });

  describe('daily run', () => {
    const fetchMock = jest.fn<typeof fetch>();
    const realFetch = global.fetch;
    afterEach(() => { global.fetch = realFetch; fetchMock.mockReset(); });

    it('sends one reminder before the due date and one after it, to the audit trail and webhooks', async () => {
      const { accessToken, organisationId } = await createPaidUser();
      await send('POST', '/webhook-endpoints', accessToken, { url: 'https://hooks.example.com/reminders', events: ['reassessment.due'] });
      const created = await json(await send('POST', '/assessments', accessToken, { title: 'FRA', answers: {} }));
      await send('POST', `/assessments/${created.id}/submit`, accessToken);
      const stored = assessmentsById.get(created.id)!;
      stored.submittedAt = new Date(Date.now() - 80 * DAY).toISOString();

      fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
      global.fetch = fetchMock;
      const ours = () => fetchMock.mock.calls.filter(([url]) => url === 'https://hooks.example.com/reminders');

      await runReassessmentReminders();
      await runReassessmentReminders(); // the same reminder is not sent twice
      expect(ours()).toHaveLength(1);
      const first = JSON.parse(ours()[0][1]!.body as string);
      expect(first).toMatchObject({ type: 'reassessment.due', organisationId, data: { status: 'due_soon', daysUntilDue: 10 } });

      await runReassessmentReminders(new Date(Date.now() + 20 * DAY));
      expect(ours()).toHaveLength(2);
      expect(JSON.parse(ours()[1][1]!.body as string).data.status).toBe('overdue');

      const events = auditEvents.filter((e) => e.organisationId === organisationId && e.eventType.startsWith('reassessment.'));
      expect(events.map((e) => e.eventType)).toEqual(['reassessment.due_soon', 'reassessment.overdue']);
    });
  });
});
