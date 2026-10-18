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
  /** Issued by the server; null until the workshop is complete and the server has issued it */
  certificateNumber: string | null;
  certificateIssuedAt: string | null;
  /** Quiz answers chosen on the phone that the server has not marked yet (sent when back online) */
  pendingQuizAnswers: Record<string, number>;
  /** The server's id for this user's progress record */
  serverProgressId: string | null;
}
