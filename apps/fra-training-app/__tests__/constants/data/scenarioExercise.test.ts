import { scenarioExercise } from '@/constants/data/scenarioExercise';

describe('scenarioExercise', () => {
  it('has a title', () => {
    expect(scenarioExercise.title).toBeDefined();
    expect(typeof scenarioExercise.title).toBe('string');
    expect(scenarioExercise.title.length).toBeGreaterThan(0);
  });

  it('has an introduction', () => {
    expect(scenarioExercise.introduction).toBeDefined();
    expect(typeof scenarioExercise.introduction).toBe('string');
    expect(scenarioExercise.introduction.length).toBeGreaterThan(0);
  });

  it('has a steps array with at least one step', () => {
    expect(scenarioExercise.steps).toBeDefined();
    expect(Array.isArray(scenarioExercise.steps)).toBe(true);
    expect(scenarioExercise.steps.length).toBeGreaterThan(0);
  });

  it('each step has an id and description', () => {
    scenarioExercise.steps.forEach((step) => {
      expect(step.id).toBeDefined();
      expect(typeof step.id).toBe('string');
      expect(step.description).toBeDefined();
      expect(typeof step.description).toBe('string');
      expect(step.description.length).toBeGreaterThan(0);
    });
  });

  it('each step has options array with at least 2 options', () => {
    scenarioExercise.steps.forEach((step) => {
      expect(step.options).toBeDefined();
      expect(Array.isArray(step.options)).toBe(true);
      expect(step.options.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('each option has id, text, isCorrect, and feedback', () => {
    scenarioExercise.steps.forEach((step) => {
      step.options.forEach((option) => {
        expect(option.id).toBeDefined();
        expect(typeof option.id).toBe('string');
        expect(option.text).toBeDefined();
        expect(typeof option.text).toBe('string');
        expect(option.text.length).toBeGreaterThan(0);
        expect(typeof option.isCorrect).toBe('boolean');
        expect(option.feedback).toBeDefined();
        expect(typeof option.feedback).toBe('string');
        expect(option.feedback.length).toBeGreaterThan(0);
      });
    });
  });

  it('each step has exactly one correct option', () => {
    scenarioExercise.steps.forEach((step) => {
      const correctCount = step.options.filter((o) => o.isCorrect).length;
      expect(correctCount).toBe(1);
    });
  });
});
