#!/usr/bin/env node
// Explicitly disposable local PostgreSQL only; includes temporary databases and
// targeted failure-injection triggers. Never point this at important data.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, readdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import jwt from 'jsonwebtoken';
const url=process.env.DATABASE_URL;
if(process.env.CERTIFICATE_TEST_DATABASE!=='1'||!url||process.env.NODE_ENV==='production')throw new Error('Requires CERTIFICATE_TEST_DATABASE=1 and a disposable local DATABASE_URL');
assert(['localhost','127.0.0.1','[::1]'].includes(new URL(url).hostname),'Only disposable local PostgreSQL is allowed');
const pool=new pg.Pool({connectionString:url});
const run=crypto.randomBytes(6).toString('hex');
const secret=crypto.randomBytes(32).toString('hex');
const backendDir=fileURLToPath(new URL('..',import.meta.url));
const output=process.env.CERTIFICATE_TEST_OUTPUT_DIR??mkdtempSync(join(tmpdir(),'fra-certificate-pdfs-'));
mkdirSync(output,{recursive:true});
let cases=0,ip=1;
const pass=name=>{cases++;console.log('PASS '+name)};
const port=Number(process.env.CERTIFICATE_TEST_PORT??3003),API=`http://127.0.0.1:${port}/api/v1`;
const testEnv={...process.env,NODE_ENV:'development',HOST:'127.0.0.1',PORT:String(port),JWT_SECRET:secret,JWT_REFRESH_SECRET:crypto.randomBytes(32).toString('hex'),
  CORS_ORIGINS:'http://localhost:8080',UPSTASH_REDIS_REST_URL:'',UPSTASH_REDIS_REST_TOKEN:'',SMTP_HOST:'',STRIPE_SECRET_KEY:'',STRIPE_WEBHOOK_SECRET:''};
async function call(method,path,body,token,options={}){
 const r=await fetch(API+path,{method,headers:{'Content-Type':'application/json',Origin:'http://localhost:8080',
  'X-Forwarded-For':options.ip??`198.19.0.${ip}`,...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 if(options.raw&&r.ok)return{status:r.status,body:Buffer.from(await r.arrayBuffer()),type:r.headers.get('content-type')};
 return{status:r.status,body:await r.json(),cache:r.headers.get('cache-control')};
}
async function account(role='admin',db=pool){
 const userId=crypto.randomUUID(),organisationId=crypto.randomUUID(),email=`cert-${run}-${userId}@example.test`;
 const client=await db.connect();
 try{await client.query('BEGIN');
  await client.query(`INSERT INTO public.users(id,email,name,password_hash,role,organisation_id,email_verified_at) VALUES($1,$2,'Certificate Recipient','not-a-login-hash',$3,$4,now())`,[userId,email,role,organisationId]);
  await client.query(`INSERT INTO public.organisations(id,name,created_by_user_id) VALUES($1,'Original Organisation',$2)`,[organisationId,userId]);
  await client.query(`INSERT INTO public.purchases(id,organisation_id,user_id,package_id,status,amount_cents,currency) VALUES($1,$2,$3,'pkg_full','succeeded',100,'gbp')`,[crypto.randomUUID(),organisationId,userId]);
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
 return{userId,organisationId,email,token:jwt.sign({sub:userId,email,role,organisationId},secret,{algorithm:'HS256',expiresIn:'1h'})};
}
async function progress(a,{scores={1:100,2:100,3:100,4:100},sections=[0,1,2,3,4,5,6],sessionId=null}={}){
 const id=crypto.randomUUID();
 await pool.query(`INSERT INTO public.workshop_progress(id,user_id,session_id,current_section,completed_sections,quiz_scores,scenario_choices,completed_at)
  VALUES($1,$2,$3,6,$4,$5,'{}','2026-11-01T10:00:00Z')`,[id,a.userId,sessionId,sections,scores]);return id;
}
async function migrate(cwd,databaseUrl,expectSuccess=true){
 const child=spawn(process.execPath,['--import',import.meta.resolve('tsx'),join(backendDir,'src/migrate.ts')],{cwd,env:{...testEnv,DATABASE_URL:databaseUrl},stdio:['ignore','pipe','pipe']});
 let log='';for(const s of [child.stdout,child.stderr])s.on('data',c=>{log+=c});const[code]=await once(child,'exit');
 assert.equal(code===0,expectSuccess,log);
}
async function legacyMigration(){
 const name=`fra_cert_legacy_${run}`;assert(/^fra_cert_legacy_[0-9a-f]+$/.test(name));
 const temp=mkdtempSync(join(tmpdir(),'fra-cert-migration-'));const migrations=join(temp,'migrations');mkdirSync(migrations);
 const target=new URL(url);target.pathname='/'+name;
 let db;
 await pool.query(`CREATE DATABASE "${name}"`);
 try{
  db=new pg.Pool({connectionString:target.toString()});
  for(const file of readdirSync(join(backendDir,'migrations')).filter(f=>f.endsWith('.sql')&&f<'032_'))copyFileSync(join(backendDir,'migrations',file),join(migrations,file));
  await migrate(temp,target.toString());
  const old=await account('admin',db);
  await db.query(`INSERT INTO public.workshop_profiles(user_id,full_name,organization_name,sector) VALUES($1,'Original Legacy Name','Original Organisation','private')`,[old.userId]);
  const numbers=[`FRA-LEGACY-${run}`,`FRA-SECOND-${run}`];
  for(const number of numbers)await db.query(`INSERT INTO public.certificates(user_id,certificate_number,issued_at) VALUES($1,$2,'2026-10-01T10:00:00Z')`,[old.userId,number]);
  const assessmentId=crypto.randomUUID();
  await db.query(`INSERT INTO public.assessments(id,organisation_id,created_by_user_id,title,status,answers,created_at,updated_at,submitted_at)
    VALUES($1,$2,$3,'Legacy assessment','submitted','{}',now(),now(),'2026-10-01T09:00:00Z')`,[assessmentId,old.organisationId,old.userId]);
  // Deliberately ambiguous legacy reference across the two old tables: fail safely.
  await db.query(`INSERT INTO public.assessment_certificates(assessment_id,organisation_id,certificate_number) VALUES($1,$2,$3)`,[assessmentId,old.organisationId,numbers[0]]);
  copyFileSync(join(backendDir,'migrations/032_certificate_lifecycle.sql'),join(migrations,'032_certificate_lifecycle.sql'));
  await migrate(temp,target.toString(),false);
  assert.equal((await db.query("SELECT to_regclass('public.certificate_records') AS relation")).rows[0].relation,null);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.certificates')).rows[0].n,2);
  pass('ambiguous legacy references refuse migration without partial backfill or loss');
  await db.query('UPDATE public.assessment_certificates SET certificate_number=$1',[`FRA-ASSESSMENT-${run}`]);
  await migrate(temp,target.toString());
  const records=await db.query('SELECT * FROM public.certificate_records ORDER BY certificate_number');assert.equal(records.rowCount,3);
  const legacy=records.rows.find(r=>r.certificate_number===numbers[0]);
  assert.equal(legacy.snapshot.snapshotOrigin,'legacy_reconstructed');assert.equal(legacy.snapshot.completedAt,null);assert.equal(legacy.snapshot.courseVersion,null);
  assert.equal(legacy.snapshot.holderName,'Original Legacy Name');
  await db.query("UPDATE public.workshop_profiles SET full_name='Later name' WHERE user_id=$1",[old.userId]);
  await migrate(temp,target.toString());
  assert.deepEqual((await db.query('SELECT snapshot FROM public.certificate_records WHERE certificate_number=$1',[numbers[0]])).rows[0].snapshot,legacy.snapshot);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.certificates')).rows[0].n,2);
  await assert.rejects(db.query("UPDATE public.certificate_records SET snapshot=jsonb_set(snapshot,'{holderName}','\"Rewritten\"') WHERE certificate_number=$1",[numbers[0]]),/immutable/);
  pass('legacy duplicates/references survive forward migration and keep immutable reconstructed details');
 }finally{if(db)await db.end();await pool.query(`DROP DATABASE "${name}"`);rmSync(temp,{recursive:true,force:true})}
}
let backend,backendExit,logs='';
try{
 await legacyMigration();
 backend=spawn(process.execPath,['--import','tsx','src/index.ts'],{cwd:backendDir,env:testEnv,stdio:['ignore','pipe','pipe']});
 backendExit=once(backend,'exit');for(const s of [backend.stdout,backend.stderr])s.on('data',c=>{logs=(logs+c).slice(-50000)});
 for(let i=0;i<100;i++){if(backend.exitCode!==null)throw new Error(logs);try{if((await fetch(API+'/health')).ok)break}catch{}if(i===99)throw new Error('Certificate backend startup timed out');await new Promise(r=>setTimeout(r,100))}
 const a=await account();
 await pool.query('UPDATE public.users SET name=$2 WHERE id=$1',[a.userId,'Certificate Recipient &copy; Trust']);
 assert.equal((await call('POST','/workshop/certificates',{},a.token)).status,400);ip++;
 const p=await progress(a,{scores:{1:100,2:100,3:100,4:0}});
 assert.equal((await call('POST','/workshop/certificates',{},a.token)).status,400);
 await pool.query("UPDATE public.workshop_progress SET quiz_scores=$2,completed_sections=$3 WHERE id=$1",[p,{1:100,2:100,3:100,4:100},[0,1,2,3,4,5]]);
 assert.equal((await call('POST','/workshop/certificates',{},a.token)).status,400);
 await pool.query('UPDATE public.workshop_progress SET completed_sections=$2 WHERE id=$1',[p,[0,1,2,3,4,5,6]]);ip++;
 const issues=await Promise.all(Array.from({length:5},()=>call('POST','/workshop/certificates',{},a.token)));
 assert.equal(issues.filter(r=>r.status===201).length,1,JSON.stringify(issues));assert.equal(issues.filter(r=>r.status===200).length,4);
 const number=issues[0].body.data.certificate_number;
 assert(issues.every(r=>r.body.data.certificate_number===number));
 assert.equal((await pool.query('SELECT id FROM public.certificates WHERE user_id=$1',[a.userId])).rowCount,1);
 assert.equal((await pool.query("SELECT id FROM public.audit_logs WHERE event_type='workshop.certificate_generate' AND resource_id=$1",[number])).rowCount,1);
 pass('eligibility rejects incomplete/75% results and five concurrent issues create one certificate/audit');ip++;
 const original=(await call('GET',`/certificates/verify/${number}`)).body.data;
 assert.equal(original.completedAt,'2026-11-01T10:00:00.000Z');assert.notEqual(original.completedAt,original.issuedAt);
 await pool.query("UPDATE public.users SET name='Later name' WHERE id=$1",[a.userId]);await pool.query("UPDATE public.organisations SET name='Later organisation' WHERE id=$1",[a.organisationId]);
 const verified=await call('GET',`/certificates/verify/${number}`);assert.deepEqual(verified.body.data,original);assert.equal(verified.cache,'no-store');
 await assert.rejects(pool.query("UPDATE public.certificate_records SET snapshot=jsonb_set(snapshot,'{holderName}','\"Rewritten\"') WHERE certificate_number=$1",[number]),/immutable/);
 pass('issued identity/course/completion snapshots cannot change with profile edits or direct updates');
 const pdf=await call('GET',`/certificates/${number}/pdf`,undefined,a.token,{raw:true});assert.equal(pdf.status,200,JSON.stringify(pdf));assert.equal(pdf.type,'application/pdf');assert.equal(pdf.body.subarray(0,5).toString(),'%PDF-');assert(pdf.body.length>1000);
 writeFileSync(join(output,'training.pdf'),pdf.body);writeFileSync(join(output,'training.json'),JSON.stringify(original));
 pass('the real Chrome renderer returns a training certificate PDF');ip++;
 const other=await account('admin'),employer=await account('employer');
 assert.equal((await call('POST',`/certificates/${number}/revoke`,{reason:'Private reason'},employer.token)).status,403);
 assert.equal((await call('POST',`/certificates/${number}/revoke`,{reason:'Private reason'},other.token)).status,404);
 assert.equal((await call('POST',`/certificates/${number}/revoke`,{reason:'   '},a.token)).status,400);
 await pool.query("UPDATE public.users SET role='employee' WHERE id=$1",[a.userId]);
 assert.equal((await call('POST',`/certificates/${number}/revoke`,{reason:'Private reason'},a.token)).status,404);
 await pool.query("UPDATE public.users SET role='admin' WHERE id=$1",[a.userId]);
 const trigger=`cert_failure_${run}`;
 await pool.query(`CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='certificate.revoked' AND NEW.resource_id='${number}' THEN RAISE EXCEPTION 'injected certificate audit failure'; END IF; RETURN NEW; END $$`);
 await pool.query(`CREATE TRIGGER ${trigger} BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION ${trigger}()`);
 try{assert.equal((await call('POST',`/certificates/${number}/revoke`,{reason:'Private reason'},a.token)).status,500);
  assert.equal((await pool.query('SELECT status FROM public.certificate_records WHERE certificate_number=$1',[number])).rows[0].status,'valid');
 }finally{await pool.query(`DROP TRIGGER ${trigger} ON public.audit_logs`);await pool.query(`DROP FUNCTION ${trigger}()`)}
 const revoked=await Promise.all(Array.from({length:4},()=>call('POST',`/certificates/${number}/revoke`,{reason:'Private reason'},a.token)));
 assert.equal(revoked.filter(r=>r.body.data?.changed).length,1);
 assert.equal((await call('POST',`/certificates/${number}/revoke`,{reason:'Rewritten reason'},a.token)).body.data.changed,false);
 const privateRow=(await pool.query('SELECT * FROM public.certificate_records WHERE certificate_number=$1',[number])).rows[0];assert.equal(privateRow.revocation_reason,'Private reason');
 assert.equal((await pool.query("SELECT id FROM public.audit_logs WHERE event_type='certificate.revoked' AND resource_id=$1",[number])).rowCount,1);
 const publicRevoked=(await call('GET',`/certificates/verify/${number}`)).body.data;assert.equal(publicRevoked.status,'revoked');assert.equal(publicRevoked.valid,false);
 for(const key of ['userId','organisationId','sourceId','trainingKey','reason','revocationReason','revokedBy'])assert(!(key in publicRevoked));
 assert.equal((await call('GET',`/certificates/${number}/pdf`,undefined,a.token)).status,409);
 const repeated=await call('POST','/workshop/certificates',{},a.token);assert.equal(repeated.body.data.certificate_number,number);assert.equal(repeated.body.data.status,'revoked');
 pass('revocation enforces tenant/admin boundaries, rolls back on audit failure and preserves one private decision');ip++;
 for(const target of ['certificate_records','audit_logs']){
  const test=await account();await progress(test);const fn=`cert_issue_${target}_${run}`;
  if(target==='certificate_records'){
   await pool.query('UPDATE public.users SET name=$2 WHERE id=$1',[test.userId,'LongRecipientName'.repeat(13).slice(0,200)]);
   await pool.query('UPDATE public.organisations SET name=$2 WHERE id=$1',[test.organisationId,'LongOrganisationName'.repeat(10)]);
  }
  const condition=target==='certificate_records'?`NEW.user_id='${test.userId}'::uuid`:`NEW.actor_id='${test.userId}'::uuid AND NEW.event_type='workshop.certificate_generate'`;
  await pool.query(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'injected issuance failure'; END IF; RETURN NEW; END $$`);
  await pool.query(`CREATE TRIGGER ${fn} BEFORE INSERT ON public.${target} FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
  try{assert.equal((await call('POST','/workshop/certificates',{},test.token)).status,500);
   assert.equal((await pool.query('SELECT id FROM public.certificates WHERE user_id=$1',[test.userId])).rowCount,0);
   assert.equal((await pool.query('SELECT certificate_number FROM public.certificate_records WHERE user_id=$1',[test.userId])).rowCount,0);
  }finally{await pool.query(`DROP TRIGGER ${fn} ON public.${target}`);await pool.query(`DROP FUNCTION ${fn}()`)}
  const retried=await call('POST','/workshop/certificates',{},test.token);assert.equal(retried.status,201);
  if(target==='certificate_records'){
   const longPdf=await call('GET',`/certificates/${retried.body.data.certificate_number}/pdf`,undefined,test.token,{raw:true});
   assert.equal(longPdf.status,200);writeFileSync(join(output,'long-name.pdf'),longPdf.body);
   writeFileSync(join(output,'long-name.json'),JSON.stringify(retried.body.data.issued_details));
  }
  pass(`${target} failure rolls back certificate issuance and permits a clean retry`);ip++;
 }
 const sessionUser=await account();await progress(sessionUser);
 assert.equal((await call('POST','/workshop/certificates',{sessionId:'invalid'},sessionUser.token)).status,400);
 assert.equal((await call('POST','/workshop/certificates',{sessionId:crypto.randomUUID()},sessionUser.token)).status,403);
 const sid=crypto.randomUUID();await pool.query("INSERT INTO public.workshop_sessions(id,facilitator_id,session_code,title) VALUES($1,$2,$3,'Session fixture')",[sid,sessionUser.userId,run.toUpperCase()]);
 await progress(sessionUser,{sessionId:sid,scores:{1:0,2:0,3:0,4:0}});
 assert.equal((await call('POST','/workshop/certificates',{sessionId:sid},sessionUser.token)).status,400);
 pass('session association cannot borrow another completion or use an unrelated session');ip++;
 const assessmentId=crypto.randomUUID();
 await pool.query("INSERT INTO public.assessments(id,organisation_id,created_by_user_id,title,status,answers,created_at,updated_at,submitted_at) VALUES($1,$2,$3,'Original Assessment','submitted','{}',now(),now(),'2026-11-01T11:00:00Z')",[assessmentId,a.organisationId,a.userId]);
 const assessment=await call('GET',`/assessments/${assessmentId}/certificate`,undefined,a.token);assert.equal(assessment.status,200);const an=assessment.body.data.certificateNumber;
 const apdf=await call('GET',`/certificates/${an}/pdf`,undefined,a.token,{raw:true});assert.equal(apdf.status,200);assert.equal(apdf.body.subarray(0,5).toString(),'%PDF-');writeFileSync(join(output,'assessment.pdf'),apdf.body);writeFileSync(join(output,'assessment.json'),JSON.stringify(assessment.body.data));
 await pool.query("UPDATE public.assessments SET title='Later Assessment' WHERE id=$1",[assessmentId]);
 assert.equal((await call('GET',`/certificates/verify/${an}`)).body.data.title,'Original Assessment');
 await pool.query('DELETE FROM public.assessments WHERE id=$1',[assessmentId]);
 assert.equal((await call('GET',`/certificates/verify/${an}`)).body.data.valid,true);
 assert.equal((await pool.query('SELECT id FROM public.assessment_certificates WHERE assessment_id=$1',[assessmentId])).rowCount,0);
 pass('assessment PDF and verification use the snapshot and survive source-row retention');ip++;
 assert.equal((await call('GET','/certificates/verify/FRA-UNKNOWN-0000')).status,404);
 assert.equal((await call('GET','/certificates/verify/invalid')).status,400);
 for(let i=0;i<30;i++)assert.equal((await call('GET',`/certificates/verify/${number}`,undefined,undefined,{ip:'198.19.255.1'})).status,200);
 assert.equal((await call('GET',`/certificates/verify/${number}`,undefined,undefined,{ip:'198.19.255.1'})).status,429);
 pass('unknown/malformed references and public verification rate limits remain enforced');
 console.log(`PASS ${cases} certificate lifecycle/PostgreSQL/PDF scenarios`);console.log('PDF QA directory: '+output);
}catch(error){console.error(logs);throw error}
finally{if(backend){backend.kill('SIGTERM');const timer=setTimeout(()=>backend.kill('SIGKILL'),11000);timer.unref();await backendExit;clearTimeout(timer)}await pool.end()}
