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

/**
 * Validate password strength requirements.
 * @param password - The password to validate.
 * @returns Object with isValid flag and strength details (8+ chars, uppercase, lowercase, number, special char).
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  score: number;
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
  };
} {
  const requirements = {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  const score = Object.values(requirements).filter(Boolean).length;
  const isValid = Object.values(requirements).every(Boolean);

  return { isValid, score, requirements };
}

/**
 * Generate a SHA-256 hash of a string (for non-cryptographic uses).
 * Uses WebCrypto API available in Node 15+ and modern browsers.
 * @param str - The string to hash.
 * @returns A promise that resolves to the hexadecimal hash string.
 */
export async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Decode and parse a JWT token (for basic info extraction only, does NOT verify signature).
 * WARNING: This does NOT verify the signature. Use only for extracting claims before verification.
 * @param token - The JWT token string.
 * @returns Object with header, payload, and signature, or null if invalid format.
 */
export function parseJWT(token: string): {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
} | null {
  try {
    const [headerB64, payloadB64, signature] = token.split('.');
    if (!headerB64 || !payloadB64 || !signature) return null;

    const header = JSON.parse(atob(headerB64));
    const payload = JSON.parse(atob(payloadB64));

    return { header, payload, signature };
  } catch {
    return null;
  }
}

/**
 * Format a currency value to GBP string (£).
 * @param amount - The amount in pounds.
 * @param decimals - Number of decimal places (default 2).
 * @returns The formatted currency string (e.g., '£1,234.50').
 */
export function formatCurrencyGBP(amount: number, decimals = 2): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Generate a UUID v4 using crypto.randomUUID().
 * @returns A UUID v4 string.
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

export * from './keypass';
