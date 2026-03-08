import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { hasDatabase, jsonError, requireAuth } from '../helpers.js';
import { keypassGenerateSchema, keypassValidateSchema, keypassUseSchema, keypassBulkSchema, RATE_LIMITS, FALLBACK_PACKAGES, KEYPASS_GRACE_PERIOD_DAYS, parsePagination, paginate, requireUUIDParam } from '../types.js';
import type { User, Keypass } from '../types.js';
import { usersByEmail, organisationsById, keypassesByCode, purchasesById } from '../stores.js';
import { getClientIp, rateLimit } from '../middleware.js';
import { generateKeypassCode } from '../s3.js';
import {
  dbGetUserByEmail, dbInsertUser,
  dbInsertKeypassBatch, dbGetKeypassByCode, dbUpdateKeypassStatus, dbClaimKeypass, dbListKeypassesByOrganisation, dbGetKeypassStatsByOrganisation,
  dbGetOrganisationById, dbGetPackageById,
  dbListPurchasesByOrganisation,
  dbUpsertRefreshToken,
  auditLog,
} from '../db/index.js';
import type { KeypassStatus } from '../types.js';
import { issueTokens, publicUser } from '../auth-utils.js';
import { createLogger } from '../logger.js';

const logger = createLogger('keypasses');

// ── Quota helper ────────────────────────────────────────────────

async function getOrgKeypassQuota(orgId: string): Promise<{ allowance: number; used: number }> {
  // Determine max keypass allowance from the org's best succeeded purchase
  let allowance = 0;

  if (hasDatabase()) {
    const purchases = await dbListPurchasesByOrganisation(orgId);
    for (const p of purchases) {
      if (p.status !== 'succeeded') continue;
      const pkg = await dbGetPackageById(p.packageId);
      if (pkg && pkg.keypassAllowance > allowance) allowance = pkg.keypassAllowance;
    }
  } else {
    const purchases = Array.from(purchasesById.values()).filter((p) => p.organisationId === orgId && p.status === 'succeeded');
    for (const p of purchases) {
      const pkg = FALLBACK_PACKAGES.find((fp) => fp.id === p.packageId);
      if (pkg && pkg.keypassAllowance > allowance) allowance = pkg.keypassAllowance;
    }
  }

  // Count existing keypasses (all statuses except revoked/expired count towards quota)
  const allKeypasses = hasDatabase()
    ? await dbListKeypassesByOrganisation(orgId)
    : Array.from(keypassesByCode.values()).filter((k) => k.organisationId === orgId);

  const used = allKeypasses.filter((k) => k.status === 'available' || k.status === 'used').length;

  return { allowance, used };
}

// ── Keypass creation helper ──────────────────────────────────────

async function createKeypasses(orgId: string, quantity: number, expiresInDays: number): Promise<{ codes: string[]; expiresAt: string }> {
  const now = Date.now();
  const expiresAt = new Date(now + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
  const createdAt = new Date(now).toISOString();

  const keypasses: Keypass[] = [];
  for (let i = 0; i < quantity; i++) {
    let code = generateKeypassCode();
    // Ensure uniqueness (check both in-memory and DB)
    if (hasDatabase()) {
      while (await dbGetKeypassByCode(code)) code = generateKeypassCode();
    } else {
      while (keypassesByCode.has(code)) code = generateKeypassCode();
    }

    keypasses.push({ code, organisationId: orgId, status: 'available', createdAt, expiresAt });
  }

  if (hasDatabase()) {
    await dbInsertKeypassBatch(keypasses);
  } else {
    for (const kp of keypasses) {
      keypassesByCode.set(kp.code, kp);
    }
  }

  return { codes: keypasses.map((kp) => kp.code), expiresAt };
}

// ── Routes ──────────────────────────────────────────────────────

const keypasses = new Hono();

keypasses.post('/keypasses/generate', async (c) => {
  const limited = await rateLimit('keypass:generate', { windowMs: RATE_LIMITS.KEYPASS_GENERATE_WINDOW_MS, max: RATE_LIMITS.KEYPASS_GENERATE_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (auth.role !== 'employer' && auth.role !== 'admin') {
    return jsonError(c, 403, 'FORBIDDEN', 'Requires employer or admin role');
  }

  const parsed = keypassGenerateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid keypass generate payload');

  const quota = await getOrgKeypassQuota(auth.organisationId);
  if (quota.allowance === 0) {
    return jsonError(c, 403, 'NO_PACKAGE', 'No active package with keypass allowance');
  }
  const remaining = quota.allowance - quota.used;
  if (parsed.data.quantity > remaining) {
    return jsonError(c, 400, 'QUOTA_EXCEEDED', `Keypass quota exceeded. Remaining: ${remaining}, requested: ${parsed.data.quantity}`);
  }

  const { codes, expiresAt } = await createKeypasses(auth.organisationId, parsed.data.quantity, parsed.data.expiresInDays);

  await auditLog({
    eventType: 'keypass.generate', actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 'keypass',
    details: { quantity: parsed.data.quantity }, ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent'),
  });

  return c.json({ success: true, data: { organisationId: auth.organisationId, expiresAt, codes } });
});

keypasses.post('/keypasses/allocate', async (c) => {
  const limited = await rateLimit('keypass:allocate', { windowMs: RATE_LIMITS.KEYPASS_GENERATE_WINDOW_MS, max: RATE_LIMITS.KEYPASS_GENERATE_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (auth.role !== 'employer' && auth.role !== 'admin') {
    return jsonError(c, 403, 'FORBIDDEN', 'Requires employer or admin role');
  }

  const parsed = keypassGenerateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid keypass allocate payload');

  const quota = await getOrgKeypassQuota(auth.organisationId);
  if (quota.allowance === 0) {
    return jsonError(c, 403, 'NO_PACKAGE', 'No active package with keypass allowance');
  }
  const remaining = quota.allowance - quota.used;
  if (parsed.data.quantity > remaining) {
    return jsonError(c, 400, 'QUOTA_EXCEEDED', `Keypass quota exceeded. Remaining: ${remaining}, requested: ${parsed.data.quantity}`);
  }

  const { codes, expiresAt } = await createKeypasses(auth.organisationId, parsed.data.quantity, parsed.data.expiresInDays);

  await auditLog({
    eventType: 'keypass.allocate', actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 'keypass',
    details: { quantity: parsed.data.quantity }, ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent'),
  });

  return c.json({ success: true, data: { organisationId: auth.organisationId, expiresAt, codes } });
});

keypasses.post('/keypasses/use', async (c) => {
  const limited = await rateLimit('keypass:use', { windowMs: RATE_LIMITS.KEYPASS_WINDOW_MS, max: RATE_LIMITS.KEYPASS_MAX })(c);
  if (limited instanceof Response) return limited;

  const parsed = keypassUseSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid keypass use payload');

  const code = parsed.data.code.toUpperCase();
  const kp = hasDatabase() ? await dbGetKeypassByCode(code) : keypassesByCode.get(code);
  if (!kp) return jsonError(c, 404, 'NOT_FOUND', 'Keypass not found');

  const now = new Date().toISOString();

  // Check expiry before status so expired keypasses get the specific "EXPIRED" error
  const expiresAt = new Date(kp.expiresAt).getTime();
  const graceEnd = expiresAt + KEYPASS_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
  const nowMs = Date.now();

  if (nowMs > graceEnd) {
    // Past grace period — hard expired
    if (kp.status === 'available') {
      if (hasDatabase()) {
        await dbUpdateKeypassStatus(code, 'expired');
      } else {
        kp.status = 'expired';
      }
    }
    return jsonError(c, 400, 'EXPIRED', 'Keypass is expired');
  }

  if (kp.status !== 'available') return jsonError(c, 400, 'NOT_AVAILABLE', 'Keypass is not available');

  // In-memory path: claim immediately to prevent TOCTOU race across async gaps
  // (bcrypt.hash below yields the event loop, allowing concurrent requests to pass the check)
  if (!hasDatabase()) {
    kp.status = 'used';
    kp.usedAt = now;
  }

  if (nowMs > expiresAt) {
    // Within grace period — allow but log warning
    logger.warn('Keypass used during grace period', { code, expiresAt: kp.expiresAt });
  }

  const email = (parsed.data.email ?? `employee+${kp.code.toLowerCase()}@example.com`).toLowerCase();
  const name = parsed.data.name ?? email.split('@')[0];

  let user: User | null | undefined;
  if (hasDatabase()) {
    user = await dbGetUserByEmail(email);
  } else {
    user = usersByEmail.get(email);
  }

  if (!user) {
    user = {
      id: crypto.randomUUID(),
      email,
      name,
      passwordHash: await bcrypt.hash(crypto.randomUUID(), 12),
      role: 'employee',
      organisationId: kp.organisationId,
      createdAt: now,
    };
    if (hasDatabase()) {
      await dbInsertUser(user);
    } else {
      usersByEmail.set(email, user);
    }
  }

  if (hasDatabase()) {
    const claimed = await dbClaimKeypass(code, now, user.id);
    if (!claimed) return jsonError(c, 409, 'ALREADY_USED', 'Keypass has already been used');
  }

  const { accessToken, refreshToken } = issueTokens(user);
  if (hasDatabase()) {
    await dbUpsertRefreshToken(refreshToken, user.id);
  }

  let orgName = 'Organisation';
  if (hasDatabase()) {
    const org = await dbGetOrganisationById(user.organisationId);
    if (org) orgName = org.name;
  } else {
    const org = organisationsById.get(user.organisationId);
    if (org) orgName = org.name;
  }

  await auditLog({
    eventType: 'keypass.use', actorId: user.id, actorEmail: user.email,
    organisationId: user.organisationId, resourceType: 'keypass', resourceId: code,
    ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent'),
  });

  return c.json({
    success: true,
    data: {
      user: publicUser(user),
      organisation: { organisationId: user.organisationId, name: orgName },
      accessToken,
      refreshToken,
      keypass: { code: kp.code, usedAt: now },
    },
  });
});

keypasses.post('/keypasses/revoke', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (auth.role !== 'employer' && auth.role !== 'admin') {
    return jsonError(c, 403, 'FORBIDDEN', 'Requires employer or admin role');
  }

  const parsed = keypassValidateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid keypass revoke payload');

  const code = parsed.data.code.toUpperCase();
  const kp = hasDatabase() ? await dbGetKeypassByCode(code) : keypassesByCode.get(code);
  if (!kp || kp.organisationId !== auth.organisationId) {
    return jsonError(c, 404, 'NOT_FOUND', 'Keypass not found');
  }
  if (kp.status === 'used') {
    return jsonError(c, 400, 'ALREADY_USED', 'Cannot revoke a keypass that has already been used');
  }
  if (kp.status === 'revoked') {
    return jsonError(c, 400, 'ALREADY_REVOKED', 'Keypass is already revoked');
  }

  if (hasDatabase()) {
    await dbUpdateKeypassStatus(code, 'revoked');
  } else {
    kp.status = 'revoked';
  }

  await auditLog({
    eventType: 'keypass.revoke', actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 'keypass', resourceId: code,
    ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent'),
  });

  return c.json({ success: true });
});

keypasses.get('/keypasses/organisation/:orgId', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const orgId = requireUUIDParam(c, 'orgId');
  if (orgId instanceof Response) return orgId;
  if (orgId !== auth.organisationId) return jsonError(c, 403, 'FORBIDDEN', 'Forbidden');

  const statusFilter = c.req.query('status') as KeypassStatus | undefined;
  const validStatuses = new Set<string>(['available', 'used', 'revoked', 'expired']);

  if (statusFilter && !validStatuses.has(statusFilter)) {
    return jsonError(c, 400, 'INVALID_PARAM', 'Invalid status filter');
  }

  let allItems = hasDatabase()
    ? await dbListKeypassesByOrganisation(orgId)
    : Array.from(keypassesByCode.values()).filter((k) => k.organisationId === orgId);

  if (statusFilter) {
    allItems = allItems.filter((k) => k.status === statusFilter);
  }

  const { page, pageSize } = parsePagination(c.req.query());
  const result = paginate(allItems, page, pageSize);

  return c.json({ success: true, data: result.items, pagination: { page: result.page, pageSize: result.pageSize, total: result.total, totalPages: result.totalPages } });
});

keypasses.get('/keypasses/organisation/:orgId/stats', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const orgId = requireUUIDParam(c, 'orgId');
  if (orgId instanceof Response) return orgId;
  if (orgId !== auth.organisationId) return jsonError(c, 403, 'FORBIDDEN', 'Forbidden');

  if (hasDatabase()) {
    const { total, byStatus } = await dbGetKeypassStatsByOrganisation(orgId);
    return c.json({ success: true, data: { organisationId: orgId, totals: total, byStatus } });
  }

  const items = Array.from(keypassesByCode.values()).filter((k) => k.organisationId === orgId);
  const stats = items.reduce<Record<KeypassStatus, number>>(
    (acc, k) => {
      acc[k.status] = (acc[k.status] ?? 0) + 1;
      return acc;
    },
    { available: 0, used: 0, revoked: 0, expired: 0 }
  );

  return c.json({ success: true, data: { organisationId: orgId, totals: items.length, byStatus: stats } });
});

keypasses.post('/keypasses/validate', async (c) => {
  const limited = await rateLimit('keypass:validate', { windowMs: RATE_LIMITS.KEYPASS_WINDOW_MS, max: RATE_LIMITS.KEYPASS_MAX })(c);
  if (limited instanceof Response) return limited;

  const parsed = keypassValidateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid keypass validate payload');

  const code = parsed.data.code.toUpperCase();
  const kp = hasDatabase() ? await dbGetKeypassByCode(code) : keypassesByCode.get(code);
  if (!kp) return jsonError(c, 404, 'NOT_FOUND', 'Keypass not found');

  if (kp.status === 'revoked') return jsonError(c, 400, 'REVOKED', 'Keypass is revoked');
  if (kp.status === 'used') return jsonError(c, 400, 'USED', 'Keypass is already used');

  const expiresAtMs = new Date(kp.expiresAt).getTime();
  const graceEndMs = expiresAtMs + KEYPASS_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

  if (Date.now() > graceEndMs) {
    if (hasDatabase()) {
      await dbUpdateKeypassStatus(code, 'expired');
    } else {
      kp.status = 'expired';
    }
    return jsonError(c, 400, 'EXPIRED', 'Keypass is expired');
  }

  const inGracePeriod = Date.now() > expiresAtMs;

  return c.json({
    success: true,
    data: {
      valid: true,
      organisationId: kp.organisationId,
      expiresAt: kp.expiresAt,
      ...(inGracePeriod ? { warning: 'Keypass is in grace period and will expire soon' } : {}),
    },
  });
});

keypasses.get('/keypasses/organisation/:orgId/quota', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const orgId = requireUUIDParam(c, 'orgId');
  if (orgId instanceof Response) return orgId;
  if (orgId !== auth.organisationId) return jsonError(c, 403, 'FORBIDDEN', 'Forbidden');

  const quota = await getOrgKeypassQuota(orgId);

  return c.json({
    success: true,
    data: {
      organisationId: orgId,
      allowance: quota.allowance,
      used: quota.used,
      remaining: Math.max(0, quota.allowance - quota.used),
    },
  });
});

keypasses.post('/keypasses/bulk-revoke', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (auth.role !== 'employer' && auth.role !== 'admin') {
    return jsonError(c, 403, 'FORBIDDEN', 'Requires employer or admin role');
  }

  const parsed = keypassBulkSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid bulk revoke payload');

  const results: { code: string; revoked: boolean; reason?: string }[] = [];

  for (const rawCode of parsed.data.codes) {
    const code = rawCode.toUpperCase();
    const kp = hasDatabase() ? await dbGetKeypassByCode(code) : keypassesByCode.get(code);

    if (!kp || kp.organisationId !== auth.organisationId) {
      results.push({ code, revoked: false, reason: 'not_found' });
      continue;
    }

    if (kp.status === 'revoked') {
      results.push({ code, revoked: false, reason: 'already_revoked' });
      continue;
    }

    if (hasDatabase()) {
      await dbUpdateKeypassStatus(code, 'revoked');
    } else {
      kp.status = 'revoked';
    }

    results.push({ code, revoked: true });
  }

  await auditLog({
    eventType: 'keypass.bulk_revoke', actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 'keypass',
    details: { count: results.filter((r) => r.revoked).length, total: parsed.data.codes.length },
    ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent'),
  });

  return c.json({ success: true, data: { results } });
});

keypasses.post('/keypasses/bulk-validate', async (c) => {
  const limited = await rateLimit('keypass:validate', { windowMs: RATE_LIMITS.KEYPASS_WINDOW_MS, max: RATE_LIMITS.KEYPASS_MAX })(c);
  if (limited instanceof Response) return limited;

  const parsed = keypassBulkSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid bulk validate payload');

  const results: { code: string; valid: boolean; status?: string; reason?: string }[] = [];

  for (const rawCode of parsed.data.codes) {
    const code = rawCode.toUpperCase();
    const kp = hasDatabase() ? await dbGetKeypassByCode(code) : keypassesByCode.get(code);

    if (!kp) {
      results.push({ code, valid: false, reason: 'not_found' });
      continue;
    }

    if (kp.status !== 'available') {
      results.push({ code, valid: false, status: kp.status, reason: kp.status });
      continue;
    }

    const expiresAtMs = new Date(kp.expiresAt).getTime();
    const graceEndMs = expiresAtMs + KEYPASS_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;
    const nowMs = Date.now();

    if (nowMs > graceEndMs) {
      if (hasDatabase()) {
        await dbUpdateKeypassStatus(code, 'expired');
      } else {
        kp.status = 'expired';
      }
      results.push({ code, valid: false, status: 'expired', reason: 'expired' });
      continue;
    }

    const inGracePeriod = nowMs > expiresAtMs;
    results.push({ code, valid: true, status: 'available', ...(inGracePeriod ? { warning: 'grace_period' } : {}) });
  }

  return c.json({ success: true, data: { results } });
});

keypasses.get('/keypasses/expiring', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (auth.role !== 'employer' && auth.role !== 'admin') {
    return jsonError(c, 403, 'FORBIDDEN', 'Requires employer or admin role');
  }

  const daysParam = c.req.query('days') ?? '7';
  const days = Math.min(90, Math.max(1, parseInt(daysParam, 10) || 7));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);

  const orgKeypasses = hasDatabase()
    ? await dbListKeypassesByOrganisation(auth.organisationId)
    : Array.from(keypassesByCode.values()).filter((k) => k.organisationId === auth.organisationId);

  const now = new Date();
  const expiring = orgKeypasses.filter((kp) => {
    if (kp.status !== 'available') return false;
    const expiresAt = new Date(kp.expiresAt);
    return expiresAt > now && expiresAt <= cutoff;
  });

  return c.json({
    success: true,
    data: {
      organisationId: auth.organisationId,
      days,
      count: expiring.length,
      keypasses: expiring.map((kp) => ({ code: kp.code, expiresAt: kp.expiresAt })),
    },
  });
});

export default keypasses;
