// ============================================================
// In-memory workshop data, used when DATABASE_URL is unset (local
// development and tests), like the other stores in stores.ts. Rows keep
// the database's snake_case column names, so the routes return the same
// shape either way.
// ============================================================

import crypto from 'node:crypto';
import type { TrainingRecord } from './db/compliance.js';

export type ProfileRow = {
  id: string; user_id: string; full_name: string; organization_name: string; sector: string; job_title: string | null;
  created_at: string; updated_at: string;
};
export type SessionRow = {
  id: string; facilitator_id: string; session_code: string; title: string; current_slide: number; is_active: boolean;
  created_at: string; ended_at: string | null;
};
export type ProgressRow = {
  id: string; user_id: string; session_id: string | null; current_section: number; completed_sections: number[];
  quiz_scores: Record<string, number>; scenario_choices: Record<string, string>; completed_at: string | null;
  created_at: string; updated_at: string;
};
export type PollRow = { id: string; session_id: string; question: string; options: string[]; is_active: boolean; created_at: string };
export type QuestionRow = {
  id: string; session_id: string; user_id: string; question_text: string; upvotes: number; is_answered: boolean; created_at: string;
};
export type ActionPlanRow = {
  id: string; user_id: string; session_id: string | null; action_items: unknown; commitments: string[]; generated_at: string;
};
export type CertificateRow = {
  id: string; user_id: string; session_id: string | null; certificate_number: string; quiz_score?: number | null; issued_at: string;
};

export const workshopProfiles = new Map<string, ProfileRow>(); // by user id
export const workshopSessions = new Map<string, SessionRow>();
/** session id → user id → joined at */
export const sessionParticipants = new Map<string, Map<string, string>>();
export const workshopProgress = new Map<string, ProgressRow>();
export const polls = new Map<string, PollRow>();
/** poll id → user id → selected option */
export const pollResponses = new Map<string, Map<string, number>>();
export const questions = new Map<string, QuestionRow>();
/** `questionId:userId` */
export const questionUpvotes = new Set<string>();
export const actionPlans = new Map<string, ActionPlanRow>();
export const certificates = new Map<string, CertificateRow>();

export const newId = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

/** The caller's relationship to a session, or null if they have none (or it does not exist). */
export function memSessionRole(sessionId: string, userId: string): 'facilitator' | 'participant' | null {
  const session = workshopSessions.get(sessionId);
  if (!session) return null;
  if (session.facilitator_id === userId) return 'facilitator';
  return sessionParticipants.get(sessionId)?.has(userId) ? 'participant' : null;
}

export const memParticipantCount = (sessionId: string) => sessionParticipants.get(sessionId)?.size ?? 0;

export function memFindProgress(userId: string, sessionId: string | null): ProgressRow | undefined {
  for (const p of workshopProgress.values()) {
    if (p.user_id === userId && p.session_id === sessionId) return p;
  }
  return undefined;
}

/** Latest first, like the database's ORDER BY ... DESC. */
export const latestFirst = <T>(rows: T[], key: keyof T) =>
  rows.sort((a, b) => String(b[key]).localeCompare(String(a[key])));

/** Workshop completion and certificates for the given users (the database version is dbListTrainingRecords). */
export function memTrainingRecords(userIds: string[]): TrainingRecord[] {
  return userIds.map((userId) => {
    const completed = [...workshopProgress.values()]
      .filter((p) => p.user_id === userId && p.completed_at)
      .map((p) => p.completed_at!)
      .sort()
      .at(-1);
    const cert = latestFirst([...certificates.values()].filter((c) => c.user_id === userId), 'issued_at')[0];
    return { userId, completedAt: completed, certificateNumber: cert?.certificate_number, certificateIssuedAt: cert?.issued_at };
  });
}
