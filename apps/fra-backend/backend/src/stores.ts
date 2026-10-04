import type { User, Assessment, Organisation, Purchase, Keypass, ApiKey, RiskRegisterEntry, WebhookEndpoint, ComplianceIncident, SeniorManager, AuditEvent } from './types.js';
import type { CounterFraudRecord } from './counter-fraud.js';
import type { SpeakUpIntake, SpeakUpMessage, SpeakUpReport } from './speak-up.js';

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

// ── Enterprise integrations (in-memory fallbacks) ────────────────
export const apiKeysById = new Map<string, ApiKey>();
export const riskRegisterById = new Map<string, RiskRegisterEntry>();
export const webhookEndpointsById = new Map<string, WebhookEndpoint>();
export const incidentsById = new Map<string, ComplianceIncident>();
export const seniorManagersById = new Map<string, SeniorManager>();
export const counterFraudRecordsById = new Map<string, CounterFraudRecord>();
export const speakUpIntakeByOrg = new Map<string, SpeakUpIntake>();
export const speakUpReportsById = new Map<string, SpeakUpReport>();
export const speakUpMessages: SpeakUpMessage[] = [];

// Bounded audit log for no-database mode (the database keeps the full history)
export const auditEvents: AuditEvent[] = [];
export const AUDIT_EVENTS_MAX = 5000;
