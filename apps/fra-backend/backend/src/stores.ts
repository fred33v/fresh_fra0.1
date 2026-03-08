import type { User, Assessment, Organisation, Purchase, Keypass } from './types.js';

// In-memory fallbacks (used only when DATABASE_URL is not set, e.g. tests)
export const usersByEmail = new Map<string, User>();
export const refreshTokenAllowlist = new Set<string>();
export const passwordResetTokens = new Map<
  string,
  {
    userId: string;
    expiresAt: number;
  }
>();

export const assessmentsById = new Map<string, Assessment>();
export const organisationsById = new Map<string, Organisation>();
export const purchasesById = new Map<string, Purchase>();
export const keypassesByCode = new Map<string, Keypass>();

export const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

// In-memory account lockout fallback (used when Redis is unavailable)
export const accountLockouts = new Map<string, { count: number; expiresAt: number }>();

// ── Periodic cleanup for in-memory stores ────────────────────────

function cleanupExpiredEntries() {
  const now = Date.now();

  for (const [key, entry] of passwordResetTokens) {
    if (entry.expiresAt < now) passwordResetTokens.delete(key);
  }

  for (const [key, bucket] of rateLimitBuckets) {
    if (bucket.resetAt < now) rateLimitBuckets.delete(key);
  }

  for (const [key, entry] of accountLockouts) {
    if (entry.expiresAt < now) accountLockouts.delete(key);
  }

  // Clean up expired keypasses (past expiry + 7-day grace period)
  const graceMs = 7 * 24 * 60 * 60 * 1000;
  for (const [, kp] of keypassesByCode) {
    if (kp.status !== 'available') continue;
    const graceEnd = new Date(kp.expiresAt).getTime() + graceMs;
    if (graceEnd < now) {
      kp.status = 'expired';
    }
  }
}

// Run cleanup every 5 minutes
const cleanupInterval = setInterval(cleanupExpiredEntries, 5 * 60 * 1000);
cleanupInterval.unref?.();
