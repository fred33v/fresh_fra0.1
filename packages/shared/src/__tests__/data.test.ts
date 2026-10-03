import { describe, it, expect } from 'vitest';
import { workshopSections, sectionContent, quizQuestions, scenarioExercise, actionPlanTemplates } from '../data';

describe('Workshop Data', () => {
  describe('workshopSections', () => {
    it('has 7 sections', () => {
      expect(workshopSections).toHaveLength(7);
    });

    it('each section has required properties', () => {
      workshopSections.forEach((section) => {
        expect(section.id).toBeDefined();
        expect(typeof section.id).toBe('number');
        expect(section.title).toBeDefined();
        expect(typeof section.title).toBe('string');
        expect(section.duration).toBeDefined();
        expect(typeof section.duration).toBe('string');
        expect(section.icon).toBeDefined();
        expect(typeof section.icon).toBe('string');
      });
    });

    it('has sequential IDs from 0-6', () => {
      expect(workshopSections.map((s) => s.id)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it('has unique, non-empty titles', () => {
      const titles = workshopSections.map((s) => s.title);
      const uniqueTitles = new Set(titles);
      expect(uniqueTitles.size).toBe(7);
      expect(titles.every((t) => t.length > 0)).toBe(true);
    });

    it('all durations include time units', () => {
      workshopSections.forEach((section) => {
        expect(section.duration).toMatch(/min/i);
      });
    });
  });

  describe('sectionContent', () => {
    it('has content for all section IDs', () => {
      workshopSections.forEach((section) => {
        expect(sectionContent[section.id]).toBeDefined();
      });
    });

    it('each section content has required properties', () => {
      Object.values(sectionContent).forEach((content) => {
        expect(content.title).toBeDefined();
        expect(typeof content.title).toBe('string');
        expect(content.subtitle).toBeDefined();
        expect(typeof content.subtitle).toBe('string');
        expect(content.keyPoints).toBeDefined();
        expect(Array.isArray(content.keyPoints)).toBe(true);
        expect(content.discussionPrompt).toBeDefined();
        expect(typeof content.discussionPrompt).toBe('string');
      });
    });

    it('each section has at least one key point', () => {
      Object.values(sectionContent).forEach((content) => {
        expect(content.keyPoints.length).toBeGreaterThan(0);
      });
    });

    it('each key point is a non-empty string', () => {
      Object.values(sectionContent).forEach((content) => {
        content.keyPoints.forEach((point) => {
          expect(typeof point).toBe('string');
          expect(point.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('quizQuestions', () => {
    it('quiz questions is exported', () => {
      expect(quizQuestions).toBeDefined();
    });

    it('has questions with required structure', () => {
      Object.values(quizQuestions).forEach((question) => {
        expect(question.question).toBeDefined();
        expect(typeof question.question).toBe('string');
        expect(question.options).toBeDefined();
        expect(Array.isArray(question.options)).toBe(true);
        expect(question.correctAnswer).toBeDefined();
        expect(typeof question.correctAnswer).toBe('number');
        expect(question.explanation).toBeDefined();
        expect(typeof question.explanation).toBe('string');
      });
    });

    it('correct answer index is within options range', () => {
      Object.values(quizQuestions).forEach((question) => {
        expect(question.correctAnswer).toBeGreaterThanOrEqual(0);
        expect(question.correctAnswer).toBeLessThan(question.options.length);
      });
    });

    it('each option is a non-empty string', () => {
      Object.values(quizQuestions).forEach((question) => {
        question.options.forEach((option) => {
          expect(typeof option).toBe('string');
          expect(option.length).toBeGreaterThan(0);
        });
      });
    });
  });

  describe('scenarioExercise', () => {
    it('scenario exercise is exported', () => {
      expect(scenarioExercise).toBeDefined();
    });

    it('has required properties', () => {
      expect(scenarioExercise.title).toBeDefined();
      expect(typeof scenarioExercise.title).toBe('string');
      expect(scenarioExercise.introduction).toBeDefined();
      expect(typeof scenarioExercise.introduction).toBe('string');
      expect(scenarioExercise.steps).toBeDefined();
      expect(Array.isArray(scenarioExercise.steps)).toBe(true);
    });

    it('has at least one step', () => {
      expect(scenarioExercise.steps.length).toBeGreaterThan(0);
    });

    it('each step has required properties', () => {
      scenarioExercise.steps.forEach((step) => {
        expect(step.id).toBeDefined();
        expect(typeof step.id).toBe('string');
        expect(step.description).toBeDefined();
        expect(typeof step.description).toBe('string');
        expect(step.options).toBeDefined();
        expect(Array.isArray(step.options)).toBe(true);
      });
    });

    it('each step has at least one option', () => {
      scenarioExercise.steps.forEach((step) => {
        expect(step.options.length).toBeGreaterThan(0);
      });
    });

    it('each option has required properties', () => {
      scenarioExercise.steps.forEach((step) => {
        step.options.forEach((option) => {
          expect(option.id).toBeDefined();
          expect(typeof option.id).toBe('string');
          expect(option.text).toBeDefined();
          expect(typeof option.text).toBe('string');
          expect(option.isCorrect).toBeDefined();
          expect(typeof option.isCorrect).toBe('boolean');
          expect(option.feedback).toBeDefined();
          expect(typeof option.feedback).toBe('string');
        });
      });
    });
  });

  describe('actionPlanTemplates', () => {
    it('action plan templates is exported', () => {
      expect(actionPlanTemplates).toBeDefined();
    });

    it('has immediate, thirtyDays, and ninetyDays timelines', () => {
      expect(actionPlanTemplates.immediate).toBeDefined();
      expect(Array.isArray(actionPlanTemplates.immediate)).toBe(true);
      expect(actionPlanTemplates.thirtyDays).toBeDefined();
      expect(Array.isArray(actionPlanTemplates.thirtyDays)).toBe(true);
      expect(actionPlanTemplates.ninetyDays).toBeDefined();
      expect(Array.isArray(actionPlanTemplates.ninetyDays)).toBe(true);
    });

    it('each timeline has at least one action', () => {
      expect(actionPlanTemplates.immediate.length).toBeGreaterThan(0);
      expect(actionPlanTemplates.thirtyDays.length).toBeGreaterThan(0);
      expect(actionPlanTemplates.ninetyDays.length).toBeGreaterThan(0);
    });

    it('each action is a non-empty string', () => {
      [...actionPlanTemplates.immediate, ...actionPlanTemplates.thirtyDays, ...actionPlanTemplates.ninetyDays].forEach(
        (action) => {
          expect(typeof action).toBe('string');
          expect(action.length).toBeGreaterThan(0);
        }
      );
    });
  });
});
