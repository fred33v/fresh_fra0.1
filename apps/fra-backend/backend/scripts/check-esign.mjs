#!/usr/bin/env node
// Read-only readiness check. No document, email or S3 object is created.
import '../src/env.ts';
import { checkFinalisation } from '../src/esign/finalise.ts';
import { codeHash } from '../src/esign/crypto.ts';
import { emailConfigured } from '../src/email.ts';
import { esignOrigin } from '../src/esign/origin.ts';
try {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (!emailConfigured()) throw new Error('SMTP_HOST is required');
  esignOrigin(process.env.ESIGN_PUBLIC_URL ?? '');
  codeHash('readiness-check', '000000');
  await checkFinalisation();
  console.log(
    'PASS: seal certificate, OTP secret, SMTP configuration and S3 versioning/Object Lock readiness'
  );
  console.log(
    'No email sent or object created. Real SMTP delivery and a retained test upload still need verification.'
  );
} catch {
  console.error(
    'NOT READY: check DATABASE_URL, ESIGN_PUBLIC_URL (HTTPS, or development loopback HTTP), SMTP_HOST, ESIGN_OTP_SECRET, ESIGN_P12_PATH/passphrase and dedicated S3 bucket/IAM settings. No secrets printed.'
  );
  process.exitCode = 1;
}
