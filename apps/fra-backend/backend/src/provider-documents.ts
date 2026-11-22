import { createHash } from 'node:crypto';

/** Evidence an applicant can attach to a provider application. Same bounds as service-delivery evidence. */
export const DOCUMENT_KINDS = [
  'identity',
  'company_registration',
  'qualification',
  'insurance',
  'training_demonstration',
  'other',
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export const DOCUMENT_MIN_BYTES = 8;
export const DOCUMENT_MAX_BYTES = 524288; // 512 KiB
export const DOCUMENTS_PER_APPLICATION = 10;
export type DocumentMime = 'application/pdf' | 'image/png' | 'image/jpeg';

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** The type comes from the file's own signature. The browser's Content-Type and the file name are not trusted. */
export function detectDocumentMime(content: Buffer): DocumentMime | null {
  if (content.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (content.length >= 8 && content.subarray(0, 8).equals(PNG_SIGNATURE)) return 'image/png';
  if (content.length >= 3 && content[0] === 255 && content[1] === 216 && content[2] === 255) return 'image/jpeg';
  return null;
}

/** The name is only a label (never a path); strip control characters and path separators and bound its length. */
export function safeDocumentFilename(name: string): string {
  const cleaned = name.replace(/[\x00-\x1f\x7f/\\]/g, '_').trim().slice(0, 160);
  return cleaned || 'evidence';
}

export function sha256Hex(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

/** Always an attachment, so a stored file is never rendered inside the application's own origin. */
export function attachmentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]|["\;]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
