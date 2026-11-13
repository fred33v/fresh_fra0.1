// ============================================================
// Outgoing webhooks — push events to an Enterprise org's SIEM/GRC endpoints.
// Payloads are signed: X-StopFRA-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "t.body">
// ============================================================

import crypto from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { WebhookEndpoint, WebhookEvent } from './types.js';
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

export function signPayload(
  secret: string,
  body: string,
  timestamp = Math.floor(Date.now() / 1000)
): string {
  const sig = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `t=${timestamp},v1=${sig}`;
}

/**
 * Check a `t=<unix seconds>,v1=<hex>` signature made by signPayload.
 * Rejects signatures older or newer than toleranceSeconds, so a captured request cannot be replayed later.
 */
export function verifySignedPayload(
  secret: string,
  body: string,
  header: string | undefined,
  toleranceSeconds = 300
): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.trim().split('=', 2)));
  const timestamp = Number(parts.t);
  if (!Number.isInteger(timestamp) || typeof parts.v1 !== 'string') return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > toleranceSeconds) return false;

  const expected = Buffer.from(signPayload(secret, body, timestamp).split('v1=')[1]);
  const received = Buffer.from(parts.v1);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

function isPrivateIPv4(host: string): boolean {
  const [a, b] = host.split('.').map(Number);
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
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
  try {
    url = new URL(raw);
  } catch {
    return 'URL is not valid';
  }

  const requireHttps = process.env.NODE_ENV === 'production';
  if (url.protocol !== 'https:' && (requireHttps || url.protocol !== 'http:')) {
    return requireHttps ? 'Webhook URL must use https' : 'Webhook URL must use http or https';
  }
  if (url.username || url.password) return 'Webhook URL must not contain credentials';

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return 'Webhook URL must be publicly reachable';
  }
  const ipVersion = isIP(host);
  if (ipVersion === 4 && isPrivateIPv4(host)) return 'Webhook URL must be publicly reachable';
  if (
    ipVersion === 6 &&
    (host === '::1' || host === '::' || /^(fc|fd|fe80)/.test(host) || host.startsWith('::ffff:'))
  ) {
    return 'Webhook URL must be publicly reachable';
  }
  return null;
}

/** One delivery attempt. Returns the HTTP status, or 0 on network error/timeout. */
export async function deliverOnce(
  endpoint: WebhookEndpoint,
  payload: WebhookPayload
): Promise<number> {
  const body = JSON.stringify(payload);
  try {
    // A public-looking hostname can still resolve to localhost or the cloud metadata address
    if (process.env.NODE_ENV === 'production') {
      const host = new URL(endpoint.url).hostname.replace(/^\[|\]$/g, '');
      const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
      if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
        logger.warn('Webhook delivery blocked: host resolves to a private address', {
          endpointId: endpoint.id,
        });
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
    const status = res.status;
    // Only headers matter; release the response stream before the next queued job.
    await res.body?.cancel().catch(() => undefined);
    return status;
  } catch (err: unknown) {
    logger.warn('Webhook delivery failed', {
      endpointId: endpoint.id,
      type: payload.type,
      error: String(err),
    });
    return 0;
  }
}
