import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
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
  return randomBytes(64).toString('hex');
}

export const jwtSecret: jwt.Secret = resolveJwtSecret();

export function hasDatabase(): boolean {
  return !!process.env.DATABASE_URL;
}

export function jsonError(c: Context, status: ContentfulStatusCode, code: string, message: string) {
  return c.json({ success: false, error: { code, message } }, status);
}

export function getAuth(c: Context): AuthContext | null {
  // Set by apiKeyMiddleware when the request carries a valid Enterprise API key
  const apiKeyAuth = c.get('apiKeyAuth' as never) as AuthContext | undefined;
  if (apiKeyAuth) return apiKeyAuth;

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
export const PACKAGE_TIER: Record<string, number> = {
  pkg_basic: 1,
  pkg_training: 2,
  pkg_full: 3,
};

// Subscription length per package; null = one-time purchase that never expires
export const SUBSCRIPTION_TERM_DAYS: Record<string, number | null> = {
  pkg_basic: null,
  pkg_training: 365,
  pkg_full: 365,
};

// A subscription can be renewed once it is within this many days of expiry
export const RENEWAL_WINDOW_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export type EntitlementWindow = {
  purchase: Purchase;
  startsAt: Date;
  expiresAt: Date | null;
};

/**
 * Turn an org's succeeded purchases into entitlement windows.
 * Renewals of the same package stack: a renewal starts when the previous term ends.
 */
export function getEntitlementWindows(purchases: Purchase[]): EntitlementWindow[] {
  const byPackage = new Map<string, Purchase[]>();
  for (const p of purchases) {
    if (p.status !== 'succeeded') continue;
    const list = byPackage.get(p.packageId) ?? [];
    list.push(p);
    byPackage.set(p.packageId, list);
  }

  const windows: EntitlementWindow[] = [];
  for (const [packageId, list] of byPackage) {
    const termDays = SUBSCRIPTION_TERM_DAYS[packageId] ?? null;
    const activatedAt = (p: Purchase) => new Date(p.confirmedAt ?? p.createdAt).getTime();
    list.sort((a, b) => activatedAt(a) - activatedAt(b));

    let previousEnd = 0;
    for (const p of list) {
      const start = Math.max(activatedAt(p), previousEnd);
      const end = termDays === null ? null : start + termDays * DAY_MS;
      windows.push({ purchase: p, startsAt: new Date(start), expiresAt: end === null ? null : new Date(end) });
      if (end !== null) previousEnd = end;
    }
  }
  return windows;
}

/** Entitlement windows that cover the given moment. */
export function getActiveWindows(purchases: Purchase[], now: Date = new Date()): EntitlementWindow[] {
  const t = now.getTime();
  return getEntitlementWindows(purchases).filter(
    (w) => w.startsAt.getTime() <= t && (w.expiresAt === null || w.expiresAt.getTime() > t)
  );
}

/** Highest package tier the org currently holds (0 = none). */
export function getActiveTier(purchases: Purchase[], now: Date = new Date()): number {
  return getActiveWindows(purchases, now).reduce(
    (max, w) => Math.max(max, PACKAGE_TIER[w.purchase.packageId] ?? 0), 0
  );
}

/**
 * Check if an org has an active (paid, unexpired) purchase at or above the required package tier.
 * Pass the org's purchases list and the minimum required package ID.
 */
export function hasPackageEntitlement(purchases: Purchase[], requiredPackageId: string, now: Date = new Date()): boolean {
  const requiredTier = PACKAGE_TIER[requiredPackageId] ?? 0;
  return getActiveTier(purchases, now) >= requiredTier && requiredTier > 0;
}

/**
 * Latest expiry for a package, counting stacked renewals.
 * Returns null for one-time packages, undefined when the org never bought it.
 */
export function getPackageExpiry(purchases: Purchase[], packageId: string): Date | null | undefined {
  const windows = getEntitlementWindows(purchases).filter((w) => w.purchase.packageId === packageId);
  if (windows.length === 0) return undefined;
  return windows[windows.length - 1].expiresAt;
}

/** True if buying this package now would duplicate a purchase that is still active. */
export function blocksRepurchase(purchases: Purchase[], packageId: string, now: Date = new Date()): boolean {
  const expiry = getPackageExpiry(purchases, packageId);
  if (expiry === undefined) return false;
  if (expiry === null) return true;
  return expiry.getTime() - now.getTime() > RENEWAL_WINDOW_DAYS * DAY_MS;
}

export function isManagerRole(role: string): boolean {
  return role === 'employer' || role === 'admin';
}
