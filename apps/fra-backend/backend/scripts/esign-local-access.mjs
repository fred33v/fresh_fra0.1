#!/usr/bin/env node
// Recover only the existing synthetic local demo account; never creates or resets a user.
import '../src/env.ts';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { esignOrigin } from '../src/esign/origin.ts';

async function main() {
  assert.equal(process.env.NODE_ENV, 'development', 'Use the local development environment only');
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
      'Use the dedicated local fresh_fra_esign_dev database'
    );
  }
  const origin = esignOrigin(process.env.ESIGN_PUBLIC_URL ?? '');
  assert(
    ['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname),
    'Use a loopback signing origin'
  );
  const email = process.argv[2]?.trim().toLowerCase();
  assert(
    email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
    'Provide the email used in the local signing demo'
  );
  const mode = process.argv[3] ?? '--copy';
  assert(['--copy', '--check'].includes(mode), 'Use --copy or --check');
  const digest = createHash('sha256')
    .update(origin + email)
    .digest('hex')
    .slice(0, 20);
  let account;
  try {
    account = JSON.parse(
      await readFile(join(process.cwd(), '.local', 'esign', `demo-account-${digest}.json`), 'utf8')
    );
  } catch {
    throw new Error(
      'Local demo account file not found. Use the dashboard Forgot your password flow, or run this command from the backend folder where you ran esign:demo'
    );
  }
  assert(
    account.email === email && typeof account.password === 'string' && account.password.length > 0,
    'Local account file is not valid'
  );
  if (mode === '--check') {
    console.log('PASS: local demo account is available. No password printed or copied.');
    return;
  }
  assert.equal(
    process.platform,
    'darwin',
    'Clipboard copying is supported on your Mac; use Forgot your password on other systems'
  );
  execFileSync('/usr/bin/pbcopy', [], {
    input: account.password,
    stdio: ['pipe', 'ignore', 'pipe'],
  });
  console.log(`Password copied privately to your Mac clipboard for ${email}.`);
  console.log(
    'Open /signing in your Web dashboard, enter this email and paste the password with Command+V.'
  );
  console.log('No account was created, changed or granted additional permissions.');
}
main().catch((error) => {
  // Avoid leaking credential_process, file contents or system errors.
  const safe =
    error?.code === 'ERR_ASSERTION'
      ? error.message.split('\n')[0]
      : error?.message?.startsWith('Local demo account file not found.')
        ? error.message
        : 'Could not recover the local demo login. Use Forgot your password in the dashboard.';
  console.error(`LOCAL ACCESS NOT READY: ${safe}`);
  process.exitCode = 1;
});
