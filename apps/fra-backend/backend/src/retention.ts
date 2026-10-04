// Data retention policy (docs/COMPLIANCE.md → Data Retention Policy).
// Fraud records are kept 6 years (GovS-013, ECCTA), payment records 7 years (UK tax law),
// operational data 2 years and session data 90 days. Records still in use — open risks,
// unresolved incidents, unexpired key-passes — are never removed.
//
// Deletion is permanent, so the daily job runs as a dry run (counts only) unless
// RETENTION_ENABLED=true is set for the environment.
import { getDbPool } from './db.js';
import { hasDatabase } from './helpers.js';
import { auditLog } from './db/audit.js';
import { createLogger } from './logger.js';

const logger = createLogger('retention');

export interface RetentionRule {
  table: string;
  /** What the rule removes, for logs and the audit trail. */
  label: string;
  /** Postgres interval for how long the record is kept. */
  keepFor: string;
  /** SQL condition; `$1` is the cut-off timestamp (now minus keepFor). */
  expiredWhen: string;
}

export const RETENTION_RULES: RetentionRule[] = [
  { table: 'public.assessments', label: 'Fraud assessments', keepFor: '6 years', expiredWhen: 'updated_at < $1' },
  { table: 'public.audit_logs', label: 'Audit logs', keepFor: '6 years', expiredWhen: 'created_at < $1' },
  {
    table: 'public.risk_register', label: 'Closed risk register items', keepFor: '6 years',
    expiredWhen: "status IN ('mitigated', 'accepted', 'closed') AND updated_at < $1",
  },
  { table: 'compliance_incidents', label: 'Resolved incidents', keepFor: '6 years', expiredWhen: 'resolved_at IS NOT NULL AND resolved_at < $1' },
  {
    // Strategies, policies and investigator arrangements stay until someone removes them
    table: 'public.counter_fraud_records', label: 'Loss, detection, gifts and ended conflict records', keepFor: '6 years',
    expiredWhen: "updated_at < $1 AND (kind IN ('loss', 'detection', 'gift_hospitality') OR (kind = 'conflict_of_interest' AND data->>'status' = 'ended'))",
  },
  // Messages go with their case (ON DELETE CASCADE); open cases are never removed
  { table: 'public.speak_up_reports', label: 'Closed speak-up cases', keepFor: '6 years', expiredWhen: "status = 'closed' AND closed_at < $1" },
  { table: 'public.purchases', label: 'Payment records', keepFor: '7 years', expiredWhen: 'created_at < $1' },
  { table: 'public.keypasses', label: 'Expired key-passes', keepFor: '2 years', expiredWhen: 'expires_at < $1' },
  { table: 'public.workshop_feedback', label: 'Workshop feedback', keepFor: '2 years', expiredWhen: 'created_at < $1' },
  { table: 'public.refresh_tokens', label: 'Session tokens', keepFor: '90 days', expiredWhen: 'created_at < $1' },
];

export interface RetentionResult {
  dryRun: boolean;
  ranAt: string;
  rules: { table: string; label: string; keepFor: string; count: number; error?: string }[];
}

export function retentionEnabled(): boolean {
  return process.env.RETENTION_ENABLED === 'true';
}

/** Counts (dry run) or deletes every record past its retention period. */
export async function runRetention(options: { dryRun?: boolean; now?: Date } = {}): Promise<RetentionResult> {
  const dryRun = options.dryRun ?? !retentionEnabled();
  const now = options.now ?? new Date();
  const result: RetentionResult = { dryRun, ranAt: now.toISOString(), rules: [] };
  if (!hasDatabase()) return result;

  const pool = getDbPool();
  for (const rule of RETENTION_RULES) {
    try {
      // The cut-off is computed in SQL so "6 years" follows the calendar, leap years included
      const cutoff = await pool.query<{ cutoff: string }>('SELECT ($1::timestamptz - $2::interval) AS cutoff', [result.ranAt, rule.keepFor]);
      const params = [cutoff.rows[0].cutoff];
      const sql = dryRun
        ? `SELECT count(*)::int AS n FROM ${rule.table} WHERE ${rule.expiredWhen}`
        : `DELETE FROM ${rule.table} WHERE ${rule.expiredWhen}`;
      const res = await pool.query<{ n: number }>(sql, params);
      const count = dryRun ? res.rows[0]?.n ?? 0 : res.rowCount ?? 0;
      result.rules.push({ table: rule.table, label: rule.label, keepFor: rule.keepFor, count });
    } catch (err: unknown) {
      // One failing table (e.g. not yet migrated) must not stop the others
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Retention rule failed for ${rule.table}`, { error: message });
      result.rules.push({ table: rule.table, label: rule.label, keepFor: rule.keepFor, count: 0, error: message });
    }
  }

  const total = result.rules.reduce((s, r) => s + r.count, 0);
  logger.info(`${dryRun ? 'Dry run: would delete' : 'Deleted'} ${total} record(s) past retention`, { rules: result.rules });
  await auditLog({
    eventType: dryRun ? 'retention.dry_run' : 'retention.run',
    resourceType: 'retention',
    details: { total, rules: result.rules },
  });
  return result;
}

/** Milliseconds from `now` until the next 02:00 UTC. */
export function msUntilNextRun(now: Date = new Date()): number {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 2, 0, 0, 0));
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

/** Runs the retention job every day at 02:00 UTC. Returns a function that stops the schedule. */
export function scheduleRetention(): () => void {
  let timer: NodeJS.Timeout;
  const arm = () => {
    timer = setTimeout(async () => {
      try {
        await runRetention();
      } catch (err: unknown) {
        logger.error('Retention job failed', { error: err instanceof Error ? err.message : String(err) });
      }
      arm();
    }, msUntilNextRun());
    timer.unref();
  };
  arm();
  logger.info(`Data retention scheduled daily at 02:00 UTC (${retentionEnabled() ? 'deleting' : 'dry run; set RETENTION_ENABLED=true to delete'})`);
  return () => clearTimeout(timer);
}
