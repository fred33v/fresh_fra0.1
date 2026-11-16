#!/usr/bin/env node
// Requires disposable loopback PostgreSQL. Uses a generated test seal and an in-memory object-store double.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { Hono } from 'hono';
import { PDFDocument, StandardFonts } from 'pdf-lib';
const url = process.env.DATABASE_URL;
if (
  process.env.ESIGN_TEST_DATABASE !== '1' ||
  process.env.NODE_ENV === 'production' ||
  !url ||
  !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)
)
  throw new Error('Requires disposable local ESIGN_TEST_DATABASE=1 database');
process.env.NODE_ENV = 'test';
process.env.ESIGN_ENABLED = 'true';
process.env.ESIGN_OTP_SECRET = 'disposable-otp-secret-not-for-production-0123456789';
process.env.ESIGN_PUBLIC_URL = 'http://localhost';
process.env.RATE_LIMIT_MAX = '10000';
const { createEsignRoutes } = await import('../src/esign/routes.ts');
const { finalise, verifyRetainedManifest } = await import('../src/esign/finalise.ts');
const { verifyAudit, appendAudit } = await import('../src/esign/audit.ts');
const { issueTokens } = await import('../src/auth-utils.ts');
const { closeDbPool } = await import('../src/db.ts');
const { sha256 } = await import('../src/esign/crypto.ts');
const { inspectSealCertificate } = await import('../src/esign/certificate.ts');
const { applyGlobalMiddleware, applyApiMiddleware } = await import('../src/middleware.ts');
const pool = new pg.Pool({ connectionString: url });
const directory = mkdtempSync(join(tmpdir(), 'fra-esign-'));
const openssl = (args) =>
  execFileSync('openssl', args, { cwd: directory, stdio: ['ignore', 'pipe', 'pipe'] });
openssl([
  'req',
  '-x509',
  '-newkey',
  'rsa:2048',
  '-keyout',
  'key.pem',
  '-out',
  'cert.pem',
  '-days',
  '1',
  '-nodes',
  '-subj',
  '/CN=Disposable e-sign test only',
]);
openssl([
  'pkcs12',
  '-export',
  '-out',
  'seal.p12',
  '-inkey',
  'key.pem',
  '-in',
  'cert.pem',
  '-passout',
  'pass:test-only',
]);
const certificate = { p12: readFileSync(join(directory, 'seal.p12')), passphrase: 'test-only' };
assert(inspectSealCertificate(certificate.p12, certificate.passphrase).fingerprint);
assert.throws(() => inspectSealCertificate(certificate.p12, 'wrong-passphrase'));
const emails = [];
const objects = new Map();
let failStore = false,
  ready = true,
  puts = 0;
const store = {
  async check() {
    if (failStore) throw new Error('Injected storage outage');
  },
  async put(key, body, type) {
    assert(!objects.has(key));
    puts++;
    const ref = { key, version: randomUUID(), sha256: sha256(body) };
    objects.set(key, { ...ref, body: Buffer.from(body), type });
    return ref;
  },
};
const app = new Hono();
const origins = applyGlobalMiddleware(app);
const api = new Hono();
applyApiMiddleware(api, origins);
api.route(
  '/esign',
  createEsignRoutes({
    emailConfigured: () => true,
    sendEmail: async (email) => {
      emails.push(email);
    },
    checkFinalisation: async () => {
      if (!ready) throw new Error('Injected configuration failure');
    },
    finalise: (id) => finalise(id, store, certificate),
  })
);
app.route('/api/v1', api);
let cases = 0;
const pass = (name) => {
  cases++;
  console.log('PASS ' + name);
};
async function actor() {
  const id = randomUUID(),
    organisationId = randomUUID(),
    email = `esign-${id}@example.test`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'INSERT INTO public.users(id,email,name,password_hash,role,organisation_id,email_verified_at) VALUES($1,$2,$3,$4,$5,$6,now())',
      [id, email, 'E-sign owner', 'not-a-login', 'employer', organisationId]
    );
    await client.query(
      'INSERT INTO public.organisations(id,name,created_by_user_id) VALUES($1,$2,$3)',
      [organisationId, 'E-sign fixture', id]
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return {
    id,
    organisationId,
    email,
    token: issueTokens({ id, email, name: 'Owner', role: 'employer', organisationId }).accessToken,
  };
}
async function call(method, path, body, owner, cookie) {
  const headers = {};
  if (owner) headers.Authorization = `Bearer ${owner.token}`;
  if (cookie) headers.Cookie = cookie;
  let encoded = body;
  if (body && !(body instanceof FormData) && !(body instanceof URLSearchParams)) {
    headers['Content-Type'] = 'application/json';
    encoded = JSON.stringify(body);
  }
  return app.request(`http://localhost/api/v1/esign${path}`, { method, headers, body: encoded });
}
const json = async (res) => {
  const body = await res.json();
  assert(res.ok, JSON.stringify(body));
  return body.data;
};
const form = (values) => new URLSearchParams(values);
const owner = await actor(),
  other = await actor();
async function document() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText('Test agreement: the signer agrees to this document.', {
    x: 35,
    y: 750,
    font,
    size: 12,
  });
  const form = new FormData();
  form.set('title', 'Disposable signing agreement');
  form.set('file', new File([await pdf.save()], 'agreement.pdf', { type: 'application/pdf' }));
  return json(await call('POST', '/documents', form, owner));
}
async function signer(doc, email) {
  return json(
    await call('POST', `/documents/${doc.id}/signers`, { email, name: 'Test Signer' }, owner)
  );
}
async function fields(doc, signers) {
  return json(
    await call(
      'PUT',
      `/documents/${doc.id}/fields`,
      {
        fields: signers.map((s, i) => ({
          signerId: s.id,
          page: 0,
          x: 35,
          y: 200 + i * 60,
          width: 250,
          height: 40,
          kind: 'signature',
        })),
      },
      owner
    )
  );
}
const tokenFor = (email) =>
  emails
    .filter((e) => e.to === email && e.text.includes('/esign/sign/'))
    .at(-1)
    .text.match(/\/esign\/sign\/([\w-]+)/)[1];
async function verify(token, email) {
  assert.equal((await call('POST', `/sign/${token}/code`)).status, 303);
  const code = emails
    .filter((e) => e.to === email && e.subject.includes('code'))
    .at(-1)
    .text.match(/\b\d{6}\b/)[0];
  assert.equal((await call('POST', `/sign/${token}/code`)).status, 429);
  assert.equal((await call('POST', `/sign/${token}/verify`, form({ code: 'wrong' }))).status, 403);
  const res = await call('POST', `/sign/${token}/verify`, form({ code }));
  assert.equal(res.status, 303);
  const cookie = res.headers.get('set-cookie').split(';')[0];
  assert(res.headers.get('set-cookie').includes('HttpOnly'));
  assert.equal((await call('POST', `/sign/${token}/verify`, form({ code }))).status, 403);
  return cookie;
}
try {
  const doc = await document(),
    first = await signer(doc, 'first@example.test'),
    second = await signer(doc, 'second@example.test');
  assert.equal((await call('GET', `/documents/${doc.id}`, undefined, other)).status, 404);
  assert.equal((await call('GET', `/documents/${doc.id}`)).status, 401);
  await pool.query("UPDATE public.users SET role='employee' WHERE id=$1", [owner.id]);
  assert.equal((await call('GET', `/documents/${doc.id}`, undefined, owner)).status, 403);
  await pool.query("UPDATE public.users SET role='employer' WHERE id=$1", [owner.id]);
  assert.equal(
    (
      await call(
        'POST',
        `/documents/${doc.id}/signers`,
        { email: 'first@example.test', name: 'Duplicate' },
        owner
      )
    ).status,
    409
  );
  assert.equal(
    (
      await call(
        'PUT',
        `/documents/${doc.id}/fields`,
        {
          fields: [
            { signerId: other.id, page: 0, x: 0, y: 0, width: 100, height: 30, kind: 'signature' },
          ],
        },
        owner
      )
    ).status,
    409
  );
  await fields(doc, [first, second]);
  ready = false;
  assert.equal((await call('POST', `/documents/${doc.id}/send`, undefined, owner)).status, 503);
  assert.equal(
    (await pool.query('SELECT status FROM public.esign_documents WHERE id=$1', [doc.id])).rows[0]
      .status,
    'draft'
  );
  ready = true;
  const sent = await json(await call('POST', `/documents/${doc.id}/send`, undefined, owner));
  assert(sent.deliveries.every((d) => d.sent));
  assert.equal(
    (await call('PUT', `/documents/${doc.id}/fields`, { fields: [] }, owner)).status,
    400
  );
  await assert.rejects(
    pool.query('UPDATE public.esign_documents SET title=$2 WHERE id=$1', [doc.id, 'Edited'])
  );
  await assert.rejects(
    pool.query('DELETE FROM public.esign_fields WHERE document_id=$1', [doc.id])
  );
  pass(
    'upload, tenant/current-role checks, layout validation, configuration gate and sent-content freeze'
  );
  const token1 = tokenFor(first.email),
    token2 = tokenFor(second.email);
  assert.equal((await call('GET', `/sign/${token1}/pdf`)).status, 403);
  const stored = (
    await pool.query('SELECT token_hash FROM public.esign_signers WHERE id=$1', [first.id])
  ).rows[0].token_hash;
  assert.equal(stored, sha256(token1));
  assert.notEqual(stored, token1);
  const cookie1 = await verify(token1, first.email);
  for (const origin of ['null', 'https://untrusted.example.test']) {
    const forged = await app.request(`http://localhost/api/v1/esign/sign/${token1}/decision`, {
      method: 'POST',
      headers: { Origin: origin, Cookie: cookie1 },
      body: form({ decision: 'decline' }),
    });
    assert.equal(forged.status, 403);
  }

  const review = await call('GET', `/sign/${token1}`, undefined, undefined, cookie1);
  assert.equal(review.headers.get('referrer-policy'), 'no-referrer');
  assert((await review.text()).includes('I agree to use electronic records'));
  const pdf = Buffer.from(
    await (await call('GET', `/sign/${token1}/pdf`, undefined, undefined, cookie1)).arrayBuffer()
  );
  assert.equal(sha256(pdf), doc.sourceSha256);
  assert.equal(
    (
      await call(
        'POST',
        `/sign/${token1}/decision`,
        form({ decision: 'sign', signature: 'Signer One', sourceSha256: doc.sourceSha256 }),
        undefined,
        cookie1
      )
    ).status,
    400
  );
  assert.equal(
    (
      await call(
        'POST',
        `/sign/${token1}/decision`,
        form({ decision: 'sign', signature: 'Signer One', consent: 'yes', sourceSha256: 'wrong' }),
        undefined,
        cookie1
      )
    ).status,
    409
  );
  const signature1 = form({
    decision: 'sign',
    signature: 'Signer One',
    consent: 'yes',
    sourceSha256: doc.sourceSha256,
  });
  assert.equal(
    (await call('POST', `/sign/${token1}/decision`, signature1, undefined, cookie1)).status,
    200
  );
  assert.equal(
    (await call('POST', `/sign/${token1}/decision`, signature1, undefined, cookie1)).status,
    409
  );
  assert.equal(objects.size, 0);
  pass(
    'hashed invitation links, email OTP expiry/attempts/replay, consent, source binding and one decision'
  );
  const cookie2 = await verify(token2, second.email);
  failStore = true;
  assert.equal(
    (
      await call(
        'POST',
        `/sign/${token2}/decision`,
        form({
          decision: 'sign',
          signature: 'Signer Two',
          consent: 'yes',
          sourceSha256: doc.sourceSha256,
        }),
        undefined,
        cookie2
      )
    ).status,
    202
  );
  assert.equal(
    (await pool.query('SELECT status FROM public.esign_signers WHERE id=$1', [second.id])).rows[0]
      .status,
    'signed'
  );
  failStore = false;
  const results = await Promise.all([
    call('POST', `/documents/${doc.id}/finalise`, undefined, owner),
    call('POST', `/documents/${doc.id}/finalise`, undefined, owner),
  ]);
  assert(results.every((r) => r.status === 200));
  assert.equal(puts, 4);
  const finalDoc = (await pool.query('SELECT * FROM public.esign_documents WHERE id=$1', [doc.id]))
    .rows[0];
  assert.equal(finalDoc.status, 'completed');
  const final = objects.get(finalDoc.final_key);
  assert.equal(sha256(final.body), finalDoc.final_sha256);
  const loaded = await PDFDocument.load(final.body);
  assert.equal(loaded.getPageCount(), 2);
  const ranges = final.body
    .toString('latin1')
    .match(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/)
    .slice(1)
    .map(Number);
  const content = Buffer.concat([
    final.body.subarray(ranges[0], ranges[0] + ranges[1]),
    final.body.subarray(ranges[2], ranges[2] + ranges[3]),
  ]);
  const signature = Buffer.from(
    final.body.subarray(ranges[1] + 1, ranges[2] - 1).toString('ascii'),
    'hex'
  );
  writeFileSync(join(directory, 'signature.der'), signature);
  writeFileSync(join(directory, 'content.bin'), content);
  openssl([
    'cms',
    '-verify',
    '-binary',
    '-inform',
    'DER',
    '-in',
    'signature.der',
    '-content',
    'content.bin',
    '-noverify',
    '-out',
    'verified.bin',
  ]);
  const manifest = JSON.parse(
    [...objects.values()].find((o) => o.type === 'application/json').body.toString()
  );
  assert.equal(manifest.pdfObject.sha256, sha256(final.body));
  assert.equal(manifest.signers.length, 2);
  pass(
    'storage outage retains signatures; concurrent retry seals once; certificate page and CMS signature verify with OpenSSL'
  );
  const timezoneClient = await pool.connect();
  try {
    await timezoneClient.query("SET TIME ZONE 'Pacific/Auckland'");
    await verifyAudit(timezoneClient, doc.id);
  } finally {
    await timezoneClient.query("SET TIME ZONE 'UTC'");
    timezoneClient.release();
  }
  const entries = await verifyAudit(pool, doc.id);
  assert(entries.length > 8);
  const manifestBytes = [...objects.values()].find((o) => o.type === 'application/json').body;
  verifyRetainedManifest(
    manifestBytes,
    sha256(manifestBytes),
    doc.id,
    entries,
    finalDoc.final_sha256
  );
  assert.throws(() =>
    verifyRetainedManifest(
      manifestBytes,
      sha256(manifestBytes),
      doc.id,
      entries.slice(0, -1),
      finalDoc.final_sha256
    )
  );
  const modified = Buffer.from(content);
  modified[0] ^= 1;
  writeFileSync(join(directory, 'modified.bin'), modified);
  assert.throws(() =>
    openssl([
      'cms',
      '-verify',
      '-binary',
      '-inform',
      'DER',
      '-in',
      'signature.der',
      '-content',
      'modified.bin',
      '-noverify',
      '-out',
      'modified-verified.bin',
    ])
  );
  assert.equal(entries.at(-1).hash, manifest.audit.at(-1).hash);
  for (const query of [
    "UPDATE public.esign_audit SET actor='tampered' WHERE document_id=$1",
    'DELETE FROM public.esign_audit WHERE document_id=$1',
    'DELETE FROM public.esign_documents WHERE id=$1',
  ])
    await assert.rejects(pool.query(query, [doc.id]));
  await assert.rejects(pool.query('TRUNCATE public.esign_audit'));
  // Demonstrate detection even if a privileged actor disables the immutability trigger and changes an event.
  await pool.query('ALTER TABLE public.esign_audit DISABLE TRIGGER esign_audit_immutable');
  try {
    await pool.query(
      "UPDATE public.esign_audit SET event='tampered' WHERE document_id=$1 AND seq=1",
      [doc.id]
    );
    await assert.rejects(verifyAudit(pool, doc.id));
    await pool.query(
      "UPDATE public.esign_audit SET event='document.uploaded' WHERE document_id=$1 AND seq=1",
      [doc.id]
    );
  } finally {
    await pool.query('ALTER TABLE public.esign_audit ENABLE TRIGGER esign_audit_immutable');
  }
  await verifyAudit(pool, doc.id);
  pass(
    'append-only trigger rejects edit/delete/truncate and hash-chain verifier detects privileged tampering'
  );
  const declined = await document(),
    rejector = await signer(declined, 'decline@example.test');
  await fields(declined, [rejector]);
  await json(await call('POST', `/documents/${declined.id}/send`, undefined, owner));
  const rt = tokenFor(rejector.email),
    rc = await verify(rt, rejector.email);
  assert.equal(
    (await call('POST', `/sign/${rt}/decision`, form({ decision: 'decline' }), undefined, rc))
      .status,
    200
  );
  assert.equal(
    (await call('POST', `/documents/${declined.id}/finalise`, undefined, owner)).status,
    409
  );
  pass('decline is terminal and prevents PDF finalisation');
  const limited = await document(),
    limitedSigner = await signer(limited, 'locked@example.test');
  await fields(limited, [limitedSigner]);
  await json(await call('POST', `/documents/${limited.id}/send`, undefined, owner));
  const lt = tokenFor(limitedSigner.email);
  assert.equal((await call('POST', `/sign/${lt}/code`)).status, 303);
  const valid = emails.at(-1).text.match(/\b\d{6}\b/)[0];
  for (let i = 0; i < 5; i++)
    assert.equal(
      (
        await call(
          'POST',
          `/sign/${lt}/verify`,
          form({ code: '999999' === valid ? '999998' : '999999' })
        )
      ).status,
      403
    );
  assert.equal((await call('POST', `/sign/${lt}/verify`, form({ code: valid }))).status, 403);
  await pool.query('UPDATE public.esign_documents SET expires_at=expires_at WHERE id=$1', [
    limited.id,
  ]);
  pass('five wrong OTP attempts lock verification even with the correct code');
  const { rateLimitBuckets } = await import('../src/stores.ts');
  rateLimitBuckets.clear(); // Separate expiry assertions from the preceding per-IP brute-force limits.
  await pool.query(
    "UPDATE public.esign_signers SET otp_attempts=0,otp_expires_at=now()-interval '1 second' WHERE id=$1",
    [limitedSigner.id]
  );
  assert.equal((await call('POST', `/sign/${lt}/verify`, form({ code: valid }))).status, 403);
  await pool.query(
    "UPDATE public.esign_signers SET token_expires_at=now()-interval '1 second' WHERE id=$1",
    [limitedSigner.id]
  );
  assert.equal((await call('GET', `/sign/${lt}`)).status, 404);
  assert.equal(
    (
      await call(
        'POST',
        `/documents/${limited.id}/signers/${limitedSigner.id}/resend`,
        undefined,
        owner
      )
    ).status,
    200
  );
  assert.equal((await call('GET', `/sign/${lt}`)).status, 404);
  assert.equal((await call('GET', `/sign/${tokenFor(limitedSigner.email)}`)).status, 200);
  pass(
    'OTP/link expiry reject access; sender resend rotates the bearer link and resets verification'
  );

  if (process.env.ESIGN_BROWSER_TEST === '1') {
    const { serve } = await import('@hono/node-server');
    const { chromium } =
      await import('../../../fra-web-dashboard/node_modules/@playwright/test/index.mjs');
    const server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' });
    if (!server.listening) await new Promise((resolve) => server.once('listening', resolve));
    const publicOrigin = `http://127.0.0.1:${server.address().port}`;
    process.env.ESIGN_PUBLIC_URL = publicOrigin;
    const browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ['--no-sandbox'],
    });
    try {
      const bd = await document(),
        bs = await signer(bd, 'browser@example.test');
      await fields(bd, [bs]);
      await json(await call('POST', `/documents/${bd.id}/send`, undefined, owner));
      const page = await browser.newPage();
      await page.goto(`${publicOrigin}/api/v1/esign/sign/${tokenFor(bs.email)}`);
      await page.getByRole('button', { name: 'Send email code', exact: true }).click();
      assert(
        emails.some((e) => e.to === bs.email && e.subject.includes('code')),
        await page.locator('body').innerText()
      );
      const code = emails
        .filter((e) => e.to === bs.email && e.subject.includes('code'))
        .at(-1)
        .text.match(/\b\d{6}\b/)[0];
      await page.getByLabel('One-time code').fill(code);
      await page.getByRole('button', { name: 'Verify', exact: true }).click();
      await page.getByRole('heading', { name: 'Disposable signing agreement' }).waitFor();
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByRole('link', { name: 'Download and review document' }).click(),
      ]);
      await download.saveAs(join(directory, 'browser-review.pdf'));
      assert.equal(sha256(readFileSync(join(directory, 'browser-review.pdf'))), bd.sourceSha256);
      await page.getByLabel('Your full typed signature').fill('Élodie Test Signer');
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: 'Sign document', exact: true }).click();
      await page.getByRole('heading', { name: 'Signature recorded', exact: true }).waitFor();
      assert.equal(
        (await pool.query('SELECT status FROM public.esign_documents WHERE id=$1', [bd.id])).rows[0]
          .status,
        'completed'
      );
      await page.close();
      pass(
        'real Chromium follows emailed link, verifies OTP, downloads exact PDF, consents and signs to completion'
      );
    } finally {
      await browser.close();
      await new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
    }
  }
  console.log(
    `PASS ${cases} e-sign PostgreSQL integration scenarios (S3 double; SMTP capture; generated test certificate)`
  );
} finally {
  await pool.end();
  await closeDbPool();
  rmSync(directory, { recursive: true, force: true });
}
