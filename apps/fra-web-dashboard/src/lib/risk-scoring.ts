// Risk register scoring — mirrors apps/fra-backend/backend/src/routes/risk-register.ts
// inherent = impact × likelihood; residual = round(inherent × (1 − control reduction))

export type ControlEffectiveness = 'very_strong' | 'reasonably_strong' | 'some_gaps' | 'weak' | 'none';
export type Priority = 'HIGH' | 'MEDIUM' | 'LOW';

const CONTROL_REDUCTION: Record<ControlEffectiveness, number> = {
  very_strong: 0.4, reasonably_strong: 0.2, some_gaps: 0, weak: 0, none: 0,
};

export function scoreRisk(impact: number, likelihood: number, control: ControlEffectiveness) {
  const inherentScore = impact * likelihood;
  const residualScore = Math.round(inherentScore * (1 - CONTROL_REDUCTION[control]));
  const priority: Priority = residualScore >= 15 ? 'HIGH' : residualScore >= 8 ? 'MEDIUM' : 'LOW';
  return { inherentScore, residualScore, priority };
}
