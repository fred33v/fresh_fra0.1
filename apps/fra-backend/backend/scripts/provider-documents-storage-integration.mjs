// Evidence documents kept in S3 and virus-scanned, against a disposable local PostgreSQL database with all migrations
// applied. Uses the real application and document routes with an in-memory object store and a stand-in scanner, so no
// AWS account or ClamAV daemon is involved: what is proved here is how this application behaves around them
// (where bytes go, what is checked, what fails closed). Detection quality belongs to the deployed scanner.
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
const { setObjectStoreForTests, StorageUnavailableError } = await import('../src/provider-document-storage.ts');
const { setScannerForTests, ScanUnavailableError } = await import('../src/provider-document-scan.ts');
const { jwtSecret } = await import('../src/helpers.ts');
const { closeDbPool } = await import('../src/db.ts');
const pool = new pg.Pool({ connectionString: url.href });
const app = new Hono().route('/providers', documentRoutes).route('/providers', applicationRoutes);

// ── Stand-ins for S3 and the scanner ─────────────────────────────

const objects = new Map();
const store = {
  down: false,
  failPuts: false,
  async put(key, body, meta) {
    if (this.down || this.failPuts) throw new StorageUnavailableError('S3 write failed: stand-in');
    // What the real client sends: S3 refuses a write whose bytes do not match the checksum we computed.
    assert.equal(createHash('sha256').update(body).digest('hex'), meta.sha256);
    objects.set(key, { body: Buffer.from(body), mimeType: meta.mimeType });
  },
  async get(key) {
    if (this.down) throw new StorageUnavailableError('S3 read failed: stand-in');
    const found = objects.get(key);
    if (!found) throw new StorageUnavailableError('S3 read failed: NoSuchKey');
    return Buffer.from(found.body);
  },
  async remove(key) {
    objects.delete(key);
  },
};
const scanner = {
  engine: 'fake',
  down: false,
  scanned: 0,
  async scan(content) {
    this.scanned += 1;
    if (this.down) throw new ScanUnavailableError('Scanner unreachable: stand-in');
    if (content.includes('EICAR-STANDIN')) return { status: 'infected', engine: 'fake', signature: 'Stand-In.Test.Signature' };
    return { status: 'clean', engine: 'fake' };
  },
};
setObjectStoreForTests(store);
setScannerForTests(scanner);

// ── Helpers (same shape as provider-documents-integration.mjs) ────

let checks = 0;
const pass = (message) => console.log(`PASS ${message}`);
async function actor(role = 'employer', org = randomUUID()) {
  const a = { id: randomUUID(), org, email: `${randomUUID()}@example.test`, role };
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query(
      "INSERT INTO public.users(id,email,name,password_hash,role,organisation_id,email_verified_at) VALUES($1,$2,'Storage Fixture','unused',$3,$4,now())",
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
const pdf = (text = 'passport scan', extra = 0) => Buffer.concat([Buffer.from(`%PDF-1.7\n${text}\n`), Buffer.alloc(extra, 7), Buffer.from('%%EOF')]);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
function upload(kind, bytes, name = 'evidence.pdf', type = 'application/pdf') {
  const form = new FormData();
  if (kind) form.set('kind', kind);
  if (bytes) form.set('file', new File([bytes], name, { type }));
  return form;
}
const events = async (applicationId) =>
  (await pool.query('SELECT event, details FROM public.provider_recruitment_audit WHERE application_id=$1 ORDER BY id', [applicationId])).rows;
const sql = (text, params = []) => pool.query(text, params);
const rowCount = async (applicationId) =>
  (await sql('SELECT count(*)::int AS n FROM public.provider_application_documents WHERE application_id=$1', [applicationId])).rows[0].n;
async function newApplicant(name) {
  const user = await actor('employer');
  const application = await data(await call(user, '/me', { body: { companyName: name, serviceInterest: 'sales' }, status: 201 }));
  return { user, application };
}
const reset = () => {
  store.down = false;
  store.failPuts = false;
  scanner.down = false;
  setObjectStoreForTests(store);
  setScannerForTests(scanner);
  delete process.env.PROVIDER_DOCUMENT_REQUIRE_SCAN;
};

try {
  const reviewer = await actor('admin', operatorOrg);
  const { user: applicant, application } = await newApplicant('Storage Ltd');

  // 1. Default behaviour is unchanged: the database, with today's limit; scanning applies there too
  delete process.env.PROVIDER_DOCUMENT_STORE;
  assert.deepEqual(await data(await call(applicant, '/me/documents/limits')), { minBytes: 8, maxBytes: 524288, maxFiles: 10, scanning: true });
  const inDb = await data(await call(applicant, '/me/documents', { form: upload('identity', pdf('database file')), status: 201 }));
  const dbRow = (await sql('SELECT storage, storage_key, size_bytes, scan_status, scan_engine, content IS NOT NULL AS has_content FROM public.provider_application_documents WHERE id=$1', [inDb.id])).rows[0];
  assert.deepEqual(dbRow, { storage: 'database', storage_key: null, size_bytes: pdf('database file').length, scan_status: 'clean', scan_engine: 'fake', has_content: true });
  assert.equal(objects.size, 0);
  await call(applicant, '/me/documents', { form: upload('identity', pdf('too big for the database', 600 * 1024)), status: 400 });
  pass('without S3 configured, files stay in the database with the old limit and are scanned when a scanner is on');

  // 2. S3 mode: larger files, bytes in the bucket and nowhere in the row
  process.env.PROVIDER_DOCUMENT_STORE = 's3';
  assert.deepEqual(await data(await call(applicant, '/me/documents/limits')), { minBytes: 8, maxBytes: 10485760, maxFiles: 10, scanning: true });
  const big = pdf('two mebibytes', 2 * 1024 * 1024);
  const inS3 = await data(await call(applicant, '/me/documents', { form: upload('qualification', big, 'degree.pdf'), status: 201 }));
  const s3Row = (await sql('SELECT storage, storage_key, size_bytes, sha256, scan_status, scan_engine, content IS NULL AS no_content FROM public.provider_application_documents WHERE id=$1', [inS3.id])).rows[0];
  assert.equal(s3Row.storage, 's3');
  assert.equal(s3Row.storage_key, `private/provider-documents/${inS3.id}`);
  assert.equal(s3Row.size_bytes, big.length);
  assert.equal(s3Row.sha256, sha(big));
  assert.equal(s3Row.no_content, true);
  assert.deepEqual([s3Row.scan_status, s3Row.scan_engine], ['clean', 'fake']);
  assert.deepEqual(objects.get(s3Row.storage_key).body, big);
  assert.equal(objects.get(s3Row.storage_key).mimeType, 'application/pdf');
  assert(!s3Row.storage_key.includes('degree'), 'the object key carries no file name or personal data');
  assert.equal(inS3.sizeBytes, big.length);
  await call(applicant, '/me/documents', { form: upload('identity', pdf('over the s3 limit', 10 * 1024 * 1024)), status: 400 });
  const applicantDownload = await call(applicant, `/me/documents/${inS3.id}/file`);
  assert.deepEqual(Buffer.from(await applicantDownload.arrayBuffer()), big);
  const reviewerDownload = await call(reviewer, `/${application.id}/documents/${inS3.id}/file`);
  assert.deepEqual(Buffer.from(await reviewerDownload.arrayBuffer()), big);
  assert.match(reviewerDownload.headers.get('content-disposition'), /^attachment; filename="degree\.pdf"/);
  assert.equal(reviewerDownload.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(reviewerDownload.headers.get('cache-control'), 'no-store');
  const uploaded = (await events(application.id)).find((e) => e.event === 'document.uploaded' && e.details.documentId === inS3.id);
  assert.deepEqual([uploaded.details.storage, uploaded.details.scan, uploaded.details.sha256], ['s3', 'clean', sha(big)]);
  assert((await events(application.id)).some((e) => e.event === 'document.downloaded' && e.details.documentId === inS3.id));
  pass('in S3 mode a 2 MiB file goes to the bucket under an opaque key, the row holds no bytes, and both parties download the exact file');

  // 3. A file that no longer matches its recorded hash is refused, never served
  const key = s3Row.storage_key;
  const original = objects.get(key).body;
  objects.get(key).body = Buffer.concat([original.subarray(0, original.length - 1), Buffer.from('X')]); // same length, one byte changed
  await call(reviewer, `/${application.id}/documents/${inS3.id}/file`, { status: 500 });
  await call(applicant, `/me/documents/${inS3.id}/file`, { status: 500 });
  objects.get(key).body = original.subarray(0, 100); // truncated
  await call(reviewer, `/${application.id}/documents/${inS3.id}/file`, { status: 500 });
  objects.delete(key); // missing
  await call(reviewer, `/${application.id}/documents/${inS3.id}/file`, { status: 503 });
  objects.set(key, { body: original, mimeType: 'application/pdf' });
  await call(reviewer, `/${application.id}/documents/${inS3.id}/file`); // positive control: restored, served again
  store.down = true;
  await call(reviewer, `/${application.id}/documents/${inS3.id}/file`, { status: 503 });
  store.down = false;
  pass('a changed, truncated or missing object is refused, an unreachable bucket is a 503, and the restored object is served again');

  // 4. The scanner fails closed
  const before = { rows: await rowCount(application.id), objects: objects.size };
  const infected = await call(applicant, '/me/documents', { form: upload('other', pdf('EICAR-STANDIN virus')), status: 422 });
  assert.equal((await infected.json()).error.code, 'FILE_REJECTED');
  assert.deepEqual({ rows: await rowCount(application.id), objects: objects.size }, before);
  const rejection = (await events(application.id)).find((e) => e.event === 'document.rejected_by_scan');
  assert.deepEqual([rejection.details.signature, rejection.details.sha256, rejection.details.engine], ['Stand-In.Test.Signature', sha(pdf('EICAR-STANDIN virus')), 'fake']);
  scanner.down = true;
  await call(applicant, '/me/documents', { form: upload('other', pdf('while the scanner is down')), status: 503 });
  assert.deepEqual({ rows: await rowCount(application.id), objects: objects.size }, before);
  scanner.down = false;
  store.failPuts = true;
  await call(applicant, '/me/documents', { form: upload('other', pdf('while the bucket refuses writes')), status: 503 });
  assert.deepEqual({ rows: await rowCount(application.id), objects: objects.size }, before);
  store.failPuts = false;
  const { user: fullUp, application: fullApplication } = await newApplicant('Refused Early Ltd');
  await sql("UPDATE public.provider_applications SET status='declined' WHERE id=$1", [fullApplication.id]); // inside the upload window
  await call(fullUp, '/me/documents', { form: upload('identity', pdf('allowed while declined')), status: 201 });
  await sql("UPDATE public.provider_applications SET status='suspended' WHERE id=$1", [fullApplication.id]); // outside it
  const scannedBeforeRefusal = scanner.scanned;
  const objectsBeforeRefusal = objects.size;
  await call(fullUp, '/me/documents', { form: upload('identity', pdf('not allowed now')), status: 409 });
  assert.equal(scanner.scanned, scannedBeforeRefusal, 'an upload refused for its application state is not even scanned');
  assert.equal(objects.size, objectsBeforeRefusal);
  pass('an infected file, an unreachable scanner and a refusing bucket each store nothing; a refused upload costs no scan or write');

  // 5. Racing uploads cannot leave orphaned objects behind
  const racer = await newApplicant('Racing Ltd');
  const post = (a, form) =>
    app.request('http://localhost/providers/me/documents', { method: 'POST', headers: { Authorization: `Bearer ${a.token}` }, body: form });
  const objectsBefore = objects.size;
  const codes = (await Promise.all(Array.from({ length: 14 }, (_, i) => post(racer.user, upload('other', pdf(`race ${i}`)))))).map((r) => r.status);
  assert.equal(codes.filter((c) => c === 201).length, 10, JSON.stringify(codes));
  assert.equal(codes.filter((c) => c === 409).length, 4, JSON.stringify(codes));
  assert.equal(await rowCount(racer.application.id), 10);
  assert.equal(objects.size - objectsBefore, 10, 'the four uploads that lost the race left no object behind');
  const racedKeys = (await sql('SELECT storage_key FROM public.provider_application_documents WHERE application_id=$1', [racer.application.id])).rows.map((r) => r.storage_key);
  assert(racedKeys.every((k) => objects.has(k)));
  checks += 14;
  pass('fourteen concurrent S3 uploads yield exactly ten documents and exactly ten objects');

  // 6. Where each file lives is on its row, so switching modes strands nothing
  delete process.env.PROVIDER_DOCUMENT_STORE; // new uploads go to the database again
  assert.deepEqual(Buffer.from(await (await call(applicant, `/me/documents/${inS3.id}/file`)).arrayBuffer()), big); // an S3 file still reads
  assert.deepEqual(Buffer.from(await (await call(applicant, `/me/documents/${inDb.id}/file`)).arrayBuffer()), pdf('database file'));
  process.env.PROVIDER_DOCUMENT_STORE = 's3';
  assert.deepEqual(Buffer.from(await (await call(applicant, `/me/documents/${inDb.id}/file`)).arrayBuffer()), pdf('database file')); // a database file still reads
  // Asking for S3 when it is not configured fails; it never quietly stores in the database instead
  setObjectStoreForTests(null);
  const rowsBefore = await rowCount(application.id);
  const noStore = await call(applicant, '/me/documents', { form: upload('other', pdf('nowhere to put this')), status: 503 });
  assert.equal((await noStore.json()).error.code, 'SERVICE_UNAVAILABLE');
  await call(applicant, '/me/documents/limits', { status: 503 });
  assert.equal(await rowCount(application.id), rowsBefore);
  setObjectStoreForTests(store);
  pass('files stay readable after switching where new ones go, and S3 mode without S3 refuses rather than falling back');

  // 7. Without a scanner, uploads work and are honestly labelled as not scanned
  setScannerForTests(null);
  assert.equal((await data(await call(applicant, '/me/documents/limits'))).scanning, false);
  const unscanned = await data(await call(applicant, '/me/documents', { form: upload('insurance', pdf('policy')), status: 201 }));
  const unscannedRow = (await sql('SELECT scan_status, scanned_at, scan_engine FROM public.provider_application_documents WHERE id=$1', [unscanned.id])).rows[0];
  assert.deepEqual(unscannedRow, { scan_status: 'not_scanned', scanned_at: null, scan_engine: null });
  const listed = await data(await call(reviewer, `/${application.id}/documents`));
  assert.equal(listed.find((d) => d.id === unscanned.id).scanStatus, 'not_scanned');
  assert.equal(listed.find((d) => d.id === inS3.id).scanStatus, 'clean');
  assert.equal(listed.find((d) => d.id === inS3.id).storage, 's3');
  assert.equal(listed.find((d) => d.id === inDb.id).storage, 'database');
  assert(!('scanStatus' in (await data(await call(applicant, '/me/documents')))[0]), 'applicants are not shown scan internals');
  setScannerForTests(scanner);
  pass('with no scanner an upload is stored and recorded as not scanned, and reviewers can see which files were scanned');

  // 8. Requiring a scan: a file that was never scanned cannot be verified, a scanned one can
  process.env.PROVIDER_DOCUMENT_REQUIRE_SCAN = '1';
  const decision = (docId, body, status) => call(reviewer, `/${application.id}/documents/${docId}/decision`, { body, status });
  await decision(unscanned.id, { status: 'verified' }, 409);
  await decision(unscanned.id, { status: 'rejected', reason: 'Please upload this again so it can be checked' }); // rejecting is never blocked
  assert.equal((await data(await decision(inS3.id, { status: 'verified' }))).status, 'verified');
  assert.equal((await data(await decision(inDb.id, { status: 'verified' }))).scanStatus, 'clean');
  delete process.env.PROVIDER_DOCUMENT_REQUIRE_SCAN;
  const looseUnscanned = await data(await (async () => { setScannerForTests(null); const r = await call(applicant, '/me/documents', { form: upload('other', pdf('loose')), status: 201 }); setScannerForTests(scanner); return r; })());
  assert.equal((await data(await decision(looseUnscanned.id, { status: 'verified' }))).status, 'verified'); // not required: allowed
  pass('when scanning is required an unscanned file cannot be verified, rejecting is unaffected, and a scanned file verifies');

  // 9. The database enforces what it can, in both places
  reset();
  const refuses = (statement, params, pattern) => assert.rejects(() => sql(statement, params), pattern);
  const content = pdf('direct write');
  const base = `INSERT INTO public.provider_application_documents
    (application_id,application_revision,kind,filename,mime_type,content,sha256,size_bytes,uploaded_by,storage,storage_key,scan_status,scanned_at,scan_engine)
    VALUES($1,0,'other','x.pdf','application/pdf',$2,$3,$4,$5,$6,$7,$8,$9,$10)`;
  const direct = (over) => {
    const v = { content, sha: sha(content), size: content.length, storage: 'database', key: null, scan: 'not_scanned', at: null, engine: null, ...over };
    return [application.id, v.content, v.sha, v.size, applicant.id, v.storage, v.key, v.scan, v.at, v.engine];
  };
  const checkFailure = /violates check constraint/;
  await sql(base, direct({ storage: 's3', content: null, key: `direct/${randomUUID()}`, sha: sha(content) })); // positive control: a valid S3 row
  await sql(base, direct({})); // positive control: a valid database row
  await refuses(base, direct({ storage: 's3', key: `direct/${randomUUID()}` }), checkFailure); // S3 row that also holds bytes
  await refuses(base, direct({ storage: 's3', content: null, key: null }), checkFailure); // S3 row with no key
  await refuses(base, direct({ storage: 's3', content: null, key: `direct/${randomUUID()}`, size: 10485761 }), checkFailure);
  await refuses(base, direct({ storage: 's3', content: null, key: `direct/${randomUUID()}`, sha: 'not-a-hash' }), checkFailure);
  await refuses(base, direct({ content: null }), /null value|violates check constraint/); // database row with no bytes
  await refuses(base, direct({ key: 'direct/x' }), checkFailure); // database row with a key
  await refuses(base, direct({ sha: 'f'.repeat(64) }), checkFailure); // database row with a wrong hash
  await refuses(base, direct({ size: content.length + 1 }), checkFailure); // database row with a wrong size
  await refuses(base, direct({ scan: 'clean' }), checkFailure); // "clean" with no scan time or engine
  await refuses(base, direct({ at: new Date(), engine: 'fake' }), checkFailure); // scan details on an unscanned row
  const sameKey = `direct/${randomUUID()}`;
  await sql(base, direct({ storage: 's3', content: null, key: sameKey }));
  await refuses(base, direct({ storage: 's3', content: null, key: sameKey }), /unique|duplicate/); // one object, one row
  for (const column of ["storage_key='other/key'", "storage='database'", "scan_status='clean', scanned_at=now(), scan_engine='fake'", 'size_bytes=size_bytes+1']) {
    await refuses(`UPDATE public.provider_application_documents SET ${column} WHERE id=$1`, [inS3.id], /cannot be changed after upload/);
  }
  checks += 20;
  pass('the database refuses inconsistent storage and scan fields, a second row for one object, and edits to where a file is or how it was scanned');

  // 10. The migration upgraded existing rows in place
  const legacy = (await sql('SELECT storage, storage_key, scan_status, size_bytes = octet_length(content) AS size_ok FROM public.provider_application_documents WHERE id=$1', [inDb.id])).rows[0];
  assert.deepEqual(legacy, { storage: 'database', storage_key: null, scan_status: 'clean', size_ok: true });
  checks += 1;

  console.log(`PASS: ${checks} provider document storage checks, S3 placement, integrity on read, fail-closed scanning, orphan cleanup and storage constraints`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await pool.end();
  await closeDbPool();
}
