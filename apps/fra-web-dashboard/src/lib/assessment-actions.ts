import type { AssessmentResults } from '@/types/assessment';
import type { ActionItem } from '@/types/workshop';

/** The id prefix of plan actions that come from the assessment, so they are added only once. */
export const ASSESSMENT_ACTION_PREFIX = 'assessment-';

/**
 * One action per high or medium risk area found by the fraud risk assessment, highest first:
 * what the organisation found in package 1 becomes the first things to do in package 2.
 */
export function actionsFromAssessment(results: AssessmentResults | null): ActionItem[] {
  if (!results) return [];
  return results.modules
    .filter((m) => m.level === 'High' || m.level === 'Medium')
    .sort((a, b) => b.score - a.score)
    .map((m) => ({
      id: `${ASSESSMENT_ACTION_PREFIX}${m.id}`,
      title: `Reduce the ${m.title.toLowerCase()} fraud risk your assessment found (${m.level.toLowerCase()}, ${m.score}/100)`,
      description: m.impactFactors.length ? `What the assessment found: ${m.impactFactors.join('; ')}.` : '',
      priority: m.level === 'High' ? 'high' as const : 'medium' as const,
      timeframe: m.level === 'High' ? 'Immediate' : '30 Days',
      completed: false,
    }));
}

/** The assessment actions not yet in the plan. */
export function missingAssessmentActions(items: ActionItem[], results: AssessmentResults | null): ActionItem[] {
  const have = new Set(items.map((i) => i.id));
  return actionsFromAssessment(results).filter((a) => !have.has(a.id));
}
