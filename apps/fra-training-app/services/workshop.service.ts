/**
 * Workshop progress, quiz answers and certificates on the server.
 *
 * The server decides quiz scores and whether the workshop is complete, and issues
 * the certificate, so training done in this app counts as evidence on the
 * organisation's dashboard. The workshop is part of the Health Check + Training
 * and Full Dashboard packages; without one the server answers PACKAGE_REQUIRED.
 */

import type { ApiResponse } from '@stopfra/types';
import { apiService } from '@/services/api.service';
import { API_CONFIG } from '@/constants/api';

/** A workshop_progress row as the API returns it. */
export interface ServerProgress {
  id: string;
  current_section: number;
  completed_sections: number[];
  quiz_scores: Record<string, number>;
  scenario_choices: Record<string, string>;
  completed_at: string | null;
}

/** A certificates row as the API returns it. */
export interface ServerCertificate {
  id: string;
  certificate_number: string;
  issued_at: string;
}

export type ProgressUpdate = {
  currentSection?: number;
  completedSections?: number[];
  /** Chosen option per quiz section; the server marks them */
  quizAnswers?: Record<string, number>;
  scenarioChoices?: Record<string, string>;
  /** Asks the server to mark the workshop complete; it records its own time */
  completedAt?: string;
};

const { PROGRESS, CERTIFICATES } = API_CONFIG.ENDPOINTS.WORKSHOP;
const auth = { requiresAuth: true };

/** True when the organisation does not hold a package that includes the workshop. */
export function isPackageRequired(res: ApiResponse<unknown>): boolean {
  return res.error?.code === 'PACKAGE_REQUIRED';
}

/** True when the request never reached the server (no signal, timeout). */
export function isOffline(res: ApiResponse<unknown>): boolean {
  return res.error?.code === 'NETWORK_ERROR' || res.error?.code === 'TIMEOUT';
}

/** The user's progress record, creating it on first use (the server returns the existing one if there is one). */
export function startProgress(): Promise<ApiResponse<ServerProgress>> {
  return apiService.post<ServerProgress>(PROGRESS, {}, auth);
}

export function updateProgress(id: string, update: ProgressUpdate): Promise<ApiResponse<ServerProgress>> {
  return apiService.patch<ServerProgress>(`${PROGRESS}/${id}`, update, auth);
}

/** Issues the certificate once the server agrees the workshop is complete (asking again returns the same one). */
export function issueCertificate(): Promise<ApiResponse<ServerCertificate>> {
  return apiService.post<ServerCertificate>(CERTIFICATES, {}, auth);
}
