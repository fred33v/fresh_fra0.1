// Enterprise: manage outgoing webhook endpoints (SIEM / GRC integration)

import crypto from 'node:crypto';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { type AuthContext, hasDatabase, isManagerRole, jsonError, requireAuth } from '../helpers.js';
import { requirePackage } from '../entitlements.js';
import { webhookEndpointsById } from '../stores.js';
import { WEBHOOK_EVENTS, requireUUIDParam, type WebhookEndpoint } from '../types.js';
import { getClientIp } from '../middleware.js';
import { auditLog, dbDeleteWebhookEndpoint, dbInsertWebhookEndpoint, dbListWebhookEndpoints } from '../db/index.js';
import { deliverOnce, validateWebhookUrl } from '../webhooks-out.js';

const MAX_ENDPOINTS_PER_ORG = 10;

const webhookEndpoints = new Hono();

async function requireManager(c: Context): Promise<AuthContext | Response> {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (!isManagerRole(auth.role)) return jsonError(c, 403, 'FORBIDDEN', 'Requires employer or admin role');
  const denied = await requirePackage(c, auth, 'pkg_full');
  return denied ?? auth;
}

async function listForOrg(orgId: string): Promise<WebhookEndpoint[]> {
  return hasDatabase()
    ? dbListWebhookEndpoints(orgId)
    : Array.from(webhookEndpointsById.values()).filter((w) => w.organisationId === orgId);
}

const publicEndpoint = ({ secret: _secret, ...rest }: WebhookEndpoint) => rest;

const createSchema = z.object({
  url: z.string().max(2000),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
});

webhookEndpoints.get('/webhook-endpoints', async (c) => {
  const auth = await requireManager(c);
  if (auth instanceof Response) return auth;
  const endpoints = await listForOrg(auth.organisationId);
  return c.json({ success: true, data: endpoints.map(publicEndpoint), events: WEBHOOK_EVENTS });
});

webhookEndpoints.post('/webhook-endpoints', async (c) => {
  const auth = await requireManager(c);
  if (auth instanceof Response) return auth;

  const parsed = createSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(c, 400, 'VALIDATION_ERROR', `Provide a url and events from: ${WEBHOOK_EVENTS.join(', ')}`);
  }
  const urlError = validateWebhookUrl(parsed.data.url);
  if (urlError) return jsonError(c, 400, 'INVALID_URL', urlError);

  if ((await listForOrg(auth.organisationId)).length >= MAX_ENDPOINTS_PER_ORG) {
    return jsonError(c, 400, 'LIMIT_REACHED', `At most ${MAX_ENDPOINTS_PER_ORG} webhook endpoints per organisation`);
  }

  const endpoint: WebhookEndpoint = {
    id: crypto.randomUUID(),
    organisationId: auth.organisationId,
    url: parsed.data.url,
    secret: `whsec_${crypto.randomBytes(24).toString('hex')}`,
    events: Array.from(new Set(parsed.data.events)),
    isActive: true,
    createdByUserId: auth.userId,
    createdAt: new Date().toISOString(),
  };

  if (hasDatabase()) await dbInsertWebhookEndpoint(endpoint);
  else webhookEndpointsById.set(endpoint.id, endpoint);

  await auditLog({
    eventType: 'webhook_endpoint.created', actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 'webhook_endpoint', resourceId: endpoint.id,
    details: { url: endpoint.url, events: endpoint.events }, ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent'),
  });

  // The signing secret is only ever returned here
  return c.json({ success: true, data: { ...publicEndpoint(endpoint), secret: endpoint.secret } }, 201);
});

webhookEndpoints.post('/webhook-endpoints/:id/test', async (c) => {
  const auth = await requireManager(c);
  if (auth instanceof Response) return auth;
  const id = requireUUIDParam(c, 'id');
  if (id instanceof Response) return id;

  const endpoint = (await listForOrg(auth.organisationId)).find((w) => w.id === id);
  if (!endpoint) return jsonError(c, 404, 'NOT_FOUND', 'Webhook endpoint not found');

  const status = await deliverOnce(endpoint, {
    id: crypto.randomUUID(), type: endpoint.events[0], createdAt: new Date().toISOString(),
    organisationId: auth.organisationId, data: { test: true },
  });
  return c.json({ success: true, data: { delivered: status >= 200 && status < 300, status } });
});

webhookEndpoints.delete('/webhook-endpoints/:id', async (c) => {
  const auth = await requireManager(c);
  if (auth instanceof Response) return auth;
  const id = requireUUIDParam(c, 'id');
  if (id instanceof Response) return id;

  let deleted = 0;
  if (hasDatabase()) {
    deleted = await dbDeleteWebhookEndpoint(id, auth.organisationId);
  } else {
    const endpoint = webhookEndpointsById.get(id);
    if (endpoint && endpoint.organisationId === auth.organisationId) {
      webhookEndpointsById.delete(id);
      deleted = 1;
    }
  }
  if (!deleted) return jsonError(c, 404, 'NOT_FOUND', 'Webhook endpoint not found');

  await auditLog({
    eventType: 'webhook_endpoint.deleted', actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 'webhook_endpoint', resourceId: id,
    ipAddress: getClientIp(c), userAgent: c.req.header('user-agent'),
  });
  return c.json({ success: true, data: { id, deleted: true } });
});

export default webhookEndpoints;
