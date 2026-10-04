/// <reference types="jest" />

import { describe, expect, it } from '@jest/globals';
import { app, authHeaders, createPaidUser } from './helpers';

const API = 'http://localhost/api/v1';
const get = (path: string, token: string) => app.request(`${API}${path}`, { headers: authHeaders(token) });
const send = (method: string, path: string, token: string, body: unknown = {}) =>
  app.request(`${API}${path}`, { method, headers: authHeaders(token), body: JSON.stringify(body) });
const json = async (res: Response) => ((await res.json()) as any).data;

describe('Workshop without a database', () => {
  it('saves progress, issues a certificate on completion, and counts it as training evidence', async () => {
    const { accessToken } = await createPaidUser('pkg_full');

    expect(await json(await get('/workshop/progress', accessToken))).toBeNull();
    const started = await json(await send('POST', '/workshop/progress', accessToken));
    // Starting again returns the same record rather than a second one
    expect((await json(await send('POST', '/workshop/progress', accessToken))).id).toBe(started.id);

    const moved = await json(await send('PATCH', `/workshop/progress/${started.id}`, accessToken, {
      currentSection: 3, completedSections: [0, 1, 2], quizScores: { q1: 1 },
    }));
    expect(moved).toMatchObject({ current_section: 3, completed_sections: [0, 1, 2], quiz_scores: { q1: 1 } });
    expect((await json(await get('/workshop/progress', accessToken))).current_section).toBe(3);

    expect((await send('POST', '/workshop/certificates', accessToken)).status).toBe(400);
    await send('PATCH', `/workshop/progress/${started.id}`, accessToken, { completedAt: new Date().toISOString() });

    const cert = await send('POST', '/workshop/certificates', accessToken);
    expect(cert.status).toBe(201);
    const issued = (await cert.json() as any).data;
    expect(issued.certificate_number).toMatch(/^FRA-[0-9A-Z]+-[0-9A-F]{6}$/);
    // Asking again returns the same certificate
    expect((await json(await send('POST', '/workshop/certificates', accessToken))).id).toBe(issued.id);
    expect((await json(await get('/workshop/certificates', accessToken))).id).toBe(issued.id);

    const report = await json(await get('/compliance/report', accessToken));
    expect(report.metrics).toMatchObject({ trainingCompleted: 1, trainingCoverage: 100 });
    const eccta5 = report.eccta2023.requirements.find((r: any) => r.id === 'eccta-5');
    expect(eccta5.status).not.toBe('not_met');
  });

  it('keeps one action plan per user, editable only by its owner', async () => {
    const owner = await createPaidUser('pkg_training');
    const other = await createPaidUser('pkg_training');

    const plan = await json(await send('POST', '/workshop/action-plans', owner.accessToken, {
      actionItems: [{ text: 'Review supplier bank changes', done: false }], commitments: ['Brief the board'],
    }));
    const updated = await json(await send('PATCH', `/workshop/action-plans/${plan.id}`, owner.accessToken, {
      actionItems: [{ text: 'Review supplier bank changes', done: true }],
    }));
    expect(updated.action_items[0].done).toBe(true);
    expect((await json(await get('/workshop/action-plans', owner.accessToken))).id).toBe(plan.id);

    expect(await json(await get('/workshop/action-plans', other.accessToken))).toBeNull();
    expect((await send('PATCH', `/workshop/action-plans/${plan.id}`, other.accessToken, { commitments: [] })).status).toBe(403);
  });

  it('runs a live session: join by code, polls, and questions with upvotes', async () => {
    const facilitator = await createPaidUser('pkg_full');
    const attendee = await createPaidUser('pkg_training');
    const outsider = await createPaidUser('pkg_training');

    const session = await json(await send('POST', '/workshop/sessions', facilitator.accessToken, { title: 'Board briefing' }));
    const found = await json(await get(`/workshop/sessions/code/${session.session_code}`, attendee.accessToken));
    expect(found).toEqual({ id: session.id, title: 'Board briefing', is_active: true, created_at: session.created_at });

    expect((await get(`/workshop/sessions/${session.id}`, attendee.accessToken)).status).toBe(403);
    expect(await json(await send('POST', `/workshop/sessions/${session.id}/join`, attendee.accessToken))).toEqual({ participantCount: 1 });
    expect((await get(`/workshop/sessions/${session.id}`, attendee.accessToken)).status).toBe(200);

    const slide = await json(await send('PATCH', `/workshop/sessions/${session.id}`, facilitator.accessToken, { currentSlide: 2 }));
    expect(slide.current_slide).toBe(2);
    expect((await send('PATCH', `/workshop/sessions/${session.id}`, attendee.accessToken, { currentSlide: 5 })).status).toBe(403);

    const poll = await json(await send('POST', `/workshop/sessions/${session.id}/polls`, facilitator.accessToken, {
      question: 'Biggest fraud risk?', options: ['Payroll', 'Procurement'],
    }));
    expect((await json(await get(`/workshop/sessions/${session.id}/polls/active`, attendee.accessToken))).id).toBe(poll.id);
    expect((await send('POST', `/workshop/polls/${poll.id}/respond`, attendee.accessToken, { selectedOption: 1 })).status).toBe(200);
    expect((await send('POST', `/workshop/polls/${poll.id}/respond`, attendee.accessToken, { selectedOption: 5 })).status).toBe(400);
    expect((await send('POST', `/workshop/polls/${poll.id}/respond`, outsider.accessToken, { selectedOption: 0 })).status).toBe(403);
    await send('PATCH', `/workshop/polls/${poll.id}`, facilitator.accessToken, { isActive: false });
    expect((await send('POST', `/workshop/polls/${poll.id}/respond`, attendee.accessToken, { selectedOption: 0 })).status).toBe(400);

    const question = await json(await send('POST', `/workshop/sessions/${session.id}/questions`, attendee.accessToken, { questionText: 'Who signs off refunds?' }));
    expect((await json(await send('POST', `/workshop/questions/${question.id}/upvote`, facilitator.accessToken))).upvotes).toBe(1);
    expect((await json(await send('POST', `/workshop/questions/${question.id}/upvote`, facilitator.accessToken))).upvotes).toBe(0);
    expect((await get(`/workshop/sessions/${session.id}/questions`, outsider.accessToken)).status).toBe(403);
    const answered = await json(await send('PATCH', `/workshop/questions/${question.id}`, facilitator.accessToken, { isAnswered: true }));
    expect(answered.is_answered).toBe(true);

    expect((await json(await get(`/workshop/sessions/${session.id}/participants`, facilitator.accessToken))).count).toBe(1);
    const ended = await json(await send('POST', `/workshop/sessions/${session.id}/end`, facilitator.accessToken));
    expect(ended).toMatchObject({ is_active: false, ended_at: expect.any(String) });
    expect((await send('POST', `/workshop/sessions/${session.id}/join`, outsider.accessToken)).status).toBe(400);
    expect((await json(await get('/workshop/sessions?isActive=false', facilitator.accessToken))).map((sn: any) => sn.id)).toEqual([session.id]);
  });

  it('keeps each person’s progress and profile to themselves', async () => {
    const a = await createPaidUser('pkg_training');
    const b = await createPaidUser('pkg_training');
    const progress = await json(await send('POST', '/workshop/progress', a.accessToken));
    expect((await send('PATCH', `/workshop/progress/${progress.id}`, b.accessToken, { currentSection: 6 })).status).toBe(403);
    expect(await json(await get('/workshop/progress', b.accessToken))).toBeNull();

    await send('PUT', '/workshop/profile', a.accessToken, { fullName: 'Alex', organizationName: 'Org A', sector: 'charity' });
    expect((await json(await get('/workshop/profile', a.accessToken))).full_name).toBe('Alex');
    expect(await json(await get('/workshop/profile', b.accessToken))).toBeNull();
  });
});
