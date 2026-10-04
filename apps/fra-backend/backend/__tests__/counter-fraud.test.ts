/// <reference types="jest" />

import { describe, expect, it } from '@jest/globals';
import { app, authHeaders, createAuthenticatedUser, createPaidUser } from './helpers';

const API = 'http://localhost/api/v1';
const get = (path: string, token: string) => app.request(`${API}${path}`, { headers: authHeaders(token) });
const send = (method: string, path: string, token: string, body: unknown = {}) =>
  app.request(`${API}${path}`, { method, headers: authHeaders(token), body: JSON.stringify(body) });
const json = async (res: Response) => ((await res.json()) as any).data;

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const add = (token: string, kind: string, data: Record<string, unknown>) => send('POST', '/compliance/records', token, { kind, data });
const govs = async (token: string, id: string) =>
  (await json(await get('/compliance/report', token))).govs013.requirements.find((r: any) => r.id === id);

const STRATEGY = { title: 'Counter fraud strategy 2026–29', periodStart: day(-30), periodEnd: day(1000), status: 'approved', approvedAt: day(-30), approvedBy: 'Audit committee' };
const POLICY = { title: 'Gifts and hospitality policy', approvedAt: day(-10), reviewDue: day(355) };

describe('Counter-fraud records (GovS 013 components 2, 8, 9, 10, 12)', () => {
  it('needs the Enterprise package', async () => {
    const { accessToken } = await createAuthenticatedUser();
    expect((await get('/compliance/records', accessToken)).status).toBe(403);
  });

  it('adds the record-based components to the GovS 013 score, all unmet at first', async () => {
    const { accessToken } = await createPaidUser();
    const report = await json(await get('/compliance/report', accessToken));
    expect(report.govs013.requirements).toHaveLength(12);
    const status = Object.fromEntries(report.govs013.requirements.map((r: any) => [r.id, r.status]));
    expect(status).toMatchObject({ 'govs-7': 'not_met', 'govs-8': 'partial', 'govs-9': 'not_met', 'govs-10': 'not_met', 'govs-11': 'not_met', 'govs-12': 'not_met' });
  });

  it('meets the strategy component with an approved strategy for the current period', async () => {
    const { accessToken } = await createPaidUser();
    expect((await add(accessToken, 'strategy', { ...STRATEGY, status: 'draft', approvedAt: undefined })).status).toBe(201);
    expect((await govs(accessToken, 'govs-7')).status).toBe('partial');

    expect((await add(accessToken, 'strategy', STRATEGY)).status).toBe(201);
    expect(await govs(accessToken, 'govs-7')).toMatchObject({ status: 'met', evidence: expect.stringContaining('Counter fraud strategy 2026–29') });
  });

  it('tracks losses and recoveries, and flags losses not reported after 30 days', async () => {
    const { accessToken } = await createPaidUser();
    const loss = await json(await add(accessToken, 'loss', {
      category: 'fraud', lossType: 'detected', description: 'Duplicate supplier invoice', identifiedAt: day(-60), amountGbp: 12500, recoveredGbp: 4000,
    }));
    let report = await json(await get('/compliance/report', accessToken));
    expect(report.metrics).toMatchObject({ lossIdentifiedGbp: 12500, lossRecoveredGbp: 4000, lossesNotReported: 1 });
    expect(report.govs013.requirements.find((r: any) => r.id === 'govs-8')).toMatchObject({ status: 'partial', evidence: expect.stringContaining('£12,500 identified') });

    await send('PATCH', `/compliance/records/${loss.id}`, accessToken, { data: { reportedToCentreAt: day(-5) } });
    report = await json(await get('/compliance/report', accessToken));
    expect(report.metrics.lossesNotReported).toBe(0);
    expect(report.govs013.requirements.find((r: any) => r.id === 'govs-8').status).toBe('met');
  });

  it('meets investigator access only while an agreement is in force', async () => {
    const { accessToken } = await createPaidUser();
    const base = { name: 'Jo Patel', provider: 'Regional counter fraud service', accreditation: 'Accredited Counter Fraud Specialist', arrangement: 'contracted' };
    await add(accessToken, 'investigator', { ...base, agreementEndsAt: day(-1) });
    expect((await govs(accessToken, 'govs-9')).status).toBe('partial');
    await add(accessToken, 'investigator', { ...base, agreementEndsAt: day(200) });
    expect((await govs(accessToken, 'govs-9')).status).toBe('met');
  });

  it('meets detection activity once an exercise is completed in the last year', async () => {
    const { accessToken } = await createPaidUser();
    const planned = await json(await add(accessToken, 'detection', { title: 'Payroll data match', method: 'data_matching', plannedFor: day(30), status: 'planned' }));
    expect((await govs(accessToken, 'govs-10')).status).toBe('partial');

    // Completing needs a completion date
    expect((await send('PATCH', `/compliance/records/${planned.id}`, accessToken, { data: { status: 'completed' } })).status).toBe(400);
    await send('PATCH', `/compliance/records/${planned.id}`, accessToken, { data: { status: 'completed', completedAt: day(0), issuesFound: 2 } });
    expect((await govs(accessToken, 'govs-10')).status).toBe('met');
  });

  it('meets gifts, hospitality and conflicts of interest with both policies and a register in use', async () => {
    const { accessToken } = await createPaidUser();
    await add(accessToken, 'policy', { ...POLICY, policyType: 'gifts_hospitality' });
    expect((await govs(accessToken, 'govs-11')).status).toBe('partial');

    await add(accessToken, 'policy', { ...POLICY, title: 'Conflicts of interest policy', policyType: 'conflicts_of_interest' });
    await add(accessToken, 'gift_hospitality', {
      personName: 'Sam Lee', direction: 'received', counterparty: 'Acme Supplies', description: 'Conference dinner', valueGbp: 85, date: day(-3), decision: 'declined',
    });
    expect((await govs(accessToken, 'govs-11')).status).toBe('met');
  });

  it('validates each kind', async () => {
    const { accessToken } = await createPaidUser();
    const bad = [
      ['nonsense', {}],
      ['strategy', { ...STRATEGY, approvedAt: undefined }], // approved without a date
      ['strategy', { ...STRATEGY, periodEnd: day(-100) }], // ends before it starts
      ['strategy', { ...STRATEGY, documentUrl: 'http://example.com/strategy.pdf' }], // not https
      ['loss', { category: 'fraud', lossType: 'detected', description: 'x', identifiedAt: day(0), amountGbp: 10, recoveredGbp: 20 }],
      ['policy', { ...POLICY, policyType: 'gifts_hospitality', ownerSalary: 1 }], // unknown field
      ['conflict_of_interest', { personName: 'A', interestType: 'secret', description: 'x', declaredAt: day(0), status: 'active' }],
    ] as const;
    for (const [kind, data] of bad) {
      expect((await add(accessToken, kind, data)).status).toBe(400);
    }
  });

  it('only links losses to the organisation\'s own incidents', async () => {
    const owner = await createPaidUser();
    const other = await createPaidUser();
    const incident = await json(await send('POST', '/compliance/incidents', other.accessToken, { type: 'fraud_incident', severity: 'high', description: 'Theirs' }));
    const res = await add(owner.accessToken, 'loss', {
      category: 'fraud', lossType: 'detected', description: 'x', identifiedAt: day(0), amountGbp: 10, incidentId: incident.id,
    });
    expect(res.status).toBe(400);
  });

  it('keeps each organisation\'s records to itself', async () => {
    const owner = await createPaidUser();
    const other = await createPaidUser();
    const record = await json(await add(owner.accessToken, 'strategy', STRATEGY));

    expect(await json(await get('/compliance/records', other.accessToken))).toEqual([]);
    expect((await send('PATCH', `/compliance/records/${record.id}`, other.accessToken, { data: { title: 'Changed' } })).status).toBe(404);
    expect((await send('DELETE', `/compliance/records/${record.id}`, other.accessToken)).status).toBe(404);

    expect((await send('DELETE', `/compliance/records/${record.id}`, owner.accessToken)).status).toBe(200);
    expect(await json(await get('/compliance/records?kind=strategy', owner.accessToken))).toEqual([]);
  });

  it('downloads a register as CSV and includes the records in the full export', async () => {
    const { accessToken } = await createPaidUser();
    await add(accessToken, 'conflict_of_interest', {
      personName: 'Sam Lee', interestType: 'financial', description: 'Shareholding in Acme Supplies', declaredAt: day(-2), status: 'active',
    });

    expect((await get('/compliance/records?format=csv', accessToken)).status).toBe(400);
    const csv = await (await get('/compliance/records?kind=conflict_of_interest&format=csv', accessToken)).text();
    expect(csv).toContain('personName');
    expect(csv).toContain('Shareholding in Acme Supplies');

    const exported = await json(await get('/compliance/export', accessToken));
    expect(exported.conflict_of_interest).toHaveLength(1);
    expect(exported.strategy).toEqual([]);
  });
});
