import { esignOrigin } from '../src/esign/origin.js';
import { beforeEach, describe, expect, it } from '@jest/globals';
import {
  S3Client,
  PutObjectCommand,
  GetBucketVersioningCommand,
  GetObjectLockConfigurationCommand,
  GetObjectLegalHoldCommand,
  GetObjectRetentionCommand,
} from '@aws-sdk/client-s3';
import { evidenceStore, preparePdf } from '../src/esign/finalise.js';
import { codeHash, equalHash, newCode, newToken, sha256 } from '../src/esign/crypto.js';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';

describe('electronic signing secrets and PDF preparation', () => {
  it('domain separates OTP digests and compares fixed-size hashes', () => {
    const previous = process.env.ESIGN_OTP_SECRET;
    try {
      process.env.ESIGN_OTP_SECRET = 'test-only-secret-at-least-32-characters';
      expect(newToken()).toMatch(/^[\w-]{43}$/);
      expect(newCode()).toMatch(/^\d{6}$/);
      expect(codeHash('signer-a', '123456')).not.toBe(codeHash('signer-b', '123456'));
      expect(equalHash(codeHash('a', '123456'), codeHash('a', '123456'))).toBe(true);
      expect(equalHash('a', 'a')).toBe(false);
      expect(equalHash('x'.repeat(64), 'x'.repeat(64))).toBe(false);
      process.env.ESIGN_OTP_SECRET = 'short';
      expect(() => codeHash('a', '123456')).toThrow();
    } finally {
      if (previous === undefined) delete process.env.ESIGN_OTP_SECRET;
      else process.env.ESIGN_OTP_SECRET = previous;
    }
  });
  it('rebuilds page contents and removes source document actions', async () => {
    const source = await PDFDocument.create();
    source.addPage([595, 842]);
    source.catalog.set(
      PDFName.of('OpenAction'),
      source.context.obj({ S: 'JavaScript', JS: PDFString.of('app.alert("source action")') })
    );
    const prepared = await preparePdf(await source.save());
    const clean = await PDFDocument.load(prepared.pdf);
    expect(prepared.pages).toEqual([{ width: 595, height: 842 }]);
    expect(clean.catalog.has(PDFName.of('OpenAction'))).toBe(false);
  });
});

describe('S3 evidence retention contract', () => {
  beforeEach(() => {
    process.env.ESIGN_S3_BUCKET = 'dedicated-esign-test';
    process.env.S3_BUCKET = 'ordinary-uploads';
    delete process.env.ESIGN_RETENTION_DAYS;
  });
  function fake(
    overrides: {
      versioning?: string;
      lock?: string;
      hold?: string;
      mode?: string;
      version?: string;
    } = {}
  ) {
    const puts: PutObjectCommand[] = [];
    const client = {
      send: async (command: unknown) => {
        if (command instanceof GetBucketVersioningCommand)
          return { Status: overrides.versioning ?? 'Enabled' };
        if (command instanceof GetObjectLockConfigurationCommand)
          return { ObjectLockConfiguration: { ObjectLockEnabled: overrides.lock ?? 'Enabled' } };
        if (command instanceof PutObjectCommand) {
          puts.push(command);
          return { VersionId: overrides.version ?? 'immutable-version' };
        }
        if (command instanceof GetObjectRetentionCommand)
          return {
            Retention: {
              Mode: overrides.mode ?? 'COMPLIANCE',
              RetainUntilDate: puts[0].input.ObjectLockRetainUntilDate,
            },
          };
        if (command instanceof GetObjectLegalHoldCommand)
          return { LegalHold: { Status: overrides.hold ?? 'ON' } };
        throw new Error('Unexpected S3 operation');
      },
    } as unknown as S3Client;
    return { store: evidenceStore(client), puts };
  }
  it('requires a separate versioned bucket with Object Lock enabled', async () => {
    await expect(fake({ versioning: 'Suspended' }).store.check()).rejects.toThrow();
    await expect(fake({ lock: 'Disabled' }).store.check()).rejects.toThrow();
    await expect(fake().store.check()).resolves.toBeUndefined();
    process.env.ESIGN_S3_BUCKET = process.env.S3_BUCKET;
    expect(() => fake()).toThrow('separate');
  });
  it('writes with COMPLIANCE retention, indefinite legal hold, encryption, checksum and conditional creation', async () => {
    const { store, puts } = fake();
    const bytes = Buffer.from('evidence');
    const saved = await store.put('esign/doc/final.pdf', bytes, 'application/pdf');
    expect(puts[0].input).toMatchObject({
      ObjectLockMode: 'COMPLIANCE',
      ObjectLockLegalHoldStatus: 'ON',
      ServerSideEncryption: 'AES256',
      IfNoneMatch: '*',
      ChecksumSHA256: Buffer.from(sha256(bytes), 'hex').toString('base64'),
    });
    expect(saved).toEqual({
      key: 'esign/doc/final.pdf',
      version: 'immutable-version',
      sha256: sha256(bytes),
    });
  });
  it('fails closed when S3 omits the version or does not confirm the requested retention', async () => {
    for (const overrides of [{ version: 'null' }, { hold: 'OFF' }, { mode: 'GOVERNANCE' }])
      await expect(
        fake(overrides).store.put('key', Buffer.from('data'), 'application/pdf')
      ).rejects.toThrow();
  });
});

describe('signing public origin validation', () => {
  it('permits only loopback HTTP in development and test', () => {
    expect(esignOrigin('http://localhost:3080', 'development')).toBe('http://localhost:3080');
    expect(esignOrigin('http://127.0.0.1:3080', 'test')).toBe('http://127.0.0.1:3080');
    expect(() => esignOrigin('http://localhost:3080', 'production')).toThrow();
    expect(() => esignOrigin('http://localhost:3080', '')).toThrow();
    expect(() => esignOrigin('http://example.com', 'development')).toThrow();
    expect(() => esignOrigin('http://localhost.example.com', 'development')).toThrow();
  });
  it('requires an origin without credentials, paths, queries or fragments', () => {
    expect(esignOrigin('https://example.com', 'production')).toBe('https://example.com');
    for (const origin of [
      'https://user:password@example.com',
      'https://example.com/path',
      'https://example.com/?token=private',
      'https://example.com/#private',
      'ftp://localhost',
    ]) {
      expect(() => esignOrigin(origin, 'development')).toThrow();
    }
  });
});
