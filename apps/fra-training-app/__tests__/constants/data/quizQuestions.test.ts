import { quizQuestions } from '@/constants/data/quizQuestions';

describe('quizQuestions', () => {
  it('has quiz questions for sections 1 through 4', () => {
    expect(quizQuestions[1]).toBeDefined();
    expect(quizQuestions[2]).toBeDefined();
    expect(quizQuestions[3]).toBeDefined();
    expect(quizQuestions[4]).toBeDefined();
  });

  it('each question has question text', () => {
    Object.values(quizQuestions).forEach((q) => {
      expect(q.question).toBeDefined();
      expect(typeof q.question).toBe('string');
      expect(q.question.length).toBeGreaterThan(0);
    });
  });

  it('each question has exactly 4 options', () => {
    Object.values(quizQuestions).forEach((q) => {
      expect(q.options).toBeDefined();
      expect(Array.isArray(q.options)).toBe(true);
      expect(q.options).toHaveLength(4);
    });
  });

  it('each option is a non-empty string', () => {
    Object.values(quizQuestions).forEach((q) => {
      q.options.forEach((option) => {
        expect(typeof option).toBe('string');
        expect(option.length).toBeGreaterThan(0);
      });
    });
  });

  it('each question has a valid correctAnswer index', () => {
    Object.values(quizQuestions).forEach((q) => {
      expect(typeof q.correctAnswer).toBe('number');
      expect(q.correctAnswer).toBeGreaterThanOrEqual(0);
      expect(q.correctAnswer).toBeLessThan(q.options.length);
    });
  });

  it('each question has an explanation', () => {
    Object.values(quizQuestions).forEach((q) => {
      expect(q.explanation).toBeDefined();
      expect(typeof q.explanation).toBe('string');
      expect(q.explanation.length).toBeGreaterThan(0);
    });
  });
});
