/// <reference types="jest" />

import { describe, expect, it } from '@jest/globals';
import { app, authHeaders, createPaidUser } from './helpers';
import { auditEvents } from '../src/stores';
import { createZip } from '../src/zip';
import { readZip } from './zip-reader';

const API = 'http://localhost/api/v1';
const get = (path: string, token: string) => app.request(`${API}${path}`, { headers: authHeaders(token) });
const send = (method: string, path: string, token: string, body: unknown = {}) =>
  app.request(`${API}${path}`, { method, headers: authHeaders(token), body: JSON.stringify(body) });
const json = async (res: Response) => ((await res.json()) as any).data;

/** Reads a ZIP from its local file headers (enough for the archives createZip writes). */

describe('createZip', () => {
  it('round-trips names and contents, including non-ASCII', () => {
    const files = readZip(createZip([{ name: 'a/£.csv', data: 'x,y\n1,2' }, { name: 'b.txt', data: Buffer.from('hello') }]));
    expect(Object.fromEntries(files)).toEqual({ 'a/£.csv': 'x,y\n1,2', 'b.txt': 'hello' });
  });
});

describe('GET /compliance/evidence-pack', () => {
  it('holds a summary and one folder per ECCTA evidence item', async () => {
    const { accessToken, organisationId } = await createPaidUser('pkg_full', { organisationName: 'Acme <Trading> Ltd' });
    await send('POST', '/compliance/records', accessToken, { kind: 'board_minute', data: { meetingDate: '2026-09-20', body: 'board', itemsDiscussed: 'Fraud risk register review' } });
    await send('POST', '/compliance/records', accessToken, {
      kind: 'associated_person', data: { name: 'Acme Logistics Ltd', associateType: 'contractor', servicesProvided: 'Collects payments', riskLevel: 'medium', identityVerified: 'yes' },
    });
    const assessment = await json(await send('POST', '/assessments', accessToken, { title: 'FRA', answers: { 'procurement.recentFraud': 'secret-answer' } }));
    await send('POST', `/assessments/${assessment.id}/submit`, accessToken);

    const res = await get('/compliance/evidence-pack', accessToken);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="eccta-evidence-pack-acme-trading-ltd-\d{4}-\d{2}-\d{2}\.zip"$/);

    const files = readZip(Buffer.from(await res.arrayBuffer()));
    expect([...files.keys()]).toEqual([
      '00-summary.html',
      '1-policy-and-tone/policies.csv', '1-policy-and-tone/tone-from-the-top.csv',
      '2-risk-assessment/assessments.csv', '2-risk-assessment/risk-register.csv',
      '3-due-diligence/associated-persons.csv',
      '4-training/training.csv', '4-training/budget-holders.csv',
      '5-reporting-routes/reporting-routes.csv', '5-reporting-routes/speak-up-case-log.csv',
      '6-monitoring/compliance-scores.csv', '6-monitoring/detection-activity.csv', '6-monitoring/audit-trail.csv',
      '7-incidents/incidents.csv', '7-incidents/losses-and-recoveries.csv',
      '8-board-oversight/board-minutes.csv', '8-board-oversight/senior-management.csv',
    ]);

    const summary = files.get('00-summary.html')!;
    expect(summary).toContain('Acme &lt;Trading&gt; Ltd');
    expect(summary).not.toContain('Acme <Trading>');
    expect(summary).toContain('Reasonable procedures: the six principles');
    expect(summary).toContain('8-board-oversight/board-minutes.csv (1)');

    expect(files.get('8-board-oversight/board-minutes.csv')).toContain('Fraud risk register review');
    expect(files.get('3-due-diligence/associated-persons.csv')).toMatch(/Acme Logistics Ltd.*,1,4,/);
    expect(files.get('2-risk-assessment/assessments.csv')).toContain('submitted');
    expect([...files.values()].join('\n')).not.toContain('secret-answer');
    expect(files.get('6-monitoring/compliance-scores.csv')).toContain('ECCTA 2023,eccta-1,');

    const event = auditEvents.find((e) => e.organisationId === organisationId && e.eventType === 'compliance.evidence_pack_exported');
    expect(event?.details).toMatchObject({ files: 17, pdf: false });
  });

  it('keeps speak-up report text and reporter identity out of the case log', async () => {
    const { accessToken } = await createPaidUser();
    const intake = await json(await send('PUT', '/compliance/speak-up/intake', accessToken, { enabled: true }));
    await app.request(`${API}/speak-up/${intake.token}/reports`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'procurement', relationship: 'employee', anonymous: false, name: 'Jo Reporter', email: 'jo@example.test', description: 'A supplier is invoicing twice for the same deliveries.' }),
    });

    const files = readZip(Buffer.from(await (await get('/compliance/evidence-pack', accessToken)).arrayBuffer()));
    const log = files.get('5-reporting-routes/speak-up-case-log.csv')!;
    expect(log).toMatch(/SU-[A-Z2-9]{8},procurement,employee,false,new/);
    const all = [...files.values()].join('\n');
    expect(all).not.toContain('invoicing twice');
    expect(all).not.toContain('Jo Reporter');
    expect(all).not.toContain('jo@example.test');
  });

  it('is part of Enterprise only', async () => {
    const { accessToken } = await createPaidUser('pkg_training');
    expect((await get('/compliance/evidence-pack', accessToken)).status).toBe(403);
  });
});
