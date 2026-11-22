import { describe, expect, it } from '@jest/globals';
import { providerProfileSchema } from '../src/provider-candidate.js';
const profile = {
  fullName: 'Alex Morgan',
  businessName: 'Example Ltd',
  country: 'GB',
  kind: 'both',
  website: 'https://example.test',
  expertise: ['training'],
  experience: 'Independent training delivery by agreement with customers.',
  engagement: {
    model: 'independent_no_minimum',
    formVersion: 'independent-engagement-2026-11-v1',
    legalStructure: 'sole_trader',
    companyNumber: '',
    businessAddress: {
      line1: '10 Example Road',
      line2: '',
      city: 'London',
      postalCode: 'SW1A 1AA',
    },
    vatRegistered: 'no',
    vatNumber: '',
    availability: 'Weekdays by agreement only.',
    declineAssignments: 'not_sure',
    deliveryControl: 'shared',
    otherClients: 'not_sure',
    personalService: 'substitution_by_agreement',
    declarationName: 'Alex Morgan',
    noMinimumAccepted: true,
    commissionAccepted: true,
    informationAccurate: true,
  },
};
describe('ported independent candidate declaration', () => {
  it('accepts uncertainty for review without classifying tax status', () =>
    expect(providerProfileSchema.parse(profile).engagement.otherClients).toBe('not_sure'));
  it.each(['noMinimumAccepted', 'commissionAccepted', 'informationAccurate'])(
    'requires explicit %s',
    (key) =>
      expect(
        providerProfileSchema.safeParse({
          ...profile,
          engagement: { ...profile.engagement, [key]: false },
        }).success
      ).toBe(false)
  );
  it('requires matching declaration name', () =>
    expect(
      providerProfileSchema.safeParse({
        ...profile,
        engagement: { ...profile.engagement, declarationName: 'Somebody Else' },
      }).success
    ).toBe(false));
  it('requires declared company and VAT details where applicable', () => {
    expect(
      providerProfileSchema.safeParse({
        ...profile,
        engagement: { ...profile.engagement, legalStructure: 'limited_company' },
      }).success
    ).toBe(false);
    expect(
      providerProfileSchema.safeParse({
        ...profile,
        engagement: { ...profile.engagement, vatRegistered: 'yes' },
      }).success
    ).toBe(false);
  });
  it('rejects extra server-owned fields and credential-bearing website URLs', () => {
    expect(providerProfileSchema.safeParse({ ...profile, commissionRate: 2 }).success).toBe(false);
    expect(
      providerProfileSchema.safeParse({ ...profile, website: 'https://user:secret@example.test' })
        .success
    ).toBe(false);
  });
});
