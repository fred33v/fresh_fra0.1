// Run only on an explicitly disposable local PostgreSQL database after migrations.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import { Hono } from 'hono';
if (process.env.PROVIDER_TEST_DATABASE !== '1' || process.env.NODE_ENV === 'production' ||
    !['localhost','127.0.0.1','[::1]'].includes(new URL(process.env.DATABASE_URL ?? 'https://invalid').hostname))
  throw new Error('Requires PROVIDER_TEST_DATABASE=1 and a disposable local DATABASE_URL');
process.env.NODE_ENV = 'test';
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
  a.token = jwt.sign({ sub: a.id, email: a.email, role, organisationId: org }, jwtSecret);
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
async function agreement(a, org = operatorOrg) {
  const id = randomUUID();
  const hash = 'a'.repeat(64);
  // Completed retained fixture; normal application clients cannot insert signing evidence.
  await pool.query(`INSERT INTO public.esign_documents(id,organisation_id,created_by,title,
    original_pdf,original_sha256,source_pdf,source_sha256,pages,status,final_key,final_version,final_sha256)
    VALUES($1,$2,$3,'Provider agreement','fixture',encode(sha256('fixture'::bytea),'hex'),
    'fixture',encode(sha256('fixture'::bytea),'hex'),'[]','draft','retained','v1',$4)`, [id,org,a.id,hash]);
  // Build retained fixture in the same state order as signing, without disabling integrity triggers.
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query(`INSERT INTO public.esign_signers(id,document_id,email,name,status,consent_text,consent_at,signature_text,signed_at)
      VALUES($1,$2,$3,'Recruitment test','signed','fixture',now(),'Fixture',now())`, [randomUUID(),id,a.email]);
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
  await call(admin, `/${application.id}/review`, review,400);
  const wrong = await agreement(other);
  await call(admin, `/${application.id}/review`, { ...review,agreementDocumentId:wrong },400);
  const own = await call(admin, '/me', {companyName:'Operator company',serviceInterest:'sales'},201);
  await call(admin, `/${own.id}/review`,review,403);
  await call(admin, '/review?page=-1',null,400);
  const doc = await agreement(applicant);
  const noEvidence = {...review,agreementDocumentId:doc}; delete noEvidence.qualificationEvidence;
  await call(admin, `/${application.id}/review`,noEvidence,400);
  const approved = await call(admin, `/${application.id}/review`, { ...review,agreementDocumentId:doc });
  assert.equal(approved.status,'approved'); assert.match(approved.providerCode,/^PRV-[a-f0-9]{32}$/);
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
  await call(admin,`/${seller.id}/review`,{revision:0,status:'approved',reason:'Sales references and agreement reviewed',agreementDocumentId:sellerDoc});
  await call(admin,`/${seller.id}/assignments`,{...offer,reference:randomUUID()},409);
  const declinedUser = await actor('employer');
  const declined = await call(declinedUser,'/me',{companyName:'Another company',serviceInterest:'sales'},201);
  await call(admin,`/${declined.id}/review`,{revision:0,status:'declined',reason:'Application does not meet requirements'});
  await call(admin,`/${declined.id}/assignments`,{...offer,reference:randomUUID()},409);
  await assert.rejects(pool.query('DELETE FROM public.provider_recruitment_audit WHERE application_id=$1',[application.id])); checks++;
  await pool.query("UPDATE public.users SET role='employee' WHERE id=$1",[admin.id]);
  await call(admin,'/review',null,403);
  console.log(`PASS: ${checks} recruitment checks, signed-agreement binding, tenant isolation, stale-role rejection, concurrent decisions, suspension and retained audit`);
} finally { await closeDbPool(); await pool.end(); }
