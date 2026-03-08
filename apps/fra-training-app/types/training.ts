export type {
  QuizQuestion,
  ScenarioOption,
  ScenarioStep,
  ScenarioExercise,
  SectionData,
  WorkshopSection,
  ActionPlanTemplates,
} from '@stopfra/types';

export interface TrainingProgress {
  completedSections: number[];
  quizScores: Record<number, number>;
  scenarioChoices: Record<string, string>;
  actionPlanCommitments: {
    immediate: string[];
    thirtyDays: string[];
    ninetyDays: string[];
  };
  currentSection: number;
  completedAt: string | null;
  certificateNumber: string | null;
}
