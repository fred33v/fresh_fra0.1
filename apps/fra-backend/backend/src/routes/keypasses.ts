import type { DbExecutor } from '../db/transaction.js';
import { withKeypassLock } from '../keypass-lock.js';
import { Hono, type Context } from 'hono';
import bcrypt from 'bcryptjs';
import { getActiveWindows, getEntitlementWindows, hasDatabase, jsonError, requireAuth } from '../helpers.js';
import { keypassGenerateSchema, keypassInviteSchema, keypassValidateSchema, keypassUseSchema, keypassBulkSchema, RATE_LIMITS, KEYPASS_GRACE_PERIOD_DAYS, parsePagination, paginate, requireUUIDParam } from '../types.js';
import type { User, Keypass } from '../types.js';
import { usersByEmail, organisationsById, keypassesByCode } from '../stores.js';
import { getClientIp, rateLimit } from '../middleware.js';
import { generateKeypassCode } from '../s3.js';
import {
  dbGetUserByEmail, dbInsertUser,
  dbInsertKeypassBatch, dbGetKeypassByCode, dbUpdateKeypassStatus, dbClaimKeypass, dbListKeypassesByOrganisation, dbGetKeypassStatsByOrganisation,
  dbGetOrganisationById,
  dbUpsertRefreshToken, dbTouchKeypassInvite,
  auditLog,
} from '../db/index.js';
import { emailConfigured, keypassInviteEmail, sendEmailInBackground } from '../email.js';
import { sendVerificationLink } from './auth.js';
import type { KeypassStatus } from '../types.js';
import { issueTokens, publicUser } from '../auth-utils.js';
import { getActiveKeypassAllowance, listOrgPurchases } from '../entitlements.js';
import { emitOrgEvent, enqueueOrgEvent } from '../webhooks-out.js';
import { createLogger } from '../logger.js';

const logger = createLogger('keypasses');

class KeypassClaimConflict extends Error {}

// ── Quota helper ────────────────────────────────────────────────

async function getOrgKeypassQuota(orgId: string, db?: DbExecutor): Promise<{ allowance: number; used: number }> {
  // Allowance comes from the org's active (unexpired) packages; -1 = unlimited
  const allowance = await getActiveKeypassAllowance(await listOrgPurchases(orgId, db), db);

  // Count existing keypasses (all statuses except revoked/expired count towards quota)
  const allKeypasses = hasDatabase()
    ? await dbListKeypassesByOrganisation(orgId, db)
    : Array.from(keypassesByCode.values()).filter((k) => k.organisationId === orgId);

  const used = allKeypasses.filter((k) => k.status === 'available' || k.status === 'used').length;

  return { allowance, used };
}

// ── Package window helper ───────────────────────────────────────

/**
 * When the org's key-passes must stop working: a Date, null when only packages with no end
 * date (Starter) are active, or undefined when no package is active at all.
 *
 * A one-time Starter purchase never ends, so it must not lift the limit of a yearly package
 * bought alongside it: as soon as a package with an end date is active, codes stop at its end
 * (counting renewals already paid for, which start when the current term ends).
 */
async function getPackageEnd(orgId: string, now: Date = new Date(), db?: DbExecutor): Promise<Date | null | undefined> {
  const purchases = await listOrgPurchases(orgId, db);
  const active = getActiveWindows(purchases, now);
  if (active.length === 0) return undefined;
  const datedPackages = new Set(active.filter((w) => w.expiresAt !== null).map((w) => w.purchase.packageId));
  if (datedPackages.size === 0) return null;
  const ends = getEntitlementWindows(purchases)
    .filter((w) => datedPackages.has(w.purchase.packageId) && w.expiresAt !== null && w.expiresAt.getTime() > now.getTime())
    .map((w) => (w.expiresAt as Date).getTime());
  return new Date(Math.max(...ends));
}

/**
 * Whether the org's current packages still cover one more employee joining. A code issued under
 * a package that has since ended (Professional, 50 codes) must not keep working because a smaller
 * package (Starter, 1 code) is still active.
 */
async function packageCoversAnotherJoin(orgId: string, db?: DbExecutor): Promise<boolean> {
  const allowance = await getActiveKeypassAllowance(await listOrgPurchases(orgId, db), db);
  if (allowance < 0) return true;
  const all = hasDatabase()
    ? await dbListKeypassesByOrganisation(orgId, db)
    : Array.from(keypassesByCode.values()).filter((k) => k.organisationId === orgId);
  return all.filter((k) => k.status === 'used').length < allowance;
}

// ── Keypass creation helper ──────────────────────────────────────

async function createKeypasses(
  orgId: string, quantity: number, expiresInDays: number, packageEnd: Date | null, invitedEmails?: string[], db?: DbExecutor,
): Promise<{ codes: string[]; expiresAt: string }> {
  const now = Date.now();
  // A code never outlives the package that paid for it
  const requestedEnd = now + expiresInDays * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(packageEnd ? Math.min(requestedEnd, packageEnd.getTime()) : requestedEnd).toISOString();
  const createdAt = new Date(now).toISOString();

  const keypasses: Keypass[] = [];
  for (let i = 0; i < quantity; i++) {
    let code = generateKeypassCode();
    // Ensure uniqueness (check both in-memory and DB)
    if (hasDatabase()) {
      while (await dbGetKeypassByCode(code, db)) code = generateKeypassCode();
    } else {
      while (keypassesByCode.has(code)) code = generateKeypassCode();
    }

    const invitedEmail = invitedEmails?.[i];
    keypasses.push({
      code, organisationId: orgId, status: 'available', createdAt, expiresAt,
      ...(invitedEmail ? { invitedEmail, invitedAt: createdAt } : {}),
    });
  }

  if (hasDatabase()) {
    await dbInsertKeypassBatch(keypasses, db);
  } else {
    for (const kp of keypasses) {
      keypassesByCode.set(kp.code, kp);
    }
  }

  return { codes: keypasses.map((kp) => kp.code), expiresAt };
}

// ── Routes ──────────────────────────────────────────────────────

const keypasses = new Hono();

async function issueKeypasses(c: Context, kind: 'generate' | 'allocate') {
  const limited = await rateLimit(`keypass:${kind}`, { windowMs: RATE_LIMITS.KEYPASS_GENERATE_WINDOW_MS, max: RATE_LIMITS.KEYPASS_GENERATE_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (auth.role !== 'employer' && auth.role !== 'admin') {
    return jsonError(c, 403, 'FORBIDDEN', 'Requires employer or admin role');
  }

  const parsed = keypassGenerateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', `Invalid keypass ${kind} payload`);

  return withKeypassLock(auth.organisationId, async (db) => {
    const quota = await getOrgKeypassQuota(auth.organisationId, db);
    if (quota.allowance === 0) {
      return jsonError(c, 403, 'NO_PACKAGE', 'No active package with keypass allowance');
    }
    const remaining = quota.allowance < 0 ? Infinity : quota.allowance - quota.used;
    if (parsed.data.quantity > remaining) {
      return jsonError(c, 400, 'QUOTA_EXCEEDED', `Keypass quota exceeded. Remaining: ${remaining}, requested: ${parsed.data.quantity}`);
    }

    const packageEnd = (await getPackageEnd(auth.organisationId, new Date(), db)) ?? null;
    const { codes, expiresAt } = await createKeypasses(auth.organisationId, parsed.data.quantity, parsed.data.expiresInDays, packageEnd, undefined, db);

    await auditLog({
      eventType: `keypass.${kind}`, actorId: auth.userId, actorEmail: auth.email,
      organisationId: auth.organisationId, resourceType: 'keypass',
      details: { quantity: parsed.data.quantity }, ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    }, db);

    return c.json({ success: true, data: { organisationId: auth.organisationId, expiresAt, codes } });
  });
}

keypasses.post('/keypasses/generate', (c) => issueKeypasses(c, 'generate'));
// Same behaviour under the name the mobile app calls
keypasses.post('/keypasses/allocate', (c) => issueKeypasses(c, 'allocate'));

async function organisationName(orgId: string, db?: DbExecutor): Promise<string> {
  const org = hasDatabase() ? await dbGetOrganisationById(orgId, db) : organisationsById.get(orgId);
  return org?.name ?? 'Your organisation';
}

// The employer types their staff's addresses: each person gets their own key-pass by email,
// usable only with that address, so the account that joins is known to be theirs.
keypasses.post('/keypasses/invite', async (c) => {
  const limited = await rateLimit('keypass:invite', { windowMs: RATE_LIMITS.KEYPASS_GENERATE_WINDOW_MS, max: RATE_LIMITS.KEYPASS_GENERATE_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (auth.role !== 'employer' && auth.role !== 'admin') {
    return jsonError(c, 403, 'FORBIDDEN', 'Requires employer or admin role');
  }

  const parsed = keypassInviteSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Enter valid email addresses, at most 100 at a time');

  return withKeypassLock(auth.organisationId, async (db, afterCommit) => {
    const skipped: Array<{ email: string; reason: 'account_exists' | 'already_invited' | 'duplicate' }> = [];
    const existingCodes = hasDatabase()
      ? await dbListKeypassesByOrganisation(auth.organisationId, db)
      : Array.from(keypassesByCode.values()).filter((k) => k.organisationId === auth.organisationId);
    const pendingInvites = new Set(existingCodes.filter((k) => k.status === 'available' && k.invitedEmail).map((k) => k.invitedEmail));
    const seen = new Set<string>();
    const toInvite: string[] = [];
    for (const email of parsed.data.emails) {
      if (seen.has(email)) { skipped.push({ email, reason: 'duplicate' }); continue; }
      seen.add(email);
      if (pendingInvites.has(email)) { skipped.push({ email, reason: 'already_invited' }); continue; }
      const user = hasDatabase() ? await dbGetUserByEmail(email, db) : usersByEmail.get(email);
      if (user) { skipped.push({ email, reason: 'account_exists' }); continue; }
      toInvite.push(email);
    }

    if (toInvite.length === 0) return c.json({ success: true, data: { invited: [], skipped, emailSent: emailConfigured() } });

    const quota = await getOrgKeypassQuota(auth.organisationId, db);
    if (quota.allowance === 0) return jsonError(c, 403, 'NO_PACKAGE', 'No active package with keypass allowance');
    const remaining = quota.allowance < 0 ? Infinity : quota.allowance - quota.used;
    if (toInvite.length > remaining) {
      return jsonError(c, 400, 'QUOTA_EXCEEDED', `Keypass quota exceeded. Remaining: ${remaining}, requested: ${toInvite.length}`);
    }

    const packageEnd = (await getPackageEnd(auth.organisationId, new Date(), db)) ?? null;
    const { codes, expiresAt } = await createKeypasses(auth.organisationId, toInvite.length, parsed.data.expiresInDays, packageEnd, toInvite, db);
    const orgName = await organisationName(auth.organisationId, db);
    const invited = toInvite.map((email, i) => ({ email, code: codes[i], expiresAt }));
    for (const inv of invited) {
      afterCommit(() => sendEmailInBackground(keypassInviteEmail(inv.email, orgName, inv.code, expiresAt), { organisationId: auth.organisationId, kind: 'keypass_invite' }));
    }

    await auditLog({
      eventType: 'keypass.invite', actorId: auth.userId, actorEmail: auth.email,
      organisationId: auth.organisationId, resourceType: 'keypass',
      details: { invited: invited.length, skipped: skipped.length }, ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    }, db);

    return c.json({ success: true, data: { invited, skipped, emailSent: emailConfigured() } });
  });
});

keypasses.post('/keypasses/:code/resend', async (c) => {
  const limited = await rateLimit('keypass:invite', { windowMs: RATE_LIMITS.KEYPASS_GENERATE_WINDOW_MS, max: RATE_LIMITS.KEYPASS_GENERATE_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (auth.role !== 'employer' && auth.role !== 'admin') {
    return jsonError(c, 403, 'FORBIDDEN', 'Requires employer or admin role');
  }

  const code = c.req.param('code').toUpperCase();
  const kp = hasDatabase() ? await dbGetKeypassByCode(code) : keypassesByCode.get(code);
  if (!kp || kp.organisationId !== auth.organisationId || !kp.invitedEmail) return jsonError(c, 404, 'NOT_FOUND', 'Invitation not found');
  if (kp.status !== 'available' || new Date(kp.expiresAt).getTime() < Date.now()) {
    return jsonError(c, 409, 'NOT_AVAILABLE', 'This key-pass can no longer be used. Send a new invitation.');
  }

  const now = new Date().toISOString();
  if (hasDatabase()) await dbTouchKeypassInvite(code, now);
  else kp.invitedAt = now;
  sendEmailInBackground(keypassInviteEmail(kp.invitedEmail, await organisationName(auth.organisationId), code, kp.expiresAt), { organisationId: auth.organisationId, kind: 'keypass_invite' });

  await auditLog({
    eventType: 'keypass.invite_resent', actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 'keypass', resourceId: code, ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent'),
  });
  return c.json({ success: true, data: { code, invitedEmail: kp.invitedEmail, invitedAt: now, emailSent: emailConfigured() } });
});

keypasses.post('/keypasses/use', async (c) => {
  const limited = await rateLimit('keypass:use', { windowMs: RATE_LIMITS.KEYPASS_WINDOW_MS, max: RATE_LIMITS.KEYPASS_MAX })(c);
  if (limited instanceof Response) return limited;

  const parsed = keypassUseSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid keypass use payload');

  const code = parsed.data.code.toUpperCase();
  const initial = hasDatabase() ? await dbGetKeypassByCode(code) : keypassesByCode.get(code);
  if (!initial) return jsonError(c, 404, 'NOT_FOUND', 'Keypass not found');
  try {
    return await withKeypassLock(initial.organisationId, async (db, afterCommit) => {
      const writeAudit = (event: Parameters<typeof auditLog>[0]) => auditLog(event, db);
      const kp = hasDatabase() ? await dbGetKeypassByCode(code, db) : keypassesByCode.get(code);
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
            await dbUpdateKeypassStatus(code, 'expired', undefined, undefined, db);
          } else {
            kp.status = 'expired';
          }
        }
        return jsonError(c, 400, 'EXPIRED', 'Keypass is expired');
      }

      if (kp.status !== 'available') return jsonError(c, 400, 'NOT_AVAILABLE', 'Keypass is not available');

      // A code only works while a package covers it, even inside the grace period
      if ((await getPackageEnd(kp.organisationId, new Date(), db)) === undefined || !(await packageCoversAnotherJoin(kp.organisationId, db))) {
        await writeAudit({
          eventType: 'keypass.use_rejected', actorEmail: parsed.data.email.toLowerCase(),
          organisationId: kp.organisationId, resourceType: 'keypass', resourceId: code,
          details: { reason: 'package_inactive' }, ipAddress: getClientIp(c),
          userAgent: c.req.header('user-agent'),
        });
        return jsonError(c, 403, 'PACKAGE_INACTIVE', "This organisation's package is no longer active");
      }

      const email = parsed.data.email.toLowerCase();
      const name = parsed.data.name ?? email.split('@')[0];

      // An emailed key-pass belongs to the person it was sent to
      if (kp.invitedEmail && kp.invitedEmail !== email) {
        await writeAudit({
          eventType: 'keypass.use_rejected', actorEmail: email,
          organisationId: kp.organisationId, resourceType: 'keypass', resourceId: code,
          details: { reason: 'email_mismatch' }, ipAddress: getClientIp(c),
          userAgent: c.req.header('user-agent'),
        });
        return jsonError(c, 403, 'EMAIL_MISMATCH', 'This key-pass was sent to a different email address. Use the address the invitation was sent to.');
      }

      // A keypass only ever creates a new employee account. Issuing tokens for an existing
      // account here would let anyone holding a keypass sign in as any user by email.
      const existing = hasDatabase() ? await dbGetUserByEmail(email, db) : usersByEmail.get(email);
      if (existing) {
        await writeAudit({
          eventType: 'keypass.use_rejected', actorEmail: email,
          organisationId: kp.organisationId, resourceType: 'keypass', resourceId: code,
          details: { reason: 'account_exists' }, ipAddress: getClientIp(c),
          userAgent: c.req.header('user-agent'),
        });
        return jsonError(c, 409, 'ACCOUNT_EXISTS', 'An account with this email already exists. Please sign in instead.');
      }

      if (nowMs > expiresAt) {
        // Within grace period — allow but log warning
        logger.warn('Keypass used during grace period', { code, expiresAt: kp.expiresAt });
      }

      const user: User = {
        id: crypto.randomUUID(),
        email,
        name,
        passwordHash: await bcrypt.hash(parsed.data.password, 12),
        role: 'employee',
        organisationId: kp.organisationId,
        createdAt: now,
        // The invitation link reached this inbox, which proves the address. A key-pass passed on
        // any other way proves nothing about it, so the address is confirmed like any sign-up.
        emailVerifiedAt: kp.invitedEmail ? now : null,
      };
      if (hasDatabase()) {
        await dbInsertUser(user, db);
      } else {
        kp.status = 'used';
        kp.usedAt = now;
        usersByEmail.set(email, user);
      }

      if (!hasDatabase()) kp.usedByUserId = user.id;

      if (hasDatabase()) {
        const claimed = await dbClaimKeypass(code, now, user.id, db);
        if (!claimed) throw new KeypassClaimConflict();
      }

      const { accessToken, refreshToken } = issueTokens(user);
      if (hasDatabase()) {
        await dbUpsertRefreshToken(refreshToken, user.id, db);
      }
      // They can start now; they confirm the address before they next sign in
      const emailConfirmationRequired = !kp.invitedEmail;
      if (emailConfirmationRequired) afterCommit(() => { void sendVerificationLink(user); });

      let orgName = 'Organisation';
      if (hasDatabase()) {
        const org = await dbGetOrganisationById(user.organisationId, db);
        if (org) orgName = org.name;
      } else {
        const org = organisationsById.get(user.organisationId);
        if (org) orgName = org.name;
      }

      await writeAudit({
        eventType: 'keypass.use', actorId: user.id, actorEmail: user.email,
        organisationId: user.organisationId, resourceType: 'keypass', resourceId: code,
        ipAddress: getClientIp(c),
        userAgent: c.req.header('user-agent'),
      });
      const eventData={userId:user.id,email:user.email,keypass:`****${code.slice(-4)}`,usedAt:now};
      if(db)await enqueueOrgEvent(user.organisationId,'keypass.used',eventData,db);
      else afterCommit(()=>{void emitOrgEvent(user.organisationId,'keypass.used',eventData);});

      return c.json({
        success: true,
        data: {
          user: publicUser(user),
          organisation: { organisationId: user.organisationId, name: orgName },
          accessToken,
          refreshToken,
          keypass: { code: kp.code, usedAt: now },
          emailConfirmationRequired,
        },
      });
    });
  } catch (error) {
    if (error instanceof KeypassClaimConflict) {
      return jsonError(c, 409, 'ALREADY_USED', 'Keypass has already been used');
    }
    // Signup can race a redemption in another organisation on the same email.
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
      && 'constraint' in error && error.constraint === 'users_email_key') {
      return jsonError(c, 409, 'ACCOUNT_EXISTS', 'An account with this email already exists. Please sign in instead.');
    }
    throw error;
  }
});

keypasses.post('/keypasses/revoke', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (auth.role !== 'employer' && auth.role !== 'admin') {
    return jsonError(c, 403, 'FORBIDDEN', 'Requires employer or admin role');
  }

  const parsed = keypassValidateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid keypass revoke payload');

  return withKeypassLock(auth.organisationId, async (db) => {
    const code = parsed.data.code.toUpperCase();
    const kp = hasDatabase() ? await dbGetKeypassByCode(code, db) : keypassesByCode.get(code);
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
      await dbUpdateKeypassStatus(code, 'revoked', undefined, undefined, db);
    } else {
      kp.status = 'revoked';
    }

    await auditLog({
      eventType: 'keypass.revoke', actorId: auth.userId, actorEmail: auth.email,
      organisationId: auth.organisationId, resourceType: 'keypass', resourceId: code,
      ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    }, db);

    return c.json({ success: true });
  });
});

keypasses.get('/keypasses/organisation/:orgId', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  // Unused codes let anyone join the organisation, so only employers and admins may see them
  if (auth.role !== 'employer' && auth.role !== 'admin') {
    return jsonError(c, 403, 'FORBIDDEN', 'Requires employer or admin role');
  }

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
  if (auth.role !== 'employer' && auth.role !== 'admin') {
    return jsonError(c, 403, 'FORBIDDEN', 'Requires employer or admin role');
  }

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

  if ((await getPackageEnd(kp.organisationId)) === undefined || !(await packageCoversAnotherJoin(kp.organisationId))) {
    return jsonError(c, 403, 'PACKAGE_INACTIVE', "This organisation's package is no longer active");
  }

  const inGracePeriod = Date.now() > expiresAtMs;

  return c.json({
    success: true,
    data: {
      valid: true,
      expiresAt: kp.expiresAt,
      // Whether the code only works with the address it was emailed to (never which address)
      forInvitedEmail: !!kp.invitedEmail,
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
  const packageEnd = await getPackageEnd(orgId);

  return c.json({
    success: true,
    data: {
      organisationId: orgId,
      // Codes cannot be valid past this date; null when no package with an end date is active
      packageEndsAt: packageEnd ? packageEnd.toISOString() : null,
      allowance: quota.allowance,
      unlimited: quota.allowance < 0,
      used: quota.used,
      remaining: quota.allowance < 0 ? null : Math.max(0, quota.allowance - quota.used),
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

  return withKeypassLock(auth.organisationId, async (db) => {
    const results: { code: string; revoked: boolean; reason?: string }[] = [];

    for (const rawCode of parsed.data.codes) {
      const code = rawCode.toUpperCase();
      const kp = hasDatabase() ? await dbGetKeypassByCode(code, db) : keypassesByCode.get(code);

      if (!kp || kp.organisationId !== auth.organisationId) {
        results.push({ code, revoked: false, reason: 'not_found' });
        continue;
      }

      if (kp.status === 'revoked') {
        results.push({ code, revoked: false, reason: 'already_revoked' });
        continue;
      }

      // A redeemed code belongs to an employee; revoking it would free a slot past the package allowance
      if (kp.status === 'used') {
        results.push({ code, revoked: false, reason: 'already_used' });
        continue;
      }

      if (hasDatabase()) {
        await dbUpdateKeypassStatus(code, 'revoked', undefined, undefined, db);
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
    }, db);

    return c.json({ success: true, data: { results } });
  });
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
