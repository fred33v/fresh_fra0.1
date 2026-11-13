import crypto from 'node:crypto';
import { getDbPool } from './db.js';
import { withTransaction, type DbExecutor } from './db/transaction.js';
import { auditLog, dbListWebhookEndpoints } from './db/index.js';
import { listOrgPurchases } from './entitlements.js';
import { hasDatabase, hasPackageEntitlement, isManagerRole, type AuthContext } from './helpers.js';
import { createLogger } from './logger.js';
import {
  deliverOnce,
  validateWebhookUrl,
  RETRY_DELAYS_MS,
  type WebhookPayload,
} from './webhook-transport.js';
const logger = createLogger('webhook-deliveries');

export async function enqueueWebhookPayload(
  endpointId: string,
  payload: WebhookPayload,
  db: DbExecutor
): Promise<void> {
  await db.query(
    `INSERT INTO public.webhook_deliveries(id,event_id,endpoint_id,organisation_id,payload)
    VALUES($1,$2,$3,$4,$5) ON CONFLICT(event_id,endpoint_id) DO NOTHING`,
    [crypto.randomUUID(), payload.id, endpointId, payload.organisationId, payload]
  );
}

export function deliveryOutcome(
  status: number,
  attempts: number
): { status: 'pending' | 'delivered' | 'dead'; delayMs: number } {
  if (status >= 200 && status < 300) return { status: 'delivered', delayMs: 0 };
  const delayMs = RETRY_DELAYS_MS[attempts - 1];
  if (delayMs === undefined || (status >= 400 && status < 500 && status !== 429))
    return { status: 'dead', delayMs: 0 };
  return { status: 'pending', delayMs };
}
type Job = {
  id: string;
  endpoint_id: string;
  organisation_id: string;
  payload: WebhookPayload;
  attempts: number;
  cycle_attempts: number;
  lease_token: string;
};
async function claim(endpointId?: string): Promise<Job | null> {
  const result = await getDbPool().query<Job>(
    `WITH due AS (
    SELECT id FROM public.webhook_deliveries WHERE ($1::uuid IS NULL OR endpoint_id=$1)
      AND ((status='pending' AND next_attempt_at<=now()) OR (status='delivering' AND leased_until<=now()))
    ORDER BY next_attempt_at,created_at,id FOR UPDATE SKIP LOCKED LIMIT 1
  ) UPDATE public.webhook_deliveries d SET status='delivering',attempts=d.attempts+1,cycle_attempts=d.cycle_attempts+1,
    lease_token=$2,leased_until=now()+interval '30 seconds'
    FROM due WHERE d.id=due.id RETURNING d.*`,
    [endpointId ?? null, crypto.randomUUID()]
  );
  return result.rows[0] ?? null;
}
async function finish(
  job: Job,
  status: 'pending' | 'delivered' | 'dead' | 'cancelled',
  httpStatus: number | null,
  error: string | null,
  delayMs = 0
): Promise<void> {
  await withTransaction(async (db) => {
    const result = await db.query(
      `UPDATE public.webhook_deliveries SET status=$3,last_status=$4,last_error=$5,
      next_attempt_at=now()+($6::double precision*interval '1 millisecond'),lease_token=NULL,leased_until=NULL,
      completed_at=CASE WHEN $3='pending' THEN NULL ELSE now() END
      WHERE id=$1 AND lease_token=$2 AND status='delivering'`,
      [job.id, job.lease_token, status, httpStatus, error, delayMs]
    );
    // A stale worker must not overwrite either the recovered job or endpoint summary.
    if (result.rowCount && httpStatus !== null)
      await db.query(
        'UPDATE public.webhook_endpoints SET last_delivery_at=now(),last_delivery_status=$2 WHERE id=$1 AND organisation_id=$3',
        [job.endpoint_id, httpStatus, job.organisation_id]
      );
  });
}
/** One bounded pass; endpoint filtering is useful for scoped operation and isolated integration tests. */
export async function drainWebhookDeliveries(
  limit = 10,
  endpointId?: string,
  shouldStop: () => boolean = () => false
): Promise<number> {
  if (!hasDatabase()) return 0;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error('Invalid webhook batch limit');
  let processed = 0;
  for (let i = 0; i < limit; i++) {
    if (shouldStop()) break;
    const job = await claim(endpointId);
    if (!job) break;
    // Any unexpected read/ack failure leaves a lease for another worker to recover.
    const endpoint = (await dbListWebhookEndpoints(job.organisation_id)).find(
      (w) => w.id === job.endpoint_id
    );
    let cancelled: string | null = null;
    if (!endpoint) cancelled = 'endpoint_missing';
    else if (!endpoint.isActive) cancelled = 'endpoint_disabled';
    else if (!endpoint.events.includes(job.payload.type)) cancelled = 'subscription_removed';
    else if (validateWebhookUrl(endpoint.url)) cancelled = 'destination_invalid';
    else if (!hasPackageEntitlement(await listOrgPurchases(job.organisation_id), 'pkg_full'))
      cancelled = 'package_inactive';
    if (cancelled) {
      await finish(job, 'cancelled', null, cancelled);
      processed++;
      continue;
    }
    if (!endpoint) throw new Error('Endpoint disappeared');
    const status = await deliverOnce(endpoint, job.payload);
    const outcome = deliveryOutcome(status, job.cycle_attempts);
    await finish(
      job,
      outcome.status,
      status,
      outcome.status === 'delivered' ? null : status === 0 ? 'network_or_timeout' : 'http_failure',
      outcome.delayMs
    );
    if (outcome.status === 'dead')
      logger.warn('Webhook delivery exhausted', {
        deliveryId: job.id,
        endpointId: job.endpoint_id,
        status,
        attempts: job.attempts,
      });
    processed++;
  }
  return processed;
}

/** Poll persisted work on startup and thereafter. Stop awaits the active pass before pool shutdown. */
export function scheduleWebhookDeliveries(): () => Promise<void> {
  if (!hasDatabase() || process.env.WEBHOOK_WORKER_ENABLED === 'false') return async () => {};
  let stopped = false;
  let running: Promise<unknown> | undefined;
  const tick = () => {
    if (stopped || running) return;
    running = drainWebhookDeliveries(10, undefined, () => stopped)
      .catch((error) => logger.error('Webhook worker pass failed', { error: String(error) }))
      .finally(() => {
        running = undefined;
      });
  };
  const timer = setInterval(tick, 1000);
  timer.unref();
  tick();
  return async () => {
    stopped = true;
    clearInterval(timer);
    await running;
  };
}

/** Only dead/cancelled deliveries are eligible, preserving total claims and original payload ID. */
export async function retryWebhookDelivery(
  id: string,
  endpointId: string,
  auth: AuthContext
): Promise<'retried' | 'not_found' | 'not_retryable' | 'forbidden'> {
  return withTransaction(async (db) => {
    const manager = (
      await db.query<{ role: string; organisation_id: string }>(
        'SELECT role,organisation_id FROM public.users WHERE id=$1 FOR SHARE',
        [auth.userId]
      )
    ).rows[0];
    if (!manager || !isManagerRole(manager.role) || manager.organisation_id !== auth.organisationId)
      return 'forbidden';
    const result = await db.query<{
      status: string;
      attempts: number;
      last_status: number | null;
      last_error: string | null;
      completed_at: Date | null;
    }>(
      `SELECT status,attempts,last_status,last_error,completed_at FROM public.webhook_deliveries WHERE id=$1 AND endpoint_id=$2 AND organisation_id=$3 FOR UPDATE`,
      [id, endpointId, auth.organisationId]
    );
    const row = result.rows[0];
    if (!row) return 'not_found';
    if (!['dead', 'cancelled'].includes(row.status)) return 'not_retryable';
    await db.query(
      `UPDATE public.webhook_deliveries SET status='pending',cycle_attempts=0,retry_count=retry_count+1,
      next_attempt_at=now(),lease_token=NULL,leased_until=NULL,completed_at=NULL WHERE id=$1`,
      [id]
    );
    await auditLog(
      {
        eventType: 'webhook.delivery_retried',
        actorId: auth.userId,
        actorEmail: auth.email,
        organisationId: auth.organisationId,
        resourceType: 'webhook_delivery',
        resourceId: id,
        details: {
          endpointId,
          previousStatus: row.status,
          attempts: row.attempts,
          lastStatus: row.last_status,
          lastError: row.last_error,
          previousCompletedAt: row.completed_at?.toISOString() ?? null,
        },
      },
      db
    );
    return 'retried';
  });
}
