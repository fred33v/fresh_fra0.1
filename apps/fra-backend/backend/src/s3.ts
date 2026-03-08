import type { Context } from 'hono';
import { S3Client } from '@aws-sdk/client-s3';
import type { AuthContext } from './helpers.js';
import { jsonError } from './helpers.js';

// ── S3 configuration ────────────────────────────────────────────

export const s3Bucket = process.env.S3_BUCKET;
export const s3Region = process.env.S3_REGION ?? process.env.AWS_REGION;
export const s3UploadPrefix = process.env.S3_UPLOAD_PREFIX ?? 'private/uploads';
export const s3DownloadPrefix = process.env.S3_DOWNLOAD_PREFIX ?? s3UploadPrefix;
export const s3UrlExpiresSeconds = Number(process.env.S3_URL_EXPIRES_SECONDS ?? 300);
export const s3MaxUploadBytes = Number(process.env.S3_MAX_UPLOAD_BYTES ?? 10 * 1024 * 1024);
export const s3AllowedContentTypes = (process.env.S3_ALLOWED_CONTENT_TYPES ?? 'application/pdf,image/png,image/jpeg')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

export const s3Client = s3Bucket && s3Region ? new S3Client({ region: s3Region }) : null;

// ── S3 helpers ──────────────────────────────────────────────────

export function requireS3(c: Context): S3Client | Response {
  if (!s3Client || !s3Bucket || !s3Region) {
    return jsonError(c, 501, 'S3_NOT_CONFIGURED', 'S3 is not configured');
  }
  return s3Client;
}

export function sanitizeFilename(filename: string): string {
  const base = filename.split('/').pop() ?? filename;
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 255);
}

export function s3KeyForUpload(auth: AuthContext, filename: string): string {
  const safe = sanitizeFilename(filename);
  const id = crypto.randomUUID();
  return `${s3UploadPrefix}/${auth.organisationId}/${auth.userId}/${id}_${safe}`;
}

export function s3KeyForDownload(auth: AuthContext, filename: string): string {
  const safe = sanitizeFilename(filename);
  const id = crypto.randomUUID();
  return `${s3DownloadPrefix}/${auth.organisationId}/${id}_${safe}`;
}

// ── Keypass code generator ──────────────────────────────────────

export function generateKeypassCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => alphabet[b % alphabet.length])
    .join('');
}
