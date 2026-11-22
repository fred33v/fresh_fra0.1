import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import type { S3Client } from '@aws-sdk/client-s3';
import {
  S3_DOCUMENT_MAX_BYTES,
  StorageUnavailableError,
  documentUploadLimitBytes,
  s3ObjectStore,
  setObjectStoreForTests,
  uploadMode,
  uploadTarget,
} from '../src/provider-document-storage.js';
import { applyApiMiddleware, requestBodyLimit } from '../src/middleware.js';

afterEach(() => {
  delete process.env.PROVIDER_DOCUMENT_STORE;
  delete process.env.PROVIDER_DOCUMENT_MAX_BYTES;
  delete process.env.PROVIDER_DOCUMENT_S3_PREFIX;
  delete process.env.PROVIDER_DOCUMENT_KMS_KEY_ID;
  setObjectStoreForTests(undefined);
});

const sha = createHash('sha256').update('hello').digest('hex');

describe('where new uploads go', () => {
  it('defaults to the database with the existing 512 KiB limit', () => {
    expect(uploadMode()).toBe('database');
    expect(uploadTarget()).toEqual({ mode: 'database', maxBytes: 524288 });
    expect(documentUploadLimitBytes()).toBe(524288);
  });

  it('uses S3 only when asked, caps the size at what the database accepts, and never falls back silently', () => {
    process.env.PROVIDER_DOCUMENT_STORE = 's3';
    setObjectStoreForTests(null); // S3 not configured
    expect(() => uploadTarget()).toThrow(StorageUnavailableError);

    setObjectStoreForTests({ put: jest.fn(), get: jest.fn(), remove: jest.fn() } as never);
    const target = uploadTarget();
    expect(target.mode).toBe('s3');
    expect(target.maxBytes).toBe(S3_DOCUMENT_MAX_BYTES);
    expect(target.mode === 's3' && target.keyFor('abc')).toBe('private/provider-documents/abc');

    process.env.PROVIDER_DOCUMENT_MAX_BYTES = '2097152';
    expect(uploadTarget().maxBytes).toBe(2097152);
    process.env.PROVIDER_DOCUMENT_MAX_BYTES = '999999999999'; // above what the database accepts
    expect(uploadTarget().maxBytes).toBe(S3_DOCUMENT_MAX_BYTES);
    process.env.PROVIDER_DOCUMENT_MAX_BYTES = 'not a number';
    expect(uploadTarget().maxBytes).toBe(S3_DOCUMENT_MAX_BYTES);

    process.env.PROVIDER_DOCUMENT_S3_PREFIX = '/custom/prefix/';
    expect((uploadTarget() as { keyFor(id: string): string }).keyFor('abc')).toBe('custom/prefix/abc');
  });
});

describe('the S3 object store', () => {
  const client = () => {
    const send = jest.fn<(command: unknown) => Promise<unknown>>();
    return { send, client: { send } as unknown as S3Client };
  };

  it('is not available without a client and bucket', () => {
    expect(s3ObjectStore(null, 'bucket')).toBeNull();
    expect(s3ObjectStore({ send: jest.fn() } as unknown as S3Client, undefined)).toBeNull();
  });

  it('writes encrypted, checksummed, private objects and reads them back', async () => {
    const { send, client: s3 } = client();
    send.mockResolvedValueOnce({});
    await s3ObjectStore(s3, 'evidence-bucket')!.put('k/1', Buffer.from('hello'), { mimeType: 'application/pdf', sha256: sha });
    const put = (send.mock.calls[0][0] as { input: Record<string, unknown> }).input;
    expect(put).toMatchObject({
      Bucket: 'evidence-bucket',
      Key: 'k/1',
      ContentType: 'application/pdf',
      ContentLength: 5,
      CacheControl: 'no-store',
      ServerSideEncryption: 'AES256',
      ChecksumSHA256: Buffer.from(sha, 'hex').toString('base64'),
    });
    expect(put).not.toHaveProperty('ACL');
    expect(put).not.toHaveProperty('SSEKMSKeyId');

    send.mockResolvedValueOnce({ Body: { transformToByteArray: async () => new Uint8Array(Buffer.from('hello')) } });
    await expect(s3ObjectStore(s3, 'evidence-bucket')!.get('k/1')).resolves.toEqual(Buffer.from('hello'));
  });

  it('uses KMS when a key is configured', async () => {
    process.env.PROVIDER_DOCUMENT_KMS_KEY_ID = 'arn:aws:kms:eu-west-2:111122223333:key/abc';
    const { send, client: s3 } = client();
    send.mockResolvedValueOnce({});
    await s3ObjectStore(s3, 'b')!.put('k', Buffer.from('hello'), { mimeType: 'image/png', sha256: sha });
    expect((send.mock.calls[0][0] as { input: Record<string, unknown> }).input).toMatchObject({
      ServerSideEncryption: 'aws:kms',
      SSEKMSKeyId: 'arn:aws:kms:eu-west-2:111122223333:key/abc',
    });
  });

  it('reports S3 failures as storage being unavailable, without leaking provider detail', async () => {
    const { send, client: s3 } = client();
    const store = s3ObjectStore(s3, 'b')!;
    send.mockRejectedValue(Object.assign(new Error('AccessDenied: arn:aws:secret-detail'), { name: 'AccessDenied' }));
    for (const action of [
      () => store.put('k', Buffer.from('hello'), { mimeType: 'application/pdf', sha256: sha }),
      () => store.get('k'),
      () => store.remove('k'),
    ]) {
      const error = await action().catch((e: Error) => e);
      expect(error).toBeInstanceOf(StorageUnavailableError);
      expect((error as Error).message).not.toContain('secret-detail');
    }
    send.mockResolvedValueOnce({}); // an object with no body is an error too
    await expect(store.get('k')).rejects.toBeInstanceOf(StorageUnavailableError);
  });
});

describe('the request size limit', () => {
  const upload = '/api/v1/provider-applications/me/documents';

  it('is 1 MB everywhere, and larger only for evidence uploads and only in S3 mode', () => {
    expect(requestBodyLimit('POST', upload)).toBe(1_048_576);
    expect(requestBodyLimit('POST', '/api/v1/provider-applications/me')).toBe(1_048_576);
    process.env.PROVIDER_DOCUMENT_STORE = 's3';
    expect(requestBodyLimit('POST', upload)).toBe(S3_DOCUMENT_MAX_BYTES + 64 * 1024);
    expect(requestBodyLimit('GET', upload)).toBe(1_048_576);
    expect(requestBodyLimit('POST', '/api/v1/provider-applications/me/documents/x/file')).toBe(1_048_576);
    expect(requestBodyLimit('POST', '/api/v1/other/provider-applications/me/documents-extra')).toBe(1_048_576);
    expect(requestBodyLimit('POST', '/api/v1/s3/uploads/presign')).toBe(1_048_576);
  });

  it('is enforced by the middleware: 2 MiB passes on the upload route in S3 mode but not elsewhere', async () => {
    process.env.PROVIDER_DOCUMENT_STORE = 's3';
    const api = new Hono();
    applyApiMiddleware(api, []);
    api.post('/api/v1/provider-applications/me/documents', async (c) => c.json({ bytes: (await c.req.arrayBuffer()).byteLength }));
    api.post('/api/v1/other', async (c) => c.json({ bytes: (await c.req.arrayBuffer()).byteLength }));
    const send = (path: string, size: number) =>
      api.request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', Origin: 'http://localhost' },
        body: new Uint8Array(size),
      });
    expect((await send('/api/v1/provider-applications/me/documents', 2 * 1024 * 1024)).status).toBe(200);
    expect((await send('/api/v1/provider-applications/me/documents', 11 * 1024 * 1024)).status).toBe(413);
    expect((await send('/api/v1/other', 2 * 1024 * 1024)).status).toBe(413);
  });
});
