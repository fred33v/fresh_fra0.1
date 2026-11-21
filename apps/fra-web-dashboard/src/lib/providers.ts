import type { ProviderAgreement } from './providerAgreements';
export type ProviderStatus = 'submitted' | 'under_review' | 'approved' | 'rejected' | 'suspended';
export interface ProviderProfile {
  fullName: string;
  businessName: string;
  country: string;
  kind: 'professional' | 'referrer' | 'both';
  website: string;
  expertise: string[];
  experience: string;
  engagement?: IndependentEngagement;
}
export interface ProviderHistory {
  id: string;
  version: number;
  event: string;
  actorRole: string;
  createdAt: string;
  profile: ProviderProfile;
  contactEmail: string;
  status: ProviderStatus;
  message: string | null;
  engagementReviewed?: boolean;
  engagementVersion?: string | null;
}
export interface ProviderApplication {
  id: string;
  profile: ProviderProfile;
  contactEmail: string;
  status: ProviderStatus;
  version: number;
  commissionBasisPoints: number;
  termsVersion: string;
  submittedAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  reviewMessage: string | null;
  payoutsActive: boolean;
  independentEngagementComplete?: boolean;
  history?: ProviderHistory[];
  agreements?: ProviderAgreement[];
  agreementProgress?: Pick<ProviderAgreement, 'state' | 'signedCount' | 'signerCount'> | null;
}
export const providerStatusLabels: Record<ProviderStatus, string> = {
  submitted: 'Submitted',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Changes needed',
  suspended: 'Suspended',
};
export const providerKindLabels = {
  professional: 'Professional services',
  referrer: 'Package referrals',
  both: 'Services and referrals',
};
export const providerExpertiseLabels: Record<string, string> = {
  fraud_prevention: 'Fraud prevention',
  risk_assessment: 'Risk assessment',
  training: 'Training',
  investigation: 'Investigation',
};
export const availableReviews: Record<ProviderStatus, ProviderStatus[]> = {
  submitted: ['under_review', 'approved', 'rejected'],
  under_review: ['approved', 'rejected'],
  approved: ['suspended'],
  rejected: [],
  suspended: ['under_review', 'approved', 'rejected'],
};
export const emptyProviderProfile: ProviderProfile = {
  fullName: '',
  businessName: '',
  country: 'GB',
  kind: 'both',
  website: '',
  expertise: [],
  experience: '',
};

export interface IndependentEngagement {
  model: 'independent_no_minimum';
  formVersion: 'independent-engagement-2026-11-v1';
  legalStructure:
    | ''
    | 'sole_trader'
    | 'limited_company'
    | 'partnership'
    | 'limited_liability_partnership';
  companyNumber: string;
  businessAddress: { line1: string; line2: string; city: string; postalCode: string };
  vatRegistered: '' | 'yes' | 'no';
  vatNumber: string;
  availability: string;
  declineAssignments: '' | 'yes' | 'no' | 'not_sure';
  deliveryControl: '' | 'self' | 'client' | 'shared' | 'not_sure';
  otherClients: '' | 'yes' | 'no' | 'not_sure';
  personalService: '' | 'required' | 'substitution_by_agreement' | 'not_sure';
  declarationName: string;
  noMinimumAccepted: boolean;
  commissionAccepted: boolean;
  informationAccurate: boolean;
}
export function independentForm(profile: ProviderProfile): ProviderProfile {
  const old = profile.engagement;
  return {
    ...profile,
    engagement: {
      legalStructure: '',
      companyNumber: '',
      businessAddress: { line1: '', line2: '', city: '', postalCode: '' },
      vatRegistered: '',
      vatNumber: '',
      availability: '',
      declineAssignments: '',
      deliveryControl: '',
      otherClients: '',
      personalService: '',
      ...old,
      model: 'independent_no_minimum',
      formVersion: 'independent-engagement-2026-11-v1',
      declarationName: '',
      noMinimumAccepted: false,
      commissionAccepted: false,
      informationAccurate: false,
    },
  };
}
export function independentDeclarationsReady(profile: ProviderProfile): boolean {
  const e = profile.engagement;
  const normalise = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB');
  return (
    !!e &&
    e.noMinimumAccepted &&
    e.commissionAccepted &&
    e.informationAccurate &&
    !!e.declarationName.trim() &&
    normalise(e.declarationName) === normalise(profile.fullName)
  );
}
