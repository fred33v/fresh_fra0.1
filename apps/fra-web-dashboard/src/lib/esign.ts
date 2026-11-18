export type SigningStatus = 'draft' | 'sent' | 'completed' | 'declined';
export interface Signer {
  id: string;
  name: string;
  email: string;
  status: 'pending' | 'signed' | 'declined';
  signed_at: string | null;
  invitation_sent_at: string | null;
}
export interface SigningField {
  signerId: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  kind: 'signature' | 'name' | 'date';
}
export interface SigningDocument {
  id: string;
  title: string;
  status: SigningStatus;
  pages: { width: number; height: number }[];
  signers: Signer[];
  fields: (Omit<SigningField, 'signerId'> & { signer_id: string })[];
  createdAt: string;
  expiresAt: string | null;
}
export interface DocumentSummary {
  id: string;
  title: string;
  status: SigningStatus;
  created_at: string;
  expires_at: string | null;
  signer_count: number;
  signed_count: number;
}
export const signingStatusLabels: Record<SigningStatus, string> = {
  draft: 'Draft',
  sent: 'Awaiting signatures',
  completed: 'Completed',
  declined: 'Declined',
};
export function validateLayout(
  fields: SigningField[],
  signers: Signer[],
  pages: SigningDocument['pages']
): string | null {
  if (!signers.length) return 'Add at least one recipient.';
  if (fields.length > 200) return 'A document can contain up to 200 fields.';
  for (const field of fields) {
    const page = pages[field.page];
    if (
      !page ||
      !signers.some((s) => s.id === field.signerId) ||
      ![field.x, field.y, field.width, field.height, field.page].every(Number.isFinite) ||
      !Number.isInteger(field.page) ||
      field.x < 0 ||
      field.y < 0 ||
      field.width < 40 ||
      field.height < 20 ||
      field.x + field.width > page.width ||
      field.y + field.height > page.height
    )
      return 'Keep every field inside its page (minimum 40 × 20 points).';
  }
  if (signers.some((s) => !fields.some((f) => f.signerId === s.id && f.kind === 'signature')))
    return 'Place a signature field for every recipient.';
  return null;
}
export const signingPath = (id: string) => `/api/v1/esign/documents/${encodeURIComponent(id)}`;
