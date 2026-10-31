import { Hono, type Context } from 'hono';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDbPool } from '../db.js';
import { hasDatabase, jsonError, requireAuth } from '../helpers.js';
import { getRedis } from '../redis.js';
import {
  signupSchema, loginSchema, refreshSchema, forgotPasswordSchema, resetPasswordSchema, verifyEmailSchema, profileUpdateSchema,
  refreshSecret,
  LOCKOUT_PREFIX, LOCKOUT_MAX_ATTEMPTS, LOCKOUT_ACCOUNT_MAX_ATTEMPTS, LOCKOUT_WINDOW_SECONDS,
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
  setEmailVerificationToken, getEmailVerificationUserId, deleteEmailVerificationToken,
  dbMarkUserEmailVerified,
} from '../db/index.js';
import { issueTokens, publicUser } from '../auth-utils.js';
import { createLogger } from '../logger.js';
import { accountExistsEmail, passwordChangedEmail, passwordResetEmail, sendEmailInBackground, verifyEmailEmail } from '../email.js';

const logger = createLogger('auth');

const { AUTH_WINDOW_MS, SIGNUP_MAX, LOGIN_MAX, FORGOT_PASSWORD_MAX, RESET_PASSWORD_MAX, REFRESH_WINDOW_MS, REFRESH_MAX } = RATE_LIMITS;

// ── Auth helpers ────────────────────────────────────────────────

// Failed logins are counted twice: per account and client address, which locks out
// someone guessing a password, and per account across all addresses, a much higher
// ceiling that stops a guesser spread over many addresses. Counting per address means
// a stranger who knows an email cannot lock its owner out of their own account.
//
// The counters live in Redis when it is configured. If Redis errors, logins fall back
// to the per-process counters rather than failing outright.
function lockoutKeys(email: string, ip: string): { client: string; account: string } {
  const account = `${LOCKOUT_PREFIX}${email.toLowerCase()}`;
  return { client: `${account}:${ip}`, account };
}

function lockoutRedisError(err: unknown): void {
  logger.warn('Account lockout Redis error, using in-memory fallback', { error: (err as Error).message });
}

async function readFailures(key: string): Promise<number> {
  const redis = getRedis();
  if (redis) {
    try {
      return (await redis.get<number>(key)) ?? 0;
    } catch (err) {
      lockoutRedisError(err);
    }
  }
  const entry = accountLockouts.get(key);
  return entry && entry.expiresAt >= Date.now() ? entry.count : 0;
}

async function addFailure(key: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, LOCKOUT_WINDOW_SECONDS);
      }
      return;
    } catch (err) {
      lockoutRedisError(err);
    }
  }
  const entry = accountLockouts.get(key);
  const now = Date.now();
  if (!entry || entry.expiresAt < now) {
    accountLockouts.set(key, { count: 1, expiresAt: now + LOCKOUT_WINDOW_SECONDS * 1000 });
  } else {
    entry.count += 1;
  }
}

async function clearFailures(key: string): Promise<void> {
  accountLockouts.delete(key);
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(key);
    } catch (err) {
      lockoutRedisError(err);
    }
  }
}

async function checkAccountLockout(email: string, ip: string): Promise<{ locked: boolean; remaining: number }> {
  const keys = lockoutKeys(email, ip);
  const [clientFailures, accountFailures] = await Promise.all([readFailures(keys.client), readFailures(keys.account)]);
  if (clientFailures >= LOCKOUT_MAX_ATTEMPTS || accountFailures >= LOCKOUT_ACCOUNT_MAX_ATTEMPTS) {
    return { locked: true, remaining: 0 };
  }
  return { locked: false, remaining: LOCKOUT_MAX_ATTEMPTS - clientFailures };
}

async function recordFailedLogin(email: string, ip: string): Promise<void> {
  const keys = lockoutKeys(email, ip);
  await Promise.all([addFailure(keys.client), addFailure(keys.account)]);
}

async function clearFailedLogins(email: string, ip: string): Promise<void> {
  // A correct password from one address clears that address only; the account-wide
  // count keeps running so a guesser elsewhere is still held back
  await clearFailures(lockoutKeys(email, ip).client);
}

// ── Email confirmation ─────────────────────────────────────────

/** Issues a confirmation link and emails it. Returns the token (shown to developers outside production). */
export async function sendVerificationLink(user: User): Promise<string | undefined> {
  const token = crypto.randomUUID();
  try {
    await setEmailVerificationToken(token, user.id);
    sendEmailInBackground(verifyEmailEmail(user.email, user.name, token), { userId: user.id, kind: 'verify_email' });
    return token;
  } catch (err: unknown) {
    logger.error('Could not issue an email confirmation link', { userId: user.id, error: String(err) });
    return undefined;
  }
}

function signupPendingResponse(c: Context, email: string, verificationToken?: string) {
  const data: Record<string, unknown> = { pendingVerification: true, email };
  // Lets local development and tests finish sign-up without an inbox
  if (process.env.NODE_ENV !== 'production' && verificationToken) data.verificationToken = verificationToken;
  return c.json({
    success: true,
    message: 'Check your email: we have sent a link to confirm your address and finish setting up your account.',
    data,
  });
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
  // Hashed either way, so a new and an already-registered email take the same time
  const passwordHash = await bcrypt.hash(password, 12);

  if (existing) {
    // Same reply as a new sign-up, so the form cannot be used to find out who has an
    // account. The owner gets an email telling them, or a fresh link if never confirmed.
    if (existing.emailVerifiedAt === null) {
      void sendVerificationLink(existing);
    } else {
      sendEmailInBackground(accountExistsEmail(existing.email, existing.name), { userId: existing.id, kind: 'account_exists' });
    }
    return signupPendingResponse(c, emailLc);
  }

  const now = new Date().toISOString();
  const user: User = {
    id: crypto.randomUUID(),
    email: emailLc,
    name,
    passwordHash,
    role: 'employer',
    organisationId: crypto.randomUUID(),
    createdAt: now,
    emailVerifiedAt: null,
  };

  const orgName = parsed.data.organisationName ?? 'Organisation';

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

      await client.query(
        `INSERT INTO workshop_profiles (user_id, full_name, organization_name, sector, job_title)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (user_id) DO NOTHING`,
        [user.id, fullName, orgName, sector, jobTitle]
      );

      const role = 'participant';
      await client.query(
        'INSERT INTO workshop_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [user.id, role]
      );

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

  await auditLog({
    eventType: 'auth.signup', actorId: user.id, actorEmail: user.email,
    organisationId: user.organisationId, resourceType: 'user', resourceId: user.id,
    ipAddress: getClientIp(c),
    userAgent: c.req.header('user-agent'),
  });

  const verificationToken = await sendVerificationLink(user);
  return signupPendingResponse(c, emailLc, verificationToken);
});

auth.post('/auth/login', async (c) => {
  const limited = await rateLimit('auth:login', { windowMs: AUTH_WINDOW_MS, max: LOGIN_MAX })(c);
  if (limited instanceof Response) return limited;

  const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid login payload');

  const { email, password } = parsed.data;
  const emailLc = email.toLowerCase();

  // Account lockout check
  const lockout = await checkAccountLockout(emailLc, getClientIp(c));
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
    await recordFailedLogin(emailLc, getClientIp(c));
    return jsonError(c, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
  if (!ok) {
    await recordFailedLogin(emailLc, getClientIp(c));
    await auditLog({
      eventType: 'auth.failed_login', actorEmail: emailLc,
      details: { remaining: lockout.remaining - 1 }, ipAddress: getClientIp(c),
      userAgent: c.req.header('user-agent'),
    });
    return jsonError(c, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  // Successful login - clear lockout counter
  await clearFailedLogins(emailLc, getClientIp(c));

  // The right password proves who they are, so saying the email is unconfirmed reveals nothing
  if (user.emailVerifiedAt === null) {
    void sendVerificationLink(user);
    return jsonError(c, 403, 'EMAIL_NOT_VERIFIED', 'Please confirm your email address first. We have sent you a new link.');
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

/**
 * People who joined with a key-pass (and accounts made before workshop profiles existed)
 * have no workshop profile; the web app needs one to show their pages, so build it from
 * the account and organisation. The sector follows the organisation's creator.
 */
async function accountProfile(user: User) {
  let organisationName = 'Organisation';
  let sector = 'private';
  if (hasDatabase()) {
    const org = await dbGetOrganisationById(user.organisationId);
    if (org) organisationName = org.name;
    const creator = await getDbPool().query(
      `SELECT wp.sector FROM workshop_profiles wp JOIN public.organisations o ON o.created_by_user_id = wp.user_id
       WHERE o.id = $1 LIMIT 1`, [user.organisationId]);
    if (creator.rows[0]?.sector) sector = creator.rows[0].sector;
  } else {
    organisationName = organisationsById.get(user.organisationId)?.name ?? organisationName;
  }
  return {
    id: `account-${user.id}`, user_id: user.id, full_name: user.name, organization_name: organisationName,
    sector, job_title: null, created_at: user.createdAt, updated_at: user.createdAt,
  };
}

auth.get('/auth/me', async (c) => {
  const limited = await rateLimit('auth:me', { windowMs: 60_000, max: 30 })(c);
  if (limited instanceof Response) return limited;

  const authCtx = requireAuth(c);
  if (authCtx instanceof Response) return authCtx;

  if (!hasDatabase()) {
    const user = usersByEmail.get(authCtx.email.toLowerCase());
    if (!user) return jsonError(c, 401, 'UNAUTHORIZED', 'User not found');
    return c.json({ success: true, data: { ...publicUser(user), profile: await accountProfile(user), workshopRoles: [] } });
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
      profile: profileRes.rows[0] ?? await accountProfile(user),
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
    const token = crypto.randomUUID();
    resetToken = token;
    const ipAddress = getClientIp(c);
    const userAgent = c.req.header('user-agent');
    // Everything that only happens for a real account runs in the background, so the
    // response time does not reveal whether the account exists
    void (async () => {
      await setPasswordResetToken(token, user.id);
      sendEmailInBackground(passwordResetEmail(user.email, user.name, token), { userId: user.id, kind: 'password_reset' });
      await auditLog({
        eventType: 'auth.forgot_password', actorEmail: emailLc,
        resourceType: 'user', resourceId: user.id, ipAddress, userAgent,
      });
    })().catch((err: unknown) => {
      logger.error('Password reset request failed', { userId: user.id, error: String(err) });
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

auth.post('/auth/verify-email', async (c) => {
  const limited = await rateLimit('auth:verify', { windowMs: AUTH_WINDOW_MS, max: RESET_PASSWORD_MAX })(c);
  if (limited instanceof Response) return limited;

  const parsed = verifyEmailSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid verify-email payload');

  const userId = await getEmailVerificationUserId(parsed.data.token);
  if (!userId) return jsonError(c, 400, 'INVALID_TOKEN', 'This confirmation link is invalid or has expired');
  await deleteEmailVerificationToken(parsed.data.token);

  const user = hasDatabase() ? await dbGetUserById(userId) : Array.from(usersByEmail.values()).find((u) => u.id === userId) ?? null;
  if (!user) return jsonError(c, 400, 'INVALID_TOKEN', 'This confirmation link is invalid or has expired');

  const verifiedAt = new Date().toISOString();
  if (hasDatabase()) {
    await dbMarkUserEmailVerified(user.id, verifiedAt);
  } else {
    user.emailVerifiedAt ??= verifiedAt;
  }

  await auditLog({
    eventType: 'auth.email_verified', actorId: user.id, actorEmail: user.email,
    organisationId: user.organisationId, resourceType: 'user', resourceId: user.id,
    ipAddress: getClientIp(c), userAgent: c.req.header('user-agent'),
  });

  // Following the link signs them in, so a new account goes straight to the app
  const { accessToken, refreshToken } = issueTokens(user);
  if (hasDatabase()) {
    await dbUpsertRefreshToken(refreshToken, user.id);
  }
  let orgName = 'Organisation';
  const org = hasDatabase() ? await dbGetOrganisationById(user.organisationId) : organisationsById.get(user.organisationId);
  if (org) orgName = org.name;

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

auth.post('/auth/resend-verification', async (c) => {
  const limited = await rateLimit('auth:resend-verification', { windowMs: AUTH_WINDOW_MS, max: FORGOT_PASSWORD_MAX })(c);
  if (limited instanceof Response) return limited;

  const parsed = forgotPasswordSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid resend-verification payload');

  const emailLc = parsed.data.email.toLowerCase();
  // Looked up and sent in the background: the reply is the same whether or not the account exists
  void (async () => {
    const user = hasDatabase() ? await dbGetUserByEmail(emailLc) : usersByEmail.get(emailLc);
    if (user && user.emailVerifiedAt === null) await sendVerificationLink(user);
  })().catch((err: unknown) => logger.error('Resend verification failed', { error: String(err) }));

  return c.json({
    success: true,
    message: 'If that email has an account waiting to be confirmed, we have sent a new link.',
  });
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
  // The reset link reached their inbox, which confirms the address too
  const verifiedAt = new Date().toISOString();
  if (hasDatabase()) {
    await dbUpdateUserPasswordHash(user.id, newHash);
    await dbMarkUserEmailVerified(user.id, verifiedAt);
    await dbDeleteAllRefreshTokensForUser(user.id);
  } else {
    user.passwordHash = newHash;
    user.emailVerifiedAt ??= verifiedAt;
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
  sendEmailInBackground(passwordChangedEmail(user.email, user.name), { userId: user.id, kind: 'password_changed' });

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
