export interface CandidateProfile {
  fullName: string;
  businessName: string;
  country: string;
  kind: 'professional' | 'referrer' | 'both';
  website: string;
  expertise: string[];
  experience: string;
  engagement?: IndependentEngagement;
}
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
export function independentForm(profile: CandidateProfile): CandidateProfile {
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
export function independentDeclarationsReady(profile: CandidateProfile): boolean {
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
