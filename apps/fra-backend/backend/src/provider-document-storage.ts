import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, type S3Client } from '@aws-sdk/client-s3';
import { DOCUMENT_MAX_BYTES, DOCUMENT_MIN_BYTES } from './provider-documents.js';
import { s3Bucket, s3Client } from './s3.js';

/**
 * Where evidence documents are kept. New uploads go where PROVIDER_DOCUMENT_STORE says ("database", the default, or
 * "s3"); the row records where each file actually is, so files already in the database stay readable after the switch
 * and the other way round. The bytes always pass through this server: it checks the file's own signature and
 * SHA-256 before storing, and checks the SHA-256 again on every read, so a file replaced in the bucket is refused
 * rather than served. Nothing here hands out presigned URLs.
 */
export const S3_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024; // the database CHECK allows no more

export class StorageUnavailableError extends Error {}
export class StorageIntegrityError extends Error {}

export interface ObjectStore {
  put(key: string, body: Buffer, meta: { mimeType: string; sha256: string }): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
}

export type UploadTarget =
  | { mode: 'database'; maxBytes: number }
  | { mode: 's3'; maxBytes: number; objects: ObjectStore; keyFor(documentId: string): string };

/** Objects in the existing application bucket, encrypted at rest. KMS if a key is configured, otherwise S3-managed keys. */
export function s3ObjectStore(configuredClient: S3Client | null = s3Client, configuredBucket: string | undefined = s3Bucket): ObjectStore | null {
  if (!configuredClient || !configuredBucket) return null;
  const client = configuredClient;
  const bucket = configuredBucket;
  const kmsKey = process.env.PROVIDER_DOCUMENT_KMS_KEY_ID || undefined;
  return {
    async put(key, body, meta) {
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: body,
            ContentType: meta.mimeType,
            ContentLength: body.length,
            CacheControl: 'no-store',
            // S3 recomputes this and refuses the write if the bytes it received differ.
            ChecksumSHA256: Buffer.from(meta.sha256, 'hex').toString('base64'),
            ServerSideEncryption: kmsKey ? 'aws:kms' : 'AES256',
            ...(kmsKey ? { SSEKMSKeyId: kmsKey } : {}),
          })
        );
      } catch (error) {
        throw new StorageUnavailableError(`S3 write failed: ${(error as Error).name}`);
      }
    },
    async get(key) {
      try {
        const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        if (!out.Body) throw new Error('empty body');
        return Buffer.from(await out.Body.transformToByteArray());
      } catch (error) {
        throw new StorageUnavailableError(`S3 read failed: ${(error as Error).name}`);
      }
    },
    async remove(key) {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      } catch (error) {
        throw new StorageUnavailableError(`S3 delete failed: ${(error as Error).name}`);
      }
    },
  };
}

let injected: ObjectStore | null | undefined;
/** Tests substitute an in-memory store; pass undefined to go back to the configured one. */
export function setObjectStoreForTests(store: ObjectStore | null | undefined): void {
  injected = store;
}

/** Reading a file already kept in S3 needs S3, whichever place new uploads currently go to. */
export function objectStore(): ObjectStore {
  const store = injected !== undefined ? injected : s3ObjectStore();
  if (!store) throw new StorageUnavailableError('Document storage is not configured');
  return store;
}

export function s3MaxBytes(): number {
  const configured = Number(process.env.PROVIDER_DOCUMENT_MAX_BYTES ?? S3_DOCUMENT_MAX_BYTES);
  if (!Number.isInteger(configured) || configured < DOCUMENT_MIN_BYTES) return S3_DOCUMENT_MAX_BYTES;
  return Math.min(configured, S3_DOCUMENT_MAX_BYTES);
}

export function uploadMode(): 'database' | 's3' {
  return process.env.PROVIDER_DOCUMENT_STORE === 's3' ? 's3' : 'database';
}

/** Where a new upload goes. A request for S3 that cannot be served fails; it never quietly falls back to the database. */
export function uploadTarget(): UploadTarget {
  if (uploadMode() === 'database') return { mode: 'database', maxBytes: DOCUMENT_MAX_BYTES };
  const objects = objectStore();
  const prefix = (process.env.PROVIDER_DOCUMENT_S3_PREFIX ?? 'private/provider-documents').replace(/^\/+|\/+$/g, '');
  return { mode: 's3', maxBytes: s3MaxBytes(), objects, keyFor: (documentId) => `${prefix}/${documentId}` };
}

/** The largest file a request may carry, for the request-size limit. */
export function documentUploadLimitBytes(): number {
  return uploadMode() === 's3' ? s3MaxBytes() : DOCUMENT_MAX_BYTES;
}
