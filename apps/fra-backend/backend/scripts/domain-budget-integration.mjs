#!/usr/bin/env node
// Disposable local PostgreSQL. No external receivers, messages or payment operations.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import pg from 'pg';
const url = process.env.DATABASE_URL;
if (
  process.env.DOMAIN_BUDGET_TEST_DATABASE !== '1' ||
  !url ||
  process.env.NODE_ENV === 'production'
)
  throw new Error('Requires DOMAIN_BUDGET_TEST_DATABASE=1 and disposable local DATABASE_URL');
assert(['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname));
process.env.NODE_ENV = 'test';
process.env.WEBHOOK_WORKER_ENABLED = 'false';
process.env.UPSTASH_REDIS_REST_URL = '';
process.env.UPSTASH_REDIS_REST_TOKEN = '';
process.env.SMTP_HOST = '';
const { default: app } = await import('../src/index.ts');
const { issueTokens } = await import('../src/auth-utils.ts');
const { closeDbPool } = await import('../src/db.ts');
const pool = new pg.Pool({ connectionString: url });
let cases = 0;
const pass = (name) => {
  cases++;
  console.log('PASS ' + name);
};
const run = crypto.randomBytes(6).toString('hex');
async function actor(role = 'employer', org) {
  const a = {
    id: crypto.randomUUID(),
    organisationId: org ?? crypto.randomUUID(),
    email: `domain-${crypto.randomUUID()}@example.test`,
    name: 'Domain fixture',
    role,
    passwordHash: 'not-a-login-hash',
    createdAt: new Date().toISOString(),
  };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO public.users(id,email,name,password_hash,role,organisation_id,email_verified_at) VALUES($1,$2,$3,$4,$5,$6,now())`,
      [a.id, a.email, a.name, a.passwordHash, a.role, a.organisationId]
    );
    if (!org) {
      await client.query(
        "INSERT INTO public.organisations(id,name,created_by_user_id) VALUES($1,'Domain fixture',$2)",
        [a.organisationId, a.id]
      );
      await client.query(
        "INSERT INTO public.purchases(id,organisation_id,user_id,package_id,status,amount_cents,currency,confirmed_at) VALUES($1,$2,$3,'pkg_full','succeeded',1000,'gbp',now())",
        [crypto.randomUUID(), a.organisationId, a.id]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return { ...a, token: issueTokens(a).accessToken };
}
async function call(method, path, body, a) {
  const r = await app.request('http://localhost/api/v1' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(a ? { Authorization: `Bearer ${a.token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}
const owner = await actor(),
  other = await actor(),
  employee = await actor('employee', owner.organisationId);
const endpoint = crypto.randomUUID();
let trigger;
async function fail(table, condition) {
  trigger = { name: `domain_test_${run}`, table };
  await pool.query(
    `CREATE FUNCTION ${trigger.name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'injected domain failure'; END IF; RETURN NEW; END $$`
  );
  await pool.query(
    `CREATE TRIGGER ${trigger.name} BEFORE INSERT ON public.${table} FOR EACH ROW EXECUTE FUNCTION ${trigger.name}()`
  );
}
async function removeFailure() {
  if (trigger) {
    await pool.query(`DROP TRIGGER IF EXISTS ${trigger.name} ON public.${trigger.table}`);
    await pool.query(`DROP FUNCTION IF EXISTS ${trigger.name}()`);
    trigger = undefined;
  }
}
try {
  await pool.query(
    `INSERT INTO public.webhook_endpoints(id,organisation_id,url,secret,events,created_by_user_id) VALUES($1,$2,'https://receiver.example.test/hook','fixture-only',$3,$4)`,
    [
      endpoint,
      owner.organisationId,
      [
        'assessment.submitted',
        'assessment.high_risk',
        'risk.created',
        'risk.updated',
        'risk.high_priority',
      ],
      owner.id,
    ]
  );
  const created = await call('POST', '/assessments', { title: 'Atomic assessment' }, owner);
  assert.equal(created.status, 201);
  const assessmentId = created.body.data.id;
  await fail(
    'webhook_deliveries',
    `NEW.endpoint_id='${endpoint}'::uuid AND NEW.payload->>'type'='assessment.submitted'`
  );
  assert.equal((await call('POST', `/assessments/${assessmentId}/submit`, {}, owner)).status, 500);
  assert.equal(
    (await pool.query('SELECT status,result FROM public.assessments WHERE id=$1', [assessmentId]))
      .rows[0].status,
    'draft'
  );
  assert.equal(
    (
      await pool.query(
        "SELECT id FROM public.audit_logs WHERE resource_id=$1 AND event_type='assessment.submitted'",
        [assessmentId]
      )
    ).rowCount,
    0
  );
  assert.equal(
    (
      await pool.query('SELECT id FROM public.assessment_certificates WHERE assessment_id=$1', [
        assessmentId,
      ])
    ).rowCount,
    0
  );
  await removeFailure();
  const submitted = await Promise.all([
    call('POST', `/assessments/${assessmentId}/submit`, {}, owner),
    call('POST', `/assessments/${assessmentId}/submit`, {}, owner),
  ]);
  assert.deepEqual(submitted.map((r) => r.status).sort(), [200, 400]);
  assert.equal(
    (
      await pool.query(
        "SELECT id FROM public.webhook_deliveries WHERE endpoint_id=$1 AND payload->>'type'='assessment.submitted'",
        [endpoint]
      )
    ).rowCount,
    1
  );
  pass(
    'assessment submission, result, audit and outbox roll back together; concurrent submission publishes once'
  );
  const second = await call(
    'POST',
    '/assessments',
    {
      title: 'Budget second',
      answers: {
        'procurement.dueDiligenceLevel': 1,
        'procurement.monthlySpend': 750000,
        'procurement.recentFraud': 'yes',
        'procurement.controlMaturity': 2,
        'cashBanking.controlEffectiveness': 1,
        'cashBanking.dailyCashVolume': 1000000,
        'cashBanking.fraudIncidents': 'yes',
      },
    },
    owner
  );
  const secondId = second.body.data.id;
  await fail(
    'webhook_deliveries',
    `NEW.endpoint_id='${endpoint}'::uuid AND NEW.payload->>'type'='assessment.submitted'`
  );
  assert.equal(
    (await call('PATCH', `/assessments/${secondId}`, { status: 'submitted' }, owner)).status,
    500
  );
  assert.equal(
    (await pool.query('SELECT status FROM public.assessments WHERE id=$1', [secondId])).rows[0]
      .status,
    'draft'
  );
  await removeFailure();
  assert.equal(
    (await call('PATCH', `/assessments/${secondId}`, { status: 'submitted' }, owner)).status,
    200
  );
  pass('PATCH submission uses the same atomic publication boundary');
  const suggested = await call('GET', '/risk-register/from-assessment', undefined, owner);
  assert(suggested.body.data.length > 1);
  const riskBefore = Number(
    (
      await pool.query('SELECT count(*) FROM public.risk_register WHERE organisation_id=$1', [
        owner.organisationId,
      ])
    ).rows[0].count
  );
  const eventsBefore = Number(
    (
      await pool.query('SELECT count(*) FROM public.webhook_deliveries WHERE endpoint_id=$1', [
        endpoint,
      ])
    ).rows[0].count
  );
  await fail(
    'audit_logs',
    `NEW.event_type='risk_register.imported_from_assessment' AND NEW.organisation_id='${owner.organisationId}'::uuid`
  );
  assert.equal((await call('POST', '/risk-register/from-assessment', {}, owner)).status, 500);
  assert.equal(
    Number(
      (
        await pool.query('SELECT count(*) FROM public.risk_register WHERE organisation_id=$1', [
          owner.organisationId,
        ])
      ).rows[0].count
    ),
    riskBefore
  );
  assert.equal(
    Number(
      (
        await pool.query('SELECT count(*) FROM public.webhook_deliveries WHERE endpoint_id=$1', [
          endpoint,
        ])
      ).rows[0].count
    ),
    eventsBefore
  );
  await removeFailure();
  const imported = await call('POST', '/risk-register/from-assessment', {}, owner);
  assert.equal(imported.status, 201);
  assert.equal(imported.body.data.length, suggested.body.data.length);
  assert.equal(
    (await call('POST', '/risk-register/from-assessment', {}, owner)).body.data.length,
    0
  );
  pass(
    'bulk assessment-risk imports roll back every row and event together and retry without duplicates'
  );

  const risk = {
    title: 'Atomic risk',
    riskArea: 'procurement',
    impact: 5,
    likelihood: 5,
    controlEffectiveness: 'none',
    ownerUserId: employee.id,
  };
  await fail(
    'webhook_deliveries',
    `NEW.endpoint_id='${endpoint}'::uuid AND NEW.payload->>'type'='risk.high_priority'`
  );
  assert.equal((await call('POST', '/risk-register', risk, owner)).status, 500);
  assert.equal(
    (
      await pool.query(
        "SELECT id FROM public.risk_register WHERE organisation_id=$1 AND title='Atomic risk'",
        [owner.organisationId]
      )
    ).rowCount,
    0
  );
  assert.equal(
    (
      await pool.query(
        "SELECT id FROM public.webhook_deliveries WHERE endpoint_id=$1 AND payload->>'type'='risk.created' AND payload->'data'->'risk'->>'title'='Atomic risk'",
        [endpoint]
      )
    ).rowCount,
    0
  );
  await removeFailure();
  const riskCreated = await call('POST', '/risk-register', risk, owner);
  assert.equal(riskCreated.status, 201);
  const riskId = riskCreated.body.data.id;
  pass('high-priority risk fan-out and its source/audit commit all-or-nothing');
  await fail(
    'webhook_deliveries',
    `NEW.endpoint_id='${endpoint}'::uuid AND NEW.payload->>'type'='risk.updated'`
  );
  assert.equal(
    (await call('PATCH', `/risk-register/${riskId}`, { title: 'Must roll back' }, owner)).status,
    500
  );
  assert.equal(
    (await pool.query('SELECT title FROM public.risk_register WHERE id=$1', [riskId])).rows[0]
      .title,
    risk.title
  );
  assert.equal(
    (
      await call(
        'POST',
        `/my-actions/${riskId}/progress`,
        { status: 'done', note: 'Completed checks' },
        employee
      )
    ).status,
    500
  );
  assert.equal(
    (await pool.query('SELECT review_pending FROM public.risk_register WHERE id=$1', [riskId]))
      .rows[0].review_pending,
    false
  );
  await removeFailure();
  assert.equal(
    (
      await call(
        'POST',
        `/my-actions/${riskId}/progress`,
        { status: 'done', note: 'Completed checks' },
        employee
      )
    ).status,
    200
  );
  await fail(
    'webhook_deliveries',
    `NEW.endpoint_id='${endpoint}'::uuid AND NEW.payload->>'type'='risk.updated'`
  );
  assert.equal(
    (await call('POST', `/risk-register/${riskId}/review`, { decision: 'approve' }, owner)).status,
    500
  );
  assert.equal(
    (await pool.query('SELECT review_pending FROM public.risk_register WHERE id=$1', [riskId]))
      .rows[0].review_pending,
    true
  );
  await removeFailure();
  pass('risk edits, owner progress and manager review roll back on publication failure');

  const base = `/budget-guide/plans/${assessmentId}`;
  assert.equal((await call('GET', base, undefined, owner)).body.data, null);
  const initial = await Promise.all([call('POST', base, {}, owner), call('POST', base, {}, owner)]);
  assert(initial.every((r) => [200, 201].includes(r.status)));
  assert.equal(initial[0].body.data.id, initial[1].body.data.id);
  let plan = initial[0].body.data;
  assert.equal(
    (await call('POST', base + '/complete', { expectedVersion: plan.version }, owner)).status,
    409
  );
  assert.equal((await call('GET', base, undefined, employee)).status, 404);
  assert.equal((await call('GET', base, undefined, other)).status, 404);
  assert.equal((await call('GET', base)).status, 401);
  pass('budget initialization is idempotent and isolated by assessment/organisation/authority');
  const appetite = await call(
    'PATCH',
    base + '/risk-appetite',
    { expectedVersion: plan.version, level: 'medium', justification: 'Protect core services' },
    owner
  );
  assert.equal(appetite.status, 200);
  plan = appetite.body.data;
  const mitigation = {
    risk_level: 'high',
    category: 'prevention',
    description: '<script>never execute</script> & checks',
    budget: 125.55,
    timeline: '1-3 months',
    status: 'planned',
  };
  assert.equal(
    (
      await call(
        'POST',
        base + '/mitigations',
        { ...mitigation, budget: -1, expectedVersion: plan.version },
        owner
      )
    ).status,
    400
  );
  assert.equal(
    (
      await call(
        'POST',
        base + '/mitigations',
        { ...mitigation, budget: 1.234, expectedVersion: plan.version },
        owner
      )
    ).status,
    400
  );
  await fail(
    'audit_logs',
    `NEW.event_type='budget_plan.mitigation_created' AND NEW.resource_id='${plan.id}'`
  );
  assert.equal(
    (
      await call(
        'POST',
        base + '/mitigations',
        { ...mitigation, expectedVersion: plan.version },
        owner
      )
    ).status,
    500
  );
  assert.equal(
    (await pool.query('SELECT id FROM public.budget_plan_mitigations WHERE plan_id=$1', [plan.id]))
      .rowCount,
    0
  );
  assert.equal(
    (await pool.query('SELECT version FROM public.budget_plans WHERE id=$1', [plan.id])).rows[0]
      .version,
    plan.version
  );
  await removeFailure();
  const added = await call(
    'POST',
    base + '/mitigations',
    { ...mitigation, expectedVersion: plan.version },
    owner
  );
  assert.equal(added.status, 200);
  plan = added.body.data;
  const itemId = plan.mitigations[0].id;
  assert.equal(
    (
      await pool.query('SELECT budget_cents FROM public.budget_plan_mitigations WHERE id=$1', [
        itemId,
      ])
    ).rows[0].budget_cents,
    12555
  );
  pass('budget money is validated in integer pence and failed saves roll back item/version/audit');
  const races = await Promise.all([
    call(
      'PATCH',
      base + `/mitigations/${itemId}`,
      { expectedVersion: plan.version, budget: 75.1 },
      owner
    ),
    call(
      'PATCH',
      base + `/mitigations/${itemId}`,
      { expectedVersion: plan.version, budget: 99.5 },
      owner
    ),
  ]);
  assert.deepEqual(races.map((r) => r.status).sort(), [200, 409]);
  plan = races.find((r) => r.status === 200).body.data;
  assert.equal(
    (await call('GET', `/budget-guide/plans/${secondId}`, undefined, owner)).body.data,
    null
  );
  assert.equal(
    (
      await call(
        'PATCH',
        `/budget-guide/plans/${secondId}/mitigations/${itemId}`,
        { expectedVersion: plan.version, budget: 10 },
        owner
      )
    ).status,
    404
  );
  pass(
    'stale saves are refused without overwrites and assessment plans do not leak into one another'
  );
  const complete = await call('POST', base + '/complete', { expectedVersion: plan.version }, owner);
  assert.equal(complete.status, 200);
  plan = complete.body.data;
  assert(plan.completed_at);
  const report = await app.request('http://localhost/api/v1' + base + '/report', {
    headers: { Authorization: `Bearer ${owner.token}` },
  });
  assert.equal(report.status, 200);
  assert(report.headers.get('content-disposition').includes('attachment'));
  assert.equal(report.headers.get('cache-control'), 'no-store');
  const html = await report.text();
  assert(html.includes('&amp;lt;script&amp;gt;'));
  assert(!html.includes('<script>'));
  assert(html.includes('Protect core services'));
  const edited = await call(
    'PATCH',
    base + `/mitigations/${itemId}`,
    { expectedVersion: plan.version, status: 'in_progress' },
    owner
  );
  assert.equal(edited.status, 200);
  plan = edited.body.data;
  assert.equal(plan.completed_at, null);
  const removed = await call(
    'DELETE',
    base + `/mitigations/${itemId}?expectedVersion=${plan.version}`,
    undefined,
    owner
  );
  assert.equal(removed.status, 200);
  assert.equal(removed.body.data.mitigations.length, 0);
  assert(
    (
      await pool.query('SELECT archived_at FROM public.budget_plan_mitigations WHERE id=$1', [
        itemId,
      ])
    ).rows[0].archived_at
  );
  pass('completion, report escaping, reopening and soft removal preserve saved strategy history');
  await pool.query("UPDATE public.purchases SET status='refunded' WHERE organisation_id=$1", [
    owner.organisationId,
  ]);
  assert.equal((await call('GET', base, undefined, owner)).status, 200);
  assert.equal(
    (
      await call(
        'PATCH',
        base + '/risk-appetite',
        { expectedVersion: removed.body.data.version, level: 'low', justification: 'No authority' },
        owner
      )
    ).status,
    403
  );
  assert.equal((await call('GET', '/budget-guide/progress', undefined, owner)).status, 200);
  pass(
    'saved plans remain readable after package expiry and existing training progress endpoints are preserved'
  );
  // Let post-commit certificate issuance finish before shutting down the disposable pool.
  for (let i = 0; i < 50; i++) {
    if (
      (
        await pool.query('SELECT id FROM public.assessment_certificates WHERE assessment_id=$1', [
          secondId,
        ])
      ).rowCount
    )
      break;
    await new Promise((r) => setTimeout(r, 50));
  }
  console.log(`PASS ${cases} domain publication/budget PostgreSQL scenarios`);
} finally {
  await removeFailure();
  await pool.end();
  await closeDbPool();
}
