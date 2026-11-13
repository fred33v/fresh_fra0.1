#!/usr/bin/env node
// Disposable PostgreSQL; transport is replaced before any drain. No external messages are sent.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import pg from 'pg';
const url = process.env.DATABASE_URL;
if (process.env.WEBHOOK_TEST_DATABASE !== '1' || !url || process.env.NODE_ENV === 'production')
  throw new Error('Requires WEBHOOK_TEST_DATABASE=1 and disposable local DATABASE_URL');
assert(['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname));
process.env.NODE_ENV = 'test';
process.env.WEBHOOK_WORKER_ENABLED = 'false';
process.env.UPSTASH_REDIS_REST_URL = '';
process.env.UPSTASH_REDIS_REST_TOKEN = '';
process.env.SMTP_HOST = '';
const { closeDbPool } = await import('../src/db.ts');
const { drainWebhookDeliveries } = await import('../src/webhook-deliveries.ts');
const { verifySignedPayload } = await import('../src/webhook-transport.ts');
const pool = new pg.Pool({ connectionString: url });
const originalFetch = globalThis.fetch;
if (process.argv[2] === '--drain') {
  const endpointId = process.argv[3];
  const job = (
    await pool.query(
      'SELECT payload FROM public.webhook_deliveries WHERE endpoint_id=$1 ORDER BY created_at DESC LIMIT 1',
      [endpointId]
    )
  ).rows[0];
  const endpoint = (
    await pool.query('SELECT secret FROM public.webhook_endpoints WHERE id=$1', [endpointId])
  ).rows[0];
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.body, JSON.stringify(job.payload));
    assert.equal(init.headers['X-StopFRA-Delivery'], job.payload.id);
    assert(verifySignedPayload(endpoint.secret, init.body, init.headers['X-StopFRA-Signature']));
    return new Response(null, { status: 204 });
  };
  try {
    assert.equal(await drainWebhookDeliveries(1, endpointId), 1);
    console.log('PASS separate worker retries the same signed payload');
  } finally {
    globalThis.fetch = originalFetch;
    await pool.end();
    await closeDbPool();
  }
} else {
  const { default: app } = await import('../src/index.ts');
  const { enqueueOrgEvent } = await import('../src/webhooks-out.ts');
  const { issueTokens } = await import('../src/auth-utils.ts');
  const { withTransaction } = await import('../src/db/transaction.ts');
  let cases = 0;
  const pass = (name) => {
    cases++;
    console.log('PASS ' + name);
  };
  const run = crypto.randomBytes(6).toString('hex');
  const owner = {
    id: crypto.randomUUID(),
    organisationId: crypto.randomUUID(),
    email: `outbox-${run}@example.test`,
    name: 'Outbox fixture',
    role: 'employer',
    passwordHash: 'not-a-login-hash',
    createdAt: new Date().toISOString(),
  };
  const endpointId = crypto.randomUUID();
  const secret = crypto.randomBytes(32).toString('hex');
  const calls = [];
  let http = 503;
  let transport = async () => new Response(null, { status: http });
  globalThis.fetch = async (url, init) => {
    calls.push({ url, body: init.body, headers: init.headers });
    assert(verifySignedPayload(secret, init.body, init.headers['X-StopFRA-Signature']));
    return transport();
  };
  const latest = async () =>
    (
      await pool.query(
        'SELECT * FROM public.webhook_deliveries WHERE endpoint_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1',
        [endpointId]
      )
    ).rows[0];
  const enqueue = async () => {
    await enqueueOrgEvent(owner.organisationId, 'risk.created', { fixture: crypto.randomUUID() });
    return latest();
  };
  const due = async (id) =>
    pool.query(
      "UPDATE public.webhook_deliveries SET next_attempt_at=now()-interval '1 second' WHERE id=$1",
      [id]
    );
  const api = async (method, path, body, token = issueTokens(owner).accessToken) => {
    const r = await app.request('http://localhost/api/v1' + path, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, body: await r.json() };
  };
  let trigger;
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO public.users(id,email,name,password_hash,role,organisation_id,email_verified_at) VALUES($1,$2,$3,$4,$5,$6,now())`,
        [owner.id, owner.email, owner.name, owner.passwordHash, owner.role, owner.organisationId]
      );
      await client.query(
        `INSERT INTO public.organisations(id,name,created_by_user_id) VALUES($1,'Outbox fixture',$2)`,
        [owner.organisationId, owner.id]
      );
      await client.query(
        `INSERT INTO public.purchases(id,organisation_id,user_id,package_id,status,amount_cents,currency,confirmed_at) VALUES($1,$2,$3,'pkg_full','succeeded',1000,'gbp',now())`,
        [crypto.randomUUID(), owner.organisationId, owner.id]
      );
      await client.query(
        `INSERT INTO public.webhook_endpoints(id,organisation_id,url,secret,events,created_by_user_id) VALUES($1,$2,'https://receiver.example.test/hook',$3,$4,$5)`,
        [endpointId, owner.organisationId, secret, ['risk.created', 'keypass.used'], owner.id]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    const first = await enqueue();
    assert.equal(first.status, 'pending');
    assert.equal(calls.length, 0);
    assert.equal(first.payload.organisationId, owner.organisationId);
    assert(!JSON.stringify(first.payload).includes(secret));
    assert.equal(await drainWebhookDeliveries(1, endpointId), 1);
    let row = await latest();
    assert.equal(row.status, 'pending');
    assert.equal(row.attempts, 1);
    assert(row.next_attempt_at > new Date());
    assert.equal(await drainWebhookDeliveries(1, endpointId), 0);
    await due(first.id);
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', new URL(import.meta.url).pathname, '--drain', endpointId],
      { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let logs = '';
    for (const stream of [child.stdout, child.stderr]) stream.on('data', (c) => (logs += c));
    const [code] = await once(child, 'exit');
    assert.equal(code, 0, logs);
    row = await latest();
    assert.equal(row.status, 'delivered');
    assert.equal(row.attempts, 2);
    pass(
      'persisted transient retry survives a process change and keeps its payload ID/body/signature contract'
    );

    await enqueue();
    let release;
    let startedResolve;
    const started = new Promise((r) => (startedResolve = r));
    transport = () => {
      startedResolve();
      return new Promise((r) => (release = r));
    };
    const firstWorker = drainWebhookDeliveries(1, endpointId);
    await started;
    assert.equal(await drainWebhookDeliveries(1, endpointId), 0);
    release(new Response(null, { status: 204 }));
    await firstWorker;
    assert.equal((await latest()).attempts, 1);
    pass('concurrent workers cannot claim a live lease twice');
    await enqueue();
    await enqueue();
    let stopping = false;
    transport = async () => {
      stopping = true;
      return new Response(null, { status: 204 });
    };
    assert.equal(await drainWebhookDeliveries(10, endpointId, () => stopping), 1);
    assert.equal(
      (
        await pool.query(
          "SELECT id FROM public.webhook_deliveries WHERE endpoint_id=$1 AND status='pending'",
          [endpointId]
        )
      ).rowCount,
      1
    );
    transport = async () => new Response(null, { status: 204 });
    await drainWebhookDeliveries(1, endpointId);
    pass('shutdown control stops new claims after the active delivery completes');

    const stale = await enqueue();
    let releaseOld;
    let oldStartedResolve;
    const oldStarted = new Promise((r) => (oldStartedResolve = r));
    let hit = 0;
    transport = () => {
      if (hit++ === 0) {
        oldStartedResolve();
        return new Promise((r) => (releaseOld = r));
      }
      return Promise.resolve(new Response(null, { status: 204 }));
    };
    const oldWorker = drainWebhookDeliveries(1, endpointId);
    await oldStarted;
    await pool.query(
      "UPDATE public.webhook_deliveries SET leased_until=now()-interval '1 second' WHERE id=$1",
      [stale.id]
    );
    await drainWebhookDeliveries(1, endpointId);
    releaseOld(new Response(null, { status: 500 }));
    await oldWorker;
    row = await latest();
    assert.equal(row.status, 'delivered');
    assert.equal(row.last_status, 204);
    assert.equal(row.attempts, 2);
    assert.equal(
      (
        await pool.query('SELECT last_delivery_status FROM public.webhook_endpoints WHERE id=$1', [
          endpointId,
        ])
      ).rows[0].last_delivery_status,
      204
    );
    pass('expired leases are recovered and stale acknowledgements cannot overwrite success');

    transport = async () => new Response(null, { status: 429 });
    const exhausted = await enqueue();
    for (let attempt = 1; attempt <= 4; attempt++) {
      await due(exhausted.id);
      await drainWebhookDeliveries(1, endpointId);
      row = await latest();
      assert.equal(row.cycle_attempts, attempt);
      assert.equal(row.status, attempt < 4 ? 'pending' : 'dead');
    }
    const listing = await api('GET', `/webhook-endpoints/${endpointId}/deliveries`);
    assert.equal(listing.status, 200);
    assert(!JSON.stringify(listing.body).includes(secret));
    assert(listing.body.data.every((d) => !('payload' in d) && !('data' in d)));
    const retryPath = `/webhook-endpoints/${endpointId}/deliveries/${exhausted.id}/retry`;
    const employee = issueTokens({ ...owner, role: 'employee' }).accessToken;
    assert.equal((await api('POST', retryPath, {}, employee)).status, 403);
    const stranger = issueTokens({ ...owner, organisationId: crypto.randomUUID() }).accessToken;
    assert([403, 404].includes((await api('POST', retryPath, {}, stranger)).status));
    const staleManager = issueTokens(owner).accessToken;
    await pool.query("UPDATE public.users SET role='employee' WHERE id=$1", [owner.id]);
    assert.equal((await api('POST', retryPath, {}, staleManager)).status, 403);
    await pool.query("UPDATE public.users SET role='employer' WHERE id=$1", [owner.id]);
    const retryAudit = `outbox_retry_${run}`;
    await pool.query(
      `CREATE FUNCTION ${retryAudit}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='webhook.delivery_retried' AND NEW.resource_id='${exhausted.id}' THEN RAISE EXCEPTION 'injected retry audit failure'; END IF; RETURN NEW; END $$`
    );
    await pool.query(
      `CREATE TRIGGER ${retryAudit} BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION ${retryAudit}()`
    );
    try {
      assert.equal((await api('POST', retryPath, {})).status, 500);
      assert.equal((await latest()).status, 'dead');
      assert.equal((await latest()).retry_count, 0);
    } finally {
      await pool.query(`DROP TRIGGER ${retryAudit} ON public.audit_logs`);
      await pool.query(`DROP FUNCTION ${retryAudit}()`);
    }
    assert.equal((await api('POST', retryPath, {})).status, 200);
    row = await latest();
    assert.equal(row.attempts, 4);
    assert.equal(row.cycle_attempts, 0);
    assert.equal(row.retry_count, 1);
    assert.equal(row.payload.id, exhausted.payload.id);
    transport = async () => new Response(null, { status: 204 });
    await drainWebhookDeliveries(1, endpointId);
    assert.equal((await api('POST', retryPath, {})).status, 409);
    assert.equal(
      (
        await pool.query(
          "SELECT id FROM public.audit_logs WHERE resource_id=$1 AND event_type='webhook.delivery_retried'",
          [exhausted.id]
        )
      ).rowCount,
      1
    );
    pass('bounded retries dead-letter and only authorised current managers can auditably requeue');

    const disabled = await enqueue();
    const previousCalls = calls.length;
    await pool.query('UPDATE public.webhook_endpoints SET is_active=false WHERE id=$1', [
      endpointId,
    ]);
    await drainWebhookDeliveries(1, endpointId);
    assert.equal((await latest()).last_error, 'endpoint_disabled');
    assert.equal(calls.length, previousCalls);
    await pool.query('UPDATE public.webhook_endpoints SET is_active=true WHERE id=$1', [
      endpointId,
    ]);
    const unsubscribed = await enqueue();
    await pool.query(
      "UPDATE public.webhook_endpoints SET events=ARRAY['keypass.used'] WHERE id=$1",
      [endpointId]
    );
    await drainWebhookDeliveries(1, endpointId);
    assert.equal((await latest()).last_error, 'subscription_removed');
    assert.equal(calls.length, previousCalls);
    await pool.query(
      "UPDATE public.webhook_endpoints SET events=ARRAY['risk.created','keypass.used'] WHERE id=$1",
      [endpointId]
    );
    assert(disabled.id !== unsubscribed.id);
    pass('disabled endpoints and removed subscriptions cancel without sending');

    const before = (
      await pool.query('SELECT id FROM public.webhook_deliveries WHERE endpoint_id=$1', [
        endpointId,
      ])
    ).rowCount;
    await assert.rejects(
      withTransaction(async (db) => {
        await enqueueOrgEvent(owner.organisationId, 'risk.created', { rollback: true }, db);
        throw new Error('Injected domain rollback');
      })
    );
    assert.equal(
      (
        await pool.query('SELECT id FROM public.webhook_deliveries WHERE endpoint_id=$1', [
          endpointId,
        ])
      ).rowCount,
      before
    );
    trigger = `outbox_test_${run}`;
    await pool.query(
      `CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.endpoint_id='${endpointId}'::uuid AND NEW.payload->>'type'='keypass.used' THEN RAISE EXCEPTION 'injected enqueue failure'; END IF; RETURN NEW; END $$`
    );
    await pool.query(
      `CREATE TRIGGER ${trigger} BEFORE INSERT ON public.webhook_deliveries FOR EACH ROW EXECUTE FUNCTION ${trigger}()`
    );
    const generated = await api('POST', '/keypasses/generate', { quantity: 1 });
    assert.equal(generated.status, 200);
    const joinCode = generated.body.data.codes[0],
      joinEmail = `outbox-join-${run}@example.test`;
    const redeem = () =>
      api('POST', '/keypasses/use', {
        code: joinCode,
        email: joinEmail,
        password: 'OutboxPassword123!',
        name: 'Outbox join',
      });
    assert.equal((await redeem()).status, 500);
    assert.equal(
      (await pool.query('SELECT id FROM public.users WHERE email=$1', [joinEmail])).rowCount,
      0
    );
    assert.equal(
      (await pool.query('SELECT status FROM public.keypasses WHERE code=$1', [joinCode])).rows[0]
        .status,
      'available'
    );
    await pool.query(`DROP TRIGGER ${trigger} ON public.webhook_deliveries`);
    await pool.query(`DROP FUNCTION ${trigger}()`);
    trigger = undefined;
    assert.equal((await redeem()).status, 200);
    assert.equal(
      (
        await pool.query(
          "SELECT id FROM public.webhook_deliveries WHERE endpoint_id=$1 AND payload->>'type'='keypass.used'",
          [endpointId]
        )
      ).rowCount,
      1
    );
    pass(
      'transaction rollback removes queued work; key-pass join and its notification commit together'
    );

    // Cancel any queued key-pass event under this endpoint before the next isolated scenario.
    await pool.query(
      "UPDATE public.webhook_deliveries SET status='cancelled' WHERE endpoint_id=$1 AND status='pending'",
      [endpointId]
    );
    await enqueue();
    await pool.query("UPDATE public.purchases SET status='refunded' WHERE organisation_id=$1", [
      owner.organisationId,
    ]);
    const callsBeforeRefund = calls.length;
    await drainWebhookDeliveries(1, endpointId);
    assert.equal((await latest()).last_error, 'package_inactive');
    assert.equal(calls.length, callsBeforeRefund);
    await pool.query("UPDATE public.purchases SET status='succeeded' WHERE organisation_id=$1", [
      owner.organisationId,
    ]);
    await enqueue();
    await pool.query('DELETE FROM public.webhook_endpoints WHERE id=$1', [endpointId]);
    await drainWebhookDeliveries(1, endpointId);
    assert.equal((await latest()).last_error, 'endpoint_missing');
    assert.equal(calls.length, callsBeforeRefund);
    pass('revoked package access and endpoint deletion prevent queued payload delivery');
    console.log(`PASS ${cases} PostgreSQL outgoing webhook scenarios`);
  } finally {
    if (trigger) {
      await pool.query(`DROP TRIGGER IF EXISTS ${trigger} ON public.webhook_deliveries`);
      await pool.query(`DROP FUNCTION IF EXISTS ${trigger}()`);
    }
    globalThis.fetch = originalFetch;
    await pool.end();
    await closeDbPool();
  }
}
