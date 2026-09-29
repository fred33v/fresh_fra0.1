// ============================================================
// Enterprise API keys — read-only programmatic access for GRC tools,
// custom dashboards and scheduled exports.
// Keys look like `sfra_<64 hex>`; only a SHA-256 hash is stored.
// ============================================================

import crypto from 'node:crypto';
import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { z } from 'zod';
import { type AuthContext, hasDatabase, hasPackageEntitlement, isManagerRole, jsonError, requireAuth } from '../helpers.js';
import { requirePackage, listOrgPurchases } from '../entitlements.js';
import { apiKeysById } from '../stores.js';
import type { ApiKey } from '../types.js';
import { requireUUIDParam } from '../types.js';
import { getClientIp } from '../middleware.js';
import {
  auditLog, dbGetApiKeyByHash, dbInsertApiKey, dbListApiKeysByOrganisation, dbRevokeApiKey, dbTouchApiKey,
} from '../db/index.js';
import { createLogger } from '../logger.js';

const logger = createLogger('api-keys');

export const API_KEY_PREFIX = 'sfra_';
export const API_KEY_CONTEXT = 'apiKeyAuth';

// Paths (under /api/v1) an API key may read. Everything else needs a user session.
const API_KEY_READABLE = [
  /^\/entitlements$/,
  /^\/assessments(\/[^/]+)?$/,
  /^\/analytics\/(overview|assessments|dashboard|employees)(\/[^/]+)?$/,
  /^\/compliance\/[a-z-]+$/,
  /^\/risk-register(\/[^/]+)?$/,
  /^\/keypasses\/organisation\/[^/]+(\/stats|\/quota)?$/,
];

const hashKey = (key: string) => crypto.createHash('sha256').update(key).digest('hex');

async function findKey(hash: string): Promise<ApiKey | null> {
  if (hasDatabase()) return dbGetApiKeyByHash(hash);
  return Array.from(apiKeysById.values()).find((k) => k.keyHash === hash) ?? null;
}

/**
 * Resolves `Authorization: Bearer sfra_...` into an AuthContext that getAuth() picks up.
 * Keys are read-only, limited to reporting endpoints, and stop working if Enterprise lapses.
 */
export async function apiKeyMiddleware(c: Context, next: Next) {
  const header = c.req.header('authorization') ?? '';
  const match = header.match(/^Bearer\s+(sfra_[a-f0-9]{64})$/i);
  if (!match) return next();

  if (c.req.method !== 'GET') {
    return jsonError(c, 403, 'API_KEY_READ_ONLY', 'API keys only allow GET requests');
  }
  const path = c.req.path.replace(/^\/api\/v1/, '');
  if (!API_KEY_READABLE.some((re) => re.test(path))) {
    return jsonError(c, 403, 'API_KEY_SCOPE', 'This endpoint is not available to API keys');
  }

  const key = await findKey(hashKey(match[1]));
  if (!key || key.revokedAt) return jsonError(c, 401, 'UNAUTHORIZED', 'Invalid or revoked API key');

  if (!hasPackageEntitlement(await listOrgPurchases(key.organisationId), 'pkg_full')) {
    return jsonError(c, 403, 'PACKAGE_REQUIRED', 'API access requires an active Enterprise package');
  }

  const auth: AuthContext = {
    userId: key.createdByUserId,
    email: `api-key:${key.keyPrefix}`,
    role: 'employer',
    organisationId: key.organisationId,
  };
  c.set(API_KEY_CONTEXT as never, auth as never);

  if (hasDatabase()) {
    dbTouchApiKey(key.id).catch((err: unknown) => logger.warn('Failed to record API key use', { error: String(err) }));
  } else {
    key.lastUsedAt = new Date().toISOString();
  }
  return next();
}

// ── Key management (requires a signed-in employer/admin on Enterprise) ──

const apiKeys = new Hono();

async function requireKeyManager(c: Context): Promise<AuthContext | Response> {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (auth.email.startsWith('api-key:')) return jsonError(c, 403, 'FORBIDDEN', 'API keys cannot manage API keys');
  if (!isManagerRole(auth.role)) return jsonError(c, 403, 'FORBIDDEN', 'Requires employer or admin role');
  const denied = await requirePackage(c, auth, 'pkg_full');
  return denied ?? auth;
}

const publicKey = ({ keyHash: _hash, ...rest }: ApiKey) => rest;

apiKeys.get('/api-keys', async (c) => {
  const auth = await requireKeyManager(c);
  if (auth instanceof Response) return auth;

  const keys = hasDatabase()
    ? await dbListApiKeysByOrganisation(auth.organisationId)
    : Array.from(apiKeysById.values()).filter((k) => k.organisationId === auth.organisationId);
  return c.json({ success: true, data: keys.map(publicKey) });
});

apiKeys.post('/api-keys', async (c) => {
  const auth = await requireKeyManager(c);
  if (auth instanceof Response) return auth;

  const parsed = z.object({ name: z.string().min(1).max(100) }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'A key name is required');

  const secret = `${API_KEY_PREFIX}${crypto.randomBytes(32).toString('hex')}`;
  const key: ApiKey = {
    id: crypto.randomUUID(),
    organisationId: auth.organisationId,
    createdByUserId: auth.userId,
    name: parsed.data.name,
    keyPrefix: secret.slice(0, 12),
    keyHash: hashKey(secret),
    createdAt: new Date().toISOString(),
  };

  if (hasDatabase()) await dbInsertApiKey(key);
  else apiKeysById.set(key.id, key);

  await auditLog({
    eventType: 'api_key.created', actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 'api_key', resourceId: key.id,
    details: { name: key.name, keyPrefix: key.keyPrefix }, ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent'),
  });

  // The full key is only ever returned here
  return c.json({ success: true, data: { ...publicKey(key), key: secret } }, 201);
});

apiKeys.delete('/api-keys/:id', async (c) => {
  const auth = await requireKeyManager(c);
  if (auth instanceof Response) return auth;

  const id = requireUUIDParam(c, 'id');
  if (id instanceof Response) return id;

  let revoked = 0;
  if (hasDatabase()) {
    revoked = await dbRevokeApiKey(id, auth.organisationId);
  } else {
    const key = apiKeysById.get(id);
    if (key && key.organisationId === auth.organisationId && !key.revokedAt) {
      key.revokedAt = new Date().toISOString();
      revoked = 1;
    }
  }
  if (!revoked) return jsonError(c, 404, 'NOT_FOUND', 'API key not found');

  await auditLog({
    eventType: 'api_key.revoked', actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 'api_key', resourceId: id,
    ipAddress: getClientIp(c), userAgent: c.req.header('user-agent'),
  });
  return c.json({ success: true, data: { id, revoked: true } });
});

export default apiKeys;
