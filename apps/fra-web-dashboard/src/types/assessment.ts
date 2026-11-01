// Shapes returned by the backend assessment routes (apps/fra-backend/backend/src/routes/assessments.ts)

export type AssessmentStatus = 'draft' | 'in_progress' | 'submitted' | 'completed';

export interface AssessmentRecord {
  id: string;
  organisationId: string;
  createdByUserId: string;
  title: string;
  status: AssessmentStatus;
  answers: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  /** Saved by the server when the assessment is submitted, and never recalculated */
  result?: { methodVersion: number; scoredAt: string; results: AssessmentResults };
}

/** GET /api/v1/assessments/modules — question IDs are `<moduleId>.<field>` */
export interface AssessmentModule {
  id: string;
  title: string;
  description: string;
  category: 'governance' | 'people' | 'process' | 'systems' | 'culture';
  questions: Array<{
    id: string;
    text: string;
    type: 'frequency' | 'currency' | 'scale' | 'yesno';
    weight?: number;
    responseOptions?: string[];
    metadata?: {
      min?: number;
      max?: number;
      step?: number;
      scaleLabels?: string[];
      currency?: string;
    };
  }>;
}

export type ModuleRiskLevel = 'Low' | 'Medium' | 'High';

/** GET /api/v1/assessments/:id/results */
export interface AssessmentResults {
  assessmentId: string;
  overallScore: number;
  riskLevel: ModuleRiskLevel;
  /** The fraud risk the organisation said it can accept (Risk Appetite module); null if not answered */
  riskAppetite?: 'Low' | 'Medium' | 'High' | null;
  modules: Array<{
    id: string;
    title: string;
    score: number;
    level: ModuleRiskLevel;
    impactFactors: string[];
  }>;
  topRisks: Array<{
    module: string;
    moduleTitle: string;
    risk: string;
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
  }>;
}

/** 403 codes from POST /api/v1/assessments when the organisation's package does not allow a new assessment */
export const PACKAGE_ERROR_CODES = ['PACKAGE_REQUIRED', 'ASSESSMENT_LIMIT_REACHED'] as const;
