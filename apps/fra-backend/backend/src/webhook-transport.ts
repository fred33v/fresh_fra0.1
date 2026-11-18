// ============================================================
// Outgoing webhooks — push events to an Enterprise org's SIEM/GRC endpoints.
// Payloads are signed: X-StopFRA-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "t.body">
// ============================================================

import crypto from 'node:crypto';
import { lookup } from 'node:dns/promises';
import { BlockList, isIP, type LookupFunction } from 'node:net';
import { request as httpsRequest } from 'node:https';
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

const blockedAddresses = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8],
  ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16],
  ['192.0.0.0', 24], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blockedAddresses.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [
  ['::', 96], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8],
  ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['2002::', 16], ['2001::', 32],
] as const) blockedAddresses.addSubnet(address, prefix, 'ipv6');

function isPrivateAddress(address: string): boolean {
  const family = isIP(address);
  // BlockList also matches IPv4-mapped IPv6 against IPv4 subnets.
  return !family || blockedAddresses.check(address, family === 6 ? 'ipv6' : 'ipv4');
}

/** Resolve once per attempt; the timeout covers DNS as well as HTTPS. */
async function resolveDestination(host: string, signal: AbortSignal): Promise<import('node:dns').LookupAddress[]> {
  if (isIP(host)) return [{ address: host, family: isIP(host) }];
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { abort(); return; }
    lookup(host, { all: true }).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

async function deliverPinned(url: URL, body: string, headers: Record<string, string>, signal: AbortSignal): Promise<number> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = await resolveDestination(host, signal);
  signal.throwIfAborted();
  if (!addresses.length || addresses.some(entry => isPrivateAddress(entry.address))) return 0;
  const pinnedLookup: LookupFunction = (_hostname, options, callback) => {
    if (options.all) callback(null, addresses);
    else {
      const selected = addresses.find(entry => entry.family === 4) ?? addresses[0];
      callback(null, selected.address, selected.family);
    }
  };
  return new Promise<number>((resolve, reject) => {
    // Keep the URL hostname for Host/SNI/certificate verification. No shared
    // agent or subsequent resolver can substitute an unvalidated destination.
    const request = httpsRequest(url, {
      method: 'POST', headers: { ...headers, 'Content-Length': String(Buffer.byteLength(body)) },
      lookup: pinnedLookup, agent: false, rejectUnauthorized: true, signal,
    }, response => {
      const status = response.statusCode ?? 0;
      response.destroy();
      resolve(status); // Native HTTPS never follows redirects.
    });
    request.on('error', reject);
    request.end(body);
  });
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

  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    return 'Webhook URL must be publicly reachable';
  }
  if (isIP(host) && isPrivateAddress(host)) return 'Webhook URL must be publicly reachable';
  return null;
}

/** One delivery attempt. Returns the HTTP status, or 0 on network error/timeout. */
export async function deliverOnce(
  endpoint: WebhookEndpoint,
  payload: WebhookPayload
): Promise<number> {
  const body = JSON.stringify(payload);
  try {
    if (validateWebhookUrl(endpoint.url)) return 0;
    const signal = AbortSignal.timeout(DELIVERY_TIMEOUT_MS);
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'StopFRA-Webhooks/1.0',
      'X-StopFRA-Event': payload.type,
      'X-StopFRA-Delivery': payload.id,
      'X-StopFRA-Signature': signPayload(endpoint.secret, body),
    };
    if (process.env.NODE_ENV === 'production') {
      return await deliverPinned(new URL(endpoint.url), body, headers, signal);
    }
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers,
      body,
      redirect: 'manual',
      signal,
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
