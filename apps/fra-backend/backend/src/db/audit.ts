import { getDbPool } from '../db.js';
import { hasDatabase } from '../helpers.js';
import { createLogger } from '../logger.js';

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
}): Promise<void> {
  if (!hasDatabase()) return; // skip in test / no-db mode
  try {
    const pool = getDbPool();
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
    // Audit log failures must not break the request, but should be logged
    logger.error('Failed to write audit log', { eventType: event.eventType, error: String(err) });
  }
}
