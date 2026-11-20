export interface AgreementTerms {
  operatorName: string;
  operatorAddress: string;
  signatoryName: string;
  signatoryEmail: string;
  scope: string;
  paymentTerms: string;
  expenses: string;
  confidentiality: string;
  dataHandling: string;
  termination: string;
  governingLaw: string;
  arrangementsReview: string;
}
export interface ProviderAgreement {
  id: string;
  documentId: string;
  applicationVersion: number;
  createdAt: string;
  terms: AgreementTerms;
  sourceSha256: string;
  current: boolean;
  matchingRevision: boolean;
  documentStatus: 'draft' | 'sent' | 'declined' | 'completed';
  expired: boolean;
  signedCount: number;
  signerCount: number;
  ready: boolean;
  readyAt: string | null;
  reviewNote: string | null;
  state:
    | 'superseded'
    | 'blocked'
    | 'candidate_changed'
    | 'revision_changed'
    | 'ready'
    | 'signed_pending_review'
    | 'sealing_pending'
    | 'expired'
    | 'draft'
    | 'sent'
    | 'declined';
  payoutsActive: false;
}
export const agreementStateLabels: Record<ProviderAgreement['state'], string> = {
  draft: 'Agreement prepared',
  sent: 'Awaiting signatures',
  declined: 'Agreement declined',
  expired: 'Invitation expired',
  sealing_pending: 'Signatures collected · PDF sealing pending',
  signed_pending_review: 'Signed · administrative review needed',
  ready: 'Engagement ready',
  superseded: 'Previous agreement retained',
  blocked: 'Engagement blocked by programme status',
  candidate_changed: 'Candidate account changed · review required',
  revision_changed: 'Application revision changed · new agreement needed',
};
export const agreementTermFields: Array<{
  key: keyof AgreementTerms;
  label: string;
  max: number;
  short?: boolean;
}> = [
  { key: 'operatorName', label: 'Contracting organisation legal name', max: 160, short: true },
  { key: 'operatorAddress', label: 'Contracting organisation address', max: 500 },
  { key: 'signatoryName', label: 'Authorised organisation signatory name', max: 120, short: true },
  {
    key: 'signatoryEmail',
    label: 'Authorised organisation signatory email',
    max: 254,
    short: true,
  },
  { key: 'scope', label: 'Services, assignments and any professional service fees', max: 4000 },
  {
    key: 'paymentTerms',
    label: 'Payment timing, referral attribution, refunds and disputes',
    max: 2000,
  },
  { key: 'expenses', label: 'Expenses and approval rules', max: 2000 },
  { key: 'confidentiality', label: 'Confidentiality terms', max: 3000 },
  { key: 'dataHandling', label: 'Data handling and responsibilities', max: 3000 },
  { key: 'termination', label: 'Termination and notice terms', max: 2000 },
  { key: 'governingLaw', label: 'Governing law and jurisdiction', max: 500 },
  {
    key: 'arrangementsReview',
    label: 'Working-arrangement and status review summary (visible to candidate)',
    max: 2000,
  },
];
export const emptyAgreementTerms = Object.fromEntries(
  agreementTermFields.map((f) => [f.key, ''])
) as unknown as AgreementTerms;
