import type { DbExecutor } from './transaction.js';
import { getDbPool } from '../db.js';
import { hasDatabase } from '../helpers.js';
import { createLogger } from '../logger.js';
import { auditEvents, AUDIT_EVENTS_MAX } from '../stores.js';

const logger = createLogger('audit');

export async function auditLog(event: {
  eventType: string;
  actorId?: string;
  actorEmail?: string;
  organisationId?: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}, db?: DbExecutor): Promise<void> {
  if (!hasDatabase()) {
    auditEvents.push({
      id: crypto.randomUUID(), eventType: event.eventType, actorId: event.actorId, actorEmail: event.actorEmail,
      organisationId: event.organisationId, resourceType: event.resourceType, resourceId: event.resourceId,
      details: event.details ?? {}, ipAddress: event.ipAddress, createdAt: new Date().toISOString(),
    });
    if (auditEvents.length > AUDIT_EVENTS_MAX) auditEvents.shift();
    return;
  }
  try {
    const pool = db ?? getDbPool();
    await pool.query(
      'insert into public.audit_logs (event_type, actor_id, actor_email, organisation_id, resource_type, resource_id, details, ip_address, user_agent) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [
        event.eventType,
        event.actorId ?? null, event.actorEmail ?? null, event.organisationId ?? null,
        event.resourceType ?? null, event.resourceId ?? null,
        event.details ?? {}, event.ipAddress ?? null, event.userAgent ?? null,
      ]
    );
  } catch (err: unknown) {
    // An explicit transaction must roll back if its required audit cannot be stored.
    if (db) throw err;
    // Standalone audit remains best effort for existing callers.
    logger.error('Failed to write audit log', { eventType: event.eventType, error: String(err) });
  }
}
