export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export interface ScenarioOption {
  id: string;
  text: string;
  isCorrect: boolean;
  feedback: string;
}

export interface ScenarioStep {
  id: string;
  description: string;
  options: ScenarioOption[];
}

export interface ScenarioExercise {
  title: string;
  introduction: string;
  steps: ScenarioStep[];
}

export interface SectionData {
  title: string;
  subtitle: string;
  keyPoints: string[];
  discussionPrompt: string;
}

export interface WorkshopSection {
  id: number;
  title: string;
  duration: string;
  icon: string;
}

export interface ActionPlanTemplates {
  immediate: string[];
  thirtyDays: string[];
  ninetyDays: string[];
}
