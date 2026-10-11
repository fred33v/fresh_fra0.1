// ============================================================
// Outgoing webhooks — push events to an Enterprise org's SIEM/GRC endpoints.
// Payloads are signed: X-StopFRA-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "t.body">
// ============================================================

import crypto from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { hasDatabase, hasPackageEntitlement } from './helpers.js';
import { listOrgPurchases } from './entitlements.js';
import { webhookEndpointsById } from './stores.js';
import type { WebhookEndpoint, WebhookEvent } from './types.js';
import { dbListWebhookEndpoints, dbRecordWebhookDelivery } from './db/index.js';
import { createLogger } from './logger.js';

const logger = createLogger('webhooks-out');

const DELIVERY_TIMEOUT_MS = 10_000;
export const RETRY_DELAYS_MS = [1_000, 10_000, 60_000];

export type WebhookPayload = {
  id: string;
  type: WebhookEvent;
  createdAt: string;
  organisationId: string;
  data: Record<string, unknown>;
};

export function signPayload(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const sig = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

function isPrivateIPv4(host: string): boolean {
  const [a, b] = host.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

function isPrivateAddress(address: string): boolean {
  const host = address.toLowerCase();
  const version = isIP(host);
  if (version === 4) return isPrivateIPv4(host);
  if (version === 6) {
    const mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIPv4(mapped[1]);
    return host === '::1' || host === '::' || /^(fc|fd|fe[89ab])/.test(host);
  }
  return false;
}

/**
 * Reject URLs that would let a customer make the server call internal services.
 * Hostnames that resolve to private addresses are caught at delivery time (see deliverOnce).
 */
export function validateWebhookUrl(raw: string): string | null {
  let url: URL;
  try { url = new URL(raw); } catch { return 'URL is not valid'; }

  const requireHttps = process.env.NODE_ENV === 'production';
  if (url.protocol !== 'https:' && (requireHttps || url.protocol !== 'http:')) {
    return requireHttps ? 'Webhook URL must use https' : 'Webhook URL must use http or https';
  }
  if (url.username || url.password) return 'Webhook URL must not contain credentials';

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return 'Webhook URL must be publicly reachable';
  }
  const ipVersion = isIP(host);
  if (ipVersion === 4 && isPrivateIPv4(host)) return 'Webhook URL must be publicly reachable';
  if (ipVersion === 6 && (host === '::1' || host === '::' || /^(fc|fd|fe80)/.test(host) || host.startsWith('::ffff:'))) {
    return 'Webhook URL must be publicly reachable';
  }
  return null;
}

async function listEndpoints(orgId: string): Promise<WebhookEndpoint[]> {
  return hasDatabase()
    ? dbListWebhookEndpoints(orgId)
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

/** One delivery attempt. Returns the HTTP status, or 0 on network error/timeout. */
export async function deliverOnce(endpoint: WebhookEndpoint, payload: WebhookPayload): Promise<number> {
  const body = JSON.stringify(payload);
  try {
    // A public-looking hostname can still resolve to localhost or the cloud metadata address
    if (process.env.NODE_ENV === 'production') {
      const host = new URL(endpoint.url).hostname.replace(/^\[|\]$/g, '');
      const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
      if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
        logger.warn('Webhook delivery blocked: host resolves to a private address', { endpointId: endpoint.id });
        return 0;
      }
    }
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'StopFRA-Webhooks/1.0',
        'X-StopFRA-Event': payload.type,
        'X-StopFRA-Delivery': payload.id,
        'X-StopFRA-Signature': signPayload(endpoint.secret, body),
      },
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
    });
    return res.status;
  } catch (err: unknown) {
    logger.warn('Webhook delivery failed', { endpointId: endpoint.id, type: payload.type, error: String(err) });
    return 0;
  }
}

async function deliverWithRetry(endpoint: WebhookEndpoint, payload: WebhookPayload, attempt = 0): Promise<void> {
  const status = await deliverOnce(endpoint, payload);
  await recordDelivery(endpoint, status);
  if (status >= 200 && status < 300) return;

  const delay = RETRY_DELAYS_MS[attempt];
  if (delay === undefined || (status >= 400 && status < 500 && status !== 429)) {
    logger.warn('Webhook delivery abandoned', { endpointId: endpoint.id, type: payload.type, status, attempts: attempt + 1 });
    return;
  }
  const timer = setTimeout(() => { void deliverWithRetry(endpoint, payload, attempt + 1); }, delay);
  timer.unref?.();
}

/**
 * Send an event to every active endpoint subscribed to it. Only Enterprise orgs receive events.
 * Never throws; callers may await it (tests) or fire and forget (routes).
 */
export async function emitOrgEvent(organisationId: string, type: WebhookEvent, data: Record<string, unknown>): Promise<void> {
  try {
    const endpoints = (await listEndpoints(organisationId)).filter((w) => w.isActive && w.events.includes(type));
    if (endpoints.length === 0) return;
    if (!hasPackageEntitlement(await listOrgPurchases(organisationId), 'pkg_full')) return;

    const payload: WebhookPayload = {
      id: crypto.randomUUID(), type, createdAt: new Date().toISOString(), organisationId, data,
    };
    await Promise.all(endpoints.map((endpoint) => deliverWithRetry(endpoint, payload)));
  } catch (err: unknown) {
    logger.error('Failed to emit webhook event', { organisationId, type, error: String(err) });
  }
}
