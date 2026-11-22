// Destructive fixtures are restricted to a disposable loopback database.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import { Hono } from 'hono';
import { addVerifiedEvidence } from './lib/verified-evidence.mjs';
const url = new URL(process.env.DATABASE_URL ?? 'https://invalid');
assert(
  process.env.SALES_REPORT_TEST_DATABASE === '1' &&
    process.env.NODE_ENV !== 'production' &&
    ['localhost', '127.0.0.1'].includes(url.hostname) &&
    url.pathname.includes('professional'),
  'Disposable professional loopback database required'
);
process.env.NODE_ENV = 'test';
const { default: salesReport } = await import('../src/routes/provider-sales-report.ts');
const { providerSalesReport } = await import('../src/provider-sales-report.ts');
const { commissionTarget, reconcileProviderCommission } =
  await import('../src/provider-commissions.ts');
const { default: providers } = await import('../src/routes/provider-applications.ts');
const { jwtSecret } = await import('../src/helpers.ts');
const { closeDbPool } = await import('../src/db.ts');
const pool = new pg.Pool({ connectionString: url.href });
const app = new Hono().route('/sales', salesReport).route('/providers', providers);
app.onError((e, c) => c.json({ error: e.message }, 500));
let count = 0;
const pass = (n) => {
  count++;
  console.log('PASS ' + n);
};
async function actor(role = 'employer', org = randomUUID()) {
  const a = { id: randomUUID(), org, email: randomUUID() + '@example.test', role };
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query(
      "INSERT INTO public.users(id,email,name,password_hash,role,organisation_id,email_verified_at) VALUES($1,$2,'Sales Fixture','unused',$3,$4,now())",
      [a.id, a.email, role, org]
    );
    await db.query(
      "INSERT INTO public.organisations(id,name,created_by_user_id) VALUES($1,'Fixture',$2) ON CONFLICT DO NOTHING",
      [org, a.id]
    );
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  } finally {
    db.release();
  }
  a.token = jwt.sign({ sub: a.id, email: a.email, role, organisationId: a.org }, jwtSecret);
  a.auth = { userId: a.id, email: a.email, role, organisationId: a.org };
  return a;
}
async function call(a, path, body, status = 200) {
  const r = await app.request('http://localhost' + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      'content-type': 'application/json',
      ...(a ? { authorization: 'Bearer ' + a.token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  assert.equal(r.status, status, text);
  return JSON.parse(text).data;
}
async function agreement(
  a,
  org = a.org,
  { title = 'Provider agreement', extraSigner = false } = {}
) {
  const id = randomUUID();
  const hash = 'a'.repeat(64);
  // Completed retained fixture; normal application clients cannot insert signing evidence.
  await pool.query(
    `INSERT INTO public.esign_documents(id,organisation_id,created_by,title,
    original_pdf,original_sha256,source_pdf,source_sha256,pages,status,final_key,final_version,final_sha256)
    VALUES($1,$2,$3,$5,'fixture',encode(sha256('fixture'::bytea),'hex'),
    'fixture',encode(sha256('fixture'::bytea),'hex'),'[]','draft','retained','v1',$4)`,
    [id, org, a.id, hash, title]
  );
  // Build retained fixture in the same state order as signing, without disabling integrity triggers.
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query(
      `INSERT INTO public.esign_signers(id,document_id,email,name,status,consent_text,consent_at,signature_text,signed_at)
      VALUES($1,$2,$3,'Recruitment test','signed','fixture',now(),'Fixture',now())`,
      [randomUUID(), id, a.email]
    );
    if (extraSigner)
      await db.query(
        `INSERT INTO public.esign_signers(id,document_id,email,name,status,consent_text,consent_at,signature_text,signed_at)
      VALUES($1,$2,$3,'Other party','signed','fixture',now(),'Fixture',now())`,
        [randomUUID(), id, `other-${id}@example.test`]
      );
    await db.query("UPDATE public.esign_documents SET status='sent' WHERE id=$1", [id]);
    await db.query("UPDATE public.esign_documents SET status='completed' WHERE id=$1", [id]);
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  } finally {
    db.release();
  }
  await pool.query(
    `INSERT INTO public.esign_artifacts(document_id,manifest_key,manifest_version,manifest_sha256)
    VALUES($1,'manifest','v1',$2)`,
    [id, hash]
  );
  return id;
}
try {
  const reviewer = await actor('admin'),
    provider = await actor(),
    other = await actor('admin'),
    buyer = await actor();
  process.env.PROVIDER_REVIEW_ORGANISATION_ID = reviewer.org;
  const application = await call(
    provider,
    '/providers/me',
    { companyName: '=HYPERLINK("https://example.test")', serviceInterest: 'sales' },
    201
  );
  const doc = await agreement(provider, reviewer.org);
  await addVerifiedEvidence(pool, application.id, reviewer.id);
  const approved = await call(reviewer, '/providers/' + application.id + '/review', {
    revision: 0,
    status: 'approved',
    reason: 'Sales relationship verified',
    agreementDocumentId: doc,
  });
  const offer = await call(reviewer, '/providers/' + application.id + '/assignments', {
    packageId: 'pkg_basic',
    reference: randomUUID(),
    service: 'sales',
  });
  await call(provider, '/providers/me/assignments/' + offer.id + '/decision', {
    status: 'accepted',
  });
  async function purchase({
    net = 10000,
    refunded = 0,
    status = 'succeeded',
    currency = 'gbp',
    verified = true,
    created = '2026-11-15T12:00:00Z',
    attributed = true,
  } = {}) {
    const id = randomUUID();
    await pool.query(
      `INSERT INTO public.purchases(id,organisation_id,user_id,package_id,status,amount_cents,currency,created_at,refunded_amount_cents,payment_reconciled_at) VALUES($1,$2,$3,'pkg_basic',$4,$5,$6,$7,$8,$9)`,
      [
        id,
        buyer.org,
        buyer.id,
        status,
        net,
        currency,
        created,
        refunded,
        verified ? new Date() : null,
      ]
    );
    if (attributed) {
      await pool.query(
        'INSERT INTO public.provider_sale_attributions(purchase_id,application_id,assignment_id) VALUES($1,$2,$3)',
        [id, application.id, offer.id]
      );
      await reconcileProviderCommission(pool, id);
    }
    return id;
  }
  const full = await purchase(),
    partial = await purchase({ refunded: 6000 }),
    disputed = await purchase({ status: 'disputed' }),
    refund = await purchase({ status: 'refunded', refunded: 12000 }),
    pending = await purchase({ status: 'requires_confirmation', verified: false }),
    simulated = await purchase({ verified: false }),
    anomaly = await purchase({ refunded: 17000 }),
    eur = await purchase({ currency: 'eur', net: 12000 });
  await purchase({ created: '2026-12-01T00:00:00Z' });
  const from = await purchase({ created: '2026-11-01T00:00:00Z' });
  await purchase({ attributed: false });
  const params = '?from=2026-11-01&until=2026-12-01&providerCode=' + approved.providerCode;
  await call(null, '/sales/report' + params, undefined, 401);
  await call(other, '/sales/report' + params, undefined, 403);
  await call(provider, '/sales/report' + params, undefined, 403);
  await call(reviewer, '/sales/report?from=2026-12-01&until=2026-11-01', undefined, 400);
  await call(reviewer, '/sales/report' + params + '&unknown=1', undefined, 400);
  async function fingerprint() {
    return (
      await pool.query(
        `SELECT jsonb_build_object('purchases',(SELECT md5(string_agg(to_jsonb(t)::text,'' ORDER BY id)) FROM public.purchases t),'ledger',(SELECT md5(string_agg(to_jsonb(t)::text,'' ORDER BY id)) FROM public.provider_commission_entries t),'payouts',(SELECT count(*) FROM public.provider_payouts)) AS value`
      )
    ).rows[0].value;
  }
  const before = await fingerprint();
  const report = await call(reviewer, '/sales/report' + params);
  assert.equal(report.total, 9);
  assert.equal(report.rows.length, 9);
  assert.deepEqual(await fingerprint(), before);
  assert.equal(report.basis.feesDeducted, false);
  const row = (id) => report.rows.find((r) => r.purchaseId === id);
  assert.equal(row(full).targetCommissionCents, '1700');
  assert.equal(row(partial).eligibleNetCents, '5000');
  assert.equal(row(partial).targetCommissionCents, '850');
  for (const id of [disputed, refund, pending, simulated, anomaly])
    assert.equal(row(id).targetCommissionCents, '0');
  assert.equal(row(pending).verifiedRetainedGrossCents, null);
  assert.equal(row(anomaly).anomaly, true);
  assert.equal(report.summary.length, 2);
  assert.equal(report.summary.find((r) => r.currency === 'eur').targetCommissionCents, '2040');
  assert(report.rows.some((r) => r.purchaseId === from));
  assert.equal((await call(reviewer, '/sales/report' + params + '&currency=eur')).total, 1);
  assert.equal(
    (await call(reviewer, '/sales/report' + params + '&providerCode=' + approved.providerCode))
      .total,
    9
  );
  assert.equal(
    (await call(reviewer, '/sales/report' + params + '&packageId=pkg_training')).total,
    0
  );
  pass(
    'operator-only report distinguishes verified, refunded, disputed and unverified sales; UTC date boundaries and currency filters hold'
  );
  await pool.query(
    `INSERT INTO public.provider_commission_entries(purchase_id,application_id,currency,delta_cents,target_cents,reason) VALUES($1,$2,'gbp',1,1701,'Synthetic discrepancy for reporting')`,
    [full, application.id]
  );
  const mismatch = await call(reviewer, '/sales/report' + params);
  assert.equal(mismatch.rows.find((r) => r.purchaseId === full).commissionDifferenceCents, '-1');
  assert.equal(mismatch.rows.find((r) => r.purchaseId === full).postedCommissionCents, '1701');
  const exported = await app.request('http://localhost/sales/report' + params + '&format=csv', {
    headers: { authorization: 'Bearer ' + reviewer.token },
  });
  assert.equal(exported.status, 200);
  const csv = await exported.text();
  assert.match(exported.headers.get('content-type'), /text\/csv/);
  assert(csv.includes("'="));
  assert(csv.includes('"-1"'));
  assert(csv.includes('package-ht-proportional-refunds-v1'));
  assert(csv.includes('feesDeducted'));
  assert(
    (
      await pool.query(
        "SELECT count(*)::int AS n FROM public.audit_logs WHERE event_type='provider.sales_report'"
      )
    ).rows[0].n >= 1
  );
  pass(
    'CSV guards spreadsheet formulas and carries the declared basis; ledger mismatches are surfaced, never silently repaired'
  );
  // Exact commission rounding, including odd-cent partial refunds, must match the unchanged financial function.
  for (let i = 0; i < 55; i++)
    await purchase({ net: 101 + i * 139, refunded: i % 3 === 0 ? 17 : 0 });
  const paged = await call(reviewer, '/sales/report' + params);
  assert.equal(paged.rows.length, 50);
  assert.equal(paged.total, 64);
  const next = await call(reviewer, '/sales/report' + params + '&page=1');
  assert.equal(next.rows.length, 14);
  assert(!next.rows.some((r) => paged.rows.some((p) => p.purchaseId === r.purchaseId)));
  assert.deepEqual(next.summary, paged.summary);
  for (const r of [...paged.rows, ...next.rows])
    assert.equal(
      r.targetCommissionCents,
      String(
        commissionTarget(
          Number(r.netPriceCents),
          Number(r.expectedGrossCents),
          Number(r.refundedGrossCents),
          !!r.paymentVerifiedAt && r.status === 'succeeded'
        )
      )
    );
  // A non-UTC database session must still use the declared UTC boundaries.
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query("SET LOCAL TIME ZONE 'Pacific/Auckland'");
    const same = await providerSalesReport(db, {
      from: '2026-11-01',
      until: '2026-12-01',
      providerCode: approved.providerCode,
      page: 0,
    });
    assert.equal(same.total, 64);
    await db.query('ROLLBACK');
  } finally {
    db.release();
  }
  pass(
    'pagination shares full-scope totals, mixed currencies stay separate, rounding matches the ledger policy and timezone changes cannot move boundaries'
  );
  await pool.query("UPDATE public.users SET role='employer' WHERE id=$1", [reviewer.id]);
  await call(reviewer, '/sales/report' + params, undefined, 403);
  await pool.query("UPDATE public.users SET role='admin' WHERE id=$1", [reviewer.id]);
  await pool.query(
    `WITH inserted AS (
    INSERT INTO public.purchases(id,organisation_id,user_id,package_id,status,amount_cents,currency,created_at)
    SELECT gen_random_uuid(),$1,$2,'pkg_basic','requires_confirmation',100,'gbp','2026-11-16T12:00:00Z' FROM generate_series(1,10001) RETURNING id
  ) INSERT INTO public.provider_sale_attributions(purchase_id,application_id,assignment_id) SELECT id,$3,$4 FROM inserted`,
    [buyer.org, buyer.id, application.id, offer.id]
  );
  await call(reviewer, '/sales/report' + params + '&format=csv', undefined, 400);
  const large = await call(reviewer, '/sales/report' + params);
  assert.equal(large.total, 10065);
  assert.equal(large.rows.length, 50);
  pass(
    'stale administrator claims are rejected; oversized CSV exports fail explicitly while summary and pagination remain complete'
  );
  console.log(`PASS: ${count} admin sales report integration scenarios`);
} finally {
  await pool.end();
  await closeDbPool();
}
