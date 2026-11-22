export type EvidenceKind =
  | 'identity'
  | 'company_registration'
  | 'qualification'
  | 'insurance'
  | 'training_demonstration'
  | 'other';
export type EvidenceStatus = 'pending' | 'verified' | 'rejected';
export type EvidenceDocument = {
  id: string;
  kind: EvidenceKind;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  uploadedAt: string;
  status: EvidenceStatus;
  decisionReason: string | null;
  decidedAt: string | null;
  // Reviewer view only
  scanStatus?: 'not_scanned' | 'clean';
  applicationRevision?: number;
  uploadedBy?: string;
  decidedBy?: string | null;
};
export const evidenceKinds: Array<{ value: EvidenceKind; label: string }> = [
  { value: 'identity', label: 'Identity document' },
  { value: 'company_registration', label: 'Company registration' },
  { value: 'qualification', label: 'Qualification or certificate' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'training_demonstration', label: 'Training demonstration material' },
  { value: 'other', label: 'Other supporting document' },
];
export const evidenceKindLabel = (kind: EvidenceKind) =>
  evidenceKinds.find((k) => k.value === kind)?.label ?? kind;
/** What the server allows. These are the defaults until it answers; the server's own answer is what applies. */
export type EvidenceLimits = { minBytes: number; maxBytes: number; maxFiles: number; scanning: boolean };
export const evidenceLimits: EvidenceLimits = { minBytes: 8, maxBytes: 524288, maxFiles: 10, scanning: false };
/** Anything that is not a well-formed answer (an error, an old server) leaves the defaults in force. */
export function readEvidenceLimits(value: unknown): EvidenceLimits {
  const v = value as Partial<EvidenceLimits> | null;
  const whole = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n > 0;
  if (!v || typeof v !== 'object' || !whole(v.minBytes) || !whole(v.maxBytes) || !whole(v.maxFiles)) return evidenceLimits;
  return { minBytes: v.minBytes as number, maxBytes: v.maxBytes as number, maxFiles: v.maxFiles as number, scanning: v.scanning === true };
}
export const evidenceStatusLabel: Record<EvidenceStatus, string> = {
  pending: 'Awaiting review',
  verified: 'Verified',
  rejected: 'Not accepted',
};
export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Number((bytes / (1024 * 1024)).toFixed(1))} MiB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KiB`;
}
export const scanStatusLabel: Record<NonNullable<EvidenceDocument['scanStatus']>, string> = {
  clean: 'Virus scan: clean',
  not_scanned: 'Not virus-scanned',
};
