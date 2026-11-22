// Destructive fixtures are restricted to a disposable loopback database.
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import { Hono } from 'hono';
import { addVerifiedEvidence } from './lib/verified-evidence.mjs';
const url = new URL(process.env.DATABASE_URL ?? 'https://invalid');
assert(
  process.env.FINANCE_TEST_DATABASE === '1' &&
    process.env.NODE_ENV !== 'production' &&
    ['localhost', '127.0.0.1'].includes(url.hostname) &&
    url.pathname.includes('professional'),
  'Disposable professional loopback database required'
);
process.env.NODE_ENV = 'test';
const { default: deliveries } = await import('../src/routes/service-delivery.ts');
const { default: routes } = await import('../src/routes/professional-scopes.ts');
const { default: fullApp } = await import('../src/index.ts');
const { default: finance } = await import('../src/routes/finance.ts');
const { default: identifiers } = await import('../src/routes/relationship-identifiers.ts');
const { setStripeClient } = await import('../src/stripe.ts');
const { paymentProvider } = await import('../__tests__/fixtures/payment-provider.ts');
const { dbGetPurchaseById } = await import('../src/db/purchases.ts');
const { commissionPaymentProfile } = await import('../src/finance-controls.ts');
const bcrypt = (await import('bcryptjs')).default;
const { default: providers } = await import('../src/routes/provider-applications.ts');
const { jwtSecret } = await import('../src/helpers.ts');
const { closeDbPool } = await import('../src/db.ts');
const pool = new pg.Pool({ connectionString: url.href });
const app = new Hono()
  .route('/finance', finance)
  .route('/identifiers', identifiers)
  .route('/deliveries', deliveries)
  .route('/professional', routes)
  .route('/providers', providers);
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
      "INSERT INTO public.users(id,email,name,password_hash,role,organisation_id,email_verified_at) VALUES($1,$2,'Trainer Fixture','unused',$3,$4,now())",
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
  a.token = jwt.sign({ sub: a.id, email: a.email, role, organisationId: a.org, mfaVersion:1,mfaAt:Math.floor(Date.now()/1000) }, jwtSecret);
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
async function progress(a, session, complete = true) {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO public.workshop_progress(id,user_id,session_id,current_section,completed_sections,quiz_scores,scenario_choices,completed_at) VALUES($1,$2,$3,6,$4,$5,'{}',$6)`,
    [
      id,
      a.id,
      session,
      complete ? [0, 1, 2, 3, 4, 5, 6] : [],
      complete ? { 1: 100, 2: 100, 3: 100, 4: 100 } : {},
      complete ? new Date() : null,
    ]
  );
  if (session)
    await pool.query('INSERT INTO public.session_participants(session_id,user_id) VALUES($1,$2)', [
      session,
      a.id,
    ]);
  return id;
}
const runId = randomUUID();
try {
  const a = await actor('admin'),
    b = await actor('admin', a.org),
    supplier = await actor(),
    customer = await actor(),
    employee = await actor('participant'),
    learner = await actor('participant', customer.org),
    outsider = await actor('admin');
  process.env.PROVIDER_REVIEW_ORGANISATION_ID = a.org;
  // Finance grants are read from the database, not an environment allowlist.
  const vault = JSON.stringify({
    activeKeyId: 'test-v1',
    keys: { 'test-v1': randomBytes(32).toString('base64') },
  });
  process.env.FINANCE_VAULT_KEYS = vault;
  for(const actor of [a,b]) {
    await pool.query("INSERT INTO public.user_mfa(user_id,secret,enabled) VALUES($1,'{}',true)",[actor.id]);
    await pool.query("INSERT INTO public.user_security_roles(user_id,role,granted_by,reason) VALUES($1,'finance',$2,'Synthetic independent finance grant')",[actor.id,actor.id===a.id?b.id:a.id]);
  }
  delete process.env.FINANCE_VAULT_KEYS_FILE;
  const password = 'Synthetic-finance-password-only';
  await pool.query('UPDATE public.users SET password_hash=$2 WHERE id=ANY($1::uuid[])', [
    [a.id, b.id],
    await bcrypt.hash(password, 10),
  ]);
  const application = await call(
    supplier,
    '/providers/me',
    {
      companyName: 'Finance Supplier',
      serviceInterest: 'both',
      trainingExperience: 'Recorded course demonstration reviewed',
    },
    201
  );
  const doc = await agreement(supplier, a.org);
  await addVerifiedEvidence(pool, application.id, a.id);
  await call(a, '/providers/' + application.id + '/review', {
    revision: 0,
    status: 'approved',
    reason: 'Supplier contract and qualifications reviewed',
    qualificationEvidence: 'Qualification proof and course delivery demonstration checked',
    agreementDocumentId: doc,
  });
  const sup = (await call(supplier, '/identifiers/me')).find((i) => i.kind === 'supplier');
  const employment = await agreement(employee, a.org, {
    title: 'Employment agreement payroll fixture',
  });
  const emp = await call(
    a,
    '/identifiers/employees',
    {
      userId: employee.id,
      organisationId: employee.org,
      agreementDocumentId: employment,
      reason: 'Employment record checked for payroll test',
      employmentVerified: true,
    },
    201
  );
  const bank = {
    identifierId: sup.id,
    expectedVersion: 0,
    accountHolder: 'Synthetic Supplier Ltd',
    sortCode: '10-88-00',
    accountNumber: '00012345',
    declaration: true,
  };
  await call(outsider, '/finance/profiles?view=review', undefined, 403);
  await call(supplier, '/finance/profiles', { ...bank, sortCode: 'invalid' }, 400);
  await call(employee, '/finance/profiles', bank, 403);
  delete process.env.FINANCE_VAULT_KEYS;
  await call(supplier, '/finance/profiles', bank, 503);
  process.env.FINANCE_VAULT_KEYS = vault;
  const profile = await call(supplier, '/finance/profiles', bank, 201);
  assert.equal(profile.kind, 'supplier');
  assert.equal(profile.last4, '2345');
  assert(!('encrypted_details' in profile));
  assert(!JSON.stringify(profile).includes(bank.accountNumber));
  const stored = (
    await pool.query('SELECT encrypted_details FROM finance_payment_profiles WHERE id=$1', [
      profile.id,
    ])
  ).rows[0].encrypted_details;
  assert(!('accountNumber' in stored));
  assert.equal(stored.keyId, 'test-v1');
  await call(
    a,
    '/finance/profiles/' + profile.id + '/review',
    { revision: 1, status: 'approved', reason: 'Format alone cannot prove beneficiary ownership' },
    400
  );
  await call(
    a,
    '/finance/profiles/' + profile.id + '/reveal',
    { reason: 'Inspect beneficiary evidence against bank document', password: 'incorrect' },
    403
  );
  const revealed = await call(a, '/finance/profiles/' + profile.id + '/reveal', {
    reason: 'Inspect beneficiary evidence against bank document',
    password,
  });
  assert.equal(revealed.accountNumber, bank.accountNumber);
  assert.equal(revealed.sortCode, '108800');
  const approveProfile = {
    revision: 1,
    status: 'approved',
    reason: 'Beneficiary evidence independently checked by finance',
    verificationReference: 'SYNTHETIC-BANK-CHECK-01',
    evidenceChecked: true,
  };
  await call(a, '/finance/profiles/' + profile.id + '/review', approveProfile);
  await call(a, '/finance/profiles/' + profile.id + '/review', approveProfile, 409);
  assert.equal(await commissionPaymentProfile(pool, application.id), profile.id);
  const empProfile = await call(
    employee,
    '/finance/profiles',
    { ...bank, identifierId: emp.id, accountHolder: 'Synthetic Employee' },
    201
  );
  assert.equal(empProfile.kind, 'payroll');
  await call(a, '/finance/profiles/' + empProfile.id + '/review', approveProfile);
  pass(
    'bank collection fails closed without vault keys, encrypts at rest, redacts all normal responses and requires explicit finance/password/evidence review'
  );
  const scope = await call(
    supplier,
    '/professional/me/scopes',
    {
      subjectId: 'fraud-risk-awareness',
      subjectVersion: '2026-10-30',
      revision: 0,
      actions: ['deliver'],
      evidence: 'Recorded delivery qualification checked for test',
    },
    201
  );
  const grant = await call(a, '/professional/scopes/' + scope.id + '/review', {
    revision: 1,
    status: 'approved',
    actions: ['deliver'],
    validFrom: new Date(Date.now() - 60000).toISOString(),
    validUntil: new Date(Date.now() + 86400000).toISOString(),
    reason: 'Current course authority reviewed',
    qualificationCheck: 'Original qualification reviewed',
    demonstrationCheck: 'Demonstration recording checked',
    checksConfirmed: true,
  });
  const assignment = await call(a, '/providers/' + application.id + '/assignments', {
    packageId: 'pkg_full',
    reference: randomUUID(),
    service: 'training',
    scopeId: scope.id,
  });
  await call(supplier, '/providers/me/assignments/' + assignment.id + '/decision', {
    status: 'accepted',
  });
  const session = await call(
    supplier,
    '/professional/sessions',
    {
      scopeId: scope.id,
      scopeRevision: grant.revision,
      assignmentId: assignment.id,
      title: 'Finance service class',
    },
    201
  );
  await progress(learner, session.id);
  const delivery = await call(
    a,
    '/deliveries/records',
    {
      applicationId: application.id,
      assignmentId: assignment.id,
      sessionId: session.id,
      customerUserId: customer.id,
      customerOrganisationId: customer.org,
      title: 'Agreed training delivery',
      startsAt: '2026-11-21T10:00:00Z',
      endsAt: '2026-11-21T12:00:00Z',
      reason: 'Delivery scheduled for finance fixture',
    },
    201
  );
  const purchaseId = randomUUID();
  await pool.query(
    "INSERT INTO public.purchases(id,organisation_id,user_id,package_id,status,amount_cents,currency,payment_intent_id) VALUES($1,$2,$3,'pkg_full','succeeded',10000,'gbp',$4)",
    [purchaseId, customer.org, customer.id, 'pi_' + purchaseId]
  );
  const purchase = await dbGetPurchaseById(purchaseId);
  const payment = paymentProvider(purchase);
  setStripeClient(payment.client);
  const options = await call(a, '/finance/fee-options?deliveryId=' + delivery.id);
  assert(options.purchases.some((p) => p.id === purchaseId));
  const fee = await call(
    a,
    '/finance/fees',
    {
      deliveryId: delivery.id,
      purchaseId,
      expectedVersion: 0,
      netCents: 5000,
      vatCents: 0,
      terms:
        'Fixed GBP 50 supplier fee for this single delivered class; no commission calculation.',
    },
    201
  );
  assert.equal(fee.total_cents, 5000);
  await call(a, '/finance/fees/' + fee.id + '/decision', { revision: 1, status: 'accepted' }, 403);
  await call(supplier, '/finance/fees/' + fee.id + '/decision', {
    revision: 1,
    status: 'accepted',
  });
  const request = {
    requestKey: randomUUID(),
    profileId: profile.id,
    kind: 'supplier_service_fee',
    feeId: fee.id,
    reason: 'Prepare the agreed supplier invoice fee',
  };
  await call(a, '/finance/instructions', request, 409); // unaccepted service, even though payment verifies
  await call(
    supplier,
    '/deliveries/' + delivery.id + '/attendance',
    {
      revision: 1,
      learnerId: learner.id,
      status: 'present',
      reason: 'Trainer recorded actual attendance',
    },
    201
  );
  const form = new FormData();
  form.set('revision', '2');
  form.set(
    'file',
    new File(['%PDF-1.7\nsynthetic delivery evidence'], 'proof.pdf', { type: 'application/pdf' })
  );
  const uploaded = await app.request('http://localhost/deliveries/' + delivery.id + '/files', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + supplier.token },
    body: form,
  });
  assert.equal(uploaded.status, 201, await uploaded.text());
  await call(supplier, '/deliveries/' + delivery.id + '/action', {
    revision: 3,
    action: 'submit',
    reason: 'Service delivered for independent customer review',
    evidenceSummary: 'Completed training with retained attendance and file evidence',
  });
  await call(customer, '/deliveries/' + delivery.id + '/action', {
    revision: 4,
    action: 'accept',
    reason: 'Customer accepts the documented training service',
  });
  const instruction = await call(a, '/finance/instructions', request, 201);
  assert.equal(instruction.gross_cents, 5000);
  assert.match(instruction.instruction_reference, /^FRA-SUPFEE-/);
  assert.equal(instruction.confirmation_reference, null);
  assert.equal((await call(a, '/finance/instructions', request, 201)).id, instruction.id);
  await call(a, '/finance/instructions', { ...request, requestKey: randomUUID() }, 409);
  await call(
    a,
    '/finance/fees',
    {
      deliveryId: delivery.id,
      purchaseId,
      expectedVersion: 1,
      netCents: 1,
      vatCents: 0,
      terms: 'Attempted replacement while settlement is outstanding',
    },
    409
  );
  await call(
    a,
    '/finance/instructions/' + instruction.id + '/action',
    { revision: 1, action: 'approve', reason: 'Cannot approve own prepared supplier instruction' },
    403
  );
  payment.dispute('needs_response');
  await call(
    b,
    '/finance/instructions/' + instruction.id + '/action',
    {
      revision: 1,
      action: 'approve',
      reason: 'Disputed customer funds must not authorise a service fee',
    },
    409
  );
  payment.dispute('won');
  await call(b, '/finance/instructions/' + instruction.id + '/action', {
    revision: 1,
    action: 'approve',
    reason: 'Independent supplier fee approval complete',
  });
  payment.state.unavailable = true;
  await call(
    b,
    '/finance/instructions/' + instruction.id + '/action',
    {
      revision: 2,
      action: 'record',
      reason: 'Payment provider currently cannot verify',
      externalReference: 'SYNTHETIC-BANK-TRACE-01',
      externalExecutionChecked: true,
    },
    409
  );
  payment.state.unavailable = false;
  pass(
    'service fees require exact supplier acceptance, customer-accepted delivery, trusted income refresh and separate finance approval; duplicates/self-approval fail'
  );
  // Changing bank data resets the current version and fences an already approved instruction.
  const changed = await call(
    supplier,
    '/finance/profiles',
    { ...bank, expectedVersion: 1, accountNumber: '00012346' },
    201
  );
  await call(
    b,
    '/finance/instructions/' + instruction.id + '/action',
    {
      revision: 2,
      action: 'record',
      reason: 'Old beneficiary must not be silently replaced',
      externalReference: 'SYNTHETIC-BANK-TRACE-01',
      externalExecutionChecked: true,
    },
    409
  );
  await assert.rejects(commissionPaymentProfile(pool, application.id), /current approved/);
  await call(b, '/finance/instructions/' + instruction.id + '/action', {
    revision: 2,
    action: 'cancel',
    reason: 'Cancel instruction bound to superseded beneficiary',
  });
  await call(a, '/finance/profiles/' + changed.id + '/review', approveProfile);
  await assert.rejects(
    commissionPaymentProfile(pool, application.id, profile.id),
    /Beneficiary details changed/
  );
  const revised = await call(
    a,
    '/finance/instructions',
    { ...request, requestKey: randomUUID(), profileId: changed.id },
    201
  );
  await call(b, '/finance/instructions/' + revised.id + '/action', {
    revision: 1,
    action: 'approve',
    reason: 'New reviewed beneficiary independently checked',
  });
  const recorded = await call(b, '/finance/instructions/' + revised.id + '/action', {
    revision: 2,
    action: 'record',
    reason: 'External bank execution evidence checked by staff',
    externalReference: 'SYNTHETIC-BANK-TRACE-02-' + runId,
    externalExecutionChecked: true,
  });
  assert.match(recorded.confirmation_reference, /^FRA-CNF-/);
  assert.equal(recorded.recording_method, 'staff_bank_attestation');
  await call(
    a,
    '/finance/instructions',
    { ...request, requestKey: randomUUID(), profileId: changed.id },
    409
  );
  // Exercise the existing commission API with the newly collected beneficiary binding.
  const salesOffer = await call(a, '/providers/' + application.id + '/assignments', {
    packageId: 'pkg_full',
    reference: randomUUID(),
    service: 'sales',
  });
  await call(supplier, '/providers/me/assignments/' + salesOffer.id + '/decision', {
    status: 'accepted',
  });
  const commissionPurchaseId = randomUUID();
  await pool.query(
    "INSERT INTO public.purchases(id,organisation_id,user_id,package_id,status,amount_cents,currency,payment_intent_id) VALUES($1,$2,$3,'pkg_full','requires_confirmation',10000,'gbp',$4)",
    [commissionPurchaseId, customer.org, customer.id, 'pi_' + commissionPurchaseId]
  );
  const { attributeProviderSale } = await import('../src/provider-commissions.ts');
  await attributeProviderSale(
    pool,
    customer.auth,
    commissionPurchaseId,
    'pkg_full',
    (await call(supplier, '/providers/me')).providerCode
  );
  const commissionPayment = paymentProvider(await dbGetPurchaseById(commissionPurchaseId));
  setStripeClient(commissionPayment.client);
  process.env.PROVIDER_PAYOUTS_ENABLED = 'true';
  const commissionBody = {
    requestKey: randomUUID(),
    currency: 'gbp',
    amountCents: 1700,
    reason: 'Prepare earned commission with a reviewed bank profile',
  };
  const commission = await call(a, '/providers/' + application.id + '/payouts', commissionBody);
  assert.equal(
    (
      await pool.query('SELECT payment_profile_id FROM provider_payouts WHERE id=$1', [
        commission.id,
      ])
    ).rows[0].payment_profile_id,
    changed.id
  );
  const latestBank = await call(
    supplier,
    '/finance/profiles',
    { ...bank, expectedVersion: 2, accountNumber: '00012347' },
    201
  );
  await call(
    b,
    '/providers/payouts/' + commission.id + '/action',
    { action: 'approve', reason: 'Pending bank revision must stop commission approval' },
    409
  );
  await call(a, '/finance/profiles/' + latestBank.id + '/review', approveProfile);
  await call(
    b,
    '/providers/payouts/' + commission.id + '/action',
    { action: 'approve', reason: 'Old commission binding cannot silently change' },
    409
  );
  await call(a, '/providers/payouts/' + commission.id + '/action', {
    action: 'cancel',
    reason: 'Cancel payout bound to the previous account',
  });
  const freshCommission = await call(a, '/providers/' + application.id + '/payouts', {
    ...commissionBody,
    requestKey: randomUUID(),
  });
  await call(b, '/providers/payouts/' + freshCommission.id + '/action', {
    action: 'approve',
    reason: 'Independently approve current bank-bound commission',
  });
  await call(b, '/providers/payouts/' + freshCommission.id + '/action', {
    action: 'record',
    reason: 'Checked external commission settlement trace',
    settlementReference: 'SYNTHETIC-COMMISSION-BANK-' + runId,
  });
  const statement = await call(a, '/providers/' + application.id + '/statement');
  const commissionRow = statement.payouts.find((p) => p.id === freshCommission.id);
  assert.equal(commissionRow.beneficiarySource, 'approved_payment_profile');
  assert.equal(commissionRow.beneficiaryLast4, '2347');
  assert.match(commissionRow.confirmationReference, /^FRA-CNF-COM-/);
  setStripeClient(payment.client);
  const wages = {
    requestKey: randomUUID(),
    profileId: empProfile.id,
    kind: 'payroll_gross',
    grossCents: 120000,
    periodFrom: '2026-11-01',
    periodUntil: '2026-12-01',
    reason: 'Gross November wages instruction for external payroll',
  };
  await call(a, '/finance/instructions', { ...wages, profileId: latestBank.id }, 400);
  const payroll = await call(a, '/finance/instructions', wages, 201);
  assert.match(payroll.instruction_reference, /^FRA-PAYROLL-/);
  assert.equal(payroll.kind, 'payroll_gross');
  assert.equal((await call(a, '/finance/instructions', wages, 201)).id, payroll.id);
  await call(
    a,
    '/finance/instructions',
    { ...wages, requestKey: randomUUID(), periodFrom: '2026-11-15', periodUntil: '2026-12-15' },
    409
  );
  await call(
    a,
    '/finance/instructions/' + payroll.id + '/action',
    { revision: 1, action: 'approve', reason: 'Preparer may not approve own payroll instruction' },
    403
  );
  await call(b, '/finance/instructions/' + payroll.id + '/action', {
    revision: 1,
    action: 'approve',
    reason: 'Independent review of gross payroll instruction',
  });
  const payrollRecorded = await call(b, '/finance/instructions/' + payroll.id + '/action', {
    revision: 2,
    action: 'record',
    reason: 'Checked external payroll run reference only',
    externalReference: 'SYNTHETIC-PAYROLL-RUN-01-' + runId,
    externalExecutionChecked: true,
  });
  assert.equal(payrollRecorded.recording_method, 'staff_payroll_run_attestation');
  assert.notEqual(payrollRecorded.confirmation_reference, recorded.confirmation_reference);
  pass(
    'changed bank details invalidate old instructions and commission bindings; supplier fees and gross payroll use different identities, periods and generated references'
  );
  // Generated commission references extend the old ledger without rewriting staff-provided bank traces.
  const oldPayout = randomUUID();
  await pool.query(
    "INSERT INTO public.provider_payouts(id,application_id,currency,amount_cents,request_key,prepared_by,reason) VALUES($1,$2,'gbp',1700,$3,$4,'Synthetic legacy bank workflow')",
    [oldPayout, application.id, randomUUID(), a.id]
  );
  await pool.query(
    "UPDATE public.provider_payouts SET status='approved',approved_by=$2,approved_at=now() WHERE id=$1",
    [oldPayout, b.id]
  );
  await pool.query(
    "UPDATE public.provider_payouts SET status='recorded',recorded_by=$2,recorded_at=now(),settlement_reference=$3 WHERE id=$1",
    [oldPayout, b.id, 'SYNTHETIC-LEGACY-BANK-TRACE-' + runId]
  );
  const generated = (
    await pool.query(
      'SELECT instruction_reference,confirmation_reference,settlement_reference,beneficiary_source FROM public.provider_payouts WHERE id=$1',
      [oldPayout]
    )
  ).rows[0];
  assert.match(generated.instruction_reference, /^FRA-COM-/);
  assert.match(generated.confirmation_reference, /^FRA-CNF-COM-/);
  assert.equal(generated.settlement_reference, 'SYNTHETIC-LEGACY-BANK-TRACE-' + runId);
  assert.equal(generated.beneficiary_source, 'legacy_external_bank_workflow');
  const profileHistory = await call(a, '/finance/history/profile/' + changed.id);
  assert(profileHistory.verified);
  assert(!JSON.stringify(profileHistory).includes('encrypted_details'));
  assert(!JSON.stringify(profileHistory).includes(bank.accountNumber));
  await call(a, '/finance/history/fee/' + fee.id);
  await call(a, '/finance/history/instruction/' + revised.id);
  await call(a, '/finance/history/instruction/' + payroll.id);
  await assert.rejects(
    pool.query('DELETE FROM finance_payment_profiles WHERE id=$1', [changed.id]),
    /Retained/
  );
  await assert.rejects(
    pool.query('UPDATE finance_fee_agreements SET net_cents=1,revision=revision+1 WHERE id=$1', [
      fee.id,
    ]),
    /Immutable/
  );
  await assert.rejects(
    pool.query('DELETE FROM finance_events WHERE aggregate_id=$1', [changed.id]),
    /Retained/
  );
  const ownerInstructions = await call(supplier, '/finance/instructions');
  assert(!ownerInstructions.some((p) => 'prepared_by' in p));
  assert(!JSON.stringify(await call(supplier, '/finance/profiles')).includes('encrypted_details'));
  pass(
    'system-generated references coexist with honest external staff traces; bank, fee and instruction histories are immutable and contain no plaintext bank details'
  );
  const employmentA = await agreement(a, a.org, {
    title: 'Employment agreement independent staff fixture',
  });
  const staffEmployee = await call(
    b,
    '/identifiers/employees',
    {
      userId: a.id,
      organisationId: a.org,
      agreementDocumentId: employmentA,
      reason: 'Independent staff employment review',
      employmentVerified: true,
    },
    201
  );
  const staffBank = await call(
    a,
    '/finance/profiles',
    { ...bank, identifierId: staffEmployee.id, accountHolder: 'Synthetic Staff Beneficiary' },
    201
  );
  await call(a, '/finance/profiles/' + staffBank.id + '/review', approveProfile, 403);
  await call(b, '/finance/profiles/' + staffBank.id + '/review', approveProfile);
  await call(
    a,
    '/finance/instructions',
    { ...wages, requestKey: randomUUID(), profileId: staffBank.id },
    403
  );
  const raceBody = { ...wages, periodFrom: '2026-12-01', periodUntil: '2027-01-01' };
  const races = await Promise.all(
    [0, 1].map(async () => {
      const r = await app.request('http://localhost/finance/instructions', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + a.token, 'content-type': 'application/json' },
        body: JSON.stringify({ ...raceBody, requestKey: randomUUID() }),
      });
      return { status: r.status, body: await r.json() };
    })
  );
  assert.deepEqual(races.map((r) => r.status).sort(), [201, 409]);
  const pending = races.find((r) => r.status === 201).body.data;
  await pool.query(
    `CREATE FUNCTION public.finance_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.aggregate_id='${pending.id}' THEN RAISE EXCEPTION 'injected finance audit failure'; END IF; RETURN NEW; END $$`
  );
  await pool.query(
    'CREATE TRIGGER finance_test_fail BEFORE INSERT ON public.finance_events FOR EACH ROW EXECUTE FUNCTION public.finance_test_fail()'
  );
  try {
    await call(
      b,
      '/finance/instructions/' + pending.id + '/action',
      { revision: 1, action: 'approve', reason: 'Injected atomic approval failure' },
      500
    );
    assert.equal(
      (await pool.query('SELECT status FROM finance_instructions WHERE id=$1', [pending.id]))
        .rows[0].status,
      'prepared'
    );
  } finally {
    await pool.query('DROP TRIGGER finance_test_fail ON public.finance_events');
    await pool.query('DROP FUNCTION public.finance_test_fail()');
  }
  await pool.query(
    "UPDATE public.relationship_identifiers SET status='revoked',suspension_source=NULL,revision=revision+1,reason='Synthetic employment reference revocation',actor_id=$2 WHERE id=$1",
    [emp.id, b.id]
  );
  await call(a, '/finance/instructions/' + pending.id + '/action', {
    revision: 1,
    action: 'cancel',
    reason: 'Cancel now-ineligible beneficiary instruction',
  });
  const cancelledHistory = await call(a, '/finance/history/instruction/' + pending.id);
  assert.equal(cancelledHistory.events.at(-1).snapshot.last_action_by, a.id);
  await pool.query("UPDATE public.user_security_roles SET revoked_at=now() WHERE user_id=$1",[a.id]);
  await call(a, '/finance/profiles?view=review', undefined, 403);
  // Finance grants are read from the database, not an environment allowlist.
  payment.refund(100);
  const { refreshFeePayment, eligibleFee } = await import('../src/finance-controls.ts');
  await refreshFeePayment(a.auth, fee.id);
  await assert.rejects(eligibleFee(pool, fee.id), /unrefunded/);
  pass(
    'self-beneficiary approval is blocked, concurrent periods cannot duplicate payroll, audit failure rolls back, inactive work can be cancelled and refunded funds do not qualify'
  );
  console.log(`PASS: ${count} finance beneficiary/fee/payroll integration scenarios`);
} finally {
  setStripeClient(null);
  delete process.env.FINANCE_VAULT_KEYS;
  await pool.end();
  await closeDbPool();
}
