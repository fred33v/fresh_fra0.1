// ============================================================
// Quarterly reassessment reminders (ECCTA principle 6, monitoring and review).
// Professional and Enterprise include reassessment every quarter; this works
// out when each organisation is next due and, once a day, sends one reminder
// as the date approaches and one if it passes. Reminders go to the audit
// trail and, for Enterprise, to the organisation's `reassessment.due` webhooks
// (which can drive email through an automation tool such as n8n).
// ============================================================

import { hasDatabase, getActiveTier, PACKAGE_TIER } from './helpers.js';
import { assessmentsById, purchasesById, reassessmentRemindersSent } from './stores.js';
import { getDbPool } from './db.js';
import { auditLog, dbListAssessmentsByOrganisation } from './db/index.js';
import { listOrgPurchases } from './entitlements.js';
import { emitOrgEvent } from './webhooks-out.js';
import { createLogger } from './logger.js';
import type { Assessment, Purchase } from './types.js';

const logger = createLogger('reassessment');

export const REASSESSMENT_INTERVAL_DAYS = 90;
/** A reminder goes out this many days before the due date. */
export const DUE_SOON_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export type ReassessmentState = 'not_applicable' | 'not_started' | 'ok' | 'due_soon' | 'overdue';

export type ReassessmentStatus = {
  status: ReassessmentState;
  intervalDays: number;
  lastAssessedAt: string | null;
  dueAt: string | null;
  daysUntilDue: number | null;
};

/** Quarterly reassessment is part of Professional and Enterprise. */
const includesReassessment = (purchases: Purchase[], now: Date) => getActiveTier(purchases, now) >= PACKAGE_TIER.pkg_training;

export function reassessmentStatus(purchases: Purchase[], assessments: Assessment[], now: Date = new Date()): ReassessmentStatus {
  const base = { intervalDays: REASSESSMENT_INTERVAL_DAYS, lastAssessedAt: null, dueAt: null, daysUntilDue: null };
  if (!includesReassessment(purchases, now)) return { ...base, status: 'not_applicable' };

  const lastAssessedAt = assessments
    .filter((a) => a.status === 'submitted' || a.status === 'completed')
    .map((a) => a.submittedAt ?? a.updatedAt)
    .sort()
    .at(-1) ?? null;
  if (!lastAssessedAt) return { ...base, status: 'not_started' };

  const due = new Date(new Date(lastAssessedAt).getTime() + REASSESSMENT_INTERVAL_DAYS * DAY_MS);
  const daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / DAY_MS);
  const status: ReassessmentState = daysUntilDue < 0 ? 'overdue' : daysUntilDue <= DUE_SOON_DAYS ? 'due_soon' : 'ok';
  return { ...base, status, lastAssessedAt, dueAt: due.toISOString(), daysUntilDue };
}

async function orgAssessments(orgId: string): Promise<Assessment[]> {
  return hasDatabase()
    ? dbListAssessmentsByOrganisation(orgId)
    : Array.from(assessmentsById.values()).filter((a) => a.organisationId === orgId);
}

export async function organisationReassessmentStatus(orgId: string, now: Date = new Date()): Promise<ReassessmentStatus> {
  const [purchases, assessments] = await Promise.all([listOrgPurchases(orgId), orgAssessments(orgId)]);
  return reassessmentStatus(purchases, assessments, now);
}

/** Organisations that have ever paid; the status check filters to those with reassessment included. */
async function payingOrganisations(): Promise<string[]> {
  if (hasDatabase()) {
    const res = await getDbPool().query<{ organisation_id: string }>(
      "SELECT DISTINCT organisation_id FROM public.purchases WHERE status = 'succeeded'");
    return res.rows.map((r) => r.organisation_id);
  }
  return Array.from(new Set(Array.from(purchasesById.values()).filter((p) => p.status === 'succeeded').map((p) => p.organisationId)));
}

/** Records a reminder; false if it was already sent for this due date. */
async function claimReminder(orgId: string, dueDate: string, kind: 'due_soon' | 'overdue'): Promise<boolean> {
  if (hasDatabase()) {
    const res = await getDbPool().query(
      `INSERT INTO public.reassessment_reminders (organisation_id, due_date, kind) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`, [orgId, dueDate, kind]);
    return (res.rowCount ?? 0) > 0;
  }
  const key = `${orgId}:${dueDate}:${kind}`;
  if (reassessmentRemindersSent.has(key)) return false;
  reassessmentRemindersSent.add(key);
  return true;
}

/** Sends any reminders now due. Returns how many were sent. */
export async function runReassessmentReminders(now: Date = new Date()): Promise<number> {
  let sent = 0;
  for (const orgId of await payingOrganisations()) {
    try {
      const s = await organisationReassessmentStatus(orgId, now);
      if (s.status !== 'due_soon' && s.status !== 'overdue') continue;
      const dueDate = s.dueAt!.slice(0, 10);
      if (!(await claimReminder(orgId, dueDate, s.status))) continue;

      const data = { status: s.status, dueAt: s.dueAt, lastAssessedAt: s.lastAssessedAt, daysUntilDue: s.daysUntilDue };
      await auditLog({ eventType: `reassessment.${s.status}`, organisationId: orgId, resourceType: 'reassessment', details: data });
      await emitOrgEvent(orgId, 'reassessment.due', data);
      sent += 1;
    } catch (err: unknown) {
      logger.error('Reassessment reminder failed', { orgId, error: err instanceof Error ? err.message : String(err) });
    }
  }
  if (sent) logger.info(`Sent ${sent} reassessment reminder(s)`);
  return sent;
}

/** Milliseconds from `now` until the next 08:00 UTC. */
export function msUntilReminderRun(now: Date = new Date()): number {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8, 0, 0, 0));
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
}

/** Runs the reminders every day at 08:00 UTC. Returns a function that stops the schedule. */
export function scheduleReassessmentReminders(): () => void {
  let timer: NodeJS.Timeout;
  const arm = () => {
    timer = setTimeout(async () => {
      await runReassessmentReminders().catch((err: unknown) =>
        logger.error('Reassessment reminder run failed', { error: err instanceof Error ? err.message : String(err) }));
      arm();
    }, msUntilReminderRun());
    timer.unref();
  };
  arm();
  logger.info('Reassessment reminders scheduled daily at 08:00 UTC');
  return () => clearTimeout(timer);
}
