import { describe, it, expect } from 'vitest';
import type {
  WorkshopProgress,
  ActionItem,
  QuizQuestion,
  OrgSector,
  AppRole,
} from '@/types/workshop';

describe('Workshop types', () => {
  it('OrgSector has expected values', () => {
    const sectors: OrgSector[] = ['public', 'charity', 'private'];
    expect(sectors).toHaveLength(3);
  });

  it('AppRole has expected values', () => {
    const roles: AppRole[] = ['admin', 'facilitator', 'participant'];
    expect(roles).toHaveLength(3);
  });

  it('ActionItem priority is constrained', () => {
    const item: ActionItem = {
      id: '1',
      title: 'Test',
      description: 'Desc',
      priority: 'high',
      timeframe: '1 week',
      completed: false,
    };
    expect(['high', 'medium', 'low']).toContain(item.priority);
  });

  it('WorkshopProgress has correct shape', () => {
    const progress: WorkshopProgress = {
      id: 'p1',
      user_id: 'u1',
      session_id: null,
      current_section: 0,
      completed_sections: [0, 1],
      quiz_scores: { '1': 80, '2': 90 },
      scenario_choices: { step1: 'optionA' },
      completed_at: null,
      created_at: '2026-01-01',
      updated_at: '2026-01-02',
    };
    expect(progress.completed_sections).toHaveLength(2);
    expect(progress.quiz_scores['1']).toBe(80);
  });

  it('QuizQuestion requires correct answer index', () => {
    const quiz: QuizQuestion = {
      question: 'What is fraud?',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 2,
      explanation: 'C is correct.',
    };
    expect(quiz.correctAnswer).toBeGreaterThanOrEqual(0);
    expect(quiz.correctAnswer).toBeLessThan(quiz.options.length);
  });
});
