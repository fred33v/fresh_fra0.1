import { Hono } from 'hono';
import { PutObjectCommand, GetObjectCommand, CopyObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { jsonError, requireAuth } from '../helpers.js';
import { s3PresignUploadSchema, s3PresignDownloadSchema, s3PromoteUploadSchema, RATE_LIMITS } from '../types.js';
import { rateLimit, getClientIp } from '../middleware.js';
import { auditLog } from '../db/index.js';
import {
  s3Bucket, s3Region, s3UploadPrefix, s3DownloadPrefix,
  s3UrlExpiresSeconds, s3MaxUploadBytes, s3AllowedContentTypes,
  requireS3, s3KeyForUpload, s3KeyForDownload,
} from '../s3.js';

const s3Routes = new Hono();

s3Routes.post('/uploads/presign', async (c) => {
  const limited = await rateLimit('s3:presign', { windowMs: RATE_LIMITS.S3_PRESIGN_WINDOW_MS, max: RATE_LIMITS.S3_PRESIGN_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const s3 = requireS3(c);
  if (s3 instanceof Response) return s3;

  const parsed = s3PresignUploadSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid upload payload');

  const { filename, contentType, sizeBytes } = parsed.data;

  if (!Number.isFinite(s3UrlExpiresSeconds) || s3UrlExpiresSeconds <= 0 || s3UrlExpiresSeconds > 3600) {
    return jsonError(c, 500, 'S3_CONFIG_ERROR', 'Invalid S3_URL_EXPIRES_SECONDS');
  }

  if (!Number.isFinite(s3MaxUploadBytes) || s3MaxUploadBytes <= 0) {
    return jsonError(c, 500, 'S3_CONFIG_ERROR', 'Invalid S3_MAX_UPLOAD_BYTES');
  }

  if (sizeBytes > s3MaxUploadBytes) {
    return jsonError(c, 413, 'PAYLOAD_TOO_LARGE', 'File too large');
  }

  if (s3AllowedContentTypes.length > 0 && !s3AllowedContentTypes.includes(contentType)) {
    return jsonError(c, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Unsupported content type');
  }

  const key = s3KeyForUpload(auth, filename);
  const cmd = new PutObjectCommand({
    Bucket: s3Bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: sizeBytes,
  });

  const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: s3UrlExpiresSeconds });

  await auditLog({
    eventType: 's3.presign_upload', actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 's3_object', resourceId: key,
    details: { filename, contentType, sizeBytes },
    ipAddress: getClientIp(c), userAgent: c.req.header('user-agent'),
  });

  return c.json({
    success: true,
    data: {
      bucket: s3Bucket,
      region: s3Region,
      key,
      uploadUrl,
      expiresIn: s3UrlExpiresSeconds,
    },
  });
});

s3Routes.post('/uploads/promote', async (c) => {
  const limited = await rateLimit('s3:promote', { windowMs: RATE_LIMITS.S3_PRESIGN_WINDOW_MS, max: RATE_LIMITS.S3_PRESIGN_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const s3 = requireS3(c);
  if (s3 instanceof Response) return s3;

  const parsed = s3PromoteUploadSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid promote payload');

  const { sourceKey, filename } = parsed.data;

  if (sourceKey.includes('..') || sourceKey.includes('\0')) {
    return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid source key');
  }
  const allowedSourcePrefix = `${s3UploadPrefix}/${auth.organisationId}/`;
  if (!sourceKey.startsWith(allowedSourcePrefix)) {
    return jsonError(c, 403, 'FORBIDDEN', 'Not allowed to promote this object');
  }

  const inferredFilename = sourceKey.split('/').pop() ?? 'file';
  const destKey = s3KeyForDownload(auth, filename ?? inferredFilename);

  const copySource = encodeURIComponent(`${s3Bucket}/${sourceKey}`);
  await s3.send(
    new CopyObjectCommand({
      Bucket: s3Bucket,
      Key: destKey,
      CopySource: copySource,
    })
  );

  await auditLog({
    eventType: 's3.promote_upload', actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 's3_object', resourceId: destKey,
    details: { sourceKey }, ipAddress: getClientIp(c), userAgent: c.req.header('user-agent'),
  });

  return c.json({
    success: true,
    data: {
      bucket: s3Bucket,
      region: s3Region,
      sourceKey,
      key: destKey,
    },
  });
});

s3Routes.post('/downloads/presign', async (c) => {
  const limited = await rateLimit('s3:presign', { windowMs: RATE_LIMITS.S3_PRESIGN_WINDOW_MS, max: RATE_LIMITS.S3_PRESIGN_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const s3 = requireS3(c);
  if (s3 instanceof Response) return s3;

  const parsed = s3PresignDownloadSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid download payload');

  const { key } = parsed.data;
  if (key.includes('..') || key.includes('\0')) {
    return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid key');
  }
  const allowedPrefix = `${s3DownloadPrefix}/${auth.organisationId}/`;
  if (!key.startsWith(allowedPrefix)) {
    return jsonError(c, 403, 'FORBIDDEN', 'Not allowed to access this object');
  }

  const cmd = new GetObjectCommand({ Bucket: s3Bucket, Key: key });
  const downloadUrl = await getSignedUrl(s3, cmd, { expiresIn: s3UrlExpiresSeconds });

  await auditLog({
    eventType: 's3.presign_download', actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 's3_object', resourceId: key,
    ipAddress: getClientIp(c), userAgent: c.req.header('user-agent'),
  });

  return c.json({
    success: true,
    data: {
      bucket: s3Bucket,
      region: s3Region,
      key,
      downloadUrl,
      expiresIn: s3UrlExpiresSeconds,
    },
  });
});

export default s3Routes;
