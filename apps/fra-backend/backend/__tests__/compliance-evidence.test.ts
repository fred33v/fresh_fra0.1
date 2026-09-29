/// <reference types="jest" />

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { app, authHeaders, createAuthenticatedUser, createPaidUser } from './helpers';
import { scoreAnswers, webScoreToRegister } from '../src/assessment-risk';
import { buildAssessmentResults } from '../src/assessment-modules';

const API = 'http://localhost/api/v1';
const get = (path: string, token: string) => app.request(`${API}${path}`, { headers: authHeaders(token) });
const send = (method: string, path: string, token: string, body: unknown = {}) =>
  app.request(`${API}${path}`, { method, headers: authHeaders(token), body: JSON.stringify(body) });
const json = async (res: Response) => ((await res.json()) as any).data;

const WEAK_ANSWERS = {
  fraudTriangle: { controlStrength: 'some-gaps' },
  procurement: { q1: 'never' },
  itSystems: { q1: 'rarely' },
  controlsTechnology: { segregation: 'well-separated' },
};

async function submitAssessment(token: string, answers: Record<string, unknown> = WEAK_ANSWERS) {
  const created = await json(await send('POST', '/assessments', token, { title: 'FRA', answers }));
  await send('POST', `/assessments/${created.id}/submit`, token);
  return created.id as string;
}

const requirement = (report: any, framework: 'eccta2023' | 'govs013', id: string) =>
  report[framework].requirements.find((r: any) => r.id === id);

describe('Assessment risk scoring (server port of the mobile scoring)', () => {
  it('flags risks from weak controls using impact × likelihood', () => {
    const result = scoreAnswers(WEAK_ANSWERS);
    expect(result.level).toBe('high');
    expect(result.risks.map((r) => [r.title, r.residualScore, r.priority])).toEqual([
      ['Supplier fraud', 16, 'high'],
      ['Cyber fraud', 20, 'high'],
    ]);
  });

  it('applies the control reduction', () => {
    const result = scoreAnswers({ ...WEAK_ANSWERS, fraudTriangle: { controlStrength: 'very-strong' } });
    expect(result.risks.map((r) => r.residualScore)).toEqual([10, 12]);
    expect(result.level).toBe('medium');
  });

  it('reports a general low risk when nothing is flagged', () => {
    const result = scoreAnswers({ procurement: { q1: 'always' } });
    expect(result.risks).toHaveLength(1);
    expect(result.level).toBe('low');
  });

  it('does not score free-form answers', () => {
    expect(scoreAnswers({ q1: 'yes', q2: 'no' }).level).toBeNull();
  });
});

// Web dashboard format: flat `<module>.<field>` question ids
const WEB_WEAK_ANSWERS = {
  'procurement.dueDiligenceLevel': 1,
  'procurement.monthlySpend': 250000,
  'procurement.recentFraud': 'yes',
  'procurement.controlMaturity': 1,
  'itSystems.cybersecurityMaturity': 4,
  'itSystems.securityIncidentsCount': 0,
  'itSystems.mfaAdoption': 5,
};

describe('Web-format assessments score on the same register scale', () => {
  it('places each web band inside the matching register band', () => {
    expect(webScoreToRegister(0)).toBe(1);
    expect(webScoreToRegister(44)).toBe(7);
    expect(webScoreToRegister(45)).toBe(8);
    expect(webScoreToRegister(69)).toBe(14);
    expect(webScoreToRegister(70)).toBe(15);
    expect(webScoreToRegister(100)).toBe(25);
  });

  it('flags the same areas, with the same names, as the respondent\'s results page', () => {
    const risk = scoreAnswers(WEB_WEAK_ANSWERS);
    const results = buildAssessmentResults('a1', WEB_WEAK_ANSWERS);
    const procurement = results.modules.find((m) => m.id === 'procurement')!;

    expect(risk.format).toBe('web');
    expect(procurement.level).toBe('High');
    expect(risk.risks.map((r) => r.title)).toEqual(['Supplier fraud']); // IT answered strongly, so not flagged
    expect(risk.risks[0]).toMatchObject({ area: 'Procurement', priority: 'high', suggestedOwner: 'Head of Procurement' });
    expect(risk.risks[0].residualScore).toBe(webScoreToRegister(procurement.score));
    expect(risk.level).toBe('high');
  });

  it('reports a general low risk when no answered area is flagged', () => {
    const risk = scoreAnswers({ 'procurement.dueDiligenceLevel': 5, 'procurement.controlMaturity': 5, 'procurement.recentFraud': 'no' });
    expect(risk.level).toBe('low');
    expect(risk.risks.map((r) => r.title)).toEqual(['General fraud risk']);
  });

  it('shows web respondents on the employer dashboard alongside mobile respondents', async () => {
    const { accessToken, userId } = await createPaidUser();
    await submitAssessment(accessToken, WEB_WEAK_ANSWERS);
    const employees = ((await (await get('/analytics/employees', accessToken)).json()) as any).data;
    expect(employees.find((e: any) => e.userId === userId)).toMatchObject({ riskLevel: 'high', topRisk: 'Supplier fraud' });

    const areas = (await json(await get('/compliance/risk-assessment', accessToken))).topRisks.map((a: any) => a.area);
    expect(areas).toContain('Procurement');
  });
});

describe('Compliance report reflects real evidence', () => {
  it('starts with nothing met and improves as evidence is recorded', async () => {
    const { accessToken, userId } = await createPaidUser();

    const empty = await json(await get('/compliance/report', accessToken));
    expect(empty.eccta2023.requirements).toHaveLength(6);
    expect(requirement(empty, 'eccta2023', 'eccta-1').status).toBe('not_met');
    expect(requirement(empty, 'eccta2023', 'eccta-2').status).toBe('not_met');
    expect(requirement(empty, 'eccta2023', 'eccta-3').status).toBe('not_met');
    const startScore = empty.eccta2023.score;

    await submitAssessment(accessToken);
    await send('POST', '/compliance/senior-management', accessToken, {
      userId, role: 'CEO', lastReviewed: new Date().toISOString().slice(0, 10),
    });
    await send('POST', '/risk-register', accessToken, {
      title: 'Supplier invoice fraud', riskArea: 'procurement', impact: 4, likelihood: 4,
      controlEffectiveness: 'some_gaps', controls: 'Two-person supplier approval', ownerUserId: userId, actionPlan: 'Bank detail call-backs',
    });

    const after = await json(await get('/compliance/report', accessToken));
    expect(requirement(after, 'eccta2023', 'eccta-1').status).toBe('met');
    expect(requirement(after, 'eccta2023', 'eccta-2').status).toBe('met');
    expect(requirement(after, 'eccta2023', 'eccta-3').status).toBe('met');
    expect(requirement(after, 'eccta2023', 'eccta-4').status).toBe('partial'); // supplier risk flagged, controls recorded
    expect(after.eccta2023.score).toBeGreaterThan(startScore);
    expect(after.metrics).toMatchObject({ employees: 1, employeesAssessed: 1, assessmentCoverage: 100, registerRisks: 1 });
    expect(after.metrics.riskLevels.high).toBe(1);
    expect(after.disclaimer).toMatch(/not replace/);
  });

  it('marks high risks without an owner as a gap', async () => {
    const { accessToken } = await createPaidUser();
    await send('POST', '/risk-register', accessToken, { title: 'Cash theft', riskArea: 'cash_banking', impact: 5, likelihood: 4, controlEffectiveness: 'none' });
    const report = await json(await get('/compliance/report', accessToken));
    expect(requirement(report, 'eccta2023', 'eccta-3')).toMatchObject({ status: 'partial' });
    expect(report.metrics.highRisksWithoutOwnerOrPlan).toBe(1);
  });
});

describe('Risk assessment roll-up and gap analysis', () => {
  it('groups assessed risks by area and employee', async () => {
    const { accessToken } = await createPaidUser();
    await submitAssessment(accessToken);
    const data = await json(await get('/compliance/risk-assessment', accessToken));
    expect(data.totalAssessments).toBe(1);
    expect(data.topRisks.map((r: any) => r.area)).toEqual(expect.arrayContaining(['Procurement', 'IT Systems']));
    expect(data.employees[0].level).toBe('high');
    expect(data.averageRiskScore).toBe(18);
  });

  it('lists assessed risk areas that have no controls in the register', async () => {
    const { accessToken } = await createPaidUser();
    await submitAssessment(accessToken);
    const data = await json(await get('/compliance/gap-analysis', accessToken));
    const areaGaps = data.gaps.filter((g: any) => g.framework === 'Risk controls').map((g: any) => g.requirement);
    expect(areaGaps).toEqual(expect.arrayContaining(['Procurement', 'IT Systems']));
    expect(data.totalGaps).toBe(data.gaps.length);
    expect(data.criticalGaps).toBeGreaterThan(0);
  });
});

describe('Incidents', () => {
  it('records, lists and resolves incidents', async () => {
    const { accessToken } = await createPaidUser();
    const incident = await json(await send('POST', '/compliance/incidents', accessToken, {
      type: 'fraud_incident', severity: 'high', description: 'Duplicate supplier invoice paid',
    }));
    let listRes = (await (await get('/compliance/incidents', accessToken)).json()) as any;
    expect(listRes.summary).toEqual({ total: 1, open: 1, openSerious: 1 });

    const resolved = await json(await send('PATCH', `/compliance/incidents/${incident.id}`, accessToken, { resolved: true, resolutionNotes: 'Recovered' }));
    expect(resolved.resolvedAt).toBeTruthy();
    listRes = (await (await get('/compliance/incidents', accessToken)).json()) as any;
    expect(listRes.summary.open).toBe(0);
  });

  it('validates incident input', async () => {
    const { accessToken } = await createPaidUser();
    expect((await send('POST', '/compliance/incidents', accessToken, { type: 'theft', severity: 'high', description: 'x' })).status).toBe(400);
  });
});

describe('Senior management accountability', () => {
  it('only accepts members of the organisation', async () => {
    const { accessToken } = await createPaidUser();
    const outsider = await createAuthenticatedUser();
    const res = await send('POST', '/compliance/senior-management', accessToken, { userId: outsider.userId, role: 'CFO' });
    expect(res.status).toBe(400);
  });

  it('updates the review date and removes records', async () => {
    const { accessToken, userId } = await createPaidUser();
    const record = await json(await send('POST', '/compliance/senior-management', accessToken, { userId, role: 'CFO' }));
    const updated = await json(await send('PATCH', `/compliance/senior-management/${record.id}`, accessToken, { lastReviewed: '2026-09-01' }));
    expect(updated.lastReviewed).toContain('2026-09-01');
    expect((await send('DELETE', `/compliance/senior-management/${record.id}`, accessToken)).status).toBe(200);
    expect((await (await get('/compliance/senior-management', accessToken)).json() as any).summary.total).toBe(0);
  });
});

describe('Audit trail', () => {
  it('records platform actions for the organisation and exports CSV', async () => {
    const { accessToken } = await createPaidUser();
    await send('POST', '/risk-register', accessToken, { title: 'x', riskArea: 'other', impact: 1, likelihood: 1, controlEffectiveness: 'none' });
    const res = (await (await get('/compliance/audit-trail?pageSize=10', accessToken)).json()) as any;
    expect(res.data.map((e: any) => e.eventType)).toContain('risk_register.created');
    expect(res.pagination.total).toBeGreaterThan(0);

    const csv = await get('/compliance/audit-trail?format=csv', accessToken);
    expect(csv.headers.get('content-type')).toContain('text/csv');
    expect(await csv.text()).toContain('risk_register.created');
  });

  it('never shows another organisation\'s events', async () => {
    const a = await createPaidUser();
    const b = await createPaidUser();
    await send('POST', '/risk-register', a.accessToken, { title: 'secret', riskArea: 'other', impact: 1, likelihood: 1, controlEffectiveness: 'none' });
    const res = (await (await get('/compliance/audit-trail', b.accessToken)).json()) as any;
    expect(res.data.every((e: any) => e.organisationId === b.organisationId)).toBe(true);
  });
});

describe('High-risk alerts', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('sends assessment.high_risk when a submitted assessment scores high', async () => {
    const { accessToken, organisationId } = await createPaidUser();
    await send('POST', '/webhook-endpoints', accessToken, { url: 'https://siem.example.com/hook', events: ['assessment.high_risk'] });
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 200 }));
    global.fetch = fetchMock;

    await submitAssessment(accessToken);
    await new Promise((r) => setTimeout(r, 20)); // delivery is fire-and-forget
    const bodies = fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));
    const alert = bodies.find((b) => b.type === 'assessment.high_risk');
    expect(alert).toBeDefined();
    expect(alert.organisationId).toBe(organisationId);
    expect(alert.data.highRisks.map((r: any) => r.title)).toEqual(['Supplier fraud', 'Cyber fraud']);
  });
});
