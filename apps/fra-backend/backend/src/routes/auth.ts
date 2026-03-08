import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDbPool } from '../db.js';
import { hasDatabase, jsonError, requireAuth } from '../helpers.js';
import { getRedis } from '../redis.js';
import {
  signupSchema, loginSchema, refreshSchema, forgotPasswordSchema, resetPasswordSchema, profileUpdateSchema,
  refreshSecret,
  LOCKOUT_PREFIX, LOCKOUT_MAX_ATTEMPTS, LOCKOUT_WINDOW_SECONDS,
  RATE_LIMITS,
} from '../types.js';
import type { User } from '../types.js';
import { usersByEmail, refreshTokenAllowlist, organisationsById, accountLockouts } from '../stores.js';
import { getClientIp, rateLimit } from '../middleware.js';
import {
  dbGetUserByEmail, dbGetUserById, dbUpdateUserPasswordHash, dbUpdateUserProfile,
  dbUpsertRefreshToken, dbHasRefreshToken, dbDeleteRefreshToken, dbDeleteAllRefreshTokensForUser,
  dbGetOrganisationById,
  auditLog,
  setPasswordResetToken, getPasswordResetUserId, deletePasswordResetToken,
} from '../db/index.js';
import { issueTokens, publicUser } from '../auth-utils.js';
import { createLogger } from '../logger.js';

const logger = createLogger('auth');

const { AUTH_WINDOW_MS, SIGNUP_MAX, LOGIN_MAX, FORGOT_PASSWORD_MAX, RESET_PASSWORD_MAX, REFRESH_WINDOW_MS, REFRESH_MAX } = RATE_LIMITS;

// ── Auth helpers ────────────────────────────────────────────────

async function checkAccountLockout(email: string): Promise<{ locked: boolean; remaining: number }> {
  const redis = getRedis();
  const key = `${LOCKOUT_PREFIX}${email.toLowerCase()}`;

  if (!redis) {
    // In-memory fallback
    const entry = accountLockouts.get(key);
    if (!entry || entry.expiresAt < Date.now()) {
      return { locked: false, remaining: LOCKOUT_MAX_ATTEMPTS };
    }
    if (entry.count >= LOCKOUT_MAX_ATTEMPTS) {
      return { locked: true, remaining: 0 };
    }
    return { locked: false, remaining: LOCKOUT_MAX_ATTEMPTS - entry.count };
  }

  const count = await redis.get<number>(key) ?? 0;
  if (count >= LOCKOUT_MAX_ATTEMPTS) {
    return { locked: true, remaining: 0 };
  }
  return { locked: false, remaining: LOCKOUT_MAX_ATTEMPTS - count };
}

async function recordFailedLogin(email: string): Promise<void> {
  const redis = getRedis();
  const key = `${LOCKOUT_PREFIX}${email.toLowerCase()}`;

  if (!redis) {
    // In-memory fallback
    const entry = accountLockouts.get(key);
    const now = Date.now();
    if (!entry || entry.expiresAt < now) {
      accountLockouts.set(key, { count: 1, expiresAt: now + LOCKOUT_WINDOW_SECONDS * 1000 });
    } else {
      entry.count += 1;
    }
    return;
  }

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, LOCKOUT_WINDOW_SECONDS);
  }
}

async function clearFailedLogins(email: string): Promise<void> {
  const redis = getRedis();
  const key = `${LOCKOUT_PREFIX}${email.toLowerCase()}`;

  if (!redis) {
    accountLockouts.delete(key);
    return;
  }

  await redis.del(key);
}

// Dummy hash for timing-safe comparison when user is not found
const DUMMY_HASH = '$2a$12$000000000000000000000uGEjMjP7rqOHBwE0oFRnlJWx/.EHPqK';

// ── Routes ──────────────────────────────────────────────────────

const auth = new Hono();

auth.post('/auth/signup', async (c) => {
  const limited = await rateLimit('auth:signup', { windowMs: AUTH_WINDOW_MS, max: SIGNUP_MAX })(c);
  if (limited instanceof Response) return limited;

  const parsed = signupSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid signup payload');

  const { email, password, name } = parsed.data;
  const emailLc = email.toLowerCase();
  const existing = hasDatabase() ? await dbGetUserByEmail(emailLc) : usersByEmail.get(emailLc);
  if (existing) return jsonError(c, 409, 'SIGNUP_FAILED', 'Unable to create account. Please try signing in or resetting your password.');

  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date().toISOString();
  const user: User = {
    id: crypto.randomUUID(),
    email: emailLc,
    name,
    passwordHash,
    role: 'employer',
    organisationId: crypto.randomUUID(),
    createdAt: now,
  };

  const orgName = parsed.data.organisationName ?? 'Organisation';

  let workshopProfile = null;
  const workshopRoles: string[] = [];

  if (hasDatabase()) {
    const pool = getDbPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        'INSERT INTO public.users (id, email, name, password_hash, role, organisation_id, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [user.id, user.email, user.name, user.passwordHash, user.role, user.organisationId, user.createdAt]
      );
      await client.query(
        'INSERT INTO public.organisations (id, name, created_by_user_id, created_at, updated_at) VALUES ($1,$2,$3,$4,$5)',
        [user.organisationId, orgName, user.id, now, now]
      );

      const fullName = parsed.data.name;
      const sector = parsed.data.sector ?? 'private';
      const jobTitle = parsed.data.jobTitle ?? null;

      const profileRes = await client.query(
        `INSERT INTO workshop_profiles (user_id, full_name, organization_name, sector, job_title)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO NOTHING
         RETURNING *`,
        [user.id, fullName, orgName, sector, jobTitle]
      );
      workshopProfile = profileRes.rows[0] ?? null;

      const role = parsed.data.workshopRole ?? 'participant';
      await client.query(
        'INSERT INTO workshop_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [user.id, role]
      );
      workshopRoles.push(role);

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    usersByEmail.set(user.email, user);
    organisationsById.set(user.organisationId, {
      id: user.organisationId, name: orgName, createdByUserId: user.id,
      createdAt: now, updatedAt: now,
    });
  }

  const { accessToken, refreshToken } = issueTokens(user);
  if (hasDatabase()) {
    await dbUpsertRefreshToken(refreshToken, user.id);
  }

  await auditLog({
    eventType: 'auth.signup', actorId: user.id, actorEmail: user.email,
    organisationId: user.organisationId, resourceType: 'user', resourceId: user.id,
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
      profile: workshopProfile,
      workshopRoles,
    },
  });
});

auth.post('/auth/login', async (c) => {
  const limited = await rateLimit('auth:login', { windowMs: AUTH_WINDOW_MS, max: LOGIN_MAX })(c);
  if (limited instanceof Response) return limited;

  const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid login payload');

  const { email, password } = parsed.data;
  const emailLc = email.toLowerCase();

  // Account lockout check
  const lockout = await checkAccountLockout(emailLc);
  if (lockout.locked) {
    await auditLog({
      eventType: 'auth.lockout', actorEmail: emailLc,
      details: { reason: 'Too many failed login attempts' }, ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });
    // Return the same generic error as invalid credentials to prevent
    // account enumeration via lockout timing differences.
    return jsonError(c, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const user = hasDatabase() ? await dbGetUserByEmail(emailLc) : usersByEmail.get(emailLc);

  // Always run bcrypt.compare to prevent timing-based email enumeration
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user) {
    await recordFailedLogin(emailLc);
    return jsonError(c, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
  if (!ok) {
    await recordFailedLogin(emailLc);
    await auditLog({
      eventType: 'auth.failed_login', actorEmail: emailLc,
      details: { remaining: lockout.remaining - 1 }, ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });
    return jsonError(c, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  // Successful login - clear lockout counter
  await clearFailedLogins(emailLc);

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
    eventType: 'auth.login', actorId: user.id, actorEmail: user.email,
    organisationId: user.organisationId, resourceType: 'user', resourceId: user.id,
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
    },
  });
});

auth.get('/auth/me', async (c) => {
  const limited = await rateLimit('auth:me', { windowMs: 60_000, max: 30 })(c);
  if (limited instanceof Response) return limited;

  const authCtx = requireAuth(c);
  if (authCtx instanceof Response) return authCtx;

  if (!hasDatabase()) {
    const user = usersByEmail.get(authCtx.email.toLowerCase());
    if (!user) return jsonError(c, 401, 'UNAUTHORIZED', 'User not found');
    return c.json({ success: true, data: { ...publicUser(user), profile: null, workshopRoles: [] } });
  }

  const user = await dbGetUserByEmail(authCtx.email.toLowerCase());
  if (!user) return jsonError(c, 401, 'UNAUTHORIZED', 'User not found');

  const pool = getDbPool();
  const [profileRes, rolesRes] = await Promise.all([
    pool.query('SELECT * FROM workshop_profiles WHERE user_id = $1 LIMIT 1', [user.id]),
    pool.query('SELECT role FROM workshop_roles WHERE user_id = $1', [user.id]),
  ]);

  return c.json({
    success: true,
    data: {
      ...publicUser(user),
      profile: profileRes.rows[0] ?? null,
      workshopRoles: rolesRes.rows.map((r: { role: string }) => r.role),
    },
  });
});

auth.post('/auth/logout', async (c) => {
  const parsed = refreshSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid logout payload');

  if (parsed.data.refreshToken) {
    if (hasDatabase()) {
      await dbDeleteRefreshToken(parsed.data.refreshToken);
    } else {
      refreshTokenAllowlist.delete(parsed.data.refreshToken);
    }
  }
  return c.json({ success: true });
});

auth.post('/auth/refresh', async (c) => {
  const limited = await rateLimit('auth:refresh', { windowMs: REFRESH_WINDOW_MS, max: REFRESH_MAX })(c);
  if (limited instanceof Response) return limited;

  const parsed = refreshSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success || !parsed.data.refreshToken) {
    return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid refresh payload');
  }

  const { refreshToken } = parsed.data;
  if (hasDatabase()) {
    const exists = await dbHasRefreshToken(refreshToken);
    if (!exists) return jsonError(c, 401, 'REFRESH_REVOKED', 'Refresh token is revoked');
  } else {
    if (!refreshTokenAllowlist.has(refreshToken)) {
      return jsonError(c, 401, 'REFRESH_REVOKED', 'Refresh token is revoked');
    }
  }

  try {
    const payload = jwt.verify(refreshToken, refreshSecret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    if (payload.type !== 'refresh' || typeof payload.sub !== 'string') {
      return jsonError(c, 401, 'INVALID_REFRESH', 'Invalid refresh token');
    }

    const user = hasDatabase() ? await dbGetUserById(payload.sub) : Array.from(usersByEmail.values()).find((u) => u.id === payload.sub) ?? null;
    if (!user) return jsonError(c, 401, 'INVALID_REFRESH', 'Invalid refresh token');

    if (hasDatabase()) {
      await dbDeleteRefreshToken(refreshToken);
    } else {
      refreshTokenAllowlist.delete(refreshToken);
    }
    const tokens = issueTokens(user);
    if (hasDatabase()) {
      await dbUpsertRefreshToken(tokens.refreshToken, user.id);
    }

    return c.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
    });
  } catch (err: unknown) {
    logger.warn('Refresh token verification failed', { error: String(err) });
    if (hasDatabase()) {
      await dbDeleteRefreshToken(refreshToken).catch((e) => logger.warn('Failed to delete refresh token during cleanup', { error: String(e) }));
    } else {
      refreshTokenAllowlist.delete(refreshToken);
    }
    return jsonError(c, 401, 'INVALID_REFRESH', 'Invalid refresh token');
  }
});

auth.post('/auth/forgot-password', async (c) => {
  const limited = await rateLimit('auth:forgot', { windowMs: AUTH_WINDOW_MS, max: FORGOT_PASSWORD_MAX })(c);
  if (limited instanceof Response) return limited;

  const parsed = forgotPasswordSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid forgot-password payload');

  const emailLc = parsed.data.email.toLowerCase();
  const user = hasDatabase() ? await dbGetUserByEmail(emailLc) : usersByEmail.get(emailLc);

  let resetToken: string | undefined;

  if (user) {
    resetToken = crypto.randomUUID();
    await setPasswordResetToken(resetToken, user.id);

    await auditLog({
      eventType: 'auth.forgot_password', actorEmail: emailLc,
      resourceType: 'user', resourceId: user.id, ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });
  }

  // Always return the same message to prevent email enumeration
  const response: Record<string, unknown> = {
    success: true,
    message: 'If an account with that email exists, a password reset link has been sent.',
  };

  // Only expose token in development for testing
  if (process.env.NODE_ENV !== 'production' && resetToken) {
    response.resetToken = resetToken;
  }

  return c.json(response);
});

auth.post('/auth/reset-password', async (c) => {
  const limited = await rateLimit('auth:reset', { windowMs: AUTH_WINDOW_MS, max: RESET_PASSWORD_MAX })(c);
  if (limited instanceof Response) return limited;

  const parsed = resetPasswordSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid reset-password payload');

  const userId = await getPasswordResetUserId(parsed.data.token);
  if (!userId) {
    return jsonError(c, 400, 'INVALID_TOKEN', 'Invalid or expired reset token');
  }

  // Delete token immediately to prevent reuse if password change fails
  await deletePasswordResetToken(parsed.data.token);

  const user = hasDatabase() ? await dbGetUserById(userId) : Array.from(usersByEmail.values()).find((u) => u.id === userId) ?? null;
  if (!user) {
    return jsonError(c, 400, 'INVALID_TOKEN', 'Invalid or expired reset token');
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
  if (hasDatabase()) {
    await dbUpdateUserPasswordHash(user.id, newHash);
    await dbDeleteAllRefreshTokensForUser(user.id);
  } else {
    user.passwordHash = newHash;
    for (const token of Array.from(refreshTokenAllowlist.values())) {
      try {
        const payload = jwt.decode(token) as jwt.JwtPayload | null;
        if (payload && payload.sub === user.id) refreshTokenAllowlist.delete(token);
      } catch {
        refreshTokenAllowlist.delete(token);
      }
    }
  }

  await auditLog({
    eventType: 'auth.reset_password', actorId: user.id, actorEmail: user.email,
    resourceType: 'user', resourceId: user.id, ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent'),
  });

  return c.json({ success: true });
});

auth.patch('/auth/profile', async (c) => {
  const limited = await rateLimit('auth:profile', { windowMs: AUTH_WINDOW_MS, max: 20 })(c);
  if (limited instanceof Response) return limited;

  const authCtx = requireAuth(c);
  if (authCtx instanceof Response) return authCtx;

  const parsed = profileUpdateSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid profile payload');

  const { name, department } = parsed.data;

  if (hasDatabase()) {
    await dbUpdateUserProfile(authCtx.userId, { name, department });
  } else {
    const user = Array.from(usersByEmail.values()).find((u) => u.id === authCtx.userId);
    if (!user) return jsonError(c, 401, 'UNAUTHORIZED', 'User not found');
    if (name !== undefined) user.name = name;
    if (department !== undefined) user.department = department || undefined;
  }

  await auditLog({
    eventType: 'auth.profile_update', actorId: authCtx.userId, actorEmail: authCtx.email,
    organisationId: authCtx.organisationId, resourceType: 'user', resourceId: authCtx.userId,
    details: { name, department }, ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent'),
  });

  // Return updated user data
  const updatedUser = hasDatabase()
    ? await dbGetUserById(authCtx.userId)
    : Array.from(usersByEmail.values()).find((u) => u.id === authCtx.userId) ?? null;

  if (!updatedUser) return jsonError(c, 401, 'UNAUTHORIZED', 'User not found');

  return c.json({
    success: true,
    data: { ...publicUser(updatedUser), department: updatedUser.department ?? null },
  });
});

auth.get('/debug/db/ping', async (c) => {
  if (process.env.NODE_ENV === 'production') {
    return jsonError(c, 404, 'NOT_FOUND', 'Not found');
  }

  const authCtx = requireAuth(c);
  if (authCtx instanceof Response) return authCtx;

  try {
    const pool = getDbPool();
    const result = await pool.query('select 1 as ok');
    return c.json({ success: true, data: { ok: result.rows?.[0]?.ok === 1 } });
  } catch (error: unknown) {
    logger.error('Debug DB ping failed', { error: error instanceof Error ? error.message : String(error) });
    return jsonError(c, 500, 'DB_UNAVAILABLE', 'Database health check failed');
  }
});

export default auth;
