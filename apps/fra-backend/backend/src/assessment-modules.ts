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
const scale = (scaleLabels: string[]) => ({ min: 1, max: 5, scaleLabels });

// The 13 modules, in the same order as the mobile app
export const ASSESSMENT_MODULES: AssessmentModuleDefinition[] = [
  {
    id: 'riskAppetite',
    title: 'Risk Appetite',
    description: 'How much fraud risk the organisation is prepared to accept, and what a loss would mean.',
    category: 'governance',
    questions: [
      { id: 'riskAppetite.toleranceLevel', text: 'How would you rate your organisation\'s tolerance for fraud risk?', type: 'scale', metadata: scale(['Very risk averse', 'Very risk tolerant']) },
      { id: 'riskAppetite.acceptableRisk', text: 'Overall, how much fraud risk can the organisation accept?', type: 'frequency', responseOptions: ['Low', 'Medium', 'High'] },
      { id: 'riskAppetite.moderateLossImpact', text: 'How serious would a moderate fraud loss be?', type: 'scale', metadata: scale(['Minor', 'Very serious']) },
      { id: 'riskAppetite.reputationalImpact', text: 'How significant would reputational damage from fraud be?', type: 'scale', metadata: scale(['Minor', 'Severe']) },
    ],
  },
  {
    id: 'fraudTriangle',
    title: 'Fraud Triangle',
    description: 'Pressure, opportunity and rationalisation: the conditions that make fraud more likely.',
    category: 'culture',
    questions: [
      { id: 'fraudTriangle.potentialAnnualLoss', text: 'If fraud went undetected, what might it cost the organisation in a year?', type: 'currency' },
      { id: 'fraudTriangle.financialPressure', text: 'How much financial or operational pressure is the organisation under?', type: 'scale', metadata: scale(['Very low', 'Very high']) },
      { id: 'fraudTriangle.rationalisationLikelihood', text: 'How likely is it that staff could justify dishonest behaviour to themselves?', type: 'scale', metadata: scale(['Very unlikely', 'Very likely']) },
      { id: 'fraudTriangle.controlStrength', text: 'How strong are your fraud prevention controls overall?', type: 'scale', metadata: scale(MATURITY_LABELS) },
      { id: 'fraudTriangle.speakUpConfidence', text: 'How confident are you that staff would speak up if they saw something wrong?', type: 'scale', metadata: scale(['Not confident', 'Very confident']) },
    ],
  },
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
  {
    id: 'peopleCulture',
    title: 'People & Culture',
    description: 'Vetting, speaking up and the tone set by leadership.',
    category: 'people',
    questions: [
      { id: 'peopleCulture.vettingThoroughness', text: 'How thorough are background and vetting checks on new staff?', type: 'scale', metadata: scale(MATURITY_LABELS) },
      { id: 'peopleCulture.whistleblowingRoute', text: 'Is there a confidential way for staff to report concerns, including anonymously?', type: 'yesno' },
      { id: 'peopleCulture.leadershipMessaging', text: 'How often and clearly does leadership communicate expectations about fraud?', type: 'scale', metadata: scale(['Never', 'Regularly and clearly']) },
    ],
  },
  {
    id: 'controlsTechnology',
    title: 'Controls & Technology',
    description: 'Segregation of duties, system access and automated checks.',
    category: 'systems',
    questions: [
      { id: 'controlsTechnology.segregationOfDuties', text: 'How well are duties separated in your financial processes?', type: 'scale', metadata: scale(MATURITY_LABELS) },
      { id: 'controlsTechnology.accessManagement', text: 'How mature is system access management, including starters and leavers?', type: 'scale', metadata: scale(MATURITY_LABELS) },
      { id: 'controlsTechnology.automatedMonitoring', text: 'Do you have automated monitoring or exception reports for unusual transactions?', type: 'yesno' },
    ],
  },
  {
    id: 'trainingAwareness',
    title: 'Training & Awareness',
    description: 'Fraud awareness training for staff, high-risk roles and the board.',
    category: 'people',
    questions: [
      { id: 'trainingAwareness.staffTrainedPercentage', text: 'What share of staff completed fraud awareness training in the last 12 months?', type: 'scale', metadata: { min: 0, max: 100, step: 5, scaleLabels: ['0%', '100%'] } },
      { id: 'trainingAwareness.specialistTraining', text: 'Have staff in high-risk roles (finance, procurement, payroll) had role-specific training?', type: 'yesno' },
      { id: 'trainingAwareness.boardTrained', text: 'Has the board had fraud risk training in the last 12 months?', type: 'yesno' },
    ],
  },
  {
    id: 'monitoringEvaluation',
    title: 'Monitoring & Evaluation',
    description: 'How fraud is detected, tracked and the risk register reviewed.',
    category: 'governance',
    questions: [
      { id: 'monitoringEvaluation.incidentsDetected', text: 'How many fraud incidents were detected in the last 12 months?', type: 'scale', metadata: { min: 0, max: 20, step: 1, scaleLabels: ['0', '20+'] } },
      { id: 'monitoringEvaluation.undetectedLikelihood', text: 'With current controls, how likely is fraud to go undetected?', type: 'scale', metadata: scale(['Very unlikely', 'Very likely']) },
      { id: 'monitoringEvaluation.registerReviewFrequency', text: 'How often is the fraud risk register reviewed?', type: 'frequency', responseOptions: ['Never', 'Annually', 'Quarterly', 'Monthly'] },
    ],
  },
  {
    id: 'complianceMapping',
    title: 'Compliance',
    description: 'ECCTA 2023 reasonable procedures and GovS 013 basics.',
    category: 'governance',
    questions: [
      { id: 'complianceMapping.accountableIndividual', text: 'Is a named board member or senior manager accountable for fraud prevention?', type: 'yesno' },
      { id: 'complianceMapping.boardApprovedPolicy', text: 'Has the board approved a fraud prevention policy in the last 12 months?', type: 'yesno' },
      { id: 'complianceMapping.associatedPersonsDueDiligence', text: 'How thorough is due diligence on agents, contractors and others who act for you?', type: 'scale', metadata: scale(MATURITY_LABELS) },
      { id: 'complianceMapping.counterFraudStrategy', text: 'Do you have a current counter fraud strategy?', type: 'yesno' },
    ],
  },
  {
    id: 'fraudResponse',
    title: 'Fraud Response',
    description: 'How suspected fraud is handled, investigated and recovered.',
    category: 'governance',
    questions: [
      { id: 'fraudResponse.responsePlan', text: 'Do you have a documented fraud response plan?', type: 'yesno' },
      { id: 'fraudResponse.responseSpeed', text: 'How quickly does the organisation usually act on suspected fraud?', type: 'frequency', responseOptions: ['Within 24 hours', 'Within a week', 'Within a month', 'Longer or ad hoc'] },
      { id: 'fraudResponse.lossesLastThreeYears', text: 'What fraud losses have been identified in the last 3 years?', type: 'currency' },
      { id: 'fraudResponse.investigatorAccess', text: 'Do you have access to trained fraud investigators, in-house or contracted?', type: 'yesno' },
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
      // Yes/no and multiple-choice answers are words; scales and amounts are numbers
      const parsed = question.type === 'yesno' || question.type === 'frequency' ? String(value) : Number(value);
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
  /** The appetite the organisation stated, for comparing against its risk level */
  riskAppetite: RiskScore['riskAppetite'];
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
    riskAppetite: score.riskAppetite,
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
