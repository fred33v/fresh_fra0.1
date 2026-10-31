// ============================================================
// Enterprise: turn what the fraud risk assessments found into risk register
// entries, so an organisation that moves up from Starter or Professional
// starts its register from its own results instead of a blank page.
// ============================================================

import type { Assessment, ControlEffectiveness, RiskRegisterEntry } from './types.js';
import { latestSubmittedByUser, scoreAssessment, type ScoredRisk } from './assessment-risk.js';
import { AREA_TO_REGISTER } from './compliance-evidence.js';

export type RegisterSuggestion = {
  title: string;
  riskArea: string;
  description: string;
  impact: number;
  likelihood: number;
  controlEffectiveness: ControlEffectiveness;
  priority: 'high' | 'medium';
  /** How many people's latest assessment raised it */
  raisedBy: number;
  assessedAt: string;
};

const clamp = (n: number) => Math.min(5, Math.max(1, Math.round(n)));

/** Impact × likelihood that gives (about) the inherent score, and the control level that gives the residual. */
function toRegisterScale(r: ScoredRisk): Pick<RegisterSuggestion, 'impact' | 'likelihood' | 'controlEffectiveness'> {
  const impact = clamp(Math.ceil(r.inherentScore / 5));
  const likelihood = clamp(r.inherentScore / impact);
  const reduction = r.inherentScore > 0 ? 1 - r.residualScore / r.inherentScore : 0;
  const controlEffectiveness: ControlEffectiveness = reduction >= 0.35 ? 'very_strong' : reduction >= 0.15 ? 'reasonably_strong' : 'some_gaps';
  return { impact, likelihood, controlEffectiveness };
}

/**
 * High and medium risks from each person's latest submitted assessment, one per risk
 * title (the highest residual wins), leaving out titles already in the register.
 */
export function registerSuggestions(assessments: Assessment[], register: RiskRegisterEntry[]): RegisterSuggestion[] {
  const existing = new Set(register.map((r) => r.title.trim().toLowerCase()));
  const best = new Map<string, { risk: ScoredRisk; count: number; at: string }>();
  for (const a of latestSubmittedByUser(assessments).values()) {
    for (const risk of scoreAssessment(a).risks) {
      if (risk.priority === 'low' || !AREA_TO_REGISTER[risk.area]) continue;
      const key = risk.title.trim().toLowerCase();
      if (existing.has(key)) continue;
      const at = a.submittedAt ?? a.updatedAt;
      const seen = best.get(key);
      if (!seen) best.set(key, { risk, count: 1, at });
      else best.set(key, { risk: risk.residualScore > seen.risk.residualScore ? risk : seen.risk, count: seen.count + 1, at: at > seen.at ? at : seen.at });
    }
  }
  return [...best.values()]
    .sort((x, y) => y.risk.residualScore - x.risk.residualScore)
    .map(({ risk, count, at }) => ({
      title: risk.title,
      riskArea: AREA_TO_REGISTER[risk.area],
      description: `${risk.description} (Found by the fraud risk assessment${count > 1 ? `, raised by ${count} people` : ''}.)`,
      ...toRegisterScale(risk),
      priority: risk.priority as 'high' | 'medium',
      raisedBy: count,
      assessedAt: at,
    }));
}
