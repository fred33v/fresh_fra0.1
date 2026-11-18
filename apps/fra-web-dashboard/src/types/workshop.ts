import type { QuizQuestion } from '@stopfra/types';
export type OrgSector = 'public' | 'charity' | 'private';
export type AppRole = 'admin' | 'facilitator' | 'participant';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  organization_name: string;
  sector: OrgSector;
  job_title: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkshopSession {
  id: string;
  title: string;
  session_code: string;
  facilitator_id: string;
  is_active: boolean;
  current_slide: number;
  created_at: string;
  ended_at: string | null;
}

export interface WorkshopProgress {
  id: string;
  user_id: string;
  session_id: string | null;
  current_section: number;
  completed_sections: number[];
  quiz_scores: Record<string, number>;
  scenario_choices: Record<string, string>;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Poll {
  id: string;
  session_id: string;
  question: string;
  options: string[];
  is_active: boolean;
  created_at: string;
}

export interface PollResponse {
  id: string;
  poll_id: string;
  user_id: string;
  selected_option: number;
  created_at: string;
}

export interface Question {
  id: string;
  session_id: string;
  user_id: string;
  question_text: string;
  is_answered: boolean;
  upvotes: number;
  created_at: string;
}

export interface ActionPlan {
  id: string;
  user_id: string;
  session_id: string | null;
  action_items: ActionItem[];
  commitments: string[] | null;
  generated_at: string;
}

export interface ActionItem {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  timeframe: string;
  completed: boolean;
}

export interface Certificate {
  id: string;
  user_id: string;
  session_id: string | null;
  certificate_number: string;
  /** Quiz score in percent at the time the certificate was issued */
  quiz_score?: number | null;
  issued_at: string;
  status?: 'valid' | 'revoked';
  completed_at?: string | null;
  issued_details?: CertificateSnapshot;
}

export interface CertificateSnapshot {
  kind: 'training' | 'assessment';
  certificateNumber: string;
  issuedAt: string;
  completedAt?: string | null;
  holderName: string;
  organisationName: string;
  title: string;
  quizScore: number | null;
  areasAssessed: number | null;
  courseId?: string;
  courseVersion?: string | null;
  snapshotOrigin?: 'issued' | 'legacy_reconstructed';
}

/** What the public verification page shows for a certificate number */
export interface VerifiedCertificate {
  valid: boolean;
  status?: 'valid' | 'revoked';
  completedAt?: string | null;
  snapshotOrigin?: 'issued' | 'legacy_reconstructed';
  kind: 'training' | 'assessment';
  certificateNumber: string;
  issuedAt: string;
  holderName: string;
  organisationName: string;
  title: string;
  quizScore: number | null;
  areasAssessed: number | null;
  verifyUrl: string;
}

/** The certificate of a submitted risk assessment */
export interface AssessmentCertificate {
  kind: 'assessment';
  certificateNumber: string;
  issuedAt: string;
  assessmentId: string;
  title: string;
  verifyUrl: string;
}

export interface WorkshopFeedback {
  id: string;
  user_id: string;
  session_id: string | null;
  effectiveness_rating: number | null;
  feedback_text: string | null;
  suggestions: string | null;
  created_at: string;
}

export interface WorkshopSlide {
  id: number;
  title: string;
  section: string;
  content: React.ReactNode;
  discussionPrompt?: string;
  quiz?: QuizQuestion;
}

// Re-export shared types from @stopfra/types
export type { QuizQuestion, ScenarioOption, ScenarioStep } from '@stopfra/types';

export interface CaseStudy {
  id: string;
  title: string;
  sector: OrgSector;
  scenario: string;
  questions: string[];
  learningPoints: string[];
}
