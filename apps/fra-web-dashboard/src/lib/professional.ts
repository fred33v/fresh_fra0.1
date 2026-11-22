export const professionalActionLabels = {
  deliver: 'Deliver training',
  assess: 'Assess completion',
  issue_completion: 'Issue completion certificates',
};
export type ProfessionalAction = keyof typeof professionalActionLabels;
export interface ProfessionalSubject {
  id: string;
  version: string;
  title: string;
  courseId: string;
  courseVersion: string;
}
export interface ProfessionalScope {
  id: string;
  applicationId: string;
  subjectId: string;
  subjectVersion: string;
  requestedActions: ProfessionalAction[];
  actions: ProfessionalAction[];
  evidence: string;
  status: 'requested' | 'approved' | 'declined' | 'suspended' | 'revoked';
  revision: number;
  effective?: boolean;
  validFrom: string | null;
  validUntil: string | null;
  reason: string | null;
  qualificationCheck?: string;
  demonstrationCheck?: string;
}
