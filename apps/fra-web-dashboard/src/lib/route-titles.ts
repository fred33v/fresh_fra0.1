const SITE = 'Risk Aware';

// First match wins, so list the specific paths before the general ones
const TITLES: [RegExp, string][] = [
  [/^\/auth\b/, 'Sign in or create an account'],
  [/^\/join\b/, 'Join your organisation'],
  [/^\/dashboard\b/, 'Your dashboard'],
  [/^\/workshop\b/, 'Workshop'],
  [/^\/assessment\/[^/]+\/results\b/, 'Assessment results'],
  [/^\/assessment\b/, 'Risk assessment'],
  [/^\/budget-guide\b/, 'Budget guide'],
  [/^\/resources\b/, 'Resources'],
  [/^\/tools\/self-assessment\b/, 'Self-assessment checklist'],
  [/^\/tools\/roadmap\b/, '90-day roadmap'],
  [/^\/certificate\/verify\b/, 'Verify a certificate'],
  [/^\/certificate\b/, 'Your certificate'],
  [/^\/action-plan\b/, 'Your action plan'],
  [/^\/budget-holder\b/, 'Budget holder programme'],
  [/^\/package\/starter\b/, 'Starter package'],
  [/^\/package\/professional\b/, 'Professional package'],
  [/^\/package\/enterprise\b/, 'Enterprise package'],
  [/^\/checkout\/complete\b/, 'Payment complete'],
  [/^\/checkout\b/, 'Checkout'],
  [/^\/privacy\b/, 'Privacy notice'],
  [/^\/terms\b/, 'Terms of service'],
  [/^\/accessibility\b/, 'Accessibility statement'],
  [/^\/facilitator\b/, 'Facilitator'],
  [/^\/employer\b/, 'Organisation dashboard'],
  [/^\/risk-register\b/, 'Risk register'],
  [/^\/compliance\b/, 'Compliance'],
  [/^\/integrations\b/, 'Integrations'],
  [/^\/profile\b/, 'Your profile'],
  [/^\/speak-up\b/, 'Speak up'],
];

/** The tab title for a path: "Checkout — Risk Aware". The home page and unknown pages keep a plain title. */
export function titleForPath(pathname: string): string {
  if (pathname === '/') return `${SITE} — Fraud Risk Assessment Platform`;
  const match = TITLES.find(([re]) => re.test(pathname));
  return match ? `${match[1]} — ${SITE}` : `Page not found — ${SITE}`;
}

