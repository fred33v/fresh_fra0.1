// ============================================================
// Server-side risk scoring for submitted assessments.
// Assessments arrive in two answer formats; both are scored into the same
// risk-register shape (1–25 scale) so the dashboard, compliance reports,
// exports and webhooks treat every respondent alike.
//
// Mobile app (nested modules, e.g. { procurement: { q1: 'never' } }):
//   Port of calculateRiskScore in apps/fra-mobile-app/utils/assessment.ts.
//   inherent = impact × likelihood; residual = round(inherent × (1 − control reduction))
//
// Web dashboard (flat question ids, e.g. { 'procurement.controlMaturity': 2 }):
//   Scored by risk-scoring.ts (0–100 per module, the result the respondent sees),
//   then placed on the 1–25 scale band by band so the web engine's
//   High / Medium / Low always lands in the register's HIGH / MEDIUM / LOW.
//
// Register priority: high ≥ 15, medium ≥ 8, low < 8.
// The server recomputes from answers rather than trusting a client-sent register.
// ============================================================

import type { Assessment } from './types.js';
import { calculateRiskScore, type RiskScoringInput } from './risk-scoring.js';
import { ASSESSMENT_MODULES, answersToRiskInput } from './assessment-modules.js';

export type RiskPriority = 'high' | 'medium' | 'low';

export type ScoredRisk = {
  id: string;
  title: string;
  area: string;
  description: string;
  inherentScore: number;
  residualScore: number;
  priority: RiskPriority;
  suggestedOwner: string;
};

export type AssessmentRisk = {
  /** Highest priority among identified risks; null when the answers cannot be scored */
  level: RiskPriority | null;
  risks: ScoredRisk[];
  counts: Record<RiskPriority, number>;
  /** Which answer format was scored */
  format: 'mobile' | 'web' | null;
};

type Answers = Record<string, unknown>;

const EMPTY: AssessmentRisk = { level: null, risks: [], counts: { high: 0, medium: 0, low: 0 }, format: null };

// One risk per assessment area, shared by both formats so they aggregate together
const AREA_RISKS = {
  procurement: { title: 'Supplier fraud', area: 'Procurement', owner: 'Head of Procurement', description: 'Weak procurement controls may allow fraudulent supplier relationships or inflated invoicing.' },
  cashBanking: { title: 'Cash misappropriation', area: 'Cash & Banking', owner: 'Finance Manager', description: 'Insufficient cash handling controls increase risk of theft or misappropriation.' },
  payrollHR: { title: 'Payroll fraud', area: 'Payroll & HR', owner: 'HR Manager', description: 'Weak payroll controls may enable ghost employees or timesheet manipulation.' },
  revenue: { title: 'Revenue leakage', area: 'Revenue', owner: 'Finance Director', description: 'Poor revenue controls may lead to unrecorded income or fee manipulation.' },
  itSystems: { title: 'Cyber fraud', area: 'IT Systems', owner: 'IT Lead', description: 'Weak IT access controls increase vulnerability to internal and external cyber fraud.' },
  peopleCulture: { title: 'Unreported fraud', area: 'People & Culture', owner: 'HR Director', description: 'Absence of whistleblowing mechanisms prevents detection of fraudulent activity.' },
  controlsTechnology: { title: 'Segregation of duties failure', area: 'Controls', owner: 'Chief Operating Officer', description: 'Lack of segregation allows single individuals to execute and conceal fraudulent transactions.' },
  // Web-only areas (the mobile app asks these modules but does not turn them into register risks)
  fraudTriangle: { title: 'Pressure and rationalisation', area: 'Culture', owner: 'Senior Management Team', description: 'Pressure on the organisation and a culture that excuses dishonesty make fraud more likely.' },
  trainingAwareness: { title: 'Low fraud awareness', area: 'Training', owner: 'HR / Training Lead', description: 'Staff who are not trained are less likely to recognise and report fraud.' },
  monitoringEvaluation: { title: 'Undetected fraud', area: 'Monitoring', owner: 'Internal Audit', description: 'Limited monitoring and review allow fraud to continue unnoticed.' },
  complianceMapping: { title: 'Failure to prevent fraud exposure', area: 'Governance', owner: 'Board', description: 'Gaps in reasonable procedures weaken the defence to the ECCTA 2023 failure to prevent fraud offence.' },
  fraudResponse: { title: 'Ineffective fraud response', area: 'Fraud Response', owner: 'Counter Fraud Lead', description: 'Without a plan and investigators, losses grow and recoveries fall when fraud is found.' },
} as const;

const GENERAL_RISK = { title: 'General fraud risk', area: 'Overall', owner: 'Senior Management Team', description: 'While specific indicators are limited, all organisations face some inherent fraud risk.' };

const MOBILE_MODULE_KEYS = ['fraudTriangle', 'procurement', 'cashBanking', 'payrollHR', 'revenue', 'itSystems', 'peopleCulture', 'controlsTechnology'];
const WEB_QUESTION_IDS = new Set(ASSESSMENT_MODULES.flatMap((m) => m.questions.map((q) => q.id)));

function priorityFor(score: number): RiskPriority {
  if (score >= 15) return 'high';
  if (score >= 8) return 'medium';
  return 'low';
}

function summarise(risks: ScoredRisk[], format: 'mobile' | 'web'): AssessmentRisk {
  const counts: Record<RiskPriority, number> = { high: 0, medium: 0, low: 0 };
  for (const r of risks) counts[r.priority] += 1;
  const level: RiskPriority = counts.high ? 'high' : counts.medium ? 'medium' : 'low';
  return { level, risks, counts, format };
}

const riskId = (n: number) => `FRA-${String(n).padStart(3, '0')}`;

// ── Mobile format ───────────────────────────────────────────────

function field(answers: Answers, module: string, key: string): unknown {
  const m = answers[module];
  return m && typeof m === 'object' ? (m as Record<string, unknown>)[key] : undefined;
}

const isWeak = (v: unknown) => v === 'rarely' || v === 'never';

function controlReduction(strength: unknown): number {
  if (strength === 'very-strong' || strength === 'well-separated') return 0.4;
  if (strength === 'reasonably-strong' || strength === 'partly') return 0.2;
  return 0;
}

function isMobileFormat(answers: Answers): boolean {
  return MOBILE_MODULE_KEYS.some((k) => answers[k] && typeof answers[k] === 'object');
}

function scoreMobileAnswers(answers: Answers): AssessmentRisk {
  const risks: ScoredRisk[] = [];
  const reduction = controlReduction(field(answers, 'fraudTriangle', 'controlStrength'));

  const add = (
    risk: { title: string; area: string; description: string; owner: string },
    impact: number, likelihood: number, reductionUsed: number,
  ) => {
    const inherentScore = impact * likelihood;
    const residualScore = Math.round(inherentScore * (1 - reductionUsed));
    risks.push({
      id: riskId(risks.length + 1), title: risk.title, area: risk.area, description: risk.description,
      inherentScore, residualScore, priority: priorityFor(residualScore), suggestedOwner: risk.owner,
    });
  };

  if (isWeak(field(answers, 'procurement', 'q1')) || field(answers, 'procurement', 'q2') === 'rarely') add(AREA_RISKS.procurement, 4, 4, reduction);
  if (isWeak(field(answers, 'cashBanking', 'q1'))) add(AREA_RISKS.cashBanking, 4, 3, reduction);
  if (isWeak(field(answers, 'payrollHR', 'q1'))) add(AREA_RISKS.payrollHR, 3, 3, reduction);
  if (isWeak(field(answers, 'revenue', 'q1'))) add(AREA_RISKS.revenue, 4, 3, reduction);
  if (isWeak(field(answers, 'itSystems', 'q1'))) add(AREA_RISKS.itSystems, 5, 4, reduction);
  if (field(answers, 'peopleCulture', 'whistleblowing') === 'no-formal') {
    add(AREA_RISKS.peopleCulture, 3, 4, reduction * 0.5);
  }
  const segregation = field(answers, 'controlsTechnology', 'segregation');
  if (segregation === 'one-person' || segregation === 'not-sure') {
    add(AREA_RISKS.controlsTechnology, 5, 4, 0);
  }
  if (risks.length === 0) add(GENERAL_RISK, 2, 2, reduction);

  return summarise(risks, 'mobile');
}

// ── Web format ──────────────────────────────────────────────────

function isWebFormat(answers: Answers): boolean {
  return Object.keys(answers).some((k) => WEB_QUESTION_IDS.has(k));
}

/**
 * Place a 0–100 web module score on the 1–25 register scale, band by band:
 * Low 0–44 → 1–7, Medium 45–69 → 8–14, High 70–100 → 15–25.
 */
export function webScoreToRegister(score: number): number {
  const s = Math.max(0, Math.min(100, score));
  const scale = (from: [number, number], to: [number, number]) =>
    Math.round(to[0] + ((s - from[0]) / (from[1] - from[0])) * (to[1] - to[0]));
  if (s >= 70) return scale([70, 100], [15, 25]);
  if (s >= 45) return Math.min(14, scale([45, 70], [8, 14]));
  return Math.min(7, Math.max(1, scale([0, 45], [1, 7])));
}

function scoreWebAnswers(answers: Answers): AssessmentRisk {
  const input = answersToRiskInput(answers);
  const result = calculateRiskScore(input);
  const answered = (Object.keys(input) as (keyof RiskScoringInput)[]).filter((k) => k in AREA_RISKS);

  const risks: ScoredRisk[] = [];
  for (const moduleId of answered) {
    const module = result.moduleScores[moduleId];
    if (!module || module.level === 'Low') continue; // only flagged areas become risks, as on mobile
    const risk = AREA_RISKS[moduleId as keyof typeof AREA_RISKS];
    const registerScore = webScoreToRegister(module.score);
    risks.push({
      id: riskId(risks.length + 1), title: risk.title, area: risk.area,
      description: module.impactFactors.length ? module.impactFactors.join('; ') : risk.description,
      // Control maturity is already part of the web module score, so inherent and residual match
      inherentScore: registerScore, residualScore: registerScore,
      priority: priorityFor(registerScore), suggestedOwner: risk.owner,
    });
  }
  if (risks.length === 0) {
    const registerScore = Math.min(7, webScoreToRegister(result.overallScore));
    risks.push({
      id: riskId(1), title: GENERAL_RISK.title, area: GENERAL_RISK.area, description: GENERAL_RISK.description,
      inherentScore: registerScore, residualScore: registerScore, priority: 'low', suggestedOwner: GENERAL_RISK.owner,
    });
  }
  return summarise(risks, 'web');
}

// ── Public API ──────────────────────────────────────────────────

/** True when the answers are in either assessment app's format. */
export function isScorable(answers: Answers): boolean {
  return isMobileFormat(answers) || isWebFormat(answers);
}

export function scoreAnswers(answers: Answers): AssessmentRisk {
  if (isMobileFormat(answers)) return scoreMobileAnswers(answers);
  if (isWebFormat(answers)) return scoreWebAnswers(answers);
  return EMPTY;
}

const isFinished = (a: Assessment) => a.status === 'submitted' || a.status === 'completed';

/** Risk for a submitted assessment; drafts are not scored. */
export function scoreAssessment(a: Assessment): AssessmentRisk {
  if (!isFinished(a)) return EMPTY;
  // The result saved at submission wins, so a later change to the method never rewrites it
  return a.result?.risk ?? scoreAnswers(a.answers);
}

/** The latest submitted assessment for each user. */
export function latestSubmittedByUser(assessments: Assessment[]): Map<string, Assessment> {
  const latest = new Map<string, Assessment>();
  for (const a of assessments) {
    if (!isFinished(a)) continue;
    const current = latest.get(a.createdByUserId);
    const when = a.submittedAt ?? a.updatedAt;
    if (!current || when > (current.submittedAt ?? current.updatedAt)) latest.set(a.createdByUserId, a);
  }
  return latest;
}
