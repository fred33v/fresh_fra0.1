import type { Entitlements } from '@/hooks/useEntitlements';

/** "1 assessment included", "3 of 4 assessments left this year", "Unlimited assessments" */
export function describeAllowance(a: Entitlements['assessments']): string {
  if (a.limit === null) return 'Unlimited assessments';
  const left = Math.max(a.limit - a.used, 0);
  if (a.limit === 1) return left ? '1 assessment included' : 'Your included assessment has been used';
  return `${left} of ${a.limit} assessments left this year`;
}
