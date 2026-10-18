/// <reference types="jest" />

import { describe, expect, it } from '@jest/globals';
import { app, authHeaders, createPaidUser } from './helpers';
import { QUIZ_ANSWER_KEY, WORKSHOP_SECTION_IDS, mergeQuizScores, missingForCompletion } from '../src/workshop-quiz';
import { quizQuestions } from '../../../../packages/shared/src/data/quizQuestions';
import { workshopSections } from '../../../../packages/shared/src/data/workshopContent';

describe('workshop completion rules', () => {
  it('match the workshop content the apps show', () => {
    expect([...WORKSHOP_SECTION_IDS]).toEqual(workshopSections.map((s) => s.id));
    const sharedKey = Object.fromEntries(Object.entries(quizQuestions).map(([id, q]) => [Number(id), q.correctAnswer]));
    expect(QUIZ_ANSWER_KEY).toEqual(sharedKey);
  });

  it('scores answers on the server and rejects sections without a quiz', () => {
    expect(mergeQuizScores({ 1: 0 }, { 1: 1, 2: 0 })).toEqual({ scores: { 1: 100, 2: 0 }, invalid: [] });
    expect(mergeQuizScores({}, { 0: 1 }).invalid).toEqual(['0']);
  });

  it('lists what is still missing', () => {
    expect(missingForCompletion([0, 1, 2, 3, 4, 5, 6], { 1: 0, 2: 100, 3: 100, 4: 0 })).toEqual({ sections: [], quizzes: [] });
    expect(missingForCompletion([0, 1], { 1: 100 })).toEqual({ sections: [2, 3, 4, 5, 6], quizzes: [2, 3, 4] });
  });
});

describe('PATCH /workshop/progress/:id cannot fake training', () => {
  async function start() {
    const { accessToken } = await createPaidUser('pkg_full');
    const res = await app.request('http://localhost/api/v1/workshop/progress', { method: 'POST', headers: authHeaders(accessToken) });
    const progress = ((await res.json()) as any).data;
    const patch = (body: unknown) => app.request(`http://localhost/api/v1/workshop/progress/${progress.id}`, {
      method: 'PATCH', headers: authHeaders(accessToken), body: JSON.stringify(body),
    });
    return { accessToken, patch };
  }

  it('ignores quiz scores sent by the client', async () => {
    const { patch } = await start();
    const res = await patch({ quizScores: { 1: 100, 2: 100, 3: 100, 4: 100 } });
    expect(((await res.json()) as any).data.quiz_scores).toEqual({});
  });

  it('refuses to mark the workshop complete straight away, and issues no certificate', async () => {
    const { accessToken, patch } = await start();
    const res = await patch({ completedAt: new Date().toISOString() });
    expect(res.status).toBe(400);
    const cert = await app.request('http://localhost/api/v1/workshop/certificates', { method: 'POST', headers: authHeaders(accessToken) });
    expect(cert.status).toBe(400);
  });

  it('records its own completion time, not the one sent', async () => {
    const { patch } = await start();
    const res = await patch({
      completedSections: [0, 1, 2, 3, 4, 5, 6], quizAnswers: { 1: 1, 2: 2, 3: 1, 4: 2 }, completedAt: '2020-01-01T00:00:00.000Z',
    });
    expect(res.status).toBe(200);
    const completedAt = ((await res.json()) as any).data.completed_at;
    expect(new Date(completedAt).getFullYear()).toBeGreaterThan(2020);
  });
});
