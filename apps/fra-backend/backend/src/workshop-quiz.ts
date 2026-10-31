// ============================================================
// Workshop completion rules, checked on the server so a certificate
// (which counts as ECCTA training evidence) cannot be issued by
// a client simply claiming the workshop is done.
//
// Mirrors packages/shared/src/data (workshopSections, quizQuestions);
// __tests__/workshop-quiz.test.ts fails if the two drift apart.
// ============================================================

/** Every workshop section, by id, that must be completed. */
export const WORKSHOP_SECTION_IDS = [0, 1, 2, 3, 4, 5, 6] as const;

/** Section id → index of the correct option for that section's quiz question. */
export const QUIZ_ANSWER_KEY: Record<number, number> = { 1: 1, 2: 2, 3: 1, 4: 2 };

/** Score for an answer to a section's quiz: 100 if correct, 0 if not, null if the section has no quiz. */
export function scoreQuizAnswer(sectionId: number, answer: number): number | null {
  if (!(sectionId in QUIZ_ANSWER_KEY)) return null;
  return QUIZ_ANSWER_KEY[sectionId] === answer ? 100 : 0;
}

/** Turn submitted answers ({ "1": 2, ... }) into scores, merged over the scores already saved. */
export function mergeQuizScores(
  existing: Record<string, number> | null | undefined,
  answers: Record<string, number>,
): { scores: Record<string, number>; invalid: string[] } {
  const scores = { ...(existing ?? {}) };
  const invalid: string[] = [];
  for (const [section, answer] of Object.entries(answers)) {
    const score = scoreQuizAnswer(Number(section), answer);
    if (score === null) invalid.push(section);
    else scores[section] = score;
  }
  return { scores, invalid };
}

/** What is still missing before the workshop counts as complete (empty when it is complete). */
export function missingForCompletion(
  completedSections: number[] | null | undefined,
  quizScores: Record<string, number> | null | undefined,
): { sections: number[]; quizzes: number[] } {
  const done = new Set(completedSections ?? []);
  const scores = quizScores ?? {};
  return {
    sections: WORKSHOP_SECTION_IDS.filter((id) => !done.has(id)),
    quizzes: Object.keys(QUIZ_ANSWER_KEY).map(Number).filter((id) => typeof scores[String(id)] !== 'number'),
  };
}

/** Share of quiz questions, as a whole percentage, that must be answered correctly (decided 2026-10-30). */
export const QUIZ_PASS_MARK = 80;

/**
 * The overall quiz result: the percentage of all quiz questions answered correctly
 * (an unanswered question counts as wrong), whether it reaches the pass mark,
 * and which sections' questions are not yet right.
 */
export function quizResult(quizScores: Record<string, number> | null | undefined): {
  percent: number; passed: boolean; wrong: number[];
} {
  const scores = quizScores ?? {};
  const ids = Object.keys(QUIZ_ANSWER_KEY).map(Number);
  const wrong = ids.filter((id) => scores[String(id)] !== 100);
  const percent = Math.round(((ids.length - wrong.length) / ids.length) * 100);
  return { percent, passed: percent >= QUIZ_PASS_MARK, wrong };
}
