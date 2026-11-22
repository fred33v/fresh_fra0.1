// Applicant evidence documents against a disposable local PostgreSQL database with all migrations applied.
// Uses the real application and document routes; no S3, email or payment service is involved.
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import { Hono } from 'hono';

const url = new URL(process.env.DATABASE_URL ?? 'https://invalid');
assert(
  process.env.PROVIDER_TEST_DATABASE === '1' &&
    process.env.NODE_ENV !== 'production' &&
    ['127.0.0.1', 'localhost'].includes(url.hostname),
  'Requires PROVIDER_TEST_DATABASE=1 and a disposable loopback DATABASE_URL'
);
process.env.NODE_ENV = 'test';
const operatorOrg = randomUUID();
process.env.PROVIDER_REVIEW_ORGANISATION_ID = operatorOrg;
const { default: applicationRoutes } = await import('../src/routes/provider-applications.ts');
const { default: documentRoutes } = await import('../src/routes/provider-documents.ts');
const { jwtSecret } = await import('../src/helpers.ts');
const { closeDbPool } = await import('../src/db.ts');
const pool = new pg.Pool({ connectionString: url.href });
const app = new Hono().route('/providers', documentRoutes).route('/providers', applicationRoutes);

let checks = 0;
const pass = (message) => console.log(`PASS ${message}`);
async function actor(role = 'employer', org = randomUUID()) {
  const a = { id: randomUUID(), org, email: `${randomUUID()}@example.test`, role };
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query(
      "INSERT INTO public.users(id,email,name,password_hash,role,organisation_id,email_verified_at) VALUES($1,$2,'Evidence Fixture','unused',$3,$4,now())",
      [a.id, a.email, role, org]
    );
    await db.query("INSERT INTO public.organisations(id,name,created_by_user_id) VALUES($1,'Fixture',$2) ON CONFLICT(id) DO NOTHING", [org, a.id]);
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  } finally {
    db.release();
  }
  a.token = jwt.sign({ sub: a.id, email: a.email, role, organisationId: org }, jwtSecret);
  return a;
}
async function call(a, path, { method, body, form, status = 200 } = {}) {
  const response = await app.request(`http://localhost/providers${path}`, {
    method: method ?? (body || form ? 'POST' : 'GET'),
    headers: { Authorization: `Bearer ${a.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(form ? { body: form } : body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(response.status, status, `${method ?? 'GET'} ${path} -> ${response.status}: ${await response.clone().text()}`);
  checks += 1;
  return response;
}
const data = async (response) => (await response.json()).data;
const pdf = (text = 'passport scan') => Buffer.from(`%PDF-1.7\n${text}\n%%EOF`);
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.from('png-body')]);
const jpeg = Buffer.concat([Buffer.from([255, 216, 255, 224]), Buffer.from('jpeg-body')]);
function upload(kind, bytes, name = 'evidence.pdf', type = 'application/pdf') {
  const form = new FormData();
  if (kind) form.set('kind', kind);
  if (bytes) form.set('file', new File([bytes], name, { type }));
  return form;
}
const events = async (applicationId) =>
  (await pool.query('SELECT event, details FROM public.provider_recruitment_audit WHERE application_id=$1 ORDER BY id', [applicationId])).rows;
const sql = (text, params = []) => pool.query(text, params);

try {
  const reviewer = await actor('admin', operatorOrg);
  const secondReviewer = await actor('admin', operatorOrg);
  const outsideAdmin = await actor('admin'); // an administrator, but not of the operator organisation
  const applicant = await actor('employer');
  const stranger = await actor('employer');
  const application = await data(await call(applicant, '/me', { body: { companyName: 'Evidence Ltd', serviceInterest: 'sales' }, status: 201 }));
  assert(application.id);

  // 1. Accepted types, what is stored, what the applicant sees
  const first = await data(await call(applicant, '/me/documents', { form: upload('identity', pdf(), 'passport.pdf'), status: 201 }));
  assert.equal(first.status, 'pending');
  assert.equal(first.mimeType, 'application/pdf');
  assert.equal(first.sizeBytes, pdf().length);
  assert.equal(first.sha256, createHash('sha256').update(pdf()).digest('hex'));
  assert(!('decidedBy' in first) && !('uploadedBy' in first), 'staff identifiers stay with reviewers');
  await call(applicant, '/me/documents', { form: upload('qualification', png, 'certificate.png', 'image/png'), status: 201 });
  await call(applicant, '/me/documents', { form: upload('insurance', jpeg, 'policy.jpg', 'image/jpeg'), status: 201 });
  const stored = (await sql('SELECT mime_type, encode(sha256(content),$2) AS hash, sha256 FROM public.provider_application_documents WHERE id=$1', [first.id, 'hex'])).rows[0];
  assert.equal(stored.hash, stored.sha256);
  assert((await events(application.id)).some((e) => e.event === 'document.uploaded' && e.details.documentId === first.id && e.details.kind === 'identity'));
  pass('PDF, PNG and JPEG evidence is stored with a verified SHA-256 and a retained upload event');

  // 2. Anything else is refused, whatever the browser or the file name claims
  await call(applicant, '/me/documents', { form: upload('identity', Buffer.from('<html><script>alert(1)</script></html>'), 'passport.pdf', 'application/pdf'), status: 400 });
  await call(applicant, '/me/documents', { form: upload('identity', Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04'), 'scan.png', 'image/png'), status: 400 });
  await call(applicant, '/me/documents', { form: upload('identity', Buffer.from('%PDF'), 'tiny.pdf'), status: 400 }); // under 8 bytes
  await call(applicant, '/me/documents', { form: upload('identity', Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(524288)]), 'big.pdf'), status: 400 });
  await call(applicant, '/me/documents', { form: upload('passport', pdf(), 'x.pdf'), status: 400 }); // unknown kind
  await call(applicant, '/me/documents', { form: upload('identity', null), status: 400 }); // no file
  await call(applicant, '/me/documents', { form: upload(null, pdf()), status: 400 }); // no kind
  assert.equal((await sql('SELECT count(*)::int AS n FROM public.provider_application_documents WHERE application_id=$1', [application.id])).rows[0].n, 3);
  pass('disguised, executable, undersized, oversized and unlabelled uploads are refused and nothing is stored');

  // 3. Isolation between applicants and from the review queue
  await call(stranger, '/me/documents', { status: 200 }); // no application yet: an empty list, never someone else's
  assert.deepEqual(await data(await call(stranger, '/me/documents')), []);
  await call(stranger, '/me/documents', { form: upload('identity', pdf()), status: 404 });
  await call(stranger, `/me/documents/${first.id}/file`, { status: 404 });
  await call(applicant, `/${application.id}/documents`, { status: 403 }); // an applicant is not a reviewer
  await call(outsideAdmin, `/${application.id}/documents`, { status: 403 }); // admin of another organisation
  await call(outsideAdmin, `/${application.id}/documents/${first.id}/file`, { status: 403 });
  await call(outsideAdmin, `/${application.id}/documents/${first.id}/decision`, { body: { status: 'verified' }, status: 403 });
  pass('another applicant, an applicant and an administrator outside the operator organisation cannot read or decide evidence');

  // 4. Reviewer view, download headers and the download audit
  const reviewerList = await data(await call(reviewer, `/${application.id}/documents`));
  assert.equal(reviewerList.length, 3);
  assert(reviewerList.every((d) => d.uploadedBy === applicant.id && Number.isInteger(d.applicationRevision)));
  const download = await call(reviewer, `/${application.id}/documents/${first.id}/file`);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), pdf());
  assert.equal(download.headers.get('content-type'), 'application/pdf');
  assert.match(download.headers.get('content-disposition'), /^attachment; filename="passport\.pdf"/);
  assert.equal(download.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(download.headers.get('cache-control'), 'no-store');
  assert((await events(application.id)).some((e) => e.event === 'document.downloaded' && e.details.documentId === first.id));
  const own = await call(applicant, `/me/documents/${first.id}/file`);
  assert.deepEqual(Buffer.from(await own.arrayBuffer()), pdf());
  pass('reviewers list and download exact bytes as attachments with no-store, and every reviewer download is audited');

  // 5. Decisions: rejection needs a reason, one decision only, no deciding your own application
  await call(reviewer, `/${application.id}/documents/${first.id}/decision`, { body: { status: 'rejected' }, status: 400 });
  await call(reviewer, `/${application.id}/documents/${first.id}/decision`, { body: { status: 'rejected', reason: 'short' }, status: 400 });
  await call(reviewer, `/${application.id}/documents/${first.id}/decision`, { body: { status: 'approved', reason: 'not a valid status here' }, status: 400 });
  const rejected = await data(await call(reviewer, `/${application.id}/documents/${first.id}/decision`, { body: { status: 'rejected', reason: 'The scan is too dark to read the document number.' } }));
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.decidedBy, reviewer.id);
  await call(secondReviewer, `/${application.id}/documents/${first.id}/decision`, { body: { status: 'verified' }, status: 409 });
  const second = reviewerList.find((d) => d.kind === 'qualification');
  const verified = await data(await call(secondReviewer, `/${application.id}/documents/${second.id}/decision`, { body: { status: 'verified' } }));
  assert.equal(verified.status, 'verified');
  const applicantView = await data(await call(applicant, '/me/documents'));
  const seenRejected = applicantView.find((d) => d.id === first.id);
  assert.equal(seenRejected.decisionReason, 'The scan is too dark to read the document number.');
  assert(applicantView.every((d) => !('decidedBy' in d)), 'the applicant never sees which staff member decided');
  const reviewerWhoApplied = await actor('admin', operatorOrg);
  const ownApplication = await data(await call(reviewerWhoApplied, '/me', { body: { companyName: 'Reviewer Ltd', serviceInterest: 'sales' }, status: 201 }));
  const ownDoc = await data(await call(reviewerWhoApplied, '/me/documents', { form: upload('identity', pdf('mine')), status: 201 }));
  await call(reviewerWhoApplied, `/${ownApplication.id}/documents/${ownDoc.id}/decision`, { body: { status: 'verified' }, status: 403 });
  assert((await events(application.id)).some((e) => e.event === 'document.rejected' && e.details.reason.includes('too dark')));
  pass('rejection needs a reason, a decision is final, the applicant sees the reason but not the reviewer, and nobody decides their own evidence');

  // 6. The upload window follows the amendment window, and the limit cannot be raced past
  await sql("UPDATE public.provider_applications SET status='suspended' WHERE id=$1", [ownApplication.id]);
  await call(reviewerWhoApplied, '/me/documents', { form: upload('other', pdf('late')), status: 409 });
  const racer = await actor('employer');
  await call(racer, '/me', { body: { companyName: 'Racer Ltd', serviceInterest: 'sales' }, status: 201 });
  const results = await Promise.all(Array.from({ length: 14 }, (_, i) => app.request('http://localhost/providers/me/documents', {
    method: 'POST', headers: { Authorization: `Bearer ${racer.token}` }, body: upload('other', pdf(`file ${i}`), `f${i}.pdf`),
  })));
  const codes = results.map((r) => r.status).sort();
  assert.equal(codes.filter((s) => s === 201).length, 10, JSON.stringify(codes));
  assert.equal(codes.filter((s) => s === 409).length, 4);
  checks += 1;
  pass('uploads stop when the application is no longer submitted or declined, and fourteen at once yield exactly ten');

  // 7. Evidence survives an amendment and later uploads record the new revision
  const before = await data(await call(applicant, '/me'));
  const amended = await data(await call(applicant, '/me/amend', { body: { revision: before.revision, companyName: 'Evidence Ltd', serviceInterest: 'sales' } }));
  assert.equal(amended.revision, before.revision + 1);
  assert.equal((await data(await call(applicant, '/me/documents'))).length, 3);
  const later = await data(await call(applicant, '/me/documents', { form: upload('company_registration', pdf('registration'), 'reg.pdf'), status: 201 }));
  const revisions = (await sql('SELECT id, application_revision FROM public.provider_application_documents WHERE application_id=$1', [application.id])).rows;
  assert.equal(revisions.find((r) => r.id === later.id).application_revision, amended.revision);
  assert.equal(revisions.find((r) => r.id === first.id).application_revision, before.revision);
  pass('amending keeps every document and new evidence records the revision it was added to');

  // 8. The database guards hold even for direct writes
  const refuses = async (statement, params, pattern) =>
    assert.rejects(() => sql(statement, params), pattern);
  await refuses('UPDATE public.provider_application_documents SET content=$2 WHERE id=$1', [first.id, Buffer.from('%PDF-1.7 swapped')], /cannot be changed after upload/);
  await refuses("UPDATE public.provider_application_documents SET filename='other.pdf' WHERE id=$1", [first.id], /cannot be changed after upload/);
  await refuses("UPDATE public.provider_application_documents SET status='verified', decided_by=$2, decided_at=now() WHERE id=$1", [first.id, reviewer.id], /already be decided|cannot be decided again/);
  await refuses('DELETE FROM public.provider_application_documents WHERE id=$1', [first.id], /retained/);
  await refuses('TRUNCATE public.provider_application_documents', [], /retained/);
  const insertDocument = `INSERT INTO public.provider_application_documents(application_id,application_revision,kind,filename,mime_type,content,sha256,size_bytes,uploaded_by)
    VALUES($1,0,'other','x.pdf','application/pdf',$2,$3,octet_length($2::bytea),$4)`;
  // Positive control first: the very same row with the correct hash is accepted, so the refusal below is the hash.
  await sql(insertDocument, [application.id, pdf('control'), createHash('sha256').update(pdf('control')).digest('hex'), applicant.id]);
  await refuses(insertDocument, [application.id, pdf(), 'f'.repeat(64), applicant.id], /violates check constraint/);
  await refuses("INSERT INTO public.provider_application_documents(application_id,application_revision,kind,filename,mime_type,content,sha256,size_bytes,uploaded_by,status) VALUES($1,0,'other','x.pdf','application/pdf',$2,encode(sha256($2),'hex'),octet_length($2::bytea),$3,'rejected')",
    [application.id, pdf(), applicant.id], /violates check constraint/);
  await refuses('DELETE FROM public.provider_applications WHERE id=$1', [application.id], /foreign key|violates/);
  checks += 9;
  pass('the database refuses edits to stored evidence, second decisions, deletes, truncates, a wrong hash and an inconsistent decision');

  console.log(`PASS: ${checks} provider evidence checks, file-signature validation, isolation, audited downloads, final decisions and retained evidence`);
} finally {
  await pool.end();
  await closeDbPool();
}
