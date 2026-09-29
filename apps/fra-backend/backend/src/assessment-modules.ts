/**
 * Assessment module definitions
 *
 * The question set served to clients. Question IDs are `<module>.<field>` and map
 * one-to-one onto RiskScoringInput, so answers stored on an assessment can be
 * scored without any client-side translation. Keep this file and risk-scoring.ts
 * in step: a question that the scorer does not read has no effect on results.
 */

import { calculateRiskScore, type RiskScore, type RiskScoringInput } from './risk-scoring.js';

export type QuestionType = 'frequency' | 'currency' | 'scale' | 'yesno';

export interface AssessmentQuestion {
  id: string;
  text: string;
  type: QuestionType;
  responseOptions?: string[];
  metadata?: {
    min?: number;
    max?: number;
    step?: number;
    scaleLabels?: string[];
    currency?: string;
  };
}

export interface AssessmentModuleDefinition {
  id: keyof RiskScoringInput;
  title: string;
  description: string;
  category: 'governance' | 'people' | 'process' | 'systems' | 'culture';
  questions: AssessmentQuestion[];
}

const MATURITY_LABELS = ['Very weak', 'Very strong'];

export const ASSESSMENT_MODULES: AssessmentModuleDefinition[] = [
  {
    id: 'procurement',
    title: 'Procurement',
    description: 'Supplier onboarding, purchasing controls and spend exposure.',
    category: 'process',
    questions: [
      { id: 'procurement.dueDiligenceLevel', text: 'How thorough is due diligence on new suppliers?', type: 'scale', metadata: { min: 1, max: 5, scaleLabels: MATURITY_LABELS } },
      { id: 'procurement.monthlySpend', text: 'What is your typical monthly procurement spend?', type: 'currency' },
      { id: 'procurement.recentFraud', text: 'Have you identified procurement fraud in the last 12 months?', type: 'yesno' },
      { id: 'procurement.controlMaturity', text: 'How mature are your purchasing approval controls?', type: 'scale', metadata: { min: 1, max: 5, scaleLabels: MATURITY_LABELS } },
    ],
  },
  {
    id: 'cashBanking',
    title: 'Cash & Banking',
    description: 'Cash handling, bank accounts and payment controls.',
    category: 'process',
    questions: [
      { id: 'cashBanking.dailyCashVolume', text: 'What is your typical daily cash and payment volume?', type: 'currency' },
      { id: 'cashBanking.bankAccountCount', text: 'How many bank accounts does the organisation operate?', type: 'scale', metadata: { min: 1, max: 20, step: 1, scaleLabels: ['1', '20+'] } },
      { id: 'cashBanking.fraudIncidents', text: 'Have there been cash or banking fraud incidents in the last 12 months?', type: 'yesno' },
      { id: 'cashBanking.controlEffectiveness', text: 'How effective are your cash and banking controls?', type: 'scale', metadata: { min: 1, max: 5, scaleLabels: MATURITY_LABELS } },
    ],
  },
  {
    id: 'payrollHR',
    title: 'Payroll & HR',
    description: 'Payroll changes, starters and leavers, and HR records.',
    category: 'people',
    questions: [
      { id: 'payrollHR.totalEmployeeCount', text: 'How many people are on the payroll?', type: 'scale', metadata: { min: 0, max: 2000, step: 10, scaleLabels: ['0', '2,000+'] } },
      { id: 'payrollHR.unauthorizedChangesDetected', text: 'Have unauthorised payroll changes been detected in the last 12 months?', type: 'yesno' },
      { id: 'payrollHR.controlMaturity', text: 'How mature are your payroll change controls?', type: 'scale', metadata: { min: 1, max: 5, scaleLabels: MATURITY_LABELS } },
    ],
  },
  {
    id: 'revenue',
    title: 'Revenue & Income',
    description: 'Invoicing, collections and write-offs.',
    category: 'process',
    questions: [
      { id: 'revenue.monthlyRevenueVolume', text: 'What is your typical monthly revenue?', type: 'currency' },
      { id: 'revenue.unpaidInvoicesPercentage', text: 'What percentage of invoices are overdue?', type: 'scale', metadata: { min: 0, max: 100, step: 5, scaleLabels: ['0%', '100%'] } },
      { id: 'revenue.writeOffsOccurred', text: 'Have there been significant bad debt write-offs in the last 12 months?', type: 'yesno' },
      { id: 'revenue.collectionEffectiveness', text: 'How effective is your debt collection process?', type: 'scale', metadata: { min: 1, max: 5, scaleLabels: MATURITY_LABELS } },
    ],
  },
  {
    id: 'itSystems',
    title: 'IT Systems & Cybersecurity',
    description: 'System access, security incidents and resilience.',
    category: 'systems',
    questions: [
      { id: 'itSystems.cybersecurityMaturity', text: 'How mature is your cybersecurity programme?', type: 'scale', metadata: { min: 1, max: 5, scaleLabels: MATURITY_LABELS } },
      { id: 'itSystems.securityIncidentsCount', text: 'How many security incidents occurred in the last 12 months?', type: 'scale', metadata: { min: 0, max: 20, step: 1, scaleLabels: ['0', '20+'] } },
      { id: 'itSystems.hasCriticalSystems', text: 'Do you run critical systems whose disruption would halt operations?', type: 'yesno' },
      { id: 'itSystems.backupTestingFrequency', text: 'How regularly are backups tested?', type: 'scale', metadata: { min: 1, max: 5, scaleLabels: ['Never', 'Continuously'] } },
      { id: 'itSystems.mfaAdoption', text: 'How widely is multi-factor authentication adopted?', type: 'scale', metadata: { min: 1, max: 5, scaleLabels: ['None', 'Everywhere'] } },
    ],
  },
];

/** Converts flat `<module>.<field>` answers into the nested shape the scorer expects. Unknown keys are ignored. */
export function answersToRiskInput(answers: Record<string, unknown>): RiskScoringInput {
  const input: Record<string, Record<string, unknown>> = {};
  for (const module of ASSESSMENT_MODULES) {
    for (const question of module.questions) {
      const value = answers[question.id];
      if (value === undefined || value === null || value === '') continue;
      const field = question.id.slice(module.id.length + 1);
      const parsed = question.type === 'yesno' ? String(value) : Number(value);
      if (typeof parsed === 'number' && !Number.isFinite(parsed)) continue;
      input[module.id] ??= {};
      input[module.id][field] = parsed;
    }
  }
  return input as RiskScoringInput;
}

export interface AssessmentResults {
  assessmentId: string;
  overallScore: number;
  riskLevel: RiskScore['riskLevel'];
  modules: Array<{
    id: string;
    title: string;
    score: number;
    level: RiskScore['riskLevel'];
    impactFactors: string[];
  }>;
  topRisks: Array<RiskScore['topRisks'][number] & { moduleTitle: string }>;
}

export function buildAssessmentResults(assessmentId: string, answers: Record<string, unknown>): AssessmentResults {
  const score = calculateRiskScore(answersToRiskInput(answers));
  const titles = new Map<string, string>(ASSESSMENT_MODULES.map((m) => [m.id, m.title]));

  return {
    assessmentId,
    overallScore: score.overallScore,
    riskLevel: score.riskLevel,
    modules: Object.entries(score.moduleScores).map(([id, m]) => ({
      id,
      title: titles.get(id) ?? id,
      score: m.score,
      level: m.level,
      impactFactors: m.impactFactors,
    })),
    topRisks: score.topRisks.map((r) => ({ ...r, moduleTitle: titles.get(r.module) ?? r.module })),
  };
}
