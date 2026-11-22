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
export const evidenceLimits = { minBytes: 8, maxBytes: 524288, maxFiles: 10 };
export const evidenceStatusLabel: Record<EvidenceStatus, string> = {
  pending: 'Awaiting review',
  verified: 'Verified',
  rejected: 'Not accepted',
};
export const kibibytes = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KiB`;
