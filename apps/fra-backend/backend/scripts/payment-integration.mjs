#!/usr/bin/env node
// Isolated PostgreSQL and a fake Stripe reader; never moves money or calls Stripe.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import pg from 'pg';
const url = process.env.DATABASE_URL;
if (process.env.PAYMENT_TEST_DATABASE !== '1' || !url || process.env.NODE_ENV === 'production')
  throw new Error('Requires PAYMENT_TEST_DATABASE=1 and disposable local DATABASE_URL');
assert(['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname));
process.env.NODE_ENV = 'test';
process.env.UPSTASH_REDIS_REST_URL = '';
process.env.UPSTASH_REDIS_REST_TOKEN = '';
process.env.SMTP_HOST = '';
const { closeDbPool } = await import('../src/db.ts');
if (process.argv[2] === '--replay') {
  const { processPaymentEvent } = await import('../src/payment-lifecycle.ts');
  assert.equal(
    await processPaymentEvent(process.argv[3], 'charge.refunded', async () => {
      throw new Error('Processed event must not run again');
    }),
    false
  );
  await closeDbPool();
  console.log('PASS separate process observes durable receipt');
} else {
  const { default: app } = await import('../src/index.ts');
  const { setStripeClient } = await import('../src/stripe.ts');
  const { paymentProvider } = await import('../__tests__/fixtures/payment-provider.ts');
  const { issueTokens } = await import('../src/auth-utils.ts');
  const pool = new pg.Pool({ connectionString: url });
  const secret = crypto.randomBytes(32).toString('hex');
  process.env.STRIPE_WEBHOOK_SECRET = secret;
  let cases = 0;
  const pass = (name) => {
    cases++;
    console.log('PASS ' + name);
  };
  const run = crypto.randomBytes(6).toString('hex');
  const actor = {
    id: crypto.randomUUID(),
    organisationId: crypto.randomUUID(),
    email: `payments-${run}@example.test`,
    name: 'Payment fixture',
    role: 'employer',
    passwordHash: 'not-a-login-hash',
    createdAt: new Date().toISOString(),
  };
  async function seed() {
    const p = {
      id: crypto.randomUUID(),
      organisationId: actor.organisationId,
      userId: actor.id,
      packageId: 'pkg_full',
      status: 'succeeded',
      paymentIntentId: `pi_${crypto.randomUUID()}`,
      checkoutSessionId: `cs_${crypto.randomUUID()}`,
      amountCents: 1000,
      currency: 'gbp',
      createdAt: new Date().toISOString(),
      confirmedAt: new Date().toISOString(),
    };
    await pool.query(
      `INSERT INTO public.purchases(id,organisation_id,user_id,package_id,status,payment_intent_id,checkout_session_id,amount_cents,currency,confirmed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        p.id,
        p.organisationId,
        p.userId,
        p.packageId,
        p.status,
        p.paymentIntentId,
        p.checkoutSessionId,
        p.amountCents,
        p.currency,
        p.confirmedAt,
      ]
    );
    const provider = paymentProvider(p);
    setStripeClient(provider.client);
    return { p, provider };
  }
  async function send(id, type, object) {
    const body = JSON.stringify({ id, type, data: { object } }),
      t = Math.floor(Date.now() / 1000);
    const response = await app.request('http://localhost/api/v1/webhooks/stripe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': `t=${t},v1=${crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`,
      },
      body,
    });
    return { status: response.status, body: await response.json() };
  }
  const state = async (p) =>
    (await pool.query('SELECT * FROM public.purchases WHERE id=$1', [p.id])).rows[0];
  let trigger;
  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO public.users(id,email,name,password_hash,role,organisation_id,email_verified_at) VALUES($1,$2,$3,$4,$5,$6,now())`,
        [actor.id, actor.email, actor.name, actor.passwordHash, actor.role, actor.organisationId]
      );
      await client.query(
        `INSERT INTO public.organisations(id,name,created_by_user_id) VALUES($1,'Payment integration',$2)`,
        [actor.organisationId, actor.id]
      );
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    const first = await seed();
    first.provider.refund(1200);
    const id = `evt_${crypto.randomUUID()}`;
    const duplicates = await Promise.all([
      send(id, 'charge.refunded', { payment_intent: first.p.paymentIntentId }),
      send(id, 'charge.refunded', { payment_intent: first.p.paymentIntentId }),
    ]);
    assert.deepEqual(
      duplicates.map((r) => r.status),
      [200, 200]
    );
    assert.equal((await state(first.p)).status, 'refunded');
    assert.equal(
      (await pool.query('SELECT event_id FROM public.payment_events WHERE event_id=$1', [id]))
        .rowCount,
      1
    );
    assert.equal(
      (
        await pool.query(
          "SELECT id FROM public.audit_logs WHERE resource_id=$1 AND event_type='purchase.payment_reconciled'",
          [first.p.id]
        )
      ).rowCount,
      1
    );
    const details = await app.request(`http://localhost/api/v1/purchases/${first.p.id}`, {
      headers: { Authorization: `Bearer ${issueTokens(actor).accessToken}` },
    });
    assert.equal(details.status, 200);
    const detailBody = await details.json();
    assert.equal(detailBody.data.refundedAmountCents, 1200);
    assert(detailBody.data.paymentReconciledAt);
    pass('concurrent webhook deliveries commit one receipt, one audit and one purchase transition');
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', new URL(import.meta.url).pathname, '--replay', id],
      { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    let log = '';
    for (const s of [child.stdout, child.stderr]) s.on('data', (c) => (log += c));
    const [code] = await once(child, 'exit');
    assert.equal(code, 0, log);
    pass('a new process cannot reapply an acknowledged event');

    const rollback = await seed();
    rollback.provider.refund(1200);
    const failureId = `evt_${crypto.randomUUID()}`;
    trigger = `payment_test_${run}`;
    await pool.query(
      `CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_id='${failureId}' THEN RAISE EXCEPTION 'injected receipt failure'; END IF; RETURN NEW; END $$`
    );
    await pool.query(
      `CREATE TRIGGER ${trigger} BEFORE INSERT ON public.payment_events FOR EACH ROW EXECUTE FUNCTION ${trigger}()`
    );
    assert.equal(
      (await send(failureId, 'charge.refunded', { payment_intent: rollback.p.paymentIntentId }))
        .status,
      500
    );
    assert.equal((await state(rollback.p)).status, 'succeeded');
    assert.equal(
      (await pool.query('SELECT id FROM public.audit_logs WHERE resource_id=$1', [rollback.p.id]))
        .rowCount,
      0
    );
    assert.equal(
      (
        await pool.query('SELECT event_id FROM public.payment_events WHERE event_id=$1', [
          failureId,
        ])
      ).rowCount,
      0
    );
    await pool.query(`DROP TRIGGER ${trigger} ON public.payment_events`);
    await pool.query(`DROP FUNCTION ${trigger}()`);
    trigger = undefined;
    assert.equal(
      (await send(failureId, 'charge.refunded', { payment_intent: rollback.p.paymentIntentId }))
        .status,
      200
    );
    pass('receipt failure rolls back access/audit and the identical event succeeds on retry');

    const dispute = await seed();
    const term = (await state(dispute.p)).confirmed_at.toISOString();
    dispute.provider.dispute('needs_response');
    assert.equal(
      (
        await send(`evt_${crypto.randomUUID()}`, 'charge.dispute.created', {
          payment_intent: dispute.p.paymentIntentId,
        })
      ).status,
      200
    );
    assert.equal((await state(dispute.p)).status, 'disputed');
    dispute.provider.dispute('won');
    await send(`evt_${crypto.randomUUID()}`, 'charge.dispute.closed', {
      payment_intent: dispute.p.paymentIntentId,
    });
    assert.equal((await state(dispute.p)).status, 'succeeded');
    assert.equal((await state(dispute.p)).confirmed_at.toISOString(), term);
    pass('dispute suspension and restoration retain the paid term');

    const early = await seed();
    await pool.query(
      "UPDATE public.purchases SET status='requires_confirmation',payment_intent_id=NULL,confirmed_at=NULL WHERE id=$1",
      [early.p.id]
    );
    early.provider.refund(1200);
    assert.equal(
      (
        await send(`evt_${crypto.randomUUID()}`, 'refund.updated', {
          payment_intent: early.p.paymentIntentId,
        })
      ).status,
      200
    );
    assert.equal((await state(early.p)).status, 'refunded');
    const session = {
      id: early.p.checkoutSessionId,
      status: 'complete',
      payment_status: 'paid',
      metadata: { purchaseId: early.p.id },
      amount_total: 1200,
      currency: 'gbp',
      payment_intent: early.p.paymentIntentId,
    };
    assert.equal(
      (await send(`evt_${crypto.randomUUID()}`, 'checkout.session.completed', session)).status,
      200
    );
    assert.equal((await state(early.p)).status, 'refunded');
    pass('reversal arriving before checkout settlement cannot be undone by a late paid event');

    await pool.query("UPDATE public.purchases SET status='refunded' WHERE organisation_id=$1", [
      actor.organisationId,
    ]);
    const race = await seed();
    const accessForJoin = issueTokens(actor).accessToken;
    const generated = await app.request('http://localhost/api/v1/keypasses/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessForJoin}` },
      body: JSON.stringify({ quantity: 2 }),
    });
    assert.equal(generated.status, 200);
    const generatedBody = await generated.json();
    const joinCode = generatedBody.data.codes[0];
    const joinEmail = `payment-race-${crypto.randomUUID()}@example.test`;
    race.provider.refund(1200);
    const raceResults = await Promise.all([
      send(`evt_${crypto.randomUUID()}`, 'charge.refunded', {
        payment_intent: race.p.paymentIntentId,
      }),
      app.request('http://localhost/api/v1/keypasses/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: joinCode,
          email: joinEmail,
          password: 'PaymentJoinPassword123!',
          name: 'Payment race',
        }),
      }),
    ]);
    assert.equal(raceResults[0].status, 200);
    assert([200, 403].includes(raceResults[1].status));
    assert.equal((await state(race.p)).status, 'refunded');
    assert.equal(
      (await pool.query('SELECT id FROM public.users WHERE email=$1', [joinEmail])).rowCount,
      raceResults[1].status === 200 ? 1 : 0
    );
    const refusedEmail=`refused-${crypto.randomUUID()}@example.test`;
    const refused=await app.request('http://localhost/api/v1/keypasses/use',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:generatedBody.data.codes[1],email:refusedEmail,password:'PaymentJoinPassword123!',name:'Refused fixture'})});
    assert.equal(refused.status,403);assert.equal((await pool.query('SELECT id FROM public.users WHERE email=$1',[refusedEmail])).rowCount,0);
    pass(
      'refund and key-pass redemption share the organisation lock and do not leave refused orphan accounts'
    );

    // No other paid row may mask the entitlement assertion.
    await pool.query("UPDATE public.purchases SET status='refunded' WHERE organisation_id=$1", [
      actor.organisationId,
    ]);
    const access = issueTokens(actor).accessToken;
    const result = await app.request('http://localhost/api/v1/entitlements', {
      headers: { Authorization: `Bearer ${access}` },
    });
    assert.equal(result.status, 200);
    const data = await result.json();
    assert.equal(data.data.tier, 0);
    pass('persisted reversals remove package entitlements without deleting accounts');
    console.log(`PASS ${cases} PostgreSQL payment lifecycle scenarios`);
  } finally {
    if (trigger) {
      await pool.query(`DROP TRIGGER IF EXISTS ${trigger} ON public.payment_events`);
      await pool.query(`DROP FUNCTION IF EXISTS ${trigger}()`);
    }
    setStripeClient(undefined);
    await pool.end();
    await closeDbPool();
  }
}
