export type ProviderStatus = 'submitted' | 'under_review' | 'approved' | 'rejected' | 'suspended';
export interface ProviderProfile {
  fullName: string;
  businessName: string;
  country: string;
  kind: 'professional' | 'referrer' | 'both';
  website: string;
  expertise: string[];
  experience: string;
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
  history?: ProviderHistory[];
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
