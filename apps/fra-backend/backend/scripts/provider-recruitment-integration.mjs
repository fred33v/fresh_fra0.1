// Run only on an explicitly disposable local PostgreSQL database after migrations.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import { Hono } from 'hono';
import { addVerifiedEvidence } from './lib/verified-evidence.mjs';
if (process.env.PROVIDER_TEST_DATABASE !== '1' || process.env.NODE_ENV === 'production' ||
    !['localhost','127.0.0.1','[::1]'].includes(new URL(process.env.DATABASE_URL ?? 'https://invalid').hostname))
  throw new Error('Requires PROVIDER_TEST_DATABASE=1 and a disposable local DATABASE_URL');
process.env.NODE_ENV = 'test';
process.env.PROVIDER_PAYOUTS_ENABLED='false';
const { default: routes } = await import('../src/routes/provider-applications.ts');
const { jwtSecret } = await import('../src/helpers.ts');
const { closeDbPool } = await import('../src/db.ts');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const app = new Hono().route('/api/v1/provider-applications', routes);
const operatorOrg = randomUUID();
process.env.PROVIDER_REVIEW_ORGANISATION_ID = operatorOrg;
let checks = 0;
async function actor(role, org = randomUUID(), verified = true) {
  const a = { id: randomUUID(), org, email: `${randomUUID()}@example.test`, role };
  const db = await pool.connect();
  try {
  await db.query('BEGIN');
  await db.query(`INSERT INTO public.users(id,email,name,password_hash,role,organisation_id,email_verified_at)
    VALUES($1,$2,'Recruitment test','unused',$3,$4,$5)`, [a.id,a.email,role,org,verified ? new Date() : null]);
  await db.query(`INSERT INTO public.organisations(id,name,created_by_user_id) VALUES($1,'Provider test',$2) ON CONFLICT(id) DO NOTHING`,[org,a.id]);
  await db.query('COMMIT');
  } catch(e) {await db.query('ROLLBACK');throw e;} finally {db.release();}
  if(role==='admin' && org===operatorOrg){
    await pool.query("INSERT INTO public.user_mfa(user_id,secret,enabled) VALUES($1,'{}',true)",[a.id]);
    await pool.query("INSERT INTO public.user_security_roles(user_id,role,granted_by,reason) VALUES($1,'finance',$1,'Synthetic finance fixture grant')",[a.id]);
  }
  a.token = jwt.sign({ sub: a.id, email: a.email, role, organisationId: org,mfaVersion:1,mfaAt:Math.floor(Date.now()/1000) }, jwtSecret);
  return a;
}
async function call(actor, path, body, expected = 200, method = body ? 'POST' : 'GET') {
  const r = await app.request(`http://localhost/api/v1/provider-applications${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(actor ? { Authorization: `Bearer ${actor.token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await r.json();
  assert.equal(r.status, expected, JSON.stringify(data)); checks++;
  return data.data;
}
async function agreement(a, org = operatorOrg, { title = 'Provider agreement', extraSigner = false } = {}) {
  const id = randomUUID();
  const hash = 'a'.repeat(64);
  // Completed retained fixture; normal application clients cannot insert signing evidence.
  await pool.query(`INSERT INTO public.esign_documents(id,organisation_id,created_by,title,
    original_pdf,original_sha256,source_pdf,source_sha256,pages,status,final_key,final_version,final_sha256)
    VALUES($1,$2,$3,$5,'fixture',encode(sha256('fixture'::bytea),'hex'),
    'fixture',encode(sha256('fixture'::bytea),'hex'),'[]','draft','retained','v1',$4)`, [id,org,a.id,hash,title]);
  // Build retained fixture in the same state order as signing, without disabling integrity triggers.
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query(`INSERT INTO public.esign_signers(id,document_id,email,name,status,consent_text,consent_at,signature_text,signed_at)
      VALUES($1,$2,$3,'Recruitment test','signed','fixture',now(),'Fixture',now())`, [randomUUID(),id,a.email]);
    if (extraSigner) await db.query(`INSERT INTO public.esign_signers(id,document_id,email,name,status,consent_text,consent_at,signature_text,signed_at)
      VALUES($1,$2,$3,'Other party','signed','fixture',now(),'Fixture',now())`, [randomUUID(),id,`other-${id}@example.test`]);
    await db.query("UPDATE public.esign_documents SET status='sent' WHERE id=$1",[id]);
    await db.query("UPDATE public.esign_documents SET status='completed' WHERE id=$1",[id]);
    await db.query('COMMIT');
  } catch (e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
  await pool.query(`INSERT INTO public.esign_artifacts(document_id,manifest_key,manifest_version,manifest_sha256)
    VALUES($1,'manifest','v1',$2)`, [id,hash]);
  return id;
}
try {
  const admin = await actor('admin', operatorOrg);
  const stranger = await actor('admin');
  const applicant = await actor('employer');
  const other = await actor('employer');
  const unverified = await actor('employer', randomUUID(), false);
  await call(null, '/me', null, 401);
  await call(unverified, '/me', null, 403);
  await call(stranger, '/review', null, 403);
  await call(applicant, '/me', { companyName:'Test company', serviceInterest:'training' },400);
  const application = await call(applicant, '/me', { companyName:'Test company', serviceInterest:'both', trainingExperience:'Demonstrated training experience' },201);
  await call(applicant, '/me', { companyName:'Test company', serviceInterest:'sales' },409);
  assert.equal(await call(other, '/me'), null);
  assert((await call(admin, '/review')).some(a => a.id === application.id));
  const review = { revision:0,status:'approved',reason:'Reviewed qualifications and demonstration',qualificationEvidence:'Professional register checked and demo observed' };
  await call(applicant, `/${application.id}/review`, review,403);
  // Approval needs a checked identity document. A valid, applicant-signed agreement is not enough without it; pending
  // and rejected documents do not count, and neither does a verified document of any other kind.
  const gateAgreement = await agreement(applicant);
  const gate = { ...review, agreementDocumentId: gateAgreement };
  const insertEvidence = (status, kind = 'identity') => pool.query(`INSERT INTO public.provider_application_documents
    (application_id,application_revision,kind,filename,mime_type,content,sha256,size_bytes,uploaded_by,status,decided_by,decided_at,decision_reason)
    SELECT id,revision,$5,'gate.pdf','application/pdf',$2::bytea,encode(sha256($2::bytea),'hex'),octet_length($2::bytea),applicant_id,$3,
      CASE WHEN $3='pending' THEN NULL ELSE $4::uuid END, CASE WHEN $3='pending' THEN NULL ELSE now() END,
      CASE WHEN $3='rejected' THEN 'Document is not legible enough' END
    FROM public.provider_applications WHERE id=$1`, [application.id, Buffer.from('%PDF-1.7\ngate\n'), status, admin.id, kind]);
  const refusedForIdentity = async () => {
    const response = await app.request(`http://localhost/api/v1/provider-applications/${application.id}/review`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` }, body: JSON.stringify(gate),
    });
    const body = await response.json();
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.match(body.error.message, /identity document/);
    checks++;
  };
  await refusedForIdentity();
  await insertEvidence('pending');
  await refusedForIdentity();
  await insertEvidence('rejected');
  await refusedForIdentity();
  for (const kind of ['qualification', 'company_registration', 'insurance', 'training_demonstration', 'other'])
    await insertEvidence('verified', kind);
  await refusedForIdentity(); // five verified documents, none of them an identity document
  assert.deepEqual((await pool.query('SELECT status, provider_code FROM public.provider_applications WHERE id=$1', [application.id])).rows[0],
    { status: 'submitted', provider_code: null });
  await addVerifiedEvidence(pool, application.id, admin.id); // the identity document, verified
  await call(admin, `/${application.id}/review`, review,400); // verified identity document, but no agreement yet
  const wrong = await agreement(other);
  await call(admin, `/${application.id}/review`, { ...review,agreementDocumentId:wrong },400);
  // A completed, retained, applicant-signed document is not enough: it must be the provider agreement, signed only by the applicant.
  const consent = await agreement(applicant, operatorOrg, { title: 'Consent form' });
  await call(admin, `/${application.id}/review`, { ...review,agreementDocumentId:consent },400);
  const shared = await agreement(applicant, operatorOrg, { extraSigner: true });
  await call(admin, `/${application.id}/review`, { ...review,agreementDocumentId:shared },400);
  const own = await call(admin, '/me', {companyName:'Operator company',serviceInterest:'sales'},201);
  await call(admin, `/${own.id}/review`,review,403);
  await call(admin, '/review?page=-1',null,400);
  const doc = await agreement(applicant);
  const noEvidence = {...review,agreementDocumentId:doc}; delete noEvidence.qualificationEvidence;
  await call(admin, `/${application.id}/review`,noEvidence,400);
  const approved = await call(admin, `/${application.id}/review`, { ...review,agreementDocumentId:doc });
  assert.equal(approved.status,'approved'); assert.match(approved.providerCode,/^PRV-[a-f0-9]{32}$/);
  // Statements are reads: a lock held on the provider row (as reconciliation/checkout hold it) must not stall them.
  {
    const lock = await pool.connect();
    try {
      await lock.query('BEGIN');
      await lock.query('SELECT id FROM public.provider_applications WHERE id=$1 FOR UPDATE',[application.id]);
      const stalled = Symbol('stalled');
      const timeout = () => new Promise(r => setTimeout(() => r(stalled), 3000));
      for (const read of [() => call(applicant,'/me/statement'), () => call(admin,`/${application.id}/statement`)]) {
        const result = await Promise.race([read(), timeout()]);
        assert.notEqual(result, stalled, 'statement endpoint blocked behind a provider-row lock');
      }
    } finally { await lock.query('ROLLBACK'); lock.release(); }
  }
  await call(admin, `/${application.id}/review`, { ...review,agreementDocumentId:doc },409);
  const offer = { packageId:'pkg_basic',reference:randomUUID(),service:'training' };
  const assignment = await call(admin, `/${application.id}/assignments`,offer);
  await call(admin, `/${application.id}/assignments`,offer,409);
  const list = await call(applicant,'/me/assignments'); assert.equal(list[0].id,assignment.id);
  await call(other,`/me/assignments/${assignment.id}/decision`,{status:'accepted'},403);
  const outcomes = await Promise.all(['accepted','refused'].map(status => app.request(`http://localhost/api/v1/provider-applications/me/assignments/${assignment.id}/decision`,{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${applicant.token}`},body:JSON.stringify({status})
  })));
  assert.deepEqual(outcomes.map(r=>r.status).sort(),[200,409]); checks++;
  await call(admin,`/${application.id}/review`,{revision:1,status:'suspended',reason:'Temporary suspension pending review'});
  assert.equal((await call(applicant,'/me/assignments'))[0].status,'cancelled');
  await call(applicant,`/me/assignments/${assignment.id}/decision`,{status:'accepted'},403);
  await call(admin,`/${application.id}/assignments`,{...offer,reference:randomUUID()},409);
  const audit = await call(admin,`/${application.id}/audit`); assert.equal(audit.length,4);
  await call(admin,`/${application.id}/review`,{...review,revision:2,agreementDocumentId:doc});
  const final = await call(admin,`/${application.id}/assignments`,{...offer,reference:randomUUID()});
  await call(applicant,`/me/assignments/${final.id}/decision`,{status:'accepted'});
  await call(admin,`/${application.id}/assignments/${final.id}/close`,{status:'completed',reason:'Delivery reviewed and accepted'});
  await call(admin,`/${application.id}/assignments/${final.id}/close`,{status:'completed',reason:'Delivery reviewed and accepted'},409);
  await call(admin,`/${application.id}/assignments`);
  const cancelled = await call(admin,`/${application.id}/assignments`,{...offer,reference:randomUUID()});
  await call(admin,`/${application.id}/assignments/${cancelled.id}/close`,{status:'cancelled',reason:'Customer cancelled assignment'});
  await call(applicant,`/me/assignments/${cancelled.id}/decision`,{status:'accepted'},409);
  const seller = await call(other,'/me',{companyName:'Sales company',serviceInterest:'sales'},201);
  const sellerDoc = await agreement(other);
  await addVerifiedEvidence(pool, seller.id, admin.id);
  await call(admin,`/${seller.id}/review`,{revision:0,status:'approved',reason:'Sales references and agreement reviewed',agreementDocumentId:sellerDoc});
  await call(admin,`/${seller.id}/assignments`,{...offer,reference:randomUUID()},409);
  const declinedUser = await actor('employer');
  const declined = await call(declinedUser,'/me',{companyName:'Another company',serviceInterest:'sales'},201);
  await call(admin,`/${declined.id}/review`,{revision:0,status:'declined',reason:'Application does not meet requirements'});
  await call(admin,`/${declined.id}/assignments`,{...offer,reference:randomUUID()},409);
  // A declined applicant is not stuck: a reviewer can reopen the application, but cannot approve it directly.
  const reopenReason='Evidence supplied after the decision';
  await call(admin,`/${declined.id}/review`,{revision:1,status:'approved',reason:reopenReason},409);
  await call(declinedUser,`/${declined.id}/review`,{revision:1,status:'submitted',reason:reopenReason},403);
  const reopened=await call(admin,`/${declined.id}/review`,{revision:1,status:'submitted',reason:reopenReason});
  assert.equal(reopened.status,'submitted');
  await call(admin,`/${declined.id}/review`,{revision:2,status:'submitted',reason:reopenReason},409);
  await call(admin,`/${declined.id}/review`,{revision:2,status:'declined',reason:'Application still does not meet requirements'});
  await assert.rejects(pool.query('DELETE FROM public.provider_recruitment_audit WHERE application_id=$1',[application.id])); checks++;
  // Financial integration: real PostgreSQL and the existing isolated Stripe snapshot fixture.
  const { attributeProviderSale, commissionTarget, reconcileProviderCommission, refreshProviderPayments } = await import('../src/provider-commissions.ts');
  const { withTransaction } = await import('../src/db/transaction.ts');
  const { dbInsertPurchase } = await import('../src/db/purchases.ts');
  const { reconcilePaidPurchase } = await import('../src/payment-lifecycle.ts');
  const { setStripeClient } = await import('../src/stripe.ts');
  const { paymentProvider } = await import('../__tests__/fixtures/payment-provider.ts');
  assert.equal(commissionTarget(100000,120000,0,true),17000);
  assert.equal(commissionTarget(100000,120000,60000,true),8500);
  assert.equal(commissionTarget(100000,120000,0,false),0);
  checks+=3;
  const sales=await call(admin,`/${application.id}/assignments`,{packageId:'pkg_basic',reference:randomUUID(),service:'sales'});
  await call(applicant,`/me/assignments/${sales.id}/decision`,{status:'accepted'});
  const sale={id:randomUUID(),organisationId:declinedUser.org,userId:declinedUser.id,packageId:'pkg_basic',status:'requires_confirmation',amountCents:100000,currency:'gbp',createdAt:new Date().toISOString()};
  await withTransaction(async db=>{
    await dbInsertPurchase(sale,db);
    await attributeProviderSale(db,{userId:declinedUser.id,organisationId:declinedUser.org,email:declinedUser.email,role:'employer'},sale.id,'pkg_basic',approved.providerCode);
  });
  const provider=paymentProvider(sale);setStripeClient(provider.client);
  await reconcilePaidPurchase(sale,provider.paymentIntentId,'test');
  let statement=await call(applicant,'/me/statement');assert.equal(statement.balances[0].earned,17000);
  await reconcilePaidPurchase(sale,provider.paymentIntentId,'test-replay');
  statement=await call(applicant,'/me/statement');assert.equal(statement.entries.length,1);
  await call(other,`/${application.id}/statement`,null,403);
  await call(admin,`/${application.id}/payouts`,{requestKey:randomUUID(),currency:'gbp',amountCents:17000,reason:'Finance verified customer receipt'},503);
  process.env.PROVIDER_PAYOUTS_ENABLED='true';
  provider.refund(60000);await reconcilePaidPurchase(sale,provider.paymentIntentId,'test-refund');
  provider.dispute('needs_response');await reconcilePaidPurchase(sale,provider.paymentIntentId,'test-dispute');
  statement=await call(applicant,'/me/statement');assert.equal(statement.balances[0].earned,0);
  provider.dispute('won');await reconcilePaidPurchase(sale,provider.paymentIntentId,'test-dispute-won');
  statement=await call(applicant,'/me/statement');assert.equal(statement.balances[0].earned,8500);
  // A provider with more sales than the full-check limit skips sales verified moments ago. A stale sale is
  // still checked, a Stripe failure is reported rather than hidden, and a spent time budget asks for a retry.
  const adminAuth={userId:admin.id,organisationId:operatorOrg,email:admin.email,role:'admin',mfaVersion:1,mfaAt:Math.floor(Date.now()/1000)};
  provider.state.unavailable=true;
  await refreshProviderPayments(adminAuth,application.id,{fullCheckLimit:0}); // verified seconds ago: Stripe is not called
  await pool.query("UPDATE public.purchases SET payment_reconciled_at=now()-interval '10 minutes' WHERE id=$1",[sale.id]);
  await assert.rejects(refreshProviderPayments(adminAuth,application.id,{fullCheckLimit:0}),/could not be verified for 1 sale/);
  provider.state.unavailable=false;
  await refreshProviderPayments(adminAuth,application.id,{fullCheckLimit:0}); // stale sale checked and refreshed
  await assert.rejects(refreshProviderPayments(adminAuth,application.id,{fullCheckLimit:0,maxAgeSeconds:0,budgetMs:-1}),/still running/);
  checks+=4;
  const second=await actor('admin',operatorOrg);
  const request={requestKey:randomUUID(),currency:'gbp',amountCents:8500,reason:'Finance verified customer receipt'};
  provider.state.unavailable=true;
  await call(admin,`/${application.id}/payouts`,request,409);
  provider.state.unavailable=false;
  const reserved=await call(admin,`/${application.id}/payouts`,request);
  assert.equal((await call(admin,`/${application.id}/payouts`,request)).id,reserved.id);
  await call(admin,`/${application.id}/payouts`,{...request,requestKey:randomUUID()},409);
  const approve={action:'approve',reason:'Independent finance verification'};
  await call(admin,`/payouts/${reserved.id}/action`,approve,403);
  await call(second,`/payouts/${reserved.id}/action`,approve);
  provider.refund(30000); // Refresh before recording catches even a not-yet-delivered refund webhook.
  const record={action:'record',reason:'Bank settlement verified in fixture',settlementReference:`LOCAL-TEST-${randomUUID()}`};
  await call(second,`/payouts/${reserved.id}/action`,record,409);
  await call(admin,`/payouts/${reserved.id}/action`,{action:'cancel',reason:'Refund requires corrected amount'});
  const corrected=await call(admin,`/${application.id}/payouts`,{...request,requestKey:randomUUID(),amountCents:4250});
  await call(second,`/payouts/${corrected.id}/action`,approve);
  await call(second,`/payouts/${corrected.id}/action`,record);
  await call(second,`/payouts/${corrected.id}/action`,record); // Idempotent replay.
  statement=await call(applicant,'/me/statement');assert.equal(statement.balances[0].recorded,4250);assert.equal(statement.balances[0].available,0);
  // Operator staff identifiers are for reviewers only; the provider's own statement must not carry them.
  assert(statement.payouts.length>0 && statement.payouts.every(p=>!('preparedBy' in p) && !('approvedBy' in p)));
  const staffView=await call(admin,`/${application.id}/statement`);
  assert(staffView.payouts.length>0 && staffView.payouts.every(p=>p.preparedBy));
  provider.refund(30000);await reconcilePaidPurchase(sale,provider.paymentIntentId,'test-full-refund');
  statement=await call(applicant,'/me/statement');assert.equal(statement.balances[0].earned,0);assert.equal(statement.balances[0].available,-4250);
  await call(admin,`/${application.id}/payouts`,{...request,requestKey:randomUUID(),amountCents:1},409);
  await assert.rejects(pool.query('DELETE FROM public.provider_commission_entries WHERE purchase_id=$1',[sale.id]));
  await assert.rejects(pool.query("UPDATE public.provider_payouts SET settlement_reference='rewritten' WHERE id=$1",[corrected.id]));
  checks+=2;
  // A refund larger than the payment is inconsistent data. It must lower commission, never throw inside payment reconciliation.
  const entriesBefore=(await call(applicant,'/me/statement')).entries.length;
  await pool.query('UPDATE public.purchases SET refunded_amount_cents=refunded_amount_cents+50000 WHERE id=$1',[sale.id]);
  await withTransaction(db=>reconcileProviderCommission(db,sale.id));
  statement=await call(applicant,'/me/statement');assert.equal(statement.balances[0].earned,0);assert.equal(statement.entries.length,entriesBefore);
  checks+=2;
  const selfSale={...sale,id:randomUUID(),userId:applicant.id,organisationId:applicant.org};
  await assert.rejects(withTransaction(async db=>{
    await dbInsertPurchase(selfSale,db);
    await attributeProviderSale(db,{userId:applicant.id,organisationId:applicant.org,email:applicant.email,role:'employer'},selfSale.id,'pkg_basic',approved.providerCode);
  }),/Self-referrals/);
  assert.equal((await pool.query('SELECT 1 FROM public.purchases WHERE id=$1',[selfSale.id])).rowCount,0);checks++;
  const {default:paymentRoutes}=await import('../src/routes/payments.ts');
  const checkoutApp=new Hono().route('/api/v1',paymentRoutes);
  const checkoutBuyer=await actor('employer');
  setStripeClient({checkout:{sessions:{create:async()=>({id:'cs_provider_fixture',url:'https://example.test/fixture-checkout'})}}});
  const checkout=await checkoutApp.request('http://localhost/api/v1/purchases',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${checkoutBuyer.token}`},
    body:JSON.stringify({packageId:'pkg_basic',client:'web',providerCode:approved.providerCode}),
  });
  assert.equal(checkout.status,200,await checkout.clone().text());
  const checkoutData=await checkout.json();
  assert.equal((await pool.query('SELECT application_id FROM public.provider_sale_attributions WHERE purchase_id=$1',[checkoutData.data.purchaseId])).rows[0].application_id,application.id);
  assert.equal((await pool.query('SELECT 1 FROM public.provider_commission_entries WHERE purchase_id=$1',[checkoutData.data.purchaseId])).rowCount,0);
  checks++;
  let expired=false;
  setStripeClient({checkout:{sessions:{
    create:async()=>({id:'cs_replacement_fixture',url:'https://example.test/replacement-checkout'}),
    retrieve:async()=>({id:'cs_provider_fixture',client_reference_id:checkoutData.data.purchaseId,payment_status:'unpaid',status:expired?'expired':'open',url:'https://example.test/fixture-checkout'}),
  }}});
  const checkoutCall=code=>checkoutApp.request('http://localhost/api/v1/purchases',{
    method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${checkoutBuyer.token}`},
    body:JSON.stringify({packageId:'pkg_basic',client:'web',providerCode:code}),
  });
  assert.equal((await checkoutCall('PRV-'+'f'.repeat(32))).status,409);checks++;
  const sellerOffer=await call(admin,`/${seller.id}/assignments`,{packageId:'pkg_basic',service:'sales',reference:randomUUID()});
  await call(other,`/me/assignments/${sellerOffer.id}/decision`,{status:'accepted'});
  const sellerCode=(await call(other,'/me')).providerCode;
  expired=true;
  const replacement=await checkoutCall(sellerCode);
  assert.equal(replacement.status,200,await replacement.clone().text());
  const replacementData=await replacement.json();
  assert.equal((await pool.query('SELECT application_id FROM public.provider_sale_attributions WHERE purchase_id=$1',[replacementData.data.purchaseId])).rows[0].application_id,seller.id);checks++;
  setStripeClient(null);
  process.env.STRIPE_SECRET_KEY='rk_test_fixture_only';
  process.env.STRIPE_WEBHOOK_SECRET='whsec_fixture_only';
  await import('../src/check-provider-setup.ts');checks++;
  await pool.query("UPDATE public.users SET role='employee' WHERE id=$1",[admin.id]);
  await call(admin,'/review',null,403);
  console.log(`PASS: ${checks} recruitment checks, signed-agreement binding, tenant isolation, stale-role rejection, concurrent decisions, suspension, retained audit, attribution, refunds/disputes and independently approved payout records`);
} finally { await closeDbPool(); await pool.end(); }
