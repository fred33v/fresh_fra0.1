#!/usr/bin/env node
// Real isolated PostgreSQL/API/PDF/CMS; explicit memory doubles for SMTP and S3.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { Hono } from 'hono';
import { PDFDocument } from 'pdf-lib';
const connection = process.env.DATABASE_URL;
if (
  process.env.PROVIDER_TEST_DATABASE !== '1' ||
  process.env.NODE_ENV === 'production' ||
  !connection
)
  throw Error('Requires disposable PROVIDER_TEST_DATABASE=1');
const target = new URL(connection);
assert(
  ['127.0.0.1', 'localhost'].includes(target.hostname) &&
    target.pathname === '/provider_recruitment_test' &&
    !target.search
);
Object.assign(process.env, {
  NODE_ENV: 'test',
  PROVIDERS_ENABLED: 'true',
  ESIGN_ENABLED: 'true',
  ESIGN_PUBLIC_URL: 'http://localhost',
  ESIGN_OTP_SECRET: 'disposable-provider-agreement-test-only-0123456789',
  ESIGN_S3_BUCKET: 'in-memory-evidence-only',
  RATE_LIMIT_MAX: '10000',
  SMTP_HOST: '',
  RETENTION_ENABLED: 'false',
  UPSTASH_REDIS_REST_URL: '',
  UPSTASH_REDIS_REST_TOKEN: '',
});
const { createProviderRoutes } = await import('../src/providers/routes.ts');
const { default: authRoutes } = await import('../src/routes/auth.ts');
const { createEsignRoutes } = await import('../src/esign/routes.ts');
const { verifyAgreementEvidence } = await import('../src/providers/agreement-evidence.ts');
const { finalise } = await import('../src/esign/finalise.ts');
const { sha256 } = await import('../src/esign/crypto.ts');
const { issueTokens } = await import('../src/auth-utils.ts');
const { closeDbPool } = await import('../src/db.ts');
const { applyGlobalMiddleware, applyApiMiddleware } = await import('../src/middleware.ts');
const pool = new pg.Pool({ connectionString: connection }),
  dir = mkdtempSync(join(tmpdir(), 'provider-agreement-'));
const openssl = (args) =>
  execFileSync('openssl', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] });
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
  '/CN=Disposable provider agreement test',
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
const certificate = { p12: readFileSync(join(dir, 'seal.p12')), passphrase: 'test-only' },
  objects = new Map(),
  emails = [];
let sealOffline = false,
  evidenceOffline = false,
  hold = 'ON';
const store = {
  async check() {
    if (sealOffline) throw new Error('Injected sealing outage');
  },
  async put(key, bytes) {
    const ref = { key, version: randomUUID(), sha256: sha256(bytes) };
    objects.set(key, { ...ref, bytes: Buffer.from(bytes) });
    return ref;
  },
};
const client = {
  async send(command) {
    if (evidenceOffline) throw Error('Injected evidence outage');
    const ref = objects.get(command.input.Key);
    assert(ref && ref.version === command.input.VersionId);
    switch (command.constructor.name) {
      case 'GetObjectCommand':
        return { VersionId: ref.version, Body: { transformToByteArray: async () => ref.bytes } };
      case 'GetObjectRetentionCommand':
        return {
          Retention: { Mode: 'COMPLIANCE', RetainUntilDate: new Date(Date.now() + 86400000) },
        };
      case 'GetObjectLegalHoldCommand':
        return { LegalHold: { Status: hold } };
      default:
        throw Error('Unexpected test command');
    }
  },
};
const app = new Hono(),
  origins = applyGlobalMiddleware(app),
  api = new Hono();
applyApiMiddleware(api, origins);
api.route('/', authRoutes);
api.route(
  '/providers',
  createProviderRoutes({ verifyEvidence: (db, id) => verifyAgreementEvidence(db, id, client) })
);
api.route(
  '/esign',
  createEsignRoutes({
    emailConfigured: () => true,
    sendEmail: async (e) => {
      emails.push(e);
    },
    checkFinalisation: async () => {},
    finalise: (id) => finalise(id, store, certificate),
  })
);
app.route('/api/v1', api);
async function actor(role = 'employer', org) {
  const id = randomUUID(),
    organisationId = org ?? randomUUID(),
    email = `agreement-${id}@example.test`,
    db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query(
      'INSERT INTO public.users(id,email,name,password_hash,role,organisation_id,email_verified_at) VALUES($1,$2,$3,$4,$5,$6,now())',
      [id, email, 'Agreement fixture', 'not-a-login', role, organisationId]
    );
    if (!org)
      await db.query(
        'INSERT INTO public.organisations(id,name,created_by_user_id) VALUES($1,$2,$3)',
        [organisationId, 'Agreement fixture', id]
      );
    await db.query('COMMIT');
  } catch (e) {
    await db.query('ROLLBACK');
    throw e;
  } finally {
    db.release();
  }
  return {
    id,
    organisationId,
    email,
    token: issueTokens({ id, email, name: 'Agreement fixture', role, organisationId }).accessToken,
  };
}
async function call(method, path, body, user, cookie) {
  const headers = {};
  if (user) headers.Authorization = `Bearer ${user.token}`;
  if (cookie) headers.Cookie = cookie;
  const form = body instanceof URLSearchParams;
  if (body !== undefined && !form) headers['Content-Type'] = 'application/json';
  return app.request(`http://localhost/api/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : form ? body : JSON.stringify(body),
  });
}
const data = async (r) => {
  const b = await r.json();
  assert(r.ok, JSON.stringify(b));
  return b.data;
};
let cases = 0;
const pass = (n) => {
  cases++;
  console.log('PASS ' + n);
};
const candidate = await actor(),
  reviewer = await actor('admin'),
  other = await actor(),
  orgAdmin = await actor('admin', reviewer.organisationId);
process.env.PROVIDER_REVIEWER_IDS = reviewer.id;
const engagement = {
  model: 'independent_no_minimum',
  formVersion: 'independent-engagement-2026-11-v1',
  legalStructure: 'sole_trader',
  companyNumber: '',
  businessAddress: {
    line1: '10 Example Street',
    line2: '',
    city: 'London',
    postalCode: 'SW1A 1AA',
  },
  vatRegistered: 'no',
  vatNumber: '',
  availability: 'Weekdays by agreement only.',
  declineAssignments: 'yes',
  deliveryControl: 'self',
  otherClients: 'not_sure',
  personalService: 'substitution_by_agreement',
  declarationName: 'Alex Morgan',
  noMinimumAccepted: true,
  commissionAccepted: true,
  informationAccurate: true,
};
const profile = {
  fullName: 'Alex Morgan',
  businessName: 'Example Prevention',
  country: 'GB',
  kind: 'both',
  website: '',
  expertise: ['fraud_prevention'],
  experience: 'Fraud prevention and independently agreed training assignments.',
  engagement,
};
const terms = {
  operatorName: 'Example Contracting Ltd',
  operatorAddress: '20 Example Road, London, SW1A 1AA',
  signatoryName: 'Company Signatory',
  signatoryEmail: 'company-signatory@example.test',
  scope:
    'Individually agreed fraud prevention training assignments. Any service fees require a separate written assignment.',
  paymentTerms:
    'Accepted referrals are recorded by agreement. Commission is due within 30 days of cleared package payment, excluding VAT. Refunds and disputes require reconciliation.',
  expenses: 'Only expenses approved in writing before they are incurred are reimbursed.',
  confidentiality:
    'Each party protects confidential information and uses it only for agreed services, subject to lawful disclosure duties.',
  dataHandling:
    'Only authorised data is processed for agreed purposes. Both parties agree security and incident notification responsibilities before access.',
  termination:
    'Either party may end the arrangement on 30 days written notice, preserving accrued obligations and confidentiality.',
  governingLaw: 'England and Wales, with disputes subject to its courts.',
  arrangementsReview:
    'Synthetic test only: proposed arrangements and applicable status were discussed for this fixture.',
};
let a, g;
const path = () => `/providers/admin/applications/${a.id}`;
const body = (previousAgreementId = null) => ({
  version: a.version,
  previousAgreementId,
  terms,
  termsReviewed: true,
  statusReviewed: true,
});
async function review(status) {
  a = (
    await data(
      await call(
        'POST',
        `${path()}/review`,
        {
          version: a.version,
          status,
          message: 'Synthetic programme decision for agreement testing.',
          engagementReviewed: status === 'approved',
        },
        reviewer
      )
    )
  ).application;
}
async function prepare(previous) {
  g = (await data(await call('POST', `${path()}/agreements`, body(previous), reviewer)))
    .agreements[0];
}
const tokenFor = (email) =>
  emails
    .filter((e) => e.to === email && e.subject === 'Document ready for electronic signature')
    .at(-1)
    .text.match(/\/sign\/([A-Za-z0-9_-]{43})/)[1];
async function sign(email, name, expectedStatus = 200) {
  const token = tokenFor(email),
    base = `/esign/sign/${token}`;
  assert.equal((await call('POST', `${base}/code`)).status, 303);
  const code = emails
    .filter((e) => e.to === email && e.subject === 'Your document signing code')
    .at(-1)
    .text.match(/\b\d{6}\b/)[0];
  const verified = await call('POST', `${base}/verify`, new URLSearchParams({ code }));
  assert.equal(verified.status, 303);
  const cookie = verified.headers.get('set-cookie').split(';')[0];
  assert.equal(
    (
      await call(
        'POST',
        `${base}/decision`,
        new URLSearchParams({
          decision: 'sign',
          signature: name,
          consent: 'yes',
          sourceSha256: g.sourceSha256,
        }),
        undefined,
        cookie
      )
    ).status,
    expectedStatus
  );
}
try {
  a = (
    await data(
      await call('POST', '/providers/me', { version: 0, profile, acknowledged: true }, candidate)
    )
  ).application;
  assert.equal((await call('POST', `${path()}/agreements`, body(), reviewer)).status, 409);
  await review('approved');
  for (const u of [candidate, orgAdmin])
    assert.equal((await call('POST', `${path()}/agreements`, body(), u)).status, 403);
  assert.equal(
    (await call('POST', `${path()}/agreements`, { ...body(), termsReviewed: false }, reviewer))
      .status,
    400
  );
  assert.equal(
    (
      await call(
        'POST',
        `${path()}/agreements`,
        { ...body(), terms: { ...terms, signatoryEmail: candidate.email } },
        reviewer
      )
    ).status,
    400
  );
  const documentsBefore = (
    await pool.query('SELECT count(*)::int AS n FROM public.esign_documents')
  ).rows[0].n;
  const failureName = `provider_agreement_failure_${randomUUID().replaceAll('-', '')}`;
  try {
    await pool.query(
      `CREATE FUNCTION ${failureName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected agreement retention failure'; END $$`
    );
    await pool.query(
      `CREATE TRIGGER ${failureName} BEFORE INSERT ON public.provider_agreements FOR EACH ROW EXECUTE FUNCTION ${failureName}()`
    );
    assert.equal((await call('POST', `${path()}/agreements`, body(), reviewer)).status, 500);
    assert.equal(
      (await pool.query('SELECT count(*)::int AS n FROM public.esign_documents')).rows[0].n,
      documentsBefore
    );
  } finally {
    await pool.query(`DROP TRIGGER IF EXISTS ${failureName} ON public.provider_agreements`);
    await pool.query(`DROP FUNCTION IF EXISTS ${failureName}()`);
  }
  pass('agreement snapshot failure rolls back document, signer, field and audit creation');
  await prepare(null);
  const first = g;
  assert.equal(emails.length, 0);
  assert.equal(
    (await data(await call('GET', '/providers/me', undefined, candidate))).application.agreements[0]
      .state,
    'draft'
  );
  assert.equal(
    (await call('GET', `/esign/documents/${g.documentId}`, undefined, candidate)).status,
    404
  );
  assert.equal(
    (await call('POST', `/esign/documents/${g.documentId}/send`, undefined, orgAdmin)).status,
    409
  );
  assert.equal(
    (
      await call(
        'POST',
        `/esign/documents/${g.documentId}/signers`,
        { name: 'Extra signer', email: 'extra@example.test' },
        reviewer
      )
    ).status,
    409
  );
  pass(
    'approved revision, appointed reviewer, separate parties and private linked draft without emailing'
  );
  const replacements = await Promise.all([
    call('POST', `${path()}/agreements`, body(first.id), reviewer),
    call('POST', `${path()}/agreements`, body(first.id), reviewer),
  ]);
  assert.deepEqual(replacements.map((r) => r.status).sort(), [201, 409]);
  g = (await data(replacements.find((r) => r.status === 201))).agreements[0];
  assert.equal(
    (await call('POST', `/esign/documents/${first.documentId}/send`, undefined, reviewer)).status,
    409
  );
  await assert.rejects(
    pool.query('UPDATE public.provider_agreements SET source_sha256=repeat($1,64) WHERE id=$2', [
      'a',
      g.id,
    ])
  );
  await assert.rejects(
    pool.query('UPDATE public.esign_documents SET title=$1 WHERE id=$2', [
      'Replaced terms',
      g.documentId,
    ])
  );
  await assert.rejects(
    pool.query('UPDATE public.esign_signers SET email=$1 WHERE document_id=$2', [
      'wrong@example.test',
      g.documentId,
    ])
  );
  const pdf = await PDFDocument.load(
    await (
      await call('GET', `/esign/documents/${g.documentId}/source`, undefined, reviewer)
    ).arrayBuffer()
  );
  assert(pdf.getPageCount() >= 2);
  const details = await data(
    await call('GET', `/esign/documents/${g.documentId}`, undefined, reviewer)
  );
  assert.equal(details.signers.length, 2);
  assert.equal(details.fields.length, 2);
  assert.equal(
    (await call('POST', `/esign/documents/${g.documentId}/send`, undefined, reviewer)).status,
    200
  );
  assert.equal((await call('POST', `${path()}/agreements`, body(g.id), reviewer)).status, 409);
  pass(
    'concurrent replacement conflict, retained history, frozen source/signers and prepared PDF layout'
  );
  const stale = tokenFor(candidate.email);
  await review('suspended');
  assert.equal((await call('GET', `/esign/sign/${stale}`)).status, 404);
  await review('approved');
  assert.equal((await call('GET', `/esign/sign/${stale}`)).status, 404);
  const old = g;
  await prepare(old.id);
  assert.equal(
    (
      await call(
        'POST',
        `/esign/documents/${old.documentId}/signers/${details.signers[0].id}/resend`,
        undefined,
        reviewer
      )
    ).status,
    409
  );
  assert.equal(
    (await call('POST', `/esign/documents/${g.documentId}/send`, undefined, reviewer)).status,
    200
  );
  pass(
    'suspension and changed approval revision invalidate old invitations and require a retained new agreement'
  );
  const ready = () => ({
    version: a.version,
    agreementId: g.id,
    reviewNote: 'Reviewed the synthetic signed agreement and confirmed fixture arrangements.',
    contractReviewed: true,
    statusReviewed: true,
  });
  await sign(candidate.email, 'Alex Morgan');
  assert.equal((await call('POST', `${path()}/engagement-ready`, ready(), reviewer)).status, 409);
  assert.equal(
    (await data(await call('GET', '/providers/me', undefined, candidate))).application.agreements[0]
      .signedCount,
    1
  );
  sealOffline = true;
  await sign(terms.signatoryEmail, terms.signatoryName, 202);
  assert.equal(
    (await data(await call('GET', '/providers/me', undefined, candidate))).application.agreements[0]
      .state,
    'sealing_pending'
  );
  assert.equal((await call('POST', `${path()}/engagement-ready`, ready(), reviewer)).status, 409);
  sealOffline = false;
  assert.equal(
    (await call('POST', `/esign/documents/${g.documentId}/finalise`, undefined, reviewer)).status,
    200
  );
  const complete = (await data(await call('GET', '/providers/me', undefined, candidate)))
    .application.agreements[0];
  assert.equal(complete.state, 'signed_pending_review');
  assert.equal(complete.ready, false);
  assert.equal(
    (
      await call(
        'POST',
        `${path()}/engagement-ready`,
        { ...ready(), contractReviewed: false },
        reviewer
      )
    ).status,
    400
  );
  evidenceOffline = true;
  assert.equal((await call('POST', `${path()}/engagement-ready`, ready(), reviewer)).status, 503);
  evidenceOffline = false;
  hold = 'OFF';
  assert.equal((await call('POST', `${path()}/engagement-ready`, ready(), reviewer)).status, 503);
  hold = 'ON';
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::int AS n FROM public.provider_engagement_readiness WHERE agreement_id=$1',
        [g.id]
      )
    ).rows[0].n,
    0
  );
  const readyResponses = await Promise.all([
    call('POST', `${path()}/engagement-ready`, ready(), reviewer),
    call('POST', `${path()}/engagement-ready`, ready(), reviewer),
  ]);
  assert(readyResponses.every((r) => r.status === 200));
  const readyApp = (await data(await call('GET', '/providers/me', undefined, candidate)))
    .application;
  assert.equal(readyApp.agreements[0].ready, true);
  assert.equal(readyApp.payoutsActive, false);
  const queue = await data(
    await call('GET', '/providers/admin/applications?status=approved', undefined, reviewer)
  );
  assert.equal(
    queue.applications.find((item) => item.id === a.id).agreementProgress.state,
    'ready'
  );
  assert.equal(
    (
      await pool.query(
        'SELECT count(*)::int AS n FROM public.provider_engagement_readiness WHERE agreement_id=$1',
        [g.id]
      )
    ).rows[0].n,
    1
  );
  pass(
    'both OTP/consent signatures, real sealing and idempotent explicit readiness; outages and missing hold block validation'
  );
  const doc = (await pool.query('SELECT * FROM public.esign_documents WHERE id=$1', [g.documentId]))
      .rows[0],
    signed = objects.get(doc.final_key).bytes;
  const r = signed
    .toString('latin1')
    .match(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/)
    .slice(1)
    .map(Number);
  assert.equal(r[0], 0);
  assert.equal(r[2] + r[3], signed.length);
  writeFileSync(
    join(dir, 'content.bin'),
    Buffer.concat([signed.subarray(0, r[1]), signed.subarray(r[2])])
  );
  writeFileSync(
    join(dir, 'signature.der'),
    Buffer.from(signed.subarray(r[1] + 1, r[2] - 1).toString('ascii'), 'hex')
  );
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
    '/dev/null',
  ]);
  const download = await call(
    'GET',
    `/providers/me/agreements/${g.id}/final`,
    undefined,
    candidate
  );
  assert.equal(download.status, 200);
  assert.equal(sha256(Buffer.from(await download.arrayBuffer())), doc.final_sha256);
  assert.equal(download.headers.get('cache-control'), 'no-store');
  assert.equal(
    (await call('GET', `/providers/me/agreements/${g.id}/final`, undefined, other)).status,
    404
  );
  assert.equal(
    (await call('GET', `${path()}/agreements/${g.id}/final`, undefined, orgAdmin)).status,
    403
  );
  objects.get(doc.final_key).bytes = Buffer.from('tampered');
  assert.equal(
    (await call('GET', `/providers/me/agreements/${g.id}/final`, undefined, candidate)).status,
    503
  );
  objects.get(doc.final_key).bytes = signed;
  await assert.rejects(
    pool.query('DELETE FROM public.provider_engagement_readiness WHERE agreement_id=$1', [g.id])
  );
  pass(
    'full PDF CMS verification, candidate-only exact-version download, tamper rejection and retained readiness'
  );
  await pool.query('UPDATE public.users SET email=$2 WHERE id=$1', [
    candidate.id,
    `changed-${candidate.email}`,
  ]);
  const changedAccount = (await data(await call('GET', '/providers/me', undefined, candidate)))
    .application.agreements[0];
  assert.equal(changedAccount.ready, false);
  assert.equal(changedAccount.state, 'candidate_changed');
  assert.equal((await call('POST', `${path()}/engagement-ready`, ready(), reviewer)).status, 409);
  await pool.query('UPDATE public.users SET email=$2 WHERE id=$1', [candidate.id, candidate.email]);
  pass(
    'changed candidate account invalidates readiness without changing retained agreement identity'
  );
  await review('suspended');
  const blocked = (await data(await call('GET', '/providers/me', undefined, candidate))).application
    .agreements[0];
  assert.equal(blocked.ready, false);
  assert.equal(blocked.state, 'blocked');
  assert(blocked.readyAt);
  assert.equal((await call('POST', `${path()}/engagement-ready`, ready(), reviewer)).status, 409);
  pass(
    'suspension removes current readiness while preserving signed agreement and historical review'
  );

  if (process.env.PROVIDER_BROWSER_TEST === '1') {
    const web = new URL(process.env.PROVIDER_BROWSER_URL ?? 'http://127.0.0.1:8080');
    assert(web.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(web.hostname));
    const { serve } = await import('@hono/node-server');
    const { chromium, expect } =
      await import('../../../fra-web-dashboard/node_modules/@playwright/test/index.mjs');
    const server = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 });
    if (!server.listening) await new Promise((resolve) => server.once('listening', resolve));
    const apiOrigin = `http://127.0.0.1:${server.address().port}`;
    process.env.ESIGN_PUBLIC_URL = apiOrigin;
    const browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ['--no-sandbox'],
    });
    try {
      await review('approved');
      const errors = [];
      async function pageFor(user) {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        page.setDefaultTimeout(15000);
        page.on('pageerror', (e) => errors.push(e.message));
        await page.addInitScript(
          (token) => localStorage.setItem('fra_access_token', token),
          user.token
        );
        await page.route('**/api/v1/**', async (route) => {
          const requested = new URL(route.request().url());
          assert(['localhost', '127.0.0.1'].includes(requested.hostname));
          const response = await route.fetch({
            url: apiOrigin + requested.pathname + requested.search,
          });
          await route.fulfill({ response });
        });
        return page;
      }
      const staffPage = await pageFor(reviewer),
        candidatePage = await pageFor(candidate);
      await staffPage.goto(new URL(`/partners/review/${a.id}`, web).href);
      await staffPage
        .getByRole('button', { name: 'Prepare a retained replacement', exact: true })
        .click();
      const { agreementTermFields } =
        await import('../../../fra-web-dashboard/src/lib/providerAgreements.ts');
      for (const f of agreementTermFields)
        await staffPage.getByLabel(f.label, { exact: true }).fill(terms[f.key]);
      await staffPage
        .getByRole('checkbox', { name: /reviewed the proposed contract terms/ })
        .check();
      await staffPage
        .getByRole('checkbox', { name: /reviewed the actual working arrangements/ })
        .check();
      await staffPage.getByRole('button', { name: 'Prepare agreement PDF', exact: true }).click();
      await staffPage
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Prepare agreement', exact: true })
        .click();
      await staffPage
        .getByText(
          'Agreement prepared. Review the PDF and signature fields in Documents & signing before sending.',
          { exact: true }
        )
        .waitFor();
      g = (await data(await call('GET', '/providers/me', undefined, candidate))).application
        .agreements[0];
      await staffPage.getByRole('link', { name: 'Open agreement in Documents & signing' }).click();
      await staffPage.getByRole('button', { name: 'Place signature fields', exact: true }).click();
      await staffPage.getByRole('button', { name: 'Save fields & review', exact: true }).click();
      await staffPage.getByRole('checkbox').check();
      await staffPage.getByRole('button', { name: 'Send invitations', exact: true }).click();
      await staffPage
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Send invitations', exact: true })
        .click();
      await expect
        .poll(
          () =>
            emails.filter(
              (e) =>
                e.subject === 'Document ready for electronic signature' && e.to === candidate.email
            ).length
        )
        .toBeGreaterThan(2);
      await candidatePage.goto(new URL('/partners', web).href);
      await candidatePage.getByText('Awaiting signatures', { exact: true }).waitFor();
      for (const [email, name] of [
        [candidate.email, 'Alex Morgan'],
        [terms.signatoryEmail, terms.signatoryName],
      ]) {
        const signPage = await browser.newPage();
        signPage.setDefaultTimeout(15000);
        await signPage.goto(`${apiOrigin}/api/v1/esign/sign/${tokenFor(email)}`);
        await signPage.getByRole('button', { name: 'Send email code', exact: true }).click();
        await signPage.getByRole('status').waitFor();
        const code = emails
          .filter((e) => e.to === email && e.subject === 'Your document signing code')
          .at(-1)
          .text.match(/\b\d{6}\b/)[0];
        await signPage.getByLabel('One-time code').fill(code);
        await signPage.getByRole('button', { name: 'Verify', exact: true }).click();
        await signPage.getByLabel('Your full typed signature').fill(name);
        await signPage.getByRole('checkbox').check();
        await signPage.getByRole('button', { name: 'Sign document', exact: true }).click();
        await signPage.getByRole('heading', { name: 'Signature recorded', exact: true }).waitFor();
        await signPage.close();
      }
      await staffPage.goto(new URL(`/partners/review/${a.id}`, web).href);
      await staffPage.getByText('Signed · administrative review needed', { exact: true }).waitFor();
      await staffPage
        .getByLabel('Readiness review note (visible to candidate)')
        .fill('Browser fixture: both signatures, contract and arrangements reviewed.');
      await staffPage.getByRole('checkbox', { name: /reviewed the completed agreement/ }).check();
      await staffPage
        .getByRole('checkbox', { name: /confirm the engagement arrangements/ })
        .check();
      await staffPage
        .getByRole('button', { name: 'Verify evidence & record engagement ready', exact: true })
        .click();
      await staffPage
        .getByRole('alertdialog')
        .getByRole('button', { name: 'Verify and record readiness', exact: true })
        .click();
      await staffPage
        .getByText('Administrative readiness recorded. Payouts remain inactive.', { exact: true })
        .waitFor();
      await candidatePage
        .getByRole('button', { name: 'Refresh agreement status', exact: true })
        .click();
      await candidatePage.getByText('Engagement ready', { exact: true }).waitFor();
      const downloadEvent = candidatePage.waitForEvent('download');
      await candidatePage
        .getByRole('button', { name: 'Download verified signed agreement', exact: true })
        .click();
      const download = await downloadEvent;
      assert.equal(await download.failure(), null);
      if (process.env.PROVIDER_BROWSER_ARTIFACTS) {
        const { mkdirSync } = await import('node:fs');
        mkdirSync(process.env.PROVIDER_BROWSER_ARTIFACTS, { recursive: true });
        await candidatePage.screenshot({
          path: join(process.env.PROVIDER_BROWSER_ARTIFACTS, 'agreement-ready-candidate.png'),
          fullPage: true,
        });
        await staffPage.screenshot({
          path: join(process.env.PROVIDER_BROWSER_ARTIFACTS, 'agreement-ready-reviewer.png'),
          fullPage: true,
        });
      }
      await candidatePage.setViewportSize({ width: 390, height: 844 });
      // Same requirement as before (the page must not scroll sideways at phone width). On failure the message
      // names the elements that reach past the viewport, because the overflow depends on the machine's fonts.
      const phoneLayout = await candidatePage.evaluate(() => {
        // Report the innermost elements that reach past the viewport: an offending ancestor is only a symptom,
        // its widest descendant is the cause.
        const past = (element) => element.getBoundingClientRect().right > innerWidth + 0.5;
        const offenders = [...document.querySelectorAll('body *')]
          .filter((element) => element.getBoundingClientRect().width > 0 && past(element))
          .filter((element) => ![...element.children].some(past))
          .slice(0, 8)
          .map((element) => {
            const box = element.getBoundingClientRect();
            return (
              `${element.tagName.toLowerCase()}[class="${String(element.className).slice(0, 110)}"] ` +
              `left=${Math.round(box.left)} right=${Math.round(box.right)} width=${Math.round(box.width)} ` +
              `text="${(element.textContent ?? '').trim().slice(0, 70)}"`
            );
          });
        // Which single element, once allowed to shrink or wrap, makes the sideways scroll disappear?
        const fits = () => document.documentElement.scrollWidth <= innerWidth;
        const describe = (element) =>
          `${element.tagName.toLowerCase()}[class="${String(element.className).slice(0, 110)}"] ` +
          `text="${(element.textContent ?? '').trim().slice(0, 60)}"`;
        const cures = { minWidthZero: [], wrapAnywhere: [] };
        if (!fits()) {
          for (const element of document.querySelectorAll('body *')) {
            if (cures.minWidthZero.length < 5) {
              const before = element.style.minWidth;
              element.style.minWidth = '0';
              if (fits()) cures.minWidthZero.push(describe(element));
              element.style.minWidth = before;
            }
            if (cures.wrapAnywhere.length < 5) {
              const before = element.style.overflowWrap;
              element.style.overflowWrap = 'anywhere';
              if (fits()) cures.wrapAnywhere.push(describe(element));
              element.style.overflowWrap = before;
            }
          }
        }
        return { scrollWidth: document.documentElement.scrollWidth, innerWidth, offenders, cures };
      });
      assert(
        phoneLayout.scrollWidth <= phoneLayout.innerWidth,
        `Candidate page scrolls sideways at ${phoneLayout.innerWidth}px: ${JSON.stringify(phoneLayout)}`
      );
      assert.deepEqual(errors, []);
      pass(
        'real Chromium agreement preparation, sending, both OTP/consent signatures, administrative readiness and candidate download'
      );
    } finally {
      await browser.close();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  }
  console.log(
    `PASS ${cases} provider agreement API/PostgreSQL/PDF scenarios; SMTP/S3 memory doubles; no external services`
  );
} finally {
  await pool.end();
  await closeDbPool();
  rmSync(dir, { recursive: true, force: true });
}
