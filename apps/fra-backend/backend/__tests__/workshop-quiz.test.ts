/// <reference types="jest" />

import { describe, expect, it } from '@jest/globals';
import { app, authHeaders, createPaidUser } from './helpers';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { QUIZ_ANSWER_KEY, WORKSHOP_SECTION_IDS, mergeQuizScores, missingForCompletion, quizResult } from '../src/workshop-quiz';

// The workshop content lives in packages/shared, which the backend does not depend on,
// so it is read as text here rather than imported
const SHARED_DATA = join(__dirname, '../../../../packages/shared/src/data');

function sharedSectionIds(): number[] {
  const source = readFileSync(join(SHARED_DATA, 'workshopContent.ts'), 'utf8');
  const list = source.slice(source.indexOf('export const workshopSections'));
  return [...list.slice(0, list.indexOf('];')).matchAll(/\bid:\s*(\d+)/g)].map((m) => Number(m[1]));
}

function sharedAnswerKey(): Record<number, number> {
  const source = readFileSync(join(SHARED_DATA, 'quizQuestions.ts'), 'utf8');
  return Object.fromEntries(
    [...source.matchAll(/^\s{2}(\d+):\s*\{[\s\S]*?correctAnswer:\s*(\d+)/gm)].map((m) => [Number(m[1]), Number(m[2])]),
  );
}

describe('workshop completion rules', () => {
  it('match the workshop content the apps show', () => {
    expect(sharedSectionIds()).toEqual([...WORKSHOP_SECTION_IDS]);
    expect(sharedAnswerKey()).toEqual(QUIZ_ANSWER_KEY);
  });

  it('scores answers on the server and rejects sections without a quiz', () => {
    expect(mergeQuizScores({ 1: 0 }, { 1: 1, 2: 0 })).toEqual({ scores: { 1: 100, 2: 0 }, invalid: [] });
    expect(mergeQuizScores({}, { 0: 1 }).invalid).toEqual(['0']);
  });

  it('needs 80% of the quiz right, which with four questions means all four', () => {
    expect(quizResult({ 1: 100, 2: 100, 3: 100, 4: 100 })).toEqual({ percent: 100, passed: true, wrong: [] });
    expect(quizResult({ 1: 100, 2: 0, 3: 100, 4: 100 })).toEqual({ percent: 75, passed: false, wrong: [2] });
    // An unanswered question counts as wrong
    expect(quizResult({ 1: 100 })).toEqual({ percent: 25, passed: false, wrong: [2, 3, 4] });
    expect(quizResult(null).passed).toBe(false);
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
