import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import jwt from 'jsonwebtoken';
import type { Purchase } from './types.js';

export type AuthContext = {
  userId: string;
  email: string;
  role: string;
  organisationId: string;
};

export let usingDevJwtSecret = false;

function resolveJwtSecret(): jwt.Secret {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable must be set in production');
  }
  usingDevJwtSecret = true;
  return require('crypto').randomBytes(64).toString('hex');
}

export const jwtSecret: jwt.Secret = resolveJwtSecret();

export function hasDatabase(): boolean {
  return !!process.env.DATABASE_URL;
}

export function jsonError(c: Context, status: ContentfulStatusCode, code: string, message: string) {
  return c.json({ success: false, error: { code, message } }, status);
}

export function getAuth(c: Context): AuthContext | null {
  const authHeader = c.req.header('authorization') ?? c.req.header('Authorization');
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  try {
    const payload = jwt.verify(match[1], jwtSecret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.organisationId !== 'string'
    ) {
      return null;
    }

    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      organisationId: payload.organisationId,
    };
  } catch {
    return null;
  }
}

export function requireAuth(c: Context): AuthContext | Response {
  const auth = getAuth(c);
  if (!auth) return jsonError(c, 401, 'UNAUTHORIZED', 'Missing or invalid access token');
  return auth;
}

// Package tier ordering for entitlement checks
const PACKAGE_TIER: Record<string, number> = {
  pkg_basic: 1,
  pkg_training: 2,
  pkg_full: 3,
};

/**
 * Check if an org has a succeeded purchase at or above the required package tier.
 * Pass the org's purchases list and the minimum required package ID.
 */
export function hasPackageEntitlement(purchases: Purchase[], requiredPackageId: string): boolean {
  const requiredTier = PACKAGE_TIER[requiredPackageId] ?? 0;
  return purchases.some(
    (p) => p.status === 'succeeded' && (PACKAGE_TIER[p.packageId] ?? 0) >= requiredTier
  );
}
