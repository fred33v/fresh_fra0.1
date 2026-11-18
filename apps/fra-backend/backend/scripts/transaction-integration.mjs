#!/usr/bin/env node
// Disposable local PostgreSQL only. Starts its own backend so rate-limit state and
// test-only secrets cannot interfere with the ordinary smoke test or a live server.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import jwt from 'jsonwebtoken';

const connectionString = process.env.DATABASE_URL;
if (process.env.TRANSACTION_TEST_DATABASE !== '1' || !connectionString || process.env.NODE_ENV === 'production') {
  throw new Error('Requires TRANSACTION_TEST_DATABASE=1 and a disposable local DATABASE_URL outside production');
}
const dbUrl = new URL(connectionString);
assert(['localhost', '127.0.0.1', '[::1]'].includes(dbUrl.hostname), 'Only a disposable local database is allowed');
const pool = new pg.Pool({ connectionString });
const run = crypto.randomBytes(6).toString('hex');
const secret = crypto.randomBytes(32).toString('hex');
const refreshSecret = crypto.randomBytes(32).toString('hex');
const inboundSecret = crypto.randomBytes(32).toString('hex');
const port = Number(process.env.TRANSACTION_TEST_PORT ?? 3001);
const API = `http://127.0.0.1:${port}/api/v1`;
const password = 'TransactionTestPassword123!';
const hash = (v) => crypto.createHash('sha256').update(v).digest('hex');
const backend = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env: { ...process.env, NODE_ENV: 'development', HOST: '127.0.0.1', PORT: String(port),
    JWT_SECRET: secret, JWT_REFRESH_SECRET: refreshSecret, INBOUND_WEBHOOK_SECRET: inboundSecret,
    UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '', STRIPE_SECRET_KEY: '',
    STRIPE_WEBHOOK_SECRET: '', SMTP_HOST: '', DB_POOL_MAX: '4', CORS_ORIGINS: 'http://localhost:8080' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
for (const stream of [backend.stdout, backend.stderr]) stream.on('data', (chunk) => { logs = (logs + chunk).slice(-50000); });
const backendExit = once(backend, 'exit');
const triggers = [];
let cases = 0;
function pass(name) { cases++; console.log(`PASS ${name}`); }
async function call(method, path, body, token, extraHeaders = {}) {
  const res = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json',
    Origin: 'http://localhost:8080', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extraHeaders },
    body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
}
async function account(packageId = 'pkg_full', role = 'employer') {
  const userId = crypto.randomUUID(), organisationId = crypto.randomUUID();
  const email = `tx-${run}-${userId}@example.test`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`INSERT INTO public.users (id,email,name,password_hash,role,organisation_id,email_verified_at)
      VALUES ($1,$2,'Transaction fixture','not-a-login-hash',$3,$4,now())`, [userId,email,role,organisationId]);
    await client.query(`INSERT INTO public.organisations (id,name,created_by_user_id) VALUES ($1,'Transaction fixture',$2)`, [organisationId,userId]);
    await client.query(`INSERT INTO public.purchases (id,organisation_id,user_id,package_id,status,amount_cents,currency)
      VALUES ($1,$2,$3,$4,'succeeded',100,'gbp')`, [crypto.randomUUID(),organisationId,userId,packageId]);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  return { userId, organisationId, email, accessToken: jwt.sign({ sub:userId,email,role,organisationId }, secret, { algorithm:'HS256', expiresIn:'1h' }) };
}
async function codeFor(a) {
  const code = crypto.randomBytes(6).toString('hex').toUpperCase();
  await pool.query(`INSERT INTO public.keypasses (code,organisation_id,status,expires_at) VALUES ($1,$2,'available',now()+interval '1 day')`, [code,a.organisationId]);
  return code;
}
const redeem = (code, email) => call('POST','/keypasses/use',{code,email,password,name:'Race participant'});
async function failTrigger(table, condition, body = "RAISE EXCEPTION 'injected transaction failure';") {
  // Table/condition/body are fixed test source, never external input.
  const name = `tx_${run}_${triggers.length}`;
  await pool.query(`CREATE FUNCTION ${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN ${body} END IF; RETURN NEW; END $$`);
  try { await pool.query(`CREATE TRIGGER ${name} BEFORE ${table === 'keypasses' ? 'UPDATE' : 'INSERT'} ON public.${table} FOR EACH ROW EXECUTE FUNCTION ${name}()`); }
  catch (e) { await pool.query(`DROP FUNCTION ${name}()`); throw e; }
  triggers.push({ name,table });
  return async () => { await pool.query(`DROP TRIGGER IF EXISTS ${name} ON public.${table}`); await pool.query(`DROP FUNCTION IF EXISTS ${name}()`); };
}
async function assertNoJoin(email, code) {
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM public.users WHERE email=$1',[email])).rows[0].n,0);
  assert.equal((await pool.query('SELECT status FROM public.keypasses WHERE code=$1',[code])).rows[0].status,'available');
}
try {
  for (let attempt=0;attempt<100;attempt++) {
    if (backend.exitCode !== null) throw new Error(`Test backend exited: ${logs}`);
    try { if ((await fetch(API+'/health')).ok) break; } catch {}
    if (attempt===99) throw new Error('Test backend did not become healthy');
    await new Promise((resolve)=>setTimeout(resolve,100));
  }
  const a = await account();
  const same = await codeFor(a);
  const emails = Array.from({length:10},(_,i)=>`race-${run}-${i}@example.test`);
  const joins = await Promise.all(emails.map(email=>redeem(same,email)));
  assert.equal(joins.filter(r=>r.status===200).length,1,JSON.stringify(joins));
  assert(joins.every(r=>r.status===200 || r.status===400 || r.status===409));
  const persisted = await pool.query('SELECT id FROM public.users WHERE email=ANY($1::text[])',[emails]);
  assert.equal(persisted.rowCount,1,'A refused join must not leave an account');
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM public.refresh_tokens WHERE user_id=$1',[persisted.rows[0].id])).rows[0].n,1);
  pass('ten redemptions of one code produce exactly one user, claim and refresh session');

  const seat = await account('pkg_basic');
  const seatCodes = await Promise.all([codeFor(seat),codeFor(seat)]);
  const seatJoins = await Promise.all(seatCodes.map((code,i)=>redeem(code,`seat-${run}-${i}@example.test`)));
  assert.equal(seatJoins.filter(r=>r.status===200).length,1,JSON.stringify(seatJoins));
  assert.equal((await pool.query("SELECT count(*)::int AS n FROM public.keypasses WHERE organisation_id=$1 AND status='used'",[seat.organisationId])).rows[0].n,1);
  pass('two distinct codes cannot consume the same last package seat');

  const quota = await account('pkg_basic');
  const generated = await Promise.all(Array.from({length:6},()=>call('POST','/keypasses/generate',{quantity:1,expiresInDays:1},quota.accessToken)));
  assert.equal(generated.filter(r=>r.status===200).length,1,JSON.stringify(generated));
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM public.keypasses WHERE organisation_id=$1',[quota.organisationId])).rows[0].n,1);
  pass('concurrent generation cannot exceed package quota');

  const inviteEmail = `invite-${run}@example.test`;
  const invited = await Promise.all(Array.from({length:2},()=>call('POST','/keypasses/invite',{emails:[inviteEmail],expiresInDays:1},a.accessToken)));
  assert(invited.every(r=>r.status===200),JSON.stringify(invited));
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM public.keypasses WHERE organisation_id=$1 AND invited_email=$2',[a.organisationId,inviteEmail])).rows[0].n,1);
  pass('concurrent invitations create one pending invitation per email');

  for (const failure of ['refresh_tokens','keypasses','audit_logs']) {
    const code = await codeFor(a), email=`failure-${failure}-${run}@example.test`;
    const condition = failure==='refresh_tokens'
      ? `EXISTS (SELECT 1 FROM public.users WHERE id=NEW.user_id AND email='${email}')`
      : failure==='keypasses' ? `OLD.code='${code}'` : `NEW.event_type='keypass.use' AND NEW.actor_email='${email}'`;
    const remove = await failTrigger(failure,condition,failure==='keypasses'?'RETURN NULL;':undefined);
    try {
      const refused = await redeem(code,email);
      assert.equal(refused.status,failure==='keypasses'?409:500,JSON.stringify(refused));
      await assertNoJoin(email,code);
    } finally { await remove(); }
    assert.equal((await redeem(code,email)).status,200);
    pass(`${failure} failure rolls back user/code/token writes and allows a clean retry`);
  }

  const competingCode = await codeFor(a), competingEmail=`revoke-${run}@example.test`;
  const [joined] = await Promise.all([
    redeem(competingCode,competingEmail),
    call('POST','/keypasses/revoke',{code:competingCode},a.accessToken),
    call('POST','/keypasses/bulk-revoke',{codes:[competingCode]},a.accessToken),
  ]);
  const finalCode=(await pool.query('SELECT status FROM public.keypasses WHERE code=$1',[competingCode])).rows[0];
  const finalUsers=await pool.query('SELECT id FROM public.users WHERE email=$1',[competingEmail]);
  if (joined.status===200) { assert.equal(finalCode.status,'used');assert.equal(finalUsers.rowCount,1); }
  else { assert.equal(finalCode.status,'revoked');assert.equal(finalUsers.rowCount,0); }
  pass('redemption and single/bulk revocation cannot free an already consumed seat');

  const oldToken = jwt.sign({sub:a.userId,type:'refresh',jti:crypto.randomUUID()},refreshSecret,{algorithm:'HS256',expiresIn:'1h'});
  await pool.query('INSERT INTO public.refresh_tokens (token,user_id) VALUES ($1,$2)',[hash(oldToken),a.userId]);
  const refreshed = await Promise.all(Array.from({length:6},()=>call('POST','/auth/refresh',{refreshToken:oldToken})));
  assert.equal(refreshed.filter(r=>r.status===200).length,1,JSON.stringify(refreshed));
  assert(refreshed.every(r=>r.status===200||r.status===401));
  assert.equal((await pool.query('SELECT token FROM public.refresh_tokens WHERE token=$1',[hash(oldToken)])).rowCount,0);
  const replacement = refreshed.find(r=>r.status===200).body.data.refreshToken;
  assert.equal((await pool.query('SELECT token FROM public.refresh_tokens WHERE token=$1',[hash(replacement)])).rowCount,1);
  pass('six concurrent refreshes consume the old token once');

  const removeRefresh = await failTrigger('refresh_tokens',`NEW.user_id='${a.userId}'::uuid`);
  try {
    assert.equal((await call('POST','/auth/refresh',{refreshToken:replacement})).status,500);
    assert.equal((await pool.query('SELECT token FROM public.refresh_tokens WHERE token=$1',[hash(replacement)])).rowCount,1);
  } finally { await removeRefresh(); }
  assert.equal((await call('POST','/auth/refresh',{refreshToken:replacement})).status,200);
  pass('failed refresh replacement restores the old token for a later retry');

  assert.equal((await call('POST','/workshop/sessions',{title:'Unqualified delivery'},a.accessToken)).status,403);
  const employeeToken=jwt.sign({sub:a.userId,email:a.email,role:'employee',organisationId:a.organisationId},secret,{algorithm:'HS256',expiresIn:'1h'});
  assert.equal((await call('POST','/workshop/sessions',{title:'Employee delivery'},employeeToken)).status,403);
  await pool.query("INSERT INTO public.workshop_roles (user_id,role) VALUES ($1,'facilitator')",[a.userId]);
  assert.equal((await call('POST','/workshop/sessions',{title:'Authorised delivery'},a.accessToken)).status,201);
  pass('paid employer/employee cannot self-appoint; server-assigned facilitator can create sessions');

  const assessmentId=crypto.randomUUID();
  await pool.query("INSERT INTO public.assessments (id,organisation_id,created_by_user_id,title,status,answers,created_at,updated_at) VALUES ($1,$2,$3,'Webhook audit','submitted','{}',now(),now())",[assessmentId,a.organisationId,a.userId]);
  const body={assessmentId,organisationId:a.organisationId};
  const timestamp=Math.floor(Date.now()/1000);
  const signature=crypto.createHmac('sha256',inboundSecret).update(`${timestamp}.${JSON.stringify(body)}`).digest('hex');
  assert.equal((await call('POST','/webhooks/assessment-submitted',body,undefined,{'X-StopFRA-Signature':`t=${timestamp},v1=${signature}`})).status,200);
  const audit=await pool.query("SELECT actor_id FROM public.audit_logs WHERE event_type='webhook.assessment_submitted' AND resource_id=$1",[assessmentId]);
  assert.equal(audit.rowCount,1);assert.equal(audit.rows[0].actor_id,null);
  pass('signed system webhook writes an actual PostgreSQL audit row');

  // Account-link claims use memory in this process; account effects use real PostgreSQL.
  const linkAccount=await account();
  const resetLink=async()=>{
    const result=await call('POST','/auth/forgot-password',{email:linkAccount.email});
    assert.equal(result.status,200);assert(result.body.resetToken);return result.body.resetToken;
  };
  await pool.query('UPDATE public.users SET email_verified_at=NULL WHERE id=$1',[linkAccount.userId]);
  const beforeReset=(await pool.query('SELECT password_hash FROM public.users WHERE id=$1',[linkAccount.userId])).rows[0].password_hash;
  const retained=jwt.sign({sub:linkAccount.userId,type:'refresh',jti:crypto.randomUUID()},refreshSecret,{algorithm:'HS256',expiresIn:'1h'});
  await pool.query('INSERT INTO public.refresh_tokens(token,user_id) VALUES($1,$2)',[hash(retained),linkAccount.userId]);
  const failedReset=await resetLink();
  const removeResetAudit=await failTrigger('audit_logs',`NEW.actor_id='${linkAccount.userId}'::uuid AND NEW.event_type='auth.reset_password'`);
  try {
    assert.equal((await call('POST','/auth/reset-password',{token:failedReset,newPassword:password})).status,500);
    const row=(await pool.query('SELECT password_hash,email_verified_at FROM public.users WHERE id=$1',[linkAccount.userId])).rows[0];
    assert.equal(row.password_hash,beforeReset);assert.equal(row.email_verified_at,null);
    assert.equal((await pool.query('SELECT token FROM public.refresh_tokens WHERE token=$1',[hash(retained)])).rowCount,1);
  }finally{await removeResetAudit();}
  assert.equal((await call('POST','/auth/reset-password',{token:failedReset,newPassword:password})).status,400);
  pass('failed password reset rolls back password, verification, session deletion and audit; claimed link stays consumed');

  const concurrentReset=await resetLink();
  const resetResults=await Promise.all([call('POST','/auth/reset-password',{token:concurrentReset,newPassword:password}),call('POST','/auth/reset-password',{token:concurrentReset,newPassword:'OtherPassword123!'})]);
  assert.deepEqual(resetResults.map(x=>x.status).sort(),[200,400]);
  assert.equal((await pool.query('SELECT token FROM public.refresh_tokens WHERE user_id=$1',[linkAccount.userId])).rowCount,0);
  pass('one concurrent reset succeeds and previous refresh sessions are invalidated');

  const racingLink=await resetLink();
  const racingRefresh=jwt.sign({sub:linkAccount.userId,type:'refresh',jti:crypto.randomUUID()},refreshSecret,{algorithm:'HS256',expiresIn:'1h'});
  await pool.query('INSERT INTO public.refresh_tokens(token,user_id) VALUES($1,$2)',[hash(racingRefresh),linkAccount.userId]);
  const resetRace=await Promise.all([call('POST','/auth/reset-password',{token:racingLink,newPassword:password}),call('POST','/auth/refresh',{refreshToken:racingRefresh})]);
  assert.equal(resetRace[0].status,200);assert([200,401].includes(resetRace[1].status));
  assert.equal((await pool.query('SELECT token FROM public.refresh_tokens WHERE user_id=$1',[linkAccount.userId])).rowCount,0);
  pass('password reset and refresh rotation serialize without leaving a replacement session');

  const signupLink=async()=>{
    const email=`confirm-${crypto.randomUUID()}@example.test`;
    const result=await call('POST','/auth/signup',{email,password,name:'Confirmation fixture'});
    assert.equal(result.status,200);assert(result.body.data.verificationToken);return {...result.body.data,email};
  };
  const failedConfirmation=await signupLink();
  const failedUser=(await pool.query('SELECT id FROM public.users WHERE email=$1',[failedConfirmation.email])).rows[0];
  assert(failedUser);const confirmationUser=failedUser;
  const removeConfirmSession=await failTrigger('refresh_tokens',`NEW.user_id='${confirmationUser.id}'::uuid`);
  try{
    assert.equal((await call('POST','/auth/verify-email',{token:failedConfirmation.verificationToken})).status,500);
    assert.equal((await pool.query('SELECT email_verified_at FROM public.users WHERE id=$1',[confirmationUser.id])).rows[0].email_verified_at,null);
    assert.equal((await pool.query("SELECT id FROM public.audit_logs WHERE actor_id=$1 AND event_type='auth.email_verified'",[confirmationUser.id])).rowCount,0);
  }finally{await removeConfirmSession();}
  assert.equal((await call('POST','/auth/verify-email',{token:failedConfirmation.verificationToken})).status,400);
  pass('confirmation session failure rolls back verification and audit; consumed link cannot mint a session on retry');
  const confirmation=await signupLink();
  const confirmationResults=await Promise.all([call('POST','/auth/verify-email',{token:confirmation.verificationToken}),call('POST','/auth/verify-email',{token:confirmation.verificationToken})]);
  assert.deepEqual(confirmationResults.map(x=>x.status).sort(),[200,400]);
  pass('one concurrent email confirmation succeeds against PostgreSQL');
  console.log(`PASS ${cases} PostgreSQL transaction/permission scenarios`);
} catch (error) {
  console.error(logs);throw error;
} finally {
  backend.kill('SIGTERM');
  const timer=setTimeout(()=>backend.kill('SIGKILL'),11000);timer.unref();
  await backendExit;clearTimeout(timer);
  for (const {name,table} of triggers) {
    await pool.query(`DROP TRIGGER IF EXISTS ${name} ON public.${table}`);
    await pool.query(`DROP FUNCTION IF EXISTS ${name}()`);
  }
  await pool.end();
}
