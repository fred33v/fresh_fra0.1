import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { Hono } from 'hono';
import { execFileSync } from 'node:child_process';
import jwt from 'jsonwebtoken';
const target = new URL(process.env.DATABASE_URL ?? 'https://invalid');
assert(
  process.env.MFA_TEST_DATABASE === '1' &&
    process.env.NODE_ENV !== 'production' &&
    ['localhost', '127.0.0.1'].includes(target.hostname) &&
    target.pathname.includes('professional'),
  'Disposable professional database required'
);
process.env.NODE_ENV = 'test';
process.env.FINANCE_VAULT_KEYS = JSON.stringify({
  activeKeyId: 'test',
  keys: { test: randomBytes(32).toString('base64') },
});
delete process.env.FINANCE_VAULT_KEYS_FILE;
const { default: auth } = await import('../src/routes/auth.ts');
const { default: providers } = await import('../src/routes/provider-applications.ts');
const { default: security, mfaGuard } = await import('../src/routes/security.ts');
const { financeReviewer } = await import('../src/finance-controls.ts');
const { jwtSecret, getAuth } = await import('../src/helpers.ts');
const { sealBankDetails } = await import('../src/finance-vault.ts');
const { totp } = await import('../src/mfa.ts');
const { withTransaction } = await import('../src/db/transaction.ts');
const { closeDbPool } = await import('../src/db.ts');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const app = new Hono();
app.use('/api/v1/*', mfaGuard);
app.route('/api/v1', auth);
app.route('/api/v1/security', security);
app.route('/api/v1/providers', providers);
app.get('/api/v1/sensitive', (c) => c.json({ ok: true }));
app.get('/api/v1/finance-check', async (c) => {
  try {
    await withTransaction((db) => financeReviewer(db, getAuth(c)));
    return c.json({ ok: true });
  } catch {
    return c.json({ ok: false }, 403);
  }
});
const password = 'Synthetic-password-strong-2026';
let count = 0;
async function request(path, token, body, status = 200) {
  const r = await app.request('http://localhost/api/v1' + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await r.json();
  assert.equal(r.status, status, JSON.stringify(json));
  count++;
  return json.data;
}
async function actor(role, org = randomUUID()) {
  const u = { id: randomUUID(), org, email: randomUUID() + '@example.test' };
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query(
      'INSERT INTO users(id,email,name,password_hash,role,organisation_id,email_verified_at) VALUES($1,$2,$3,$4,$5,$6,now())',
      [u.id, u.email, 'MFA fixture', await bcrypt.hash(password, 10), role, org]
    );
    await db.query(
      'INSERT INTO organisations(id,name,created_by_user_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
      [org, 'MFA fixtures', u.id]
    );
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  } finally {
    db.release();
  }
  u.token = jwt.sign({ sub: u.id, email: u.email, role, organisationId: org }, jwtSecret);
  return u;
}
async function enabled(u) {
  const secret = randomBytes(20).toString('base64');
  await pool.query('INSERT INTO user_mfa(user_id,secret,enabled) VALUES($1,$2,true)', [
    u.id,
    sealBankDetails({ secret }, 'mfa:' + u.id),
  ]);
  return secret;
}
try {
  const admin = await actor('admin'),
    finance = await actor('employee', admin.org),
    other = await actor('admin', admin.org),
    plain = await actor('employee');
  process.env.PROVIDER_REVIEW_ORGANISATION_ID = admin.org;
  await request('/sensitive', admin.token, undefined, 403);
  await request('/sensitive', plain.token);
  // Pending enrollment expires without enabling MFA.
  await pool.query("INSERT INTO workshop_roles(user_id,role) VALUES($1,'facilitator')", [plain.id]);
  await request('/sensitive', plain.token, undefined, 403);
  const workshopState = await request('/security/mfa', plain.token);
  assert.equal(workshopState.required, true);
  await request('/security/mfa/enrol', plain.token, { password });
  await pool.query("UPDATE user_mfa SET pending_until=now()-interval '1 second' WHERE user_id=$1", [
    plain.id,
  ]);
  await request('/security/mfa/confirm', plain.token, { code: '123456' }, 401);

  await request('/security/mfa/enrol', admin.token, { password: 'wrong' }, 403);
  const setup = await request('/security/mfa/enrol', admin.token, { password });
  assert.match(setup.secret, /^[A-Z2-7]+$/);
  const state = (await pool.query('SELECT secret FROM user_mfa WHERE user_id=$1', [admin.id]))
    .rows[0];
  const { openBankDetails } = await import('../src/finance-vault.ts');
  const raw = openBankDetails(state.secret, 'mfa:' + admin.id).secret;
  const step = Math.floor(Date.now() / 30000);
  await request('/security/mfa/confirm', admin.token, { code: 'bad' }, 401);
  await request('/security/mfa/confirm', admin.token, { code: totp(raw, step) });
  await request('/sensitive', admin.token, undefined, 403);
  await request('/auth/login', null, { email: admin.email, password }, 401);
  await request(
    '/auth/login',
    null,
    { email: admin.email, password, totpCode: totp(raw, step) },
    401
  );
  const login = await request('/auth/login', null, {
    email: admin.email,
    password,
    totpCode: totp(raw, step + 1),
  });
  await request('/sensitive', login.accessToken);
  await request('/security/mfa/enrol', login.accessToken, { password }, 409);
  await request(
    '/security/roles/finance',
    login.accessToken,
    { userId: admin.id, action: 'grant', reason: 'Must reject self promotion' },
    403
  );
  await request(
    '/security/roles/finance',
    login.accessToken,
    {
      userId: admin.id.toUpperCase(),
      action: 'grant',
      reason: 'Uppercase UUID must not bypass independence',
    },
    403
  );
  await request('/security/roles/finance', login.accessToken, {
    userId: finance.id,
    action: 'grant',
    reason: 'Independent finance authority grant',
  });
  await request('/sensitive', finance.token, undefined, 403);
  const fs = await enabled(finance);
  const fLogin = await request('/auth/login', null, {
    email: finance.email,
    password,
    totpCode: totp(fs, step),
  });
  await request('/finance-check', fLogin.accessToken);
  assert.equal(
    (await pool.query('SELECT role FROM users WHERE id=$1', [finance.id])).rows[0].role,
    'employee'
  );
  await request('/providers/review', fLogin.accessToken, undefined, 403);
  await request(
    '/security/roles/finance',
    fLogin.accessToken,
    {
      userId: plain.id,
      action: 'grant',
      reason: 'Finance must not grant administrative authority',
    },
    403
  );
  const stale = jwt.sign(
    { ...jwt.decode(fLogin.accessToken), mfaAt: Math.floor(Date.now() / 1000) - 901 },
    jwtSecret
  );
  await request('/finance-check', stale, undefined, 403);

  // Coarse admin role and legacy environment allowlist do not confer finance authority.
  process.env.FINANCE_AUTHORISED_USER_IDS = other.id;
  const os = await enabled(other);
  const oLogin = await request('/auth/login', null, {
    email: other.email,
    password,
    totpCode: totp(os, step),
  });
  await request('/finance-check', oLogin.accessToken, undefined, 403);
  const refreshed = await request('/auth/refresh', null, { refreshToken: fLogin.refreshToken });
  assert.equal(
    jwt.verify(refreshed.accessToken, jwtSecret).mfaAt,
    jwt.verify(fLogin.accessToken, jwtSecret).mfaAt
  );
  await request('/security/roles/finance', login.accessToken, {
    userId: finance.id,
    action: 'revoke',
    reason: 'Independent revocation test',
  });
  await request('/finance-check', fLogin.accessToken, undefined, 403);
  await pool.query('UPDATE user_mfa SET version=version+1 WHERE user_id=$1', [finance.id]);
  await request('/sensitive', fLogin.accessToken, undefined, 403);
  await request('/auth/refresh', null, { refreshToken: refreshed.refreshToken }, 401);
  // Failures persist across requests/transactions and eventually lock verification.
  for (let n = 0; n < 5; n++)
    await request(
      '/auth/login',
      null,
      { email: other.email, password, totpCode: totp(os, step) },
      401
    );
  const locked = (
    await pool.query('SELECT attempts,locked_until FROM user_mfa WHERE user_id=$1', [other.id])
  ).rows[0];
  assert(locked.attempts >= 5 && locked.locked_until);
  const recoveryArgs = [
    '--import',
    'tsx',
    'scripts/mfa-recover.mjs',
    other.id,
    admin.id,
    'Synthetic independently checked recovery case',
  ];
  const before = (await pool.query('SELECT version FROM user_mfa WHERE user_id=$1', [other.id]))
    .rows[0].version;
  assert.match(execFileSync(process.execPath, recoveryArgs, { encoding: 'utf8' }), /DRY RUN/);
  assert.equal(
    (await pool.query('SELECT version FROM user_mfa WHERE user_id=$1', [other.id])).rows[0].version,
    before
  );
  assert.match(
    execFileSync(process.execPath, [...recoveryArgs, '--execute'], { encoding: 'utf8' }),
    /sessions revoked/
  );
  await request('/sensitive', oLogin.accessToken, undefined, 403);
  await request('/auth/refresh', null, { refreshToken: oLogin.refreshToken }, 401);
  const restricted = await request('/auth/login', null, { email: other.email, password });
  const me = await request('/auth/me', restricted.accessToken);
  assert.equal(me.mfaEnrollmentRequired, true);
  await request('/sensitive', restricted.accessToken, undefined, 403);
  await request('/security/mfa/enrol', restricted.accessToken, { password });
  await assert.rejects(pool.query('DELETE FROM security_role_events'));
  assert.equal(
    (
      await pool.query('SELECT count(*)::int n FROM security_role_events WHERE user_id=$1', [
        finance.id,
      ])
    ).rows[0].n,
    2
  );
  console.log(
    `PASS: ${count} MFA/finance security requests; enrollment, mandatory privilege gate, replay, independent grants, live revocation, refresh evidence, session invalidation and durable lockouts`
  );
} finally {
  await pool.end();
  await closeDbPool();
}
