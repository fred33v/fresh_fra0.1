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

/** Represents a live training session with facilitator and participants. */
export interface WorkshopSession {
  id: string;
  sessionCode: string;
  title: string;
  description?: string;
  organisationId: string;
  facilitatorId: string;
  currentSlide: number;
  totalSlides: number;
  isActive: boolean;
  startedAt: string;
  endedAt?: string;
  participantCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Represents a participant joining a workshop session. */
export interface SessionParticipant {
  id: string;
  sessionId: string;
  userId: string;
  email: string;
  name: string;
  joinedAt: string;
  leftAt?: string;
  hasRaisedHand: boolean;
  lastActivityAt: string;
}

/** Server-Sent Event emitted during a workshop session for real-time updates. */
export interface WorkshopSSEEvent {
  event: 'slide_changed' | 'participant_joined' | 'participant_left' | 'hand_raised' | 'session_ended';
  timestamp: string;
  data: Record<string, unknown>;
}

/** Session code for joining a workshop without authentication. */
export interface SessionCode {
  code: string;
  sessionId: string;
  expiresAt: string;
  maxAttempts: number;
  attemptCount: number;
  isValid: boolean;
}
