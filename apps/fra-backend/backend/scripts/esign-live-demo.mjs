#!/usr/bin/env node
// Explicitly opt-in: real SMTP and retained S3 writes, using synthetic documents and loopback PostgreSQL only.
import '../src/env.ts';
import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  S3Client,
  GetObjectRetentionCommand,
  GetObjectLegalHoldCommand,
  GetPublicAccessBlockCommand,
} from '@aws-sdk/client-s3';
import { esignOrigin } from '../src/esign/origin.ts';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  assert.equal(
    process.env.ESIGN_LIVE_TEST,
    '1',
    'Use ESIGN_LIVE_TEST=1 to opt into this real retained test'
  );
  assert.equal(process.env.NODE_ENV, 'development', 'This demo requires NODE_ENV=development');
  assert.equal(
    process.env.ESIGN_ENABLED,
    'true',
    'Enable the module locally after the readiness check'
  );
  const origin = esignOrigin(process.env.ESIGN_PUBLIC_URL ?? '');
  assert(
    ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname),
    'Only a loopback API is permitted'
  );
  for (const value of [
    process.env.DATABASE_URL,
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
  ]) {
    const db = new URL(value ?? '');
    assert(
      ['postgres:', 'postgresql:'].includes(db.protocol) &&
        ['localhost', '127.0.0.1', '[::1]'].includes(db.hostname) &&
        /^\/fresh_fra_esign_dev(?:_[a-z0-9]+)?$/.test(db.pathname) &&
        !db.search &&
        !db.hash,
      'Use a dedicated local fresh_fra_esign_dev database; remote/tunnel targets are outside this demo'
    );
  }
  const email = process.argv[2]?.trim().toLowerCase();
  assert(
    email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    'Provide your own recipient email: npm run esign:demo -- you@example.com'
  );
  const profile = process.env.AWS_PROFILE;
  assert(profile, 'Configure the limited AWS_PROFILE first');
  const identity = JSON.parse(
    execFileSync(
      'aws',
      [
        'sts',
        'get-caller-identity',
        '--profile',
        profile,
        '--region',
        process.env.AWS_REGION ?? 'eu-west-2',
        '--output',
        'json',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    )
  );
  assert(
    identity.Arn && !identity.Arn.endsWith(':root'),
    'Do not run the application with the root verification profile'
  );
  console.log('PASS: non-root AWS identity and isolated local development configuration');
  console.log(
    `This real test retains synthetic evidence for ${process.env.ESIGN_RETENTION_DAYS ?? 3650} days, plus a legal hold without automatic expiry.`
  );
  const client = new S3Client({ region: process.env.AWS_REGION ?? 'eu-west-2' });
  const privacy = await client.send(
    new GetPublicAccessBlockCommand({ Bucket: process.env.ESIGN_S3_BUCKET })
  );
  assert(
    ['BlockPublicAcls', 'IgnorePublicAcls', 'BlockPublicPolicy', 'RestrictPublicBuckets'].every(
      (key) => privacy.PublicAccessBlockConfiguration?.[key] === true
    ),
    'Enable all four S3 Block Public Access settings before the live test'
  );
  console.log('PASS: all four S3 public-access blocks are enabled');
  let token;
  async function request(path, options = {}) {
    const headers = new Headers(options.headers);
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await fetch(`${origin}/api/v1${path}`, {
      ...options,
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(
        `API ${response.status}: ${payload?.error?.code ?? 'REQUEST_FAILED'} ${payload?.error?.message ?? ''}`
      );
    }
    return response;
  }
  const post = async (path, value) =>
    (
      await (
        await request(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(value),
        })
      ).json()
    ).data;
  const get = async (path) => (await (await request(path)).json()).data;
  const privateRoot = join(process.cwd(), '.local', 'esign');
  await mkdir(privateRoot, { recursive: true, mode: 0o700 });
  const accountPath = join(privateRoot, `demo-account-${hash(origin + email).slice(0, 20)}.json`);
  let account;
  try {
    account = JSON.parse(await readFile(accountPath, 'utf8'));
    assert.equal(account.email, email);
    assert.equal(typeof account.password, 'string');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    account = { email, password: `Local-${randomBytes(24).toString('hex')}9!` };
    await writeFile(accountPath, JSON.stringify(account), { flag: 'wx', mode: 0o600 });
  }
  // Keep passwords and access tokens private. The development confirmation token is consumed in-process.
  const signedUp = await post('/auth/signup', {
    email,
    password: account.password,
    name: 'Local e-sign test owner',
    organisationName: 'Local e-sign test organisation',
    sector: 'private',
  });
  if (signedUp.verificationToken)
    token = (await post('/auth/verify-email', { token: signedUp.verificationToken })).accessToken;
  else token = (await post('/auth/login', { email, password: account.password })).accessToken;
  assert(token, 'Could not authenticate the local demo account');
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText('Synthetic local electronic-signing test. No real contract.', {
    x: 35,
    y: 750,
    size: 13,
    font,
  });
  const form = new FormData();
  form.set('title', `Local signing test ${new Date().toISOString()}`);
  form.set('file', new File([await pdf.save()], 'synthetic-test.pdf', { type: 'application/pdf' }));
  const doc = (await (await request('/esign/documents', { method: 'POST', body: form })).json())
    .data;
  console.log(`Local document: ${doc.id}`);
  const signer = await post(`/esign/documents/${doc.id}/signers`, {
    email,
    name: 'Local test signer',
  });
  await request(`/esign/documents/${doc.id}/fields`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: [
        { signerId: signer.id, page: 0, x: 35, y: 200, width: 300, height: 45, kind: 'signature' },
      ],
    }),
  });
  const sent = await post(`/esign/documents/${doc.id}/send`, {});
  assert(
    sent.deliveries?.every((delivery) => delivery.sent),
    'An invitation failed; inspect local email settings before retrying'
  );
  console.log(
    'Invitation submitted to SMTP. Open "Document ready for electronic signature" on THIS Mac.'
  );
  console.log(
    'Request the email code, enter it, review the PDF, tick consent and sign. Waiting up to 15 minutes…'
  );
  const deadline = Date.now() + 15 * 60000;
  let completed;
  while (Date.now() < deadline) {
    const current = await get(`/esign/documents/${doc.id}`);
    if (current.status === 'declined')
      throw new Error('The document was declined; nothing will be sealed');
    if (current.status === 'completed') {
      completed = current;
      break;
    }
    if (current.signers?.length && current.signers.every((signer) => signer.status === 'signed'))
      await post(`/esign/documents/${doc.id}/finalise`, {});
    await pause(3000);
  }
  assert(completed, 'Timed out. Existing signer decisions remain stored; no data was deleted');
  const sealed = Buffer.from(
    await (await request(`/esign/documents/${doc.id}/final`)).arrayBuffer()
  );
  const evidence = Buffer.from(
    await (await request(`/esign/documents/${doc.id}/evidence`)).arrayBuffer()
  );
  const manifest = JSON.parse(evidence.toString());
  const audit = await get(`/esign/documents/${doc.id}/audit`);
  assert.equal(hash(sealed), completed.finalSha256);
  assert.equal(hash(sealed), manifest.pdfObject.sha256);
  assert.equal(audit.retainedCheckpointVerified, true);
  assert.equal(manifest.audit.at(-1)?.hash, audit.head);
  console.log(
    'PASS: real email/OTP/signing completion, final PDF checksum and retained audit checkpoint'
  );
  for (const object of [manifest.originalObject, manifest.sourceObject, manifest.pdfObject]) {
    assert(object?.key && object.version && object.version !== 'null');
    const input = {
      Bucket: process.env.ESIGN_S3_BUCKET,
      Key: object.key,
      VersionId: object.version,
    };
    const [retention, hold] = await Promise.all([
      client.send(new GetObjectRetentionCommand(input)),
      client.send(new GetObjectLegalHoldCommand(input)),
    ]);
    assert.equal(retention.Retention?.Mode, 'COMPLIANCE');
    assert(retention.Retention.RetainUntilDate > new Date());
    assert.equal(hold.LegalHold?.Status, 'ON');
  }
  console.log('PASS: real S3 versions have COMPLIANCE retention and legal hold ON');
  const output = join(privateRoot, 'results', doc.id);
  await mkdir(output, { recursive: true, mode: 0o700 });
  await writeFile(join(output, 'signed.pdf'), sealed, { mode: 0o600 });
  await writeFile(join(output, 'evidence.json'), evidence, { mode: 0o600 });
  const ranges = sealed
    .toString('latin1')
    .match(/\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/)
    ?.slice(1)
    .map(Number);
  assert(
    ranges && ranges[0] === 0 && ranges[2] + ranges[3] === sealed.length,
    'Missing complete PDF seal ByteRange'
  );
  const content = Buffer.concat([
    sealed.subarray(0, ranges[1]),
    sealed.subarray(ranges[2], ranges[2] + ranges[3]),
  ]);
  const signature = Buffer.from(
    sealed.subarray(ranges[1] + 1, ranges[2] - 1).toString('ascii'),
    'hex'
  );
  await writeFile(join(output, 'content.bin'), content, { mode: 0o600 });
  await writeFile(join(output, 'signature.der'), signature, { mode: 0o600 });
  execFileSync(
    'openssl',
    [
      'cms',
      '-verify',
      '-binary',
      '-inform',
      'DER',
      '-in',
      join(output, 'signature.der'),
      '-content',
      join(output, 'content.bin'),
      '-noverify',
      '-out',
      join(output, 'verified.bin'),
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );
  console.log(
    'PASS: OpenSSL verifies the PDF CMS seal (certificate trust/qualified identity is not asserted)'
  );
  console.log(`Finished. Private local results: ${output}`);
  console.log('No S3 objects were deleted. Signing evidence remains retained.');
}
main().catch((error) => {
  // Do not dump HTTP bodies, AWS CLI stdout/stderr, tokens or passwords on failure.
  console.error(
    `LIVE TEST NOT COMPLETE: ${error?.code === 'ENOENT' ? 'A required local command/file was not found' : error?.message?.startsWith('Command failed:') ? 'AWS login or OpenSSL verification failed; check your local configuration' : error.message}`
  );
  process.exitCode = 1;
});
