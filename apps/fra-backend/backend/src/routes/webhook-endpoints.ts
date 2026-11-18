// Enterprise: manage outgoing webhook endpoints (SIEM / GRC integration)

import crypto from 'node:crypto';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { type AuthContext, hasDatabase, isManagerRole, jsonError, requireAuth } from '../helpers.js';
import { requirePackage } from '../entitlements.js';
import { webhookEndpointsById } from '../stores.js';
import { WEBHOOK_EVENTS, requireUUIDParam, type WebhookEndpoint } from '../types.js';
import { getClientIp, rateLimit } from '../middleware.js';
import { auditLog, dbGetUserById, dbDeleteWebhookEndpoint, dbInsertWebhookEndpoint, dbListWebhookEndpoints } from '../db/index.js';
import { deliverOnce, validateWebhookUrl } from '../webhooks-out.js';
import { getDbPool } from '../db.js';
import { retryWebhookDelivery } from '../webhook-deliveries.js';
import { parsePagination } from '../types.js';

const MAX_ENDPOINTS_PER_ORG = 10;

const webhookEndpoints = new Hono();

async function requireManager(c: Context): Promise<AuthContext | Response> {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (!isManagerRole(auth.role)) return jsonError(c, 403, 'FORBIDDEN', 'Requires employer or admin role');
  if(hasDatabase()){
    const current=await dbGetUserById(auth.userId);
    if(!current||!isManagerRole(current.role)||current.organisationId!==auth.organisationId)return jsonError(c,403,'FORBIDDEN','Requires current employer or admin authority');
  }
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

webhookEndpoints.get('/webhook-endpoints/:id/deliveries',async c=>{
  const auth=await requireManager(c);if(auth instanceof Response)return auth;
  const id=requireUUIDParam(c,'id');if(id instanceof Response)return id;
  if(!(await listForOrg(auth.organisationId)).some(w=>w.id===id))return jsonError(c,404,'NOT_FOUND','Webhook endpoint not found');
  if(!hasDatabase())return c.json({success:true,data:[],page:1,pageSize:20});
  const {page,pageSize}=parsePagination(c.req.query());
  const result=await getDbPool().query(`SELECT id,event_id AS "eventId",payload->>'type' AS "eventType",status,attempts,
    cycle_attempts AS "cycleAttempts",retry_count AS "retryCount",last_status AS "lastStatus",last_error AS "lastError",
    next_attempt_at AS "nextAttemptAt",created_at AS "createdAt",completed_at AS "completedAt"
    FROM public.webhook_deliveries WHERE endpoint_id=$1 AND organisation_id=$2 ORDER BY created_at DESC,id LIMIT $3 OFFSET $4`,[id,auth.organisationId,pageSize,(page-1)*pageSize]);
  return c.json({success:true,data:result.rows,page,pageSize});
});

webhookEndpoints.post('/webhook-endpoints/:id/deliveries/:deliveryId/retry',async c=>{
  const auth=await requireManager(c);if(auth instanceof Response)return auth;
  const limited=await rateLimit(`webhook:retry:${auth.userId}`,{windowMs:60_000,max:10})(c);if(limited instanceof Response)return limited;
  const id=requireUUIDParam(c,'id');if(id instanceof Response)return id;
  const deliveryId=requireUUIDParam(c,'deliveryId');if(deliveryId instanceof Response)return deliveryId;
  const endpoint=(await listForOrg(auth.organisationId)).find(w=>w.id===id);
  if(!endpoint)return jsonError(c,404,'NOT_FOUND','Webhook endpoint not found');
  if(!endpoint.isActive)return jsonError(c,409,'ENDPOINT_INACTIVE','Enable the endpoint before retrying');
  if(!hasDatabase())return jsonError(c,409,'NO_DURABLE_DELIVERY','Durable deliveries require PostgreSQL');
  const result=await retryWebhookDelivery(deliveryId,id,auth);
  if(result==='forbidden')return jsonError(c,403,'FORBIDDEN','Requires current employer or admin authority');
  if(result==='not_found')return jsonError(c,404,'NOT_FOUND','Delivery not found');
  if(result==='not_retryable')return jsonError(c,409,'NOT_RETRYABLE','Only failed or cancelled deliveries can be retried');
  return c.json({success:true,data:{id:deliveryId,status:'pending'}});
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
