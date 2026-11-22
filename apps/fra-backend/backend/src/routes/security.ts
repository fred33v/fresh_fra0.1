import { Hono, type MiddlewareHandler } from 'hono';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { getAuth, hasDatabase, jsonError, requireAuth } from '../helpers.js';
import { getDbPool } from '../db.js';
import { withTransaction } from '../db/transaction.js';
import { dbGetUserById, dbDeleteAllRefreshTokensForUser, auditLog } from '../db/index.js';
import { base32, privileged, verifyMfa } from '../mfa.js';
import { sealBankDetails, FinanceVaultUnavailable } from '../finance-vault.js';
import { rateLimit } from '../middleware.js';
export const mfaGuard: MiddlewareHandler = async (c, next) => {
  const auth = getAuth(c);
  if (!auth) return next();
  if (!hasDatabase()) {
    if (process.env.NODE_ENV === 'production')
      return jsonError(c, 503, 'DATABASE_REQUIRED', 'Security state requires a database');
    return next();
  }
  if (c.req.path.startsWith('/api/v1/security/') || c.req.path.startsWith('/api/v1/auth/'))
    return next();
  const db = getDbPool();
  const state = (
    await db.query(
      'SELECT m.enabled,m.version,u.id,u.email_verified_at FROM public.users u LEFT JOIN public.user_mfa m ON m.user_id=u.id WHERE u.id=$1',
      [auth.userId]
    )
  ).rows[0];
  if (!state?.id || !state.email_verified_at)
    return jsonError(c, 401, 'UNAUTHORIZED', 'A current verified account is required');
  // An API key is attributed to the user who created it, but it is a separate credential that the key middleware
  // has already verified (read-only, reporting endpoints, Enterprise only), and it cannot present an authenticator
  // code. So the per-session check below, which compares the session's MFA claims, cannot apply to it: it would
  // refuse every key made by a user who has MFA. Everything else still applies to a key request, including the
  // enrolment requirement for a privileged creator on the next check, and creating or revoking a key still needs
  // a personal, MFA-backed session.
  const apiKeyRequest = Boolean(c.get('apiKeyAuth' as never));
  if (
    state &&
    !apiKeyRequest &&
    (state.enabled || state.version > 1) &&
    (auth.mfaVersion !== state.version || !auth.mfaAt)
  )
    return jsonError(c, 403, 'MFA_REQUIRED', 'Sign in with your authenticator');
  if ((await privileged(db, auth.userId)) && !state?.enabled)
    return jsonError(c, 403, 'MFA_ENROLLMENT_REQUIRED', 'Configure an authenticator at /security');
  return next();
};
const routes = new Hono();
routes.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  if (c.get('apiKeyAuth' as never))
    return jsonError(c, 403, 'PERSONAL_SESSION_REQUIRED', 'A personal account is required');
  return next();
});
routes.get('/mfa', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (!hasDatabase())
    return jsonError(c, 503, 'DATABASE_REQUIRED', 'Security setup requires a database');
  const db = getDbPool();
  const row = (
    await db.query('SELECT enabled FROM public.user_mfa WHERE user_id=$1', [auth.userId])
  ).rows[0];
  return c.json({
    success: true,
    data: { enabled: row?.enabled === true, required: await privileged(db, auth.userId) },
  });
});
routes.post('/mfa/enrol', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (!hasDatabase()) return jsonError(c, 503, 'DATABASE_REQUIRED', 'Database required');
  const limited = await rateLimit(`mfa-enrol:${auth.userId}`, { windowMs: 300000, max: 5 })(c);
  if (limited instanceof Response) return limited;
  const body = await c.req.json().catch(() => ({}));
  const user = await dbGetUserById(auth.userId);
  if (
    !user ||
    !user.emailVerifiedAt ||
    typeof body.password !== 'string' ||
    body.password.length > 200 ||
    !(await bcrypt.compare(body.password, user.passwordHash))
  )
    return jsonError(c, 403, 'REAUTH_REQUIRED', 'Current password and verified email required');
  const secret = randomBytes(20);
  try {
    const encrypted = sealBankDetails({ secret: secret.toString('base64') }, `mfa:${user.id}`);
    const saved = await getDbPool().query(
      `INSERT INTO public.user_mfa(user_id,secret,pending_until) VALUES($1,$2,now()+interval '10 minutes') ON CONFLICT(user_id) DO UPDATE SET secret=EXCLUDED.secret,pending_until=EXCLUDED.pending_until,version=user_mfa.version+1,last_counter=-1 WHERE NOT user_mfa.enabled RETURNING user_id`,
      [user.id, encrypted]
    );
    if (!saved.rowCount)
      return jsonError(
        c,
        409,
        'MFA_ALREADY_ENABLED',
        'Authenticator already enabled; controlled recovery required'
      );
    await auditLog({
      eventType: 'auth.mfa_enrol_started',
      actorId: user.id,
      organisationId: user.organisationId,
    });
    const encoded = base32(secret);
    return c.json({
      success: true,
      data: {
        secret: encoded,
        uri: `otpauth://totp/${encodeURIComponent('Fresh FRA:' + user.email)}?secret=${encoded}&issuer=Fresh%20FRA&algorithm=SHA1&digits=6&period=30`,
      },
    });
  } catch (e) {
    if (e instanceof FinanceVaultUnavailable)
      return jsonError(c, 503, 'VAULT_UNAVAILABLE', 'Security keyring unavailable');
    throw e;
  }
});
routes.post('/mfa/confirm', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (!hasDatabase()) return jsonError(c, 503, 'DATABASE_REQUIRED', 'Database required');
  const limited = await rateLimit(`mfa-confirm:${auth.userId}`, { windowMs: 300000, max: 5 })(c);
  if (limited instanceof Response) return limited;
  const body = await c.req.json().catch(() => ({}));
  const security = await withTransaction(async (db) => {
    const verified = await verifyMfa(db, auth.userId, body.code, true);
    if (verified) await dbDeleteAllRefreshTokensForUser(auth.userId, db);
    return verified;
  });
  if (!security) return jsonError(c, 401, 'MFA_INVALID', 'Invalid, expired or already used code');
  await auditLog({
    eventType: 'auth.mfa_enabled',
    actorId: auth.userId,
    organisationId: auth.organisationId,
  });
  return c.json({ success: true, data: { enabled: true, signInAgain: true } });
});
routes.post('/roles/finance', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (!hasDatabase()) return jsonError(c, 503, 'DATABASE_REQUIRED', 'Database required');
  const body = await c.req.json().catch(() => ({}));
  if (
    typeof body.userId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.userId) ||
    typeof body.reason !== 'string' ||
    body.reason.trim().length < 10 ||
    body.reason.length > 2000 ||
    !['grant', 'revoke'].includes(body.action)
  )
    return jsonError(c, 400, 'VALIDATION_ERROR', 'User, action and reason required');
  const result = await withTransaction(async (db) => {
    const {
      rows: [u],
    } = await db.query(
      `SELECT u.role,u.organisation_id,m.enabled,m.version FROM public.users u LEFT JOIN public.user_mfa m ON m.user_id=u.id WHERE u.id=$1 AND u.email_verified_at IS NOT NULL FOR SHARE OF u`,
      [auth.userId]
    );
    if (
      !u ||
      u.role !== 'admin' ||
      u.organisation_id !== process.env.PROVIDER_REVIEW_ORGANISATION_ID ||
      !u.enabled ||
      auth.mfaVersion !== u.version ||
      !auth.mfaAt ||
      Date.now() / 1000 - auth.mfaAt > 900 ||
      body.userId.toLowerCase() === auth.userId.toLowerCase()
    )
      return false;
    const lockedMfa = (
      await db.query('SELECT enabled,version FROM public.user_mfa WHERE user_id=$1 FOR SHARE', [
        auth.userId,
      ])
    ).rows[0];
    if (!lockedMfa?.enabled || lockedMfa.version !== auth.mfaVersion) return false;
    const target = (
      await db.query(
        'SELECT id FROM public.users WHERE id=$1 AND organisation_id=$2 AND email_verified_at IS NOT NULL FOR SHARE',
        [body.userId, u.organisation_id]
      )
    ).rows[0];
    if (!target) return false;
    if (body.action === 'grant')
      await db.query(
        `INSERT INTO public.user_security_roles(user_id,role,granted_by,reason) VALUES($1,'finance',$2,$3) ON CONFLICT(user_id,role) DO UPDATE SET granted_by=$2,reason=$3,granted_at=now(),revoked_at=NULL`,
        [body.userId, auth.userId, body.reason]
      );
    else
      await db.query(
        "UPDATE public.user_security_roles SET revoked_at=now() WHERE user_id=$1 AND role='finance'",
        [body.userId]
      );
    await db.query(
      'INSERT INTO public.security_role_events(user_id,actor_id,action,reason) VALUES($1,$2,$3,$4)',
      [body.userId, auth.userId, body.action, body.reason]
    );
    return true;
  });
  if (!result)
    return jsonError(
      c,
      403,
      'ROLE_FORBIDDEN',
      'Independent operator admin with recent MFA required'
    );
  return c.json({ success: true, data: { updated: true } });
});
export default routes;
