import crypto from 'node:crypto';
import type { DbExecutor } from './db/transaction.js';
import { withTransaction } from './db/transaction.js';
import { hasDatabase, hasPackageEntitlement } from './helpers.js';
import { listOrgPurchases } from './entitlements.js';
import { webhookEndpointsById } from './stores.js';
import type { WebhookEndpoint, WebhookEvent } from './types.js';
import { dbListWebhookEndpoints, dbRecordWebhookDelivery } from './db/index.js';
import { createLogger } from './logger.js';
import { deliverOnce, RETRY_DELAYS_MS, type WebhookPayload } from './webhook-transport.js';
import { enqueueWebhookPayload } from './webhook-deliveries.js';
export {
  deliverOnce,
  signPayload,
  verifySignedPayload,
  validateWebhookUrl,
  RETRY_DELAYS_MS,
} from './webhook-transport.js';
export type { WebhookPayload } from './webhook-transport.js';
const logger = createLogger('webhooks-out');
async function listEndpoints(orgId: string, db?: DbExecutor): Promise<WebhookEndpoint[]> {
  return hasDatabase()
    ? dbListWebhookEndpoints(orgId, db)
    : Array.from(webhookEndpointsById.values()).filter((w) => w.organisationId === orgId);
}

async function recordDelivery(endpoint: WebhookEndpoint, status: number) {
  if (hasDatabase()) {
    await dbRecordWebhookDelivery(endpoint.id, status).catch(() => undefined);
  } else {
    endpoint.lastDeliveryAt = new Date().toISOString();
    endpoint.lastDeliveryStatus = status;
  }
}

async function deliverWithRetry(
  endpoint: WebhookEndpoint,
  payload: WebhookPayload,
  attempt = 0
): Promise<void> {
  const status = await deliverOnce(endpoint, payload);
  await recordDelivery(endpoint, status);
  if (status >= 200 && status < 300) return;

  const delay = RETRY_DELAYS_MS[attempt];
  if (delay === undefined || (status >= 400 && status < 500 && status !== 429)) {
    logger.warn('Webhook delivery abandoned', {
      endpointId: endpoint.id,
      type: payload.type,
      status,
      attempts: attempt + 1,
    });
    return;
  }
  const timer = setTimeout(() => {
    void deliverWithRetry(endpoint, payload, attempt + 1);
  }, delay);
  timer.unref?.();
}

/** Enqueue on the caller's transaction when supplied. Errors must roll back the domain write. */
export async function enqueueOrgEvent(
  organisationId: string,
  type: WebhookEvent,
  data: Record<string, unknown>,
  db?: DbExecutor
): Promise<void> {
  const work = async (client?: DbExecutor) => {
    const endpoints = (await listEndpoints(organisationId, client)).filter(
      (w) => w.isActive && w.events.includes(type)
    );
    if (
      !endpoints.length ||
      !hasPackageEntitlement(await listOrgPurchases(organisationId, client), 'pkg_full')
    )
      return;
    const payload: WebhookPayload = {
      id: crypto.randomUUID(),
      type,
      createdAt: new Date().toISOString(),
      organisationId,
      data,
    };
    if (client) {
      for (const endpoint of endpoints) await enqueueWebhookPayload(endpoint.id, payload, client);
    } else await Promise.all(endpoints.map((endpoint) => deliverWithRetry(endpoint, payload)));
  };
  if (db) await work(db);
  else if (hasDatabase()) await withTransaction(work);
  else await work();
}

/** Compatibility wrapper: existing best-effort publication remains non-throwing. */
export async function emitOrgEvent(
  organisationId: string,
  type: WebhookEvent,
  data: Record<string, unknown>
): Promise<void> {
  try {
    await enqueueOrgEvent(organisationId, type, data);
  } catch (error) {
    logger.error('Failed to enqueue webhook event', { organisationId, type, error: String(error) });
  }
}
