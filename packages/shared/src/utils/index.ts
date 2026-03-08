import { RISK_SCORES, CONTROL_REDUCTIONS } from '../constants';

/**
 * Calculate inherent risk score (impact x likelihood), clamped between 1 and 25.
 * @param impact - The impact score (typically 1-5).
 * @param likelihood - The likelihood score (typically 1-5).
 * @returns The inherent risk score, clamped to the range [1, 25].
 */
export function calculateInherentRisk(impact: number, likelihood: number): number {
  return Math.min(25, Math.max(1, impact * likelihood));
}

/**
 * Calculate residual risk score after applying a control strength reduction.
 * @param inherentRisk - The inherent risk score before control adjustment.
 * @param controlStrength - The strength of the control (e.g. 'VERY_STRONG', 'REASONABLY_STRONG', 'SOME_GAPS', 'WEAK').
 * @returns The residual risk score, rounded to the nearest integer.
 */
export function calculateResidualRisk(
  inherentRisk: number,
  controlStrength: keyof typeof CONTROL_REDUCTIONS
): number {
  const reduction = CONTROL_REDUCTIONS[controlStrength];
  return Math.round(inherentRisk * (1 - reduction));
}

/**
 * Get the risk priority band from a numeric risk score.
 * @param score - The risk score to classify.
 * @returns 'HIGH' if score >= 15, 'MEDIUM' if score >= 8, otherwise 'LOW'.
 */
export function getRiskPriority(score: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score >= RISK_SCORES.HIGH.min) return 'HIGH';
  if (score >= RISK_SCORES.MEDIUM.min) return 'MEDIUM';
  return 'LOW';
}

/**
 * Format a date to UK format (DD/MM/YYYY).
 * @param date - A Date object or an ISO date string to format.
 * @returns The formatted date string in en-GB locale, or 'Invalid date' if the input cannot be parsed.
 */
export function formatDateUK(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid date';
  return d.toLocaleDateString('en-GB');
}

/**
 * Generate a unique key-pass code using crypto.randomUUID for better uniqueness.
 * @param prefix - The prefix for the code. Defaults to 'FRA'.
 * @returns A string in the format `{prefix}-{timestamp}-{random}`.
 */
export function generateKeyPassCode(prefix = 'FRA'): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomUUID().slice(0, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Validate whether a string is a properly formatted email address.
 * @param email - The email string to validate.
 * @returns True if the email matches the validation pattern, false otherwise.
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * Calculate the completion percentage of assessment modules.
 * @param completedModules - An array of completed module identifiers.
 * @param totalModules - The total number of modules.
 * @returns The completion percentage (0-100), rounded to the nearest integer. Returns 0 if totalModules is 0.
 */
export function calculateCompletionPercentage(
  completedModules: string[],
  totalModules: number
): number {
  if (totalModules === 0) return 0;
  return Math.round((completedModules.length / totalModules) * 100);
}

/**
 * Sanitize a string for safe HTML display by escaping special characters.
 * @param str - The string to sanitize.
 * @returns The sanitized string with <, >, ", and ' escaped to their HTML entities.
 */
export function sanitizeString(str: string): string {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
