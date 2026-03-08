/// <reference types="jest" />

import { sanitizeFilename, s3KeyForUpload, s3KeyForDownload } from '../src/s3';
import { s3PresignUploadSchema, s3PresignDownloadSchema, s3PromoteUploadSchema } from '../src/types';
import type { AuthContext } from '../src/helpers';

const mockAuth: AuthContext = {
  userId: 'user-123',
  email: 'test@example.com',
  organisationId: 'org-456',
  role: 'employer',
};

// ── sanitizeFilename ───────────────────────────────────────────

describe('sanitizeFilename', () => {
  it('keeps simple alphanumeric filenames', () => {
    expect(sanitizeFilename('report.pdf')).toBe('report.pdf');
  });

  it('keeps hyphens and underscores', () => {
    expect(sanitizeFilename('my-file_v2.pdf')).toBe('my-file_v2.pdf');
  });

  it('replaces spaces and special characters with underscores', () => {
    expect(sanitizeFilename('my file (1).pdf')).toBe('my_file__1_.pdf');
  });

  it('strips directory traversal components', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
  });

  it('strips all path separators', () => {
    expect(sanitizeFilename('a/b/c/file.txt')).toBe('file.txt');
  });

  it('replaces null bytes', () => {
    expect(sanitizeFilename('file\0.txt')).toBe('file_.txt');
  });

  it('truncates to 255 characters', () => {
    const long = 'a'.repeat(300) + '.pdf';
    expect(sanitizeFilename(long).length).toBeLessThanOrEqual(255);
  });

  it('handles trailing slash — returns empty string', () => {
    // 'a/b/c/'.split('/').pop() returns '' → ?? only catches null/undefined
    // so base = '', then replace returns ''
    const result = sanitizeFilename('a/b/c/');
    expect(result).toBe('');
  });

  it('handles unicode characters', () => {
    const result = sanitizeFilename('résumé.pdf');
    // Non-ASCII replaced with underscores
    expect(result).toMatch(/^[a-zA-Z0-9._-]+$/);
    expect(result).toContain('.pdf');
  });

  it('handles dots-only filenames', () => {
    expect(sanitizeFilename('...')).toBe('...');
  });
});

// ── s3KeyForUpload ────────────────────────────────────────────

describe('s3KeyForUpload', () => {
  it('includes org ID and user ID in path', () => {
    const key = s3KeyForUpload(mockAuth, 'file.pdf');
    expect(key).toContain('/org-456/');
    expect(key).toContain('/user-123/');
  });

  it('starts with upload prefix', () => {
    const key = s3KeyForUpload(mockAuth, 'file.pdf');
    expect(key).toMatch(/^private\/uploads\//);
  });

  it('includes a UUID for uniqueness', () => {
    const key = s3KeyForUpload(mockAuth, 'file.pdf');
    // UUID pattern: 8-4-4-4-12 hex chars
    expect(key).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
  });

  it('sanitizes the filename in the key', () => {
    const key = s3KeyForUpload(mockAuth, '../../etc/passwd');
    expect(key).not.toContain('..');
    expect(key).toContain('passwd');
  });

  it('generates unique keys for same filename', () => {
    const key1 = s3KeyForUpload(mockAuth, 'file.pdf');
    const key2 = s3KeyForUpload(mockAuth, 'file.pdf');
    expect(key1).not.toBe(key2);
  });

  it('isolates uploads by organisation', () => {
    const otherAuth = { ...mockAuth, organisationId: 'org-789' };
    const key1 = s3KeyForUpload(mockAuth, 'file.pdf');
    const key2 = s3KeyForUpload(otherAuth, 'file.pdf');
    expect(key1).toContain('org-456');
    expect(key2).toContain('org-789');
  });
});

// ── s3KeyForDownload ──────────────────────────────────────────

describe('s3KeyForDownload', () => {
  it('includes org ID in path', () => {
    const key = s3KeyForDownload(mockAuth, 'file.pdf');
    expect(key).toContain('/org-456/');
  });

  it('does not include user ID (org-level access)', () => {
    const key = s3KeyForDownload(mockAuth, 'file.pdf');
    // Key format: prefix/orgId/uuid_filename (no userId)
    const parts = key.split('/');
    // prefix/uploads/org-456/uuid_file.pdf → 4 parts
    expect(parts).not.toContain('user-123');
  });

  it('includes a UUID for uniqueness', () => {
    const key = s3KeyForDownload(mockAuth, 'file.pdf');
    expect(key).toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
  });

  it('sanitizes the filename', () => {
    const key = s3KeyForDownload(mockAuth, '../../../etc/passwd');
    expect(key).not.toContain('..');
    expect(key).toContain('passwd');
  });
});

// ── Zod schema: s3PresignUploadSchema ─────────────────────────

describe('s3PresignUploadSchema', () => {
  it('accepts valid upload payload', () => {
    const result = s3PresignUploadSchema.safeParse({
      filename: 'report.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty filename', () => {
    const result = s3PresignUploadSchema.safeParse({
      filename: '',
      contentType: 'application/pdf',
      sizeBytes: 1024,
    });
    expect(result.success).toBe(false);
  });

  it('rejects filename over 255 chars', () => {
    const result = s3PresignUploadSchema.safeParse({
      filename: 'a'.repeat(256),
      contentType: 'application/pdf',
      sizeBytes: 1024,
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty contentType', () => {
    const result = s3PresignUploadSchema.safeParse({
      filename: 'file.pdf',
      contentType: '',
      sizeBytes: 1024,
    });
    expect(result.success).toBe(false);
  });

  it('rejects zero sizeBytes', () => {
    const result = s3PresignUploadSchema.safeParse({
      filename: 'file.pdf',
      contentType: 'application/pdf',
      sizeBytes: 0,
    });
    expect(result.success).toBe(false);
  });

  it('rejects negative sizeBytes', () => {
    const result = s3PresignUploadSchema.safeParse({
      filename: 'file.pdf',
      contentType: 'application/pdf',
      sizeBytes: -100,
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-integer sizeBytes', () => {
    const result = s3PresignUploadSchema.safeParse({
      filename: 'file.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024.5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    expect(s3PresignUploadSchema.safeParse({}).success).toBe(false);
    expect(s3PresignUploadSchema.safeParse({ filename: 'f' }).success).toBe(false);
    expect(s3PresignUploadSchema.safeParse({ filename: 'f', contentType: 'c' }).success).toBe(false);
  });

  it('rejects non-numeric sizeBytes', () => {
    const result = s3PresignUploadSchema.safeParse({
      filename: 'file.pdf',
      contentType: 'application/pdf',
      sizeBytes: '1024',
    });
    expect(result.success).toBe(false);
  });
});

// ── Zod schema: s3PresignDownloadSchema ───────────────────────

describe('s3PresignDownloadSchema', () => {
  it('accepts valid download key', () => {
    const result = s3PresignDownloadSchema.safeParse({
      key: 'private/uploads/org-123/uuid_file.pdf',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty key', () => {
    expect(s3PresignDownloadSchema.safeParse({ key: '' }).success).toBe(false);
  });

  it('rejects key over 1024 chars', () => {
    expect(s3PresignDownloadSchema.safeParse({ key: 'a'.repeat(1025) }).success).toBe(false);
  });

  it('rejects missing key', () => {
    expect(s3PresignDownloadSchema.safeParse({}).success).toBe(false);
  });
});

// ── Zod schema: s3PromoteUploadSchema ─────────────────────────

describe('s3PromoteUploadSchema', () => {
  it('accepts valid promote payload with sourceKey only', () => {
    const result = s3PromoteUploadSchema.safeParse({
      sourceKey: 'private/uploads/org-123/user-456/uuid_file.pdf',
    });
    expect(result.success).toBe(true);
  });

  it('accepts valid promote payload with optional filename', () => {
    const result = s3PromoteUploadSchema.safeParse({
      sourceKey: 'private/uploads/org-123/user-456/uuid_file.pdf',
      filename: 'renamed.pdf',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty sourceKey', () => {
    expect(s3PromoteUploadSchema.safeParse({ sourceKey: '' }).success).toBe(false);
  });

  it('rejects sourceKey over 1024 chars', () => {
    expect(s3PromoteUploadSchema.safeParse({ sourceKey: 'a'.repeat(1025) }).success).toBe(false);
  });

  it('rejects empty optional filename', () => {
    const result = s3PromoteUploadSchema.safeParse({
      sourceKey: 'valid/key',
      filename: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing sourceKey', () => {
    expect(s3PromoteUploadSchema.safeParse({}).success).toBe(false);
  });
});
