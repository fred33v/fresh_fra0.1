import { fileURLToPath } from 'node:url';
/// <reference types="jest" />

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { app, authHeaders, createAuthenticatedUser, createPaidUser } from './helpers';
import { BUDGET_HOLDER_PART_IDS, PARTS_BEFORE_COMMITMENT, SCENARIO_ANSWER_KEY, scoreScenarios } from '../src/budget-holder-rules';
import { getMember, saveMember } from '../src/budget-holder-store';
import { readZip } from './zip-reader';

const API = 'http://localhost/api/v1';
const call = (method: string, path: string, token: string | null, body?: unknown) => app.request(`${API}${path}`, {
  method, headers: token ? authHeaders(token) : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
});
const json = async (res: Response) => ((await res.json()) as any).data;

// The content lives in packages/shared, which the backend does not depend on, so it is read as text
const SHARED = readFileSync(fileURLToPath(new URL('../../../../packages/shared/src/data/budgetHolder.ts', import.meta.url)), 'utf8');
const between = (start: string) => {
  const s = SHARED.slice(SHARED.indexOf(start));
  return s.slice(0, s.indexOf('\n];'));
};

async function employerWithStaff(packageId = 'pkg_full') {
  const boss = await createPaidUser(packageId);
  const email = `bh-${crypto.randomUUID()}@example.com`;
  const { invited } = await json(await call('POST', '/keypasses/invite', boss.accessToken, { emails: [email] }));
  const joined = await json(await call('POST', '/keypasses/use', null, { code: invited[0].code, email, password: 'Employee-Pass-2026', name: 'Bea Budget' }));
  return { boss, staff: { accessToken: joined.accessToken as string, userId: joined.user.userId as string, email } };
}

const rightAnswers = () => ({ ...SCENARIO_ANSWER_KEY });

async function readAllParts(token: string) {
  for (const partId of PARTS_BEFORE_COMMITMENT.filter((p) => p !== 'scenarios')) {
    expect((await call('POST', '/budget-holder/me/parts', token, { partId })).status).toBe(200);
  }
}

describe('budget holder rules match the shared content', () => {
  it('has the same parts, in the same order', () => {
    const ids = [...between('export const budgetHolderParts').matchAll(/^ {4}id: '([^']+)'/gm)].map((m) => m[1]);
    expect(ids).toEqual([...BUDGET_HOLDER_PART_IDS]);
  });

  it('has the same scenario answers', () => {
    const block = between('export const budgetHolderScenarios');
    const key = Object.fromEntries([...block.matchAll(/^ {4}id: '([^']+)',[\s\S]*?^ {4}correct: (\d+),/gm)].map((m) => [m[1], Number(m[2])]));
    expect(key).toEqual(SCENARIO_ANSWER_KEY);
  });

  it('needs 80% and every scenario answered', () => {
    expect(scoreScenarios(rightAnswers()).passed).toBe(true);
    const oneWrong = { ...rightAnswers(), 'fake-supplier': 0 };
    expect(scoreScenarios(oneWrong)).toMatchObject({ score: 86, passed: true });
    const twoWrong = { ...oneWrong, 'ghost-employees': 0 };
    expect(scoreScenarios(twoWrong)).toMatchObject({ score: 71, passed: false });
    const { 'deepfake-executive': _skip, ...partial } = rightAnswers();
    expect(scoreScenarios(partial)).toMatchObject({ passed: false, missing: ['deepfake-executive'] });
  });
});

describe('a budget holder works through the programme', () => {
  it('reads the parts, passes the scenarios, declares a conflict and signs', async () => {
    const { boss, staff } = await employerWithStaff();

    let me = await json(await call('GET', '/budget-holder/me', staff.accessToken));
    expect(me).toMatchObject({ required: false, status: 'not_started', completedParts: [], settings: { approvalLimits: null, contacts: {} } });

    // Signing before reading is refused
    const early = await call('POST', '/budget-holder/me/commitment', staff.accessToken, { name: 'Bea Budget', conflictDeclared: false });
    expect(early.status).toBe(409);

    await readAllParts(staff.accessToken);
    expect((await call('POST', '/budget-holder/me/parts', staff.accessToken, { partId: 'scenarios' })).status).toBe(400);
    expect((await call('POST', '/budget-holder/me/parts', staff.accessToken, { partId: 'nope' })).status).toBe(400);

    // A failed attempt is kept but does not complete the part
    const failed = await json(await call('POST', '/budget-holder/me/scenarios', staff.accessToken, {
      answers: { ...rightAnswers(), 'fake-supplier': 0, 'ghost-employees': 2 },
    }));
    expect(failed.attempt).toMatchObject({ score: 71, passed: false });
    expect(failed.completedParts).not.toContain('scenarios');
    expect((await call('POST', '/budget-holder/me/commitment', staff.accessToken, { name: 'Bea Budget', conflictDeclared: false })).status).toBe(409);

    const passed = await json(await call('POST', '/budget-holder/me/scenarios', staff.accessToken, { answers: rightAnswers() }));
    expect(passed).toMatchObject({ scenarioScore: 100, scenarioPassed: true, status: 'in_progress' });

    // A declared conflict needs details
    expect((await call('POST', '/budget-holder/me/commitment', staff.accessToken, { name: 'Bea Budget', conflictDeclared: true })).status).toBe(400);
    const done = await json(await call('POST', '/budget-holder/me/commitment', staff.accessToken, {
      name: 'Bea Budget', conflictDeclared: true, conflictDetails: 'My brother owns Acme Cleaning, one of our suppliers.',
    }));
    expect(done).toMatchObject({ status: 'completed', pledgeName: 'Bea Budget', conflictDeclared: true });
    expect(done.completedParts).toContain('commitment');
    expect(Date.parse(done.renewalDueAt) - Date.parse(done.completedAt)).toBeGreaterThan(360 * 86_400_000);
    expect((await call('POST', '/budget-holder/me/commitment', staff.accessToken, { name: 'Bea Budget', conflictDeclared: false })).status).toBe(409);

    // The employer sees it, including the declaration, and can export it
    const team = await json(await call('GET', '/budget-holder/team', boss.accessToken));
    const bea = team.people.find((p: any) => p.userId === staff.userId);
    expect(bea).toMatchObject({ status: 'completed', scenarioScore: 100, conflictDeclared: true, conflictDetails: expect.stringContaining('Acme') });
    expect(team.summary.conflictsDeclared).toBe(1);
    const csv = await (await call('GET', '/budget-holder/team?format=csv', boss.accessToken)).text();
    expect(csv.split('\n')[0]).toContain('conflictDetails');
    expect(csv).toContain('Acme Cleaning');
  });

  it('is renewed after a year', async () => {
    const { staff } = await employerWithStaff();
    expect((await call('POST', '/budget-holder/me/renew', staff.accessToken)).status).toBe(409);

    await call('POST', '/budget-holder/me/parts', staff.accessToken, { partId: 'legal' });
    const m = await getMember(staff.userId);
    const lastYear = new Date(Date.now() - 366 * 86_400_000).toISOString();
    await saveMember({ ...m!, completedParts: [...BUDGET_HOLDER_PART_IDS], scenarioScore: 100, completedAt: lastYear, pledgedAt: lastYear, pledgeName: 'Bea' });

    expect((await json(await call('GET', '/budget-holder/me', staff.accessToken))).status).toBe('renewal_due');
    const renewed = await json(await call('POST', '/budget-holder/me/renew', staff.accessToken));
    expect(renewed).toMatchObject({ status: 'not_started', completedParts: [], scenarioScore: null, completedAt: null, previousCompletedAt: lastYear });
  });
});

describe('the employer runs the programme', () => {
  it('says who must do it', async () => {
    const { boss, staff } = await employerWithStaff();
    const res = await call('PUT', `/budget-holder/team/${staff.userId}`, boss.accessToken, { required: true });
    expect(res.status).toBe(200);
    expect((await json(await call('GET', '/budget-holder/me', staff.accessToken))).required).toBe(true);
    const team = await json(await call('GET', '/budget-holder/team', boss.accessToken));
    expect(team.summary).toMatchObject({ required: 1, completed: 0 });
    expect(team.people[0]).toMatchObject({ userId: staff.userId, required: true });

    // Shown next to the training in the Team training tab, and kept in the evidence pack
    const training = await json(await call('GET', '/team/training', boss.accessToken));
    expect(training.people[0].budgetHolder).toEqual({ required: true, status: 'not_started' });
    const pack = await call('GET', '/compliance/evidence-pack', boss.accessToken);
    expect(pack.status).toBe(200);
    const csv = readZip(Buffer.from(await pack.arrayBuffer())).get('4-training/budget-holders.csv');
    expect(csv).toContain(`Bea Budget,${staff.email},true,not_started`);

    // Someone from another organisation cannot be flagged
    const other = await createPaidUser('pkg_full');
    expect((await call('PUT', `/budget-holder/team/${other.userId}`, boss.accessToken, { required: true })).status).toBe(404);
  });

  it('sets its own approval limits and report contacts, which staff see', async () => {
    const { boss, staff } = await employerWithStaff();
    const limits = { bands: ['Up to £500', 'Over £500'], rows: [{ type: 'Purchases', approvers: ['Manager', 'Director'] }] };
    const bad = await call('PUT', '/budget-holder/settings', boss.accessToken, { approvalLimits: { bands: ['A', 'B'], rows: [{ type: 'X', approvers: ['only one'] }] }, contacts: {} });
    expect(bad.status).toBe(400);
    const res = await call('PUT', '/budget-holder/settings', boss.accessToken, {
      approvalLimits: limits, contacts: { fraudRiskOwner: { name: 'Fran Owner', contact: 'fran@example.com' }, internalAudit: { name: '', contact: '' } },
    });
    expect(res.status).toBe(200);
    const me = await json(await call('GET', '/budget-holder/me', staff.accessToken));
    expect(me.settings).toEqual({ approvalLimits: limits, contacts: { fraudRiskOwner: { name: 'Fran Owner', contact: 'fran@example.com' } } });
    expect((await call('PUT', '/budget-holder/settings', staff.accessToken, { approvalLimits: null, contacts: {} })).status).toBe(403);
  });

  it('is Enterprise only, and the team view is for the employer', async () => {
    const { staff } = await employerWithStaff();
    expect((await call('GET', '/budget-holder/team', staff.accessToken)).status).toBe(403);
    const pro = await createPaidUser('pkg_training');
    expect((await call('GET', '/budget-holder/me', pro.accessToken)).status).toBe(403);
    // Professional employers see no budget holder column
    const proTeam = await json(await call('GET', '/team/training', pro.accessToken));
    expect(proTeam.people.every((p: any) => p.budgetHolder === null)).toBe(true);
    const none = await createAuthenticatedUser();
    expect((await call('GET', '/budget-holder/me', none.accessToken)).status).toBe(403);
    expect((await call('GET', '/budget-holder/me', null)).status).toBe(401);
  });
});
