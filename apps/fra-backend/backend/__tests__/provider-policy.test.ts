import { describe, expect, it } from '@jest/globals';
import {
  providerSubmissionSchema,
  hasCompleteIndependentEngagement,
  providerReviewSchema,
  PROVIDER_COMMISSION_BPS,
  reviewTransitions,
} from '../src/providers/policy.js';
const engagement = {
  model: 'independent_no_minimum',
  formVersion: 'independent-engagement-2026-11-v1',
  legalStructure: 'sole_trader',
  companyNumber: '',
  businessAddress: {
    line1: '10 Example Street',
    line2: '',
    city: 'London',
    postalCode: 'SW1A 1AA',
  },
  vatRegistered: 'no',
  vatNumber: '',
  availability: 'Available for independently agreed assignments on weekdays.',
  declineAssignments: 'yes',
  deliveryControl: 'self',
  otherClients: 'yes',
  personalService: 'substitution_by_agreement',
  declarationName: 'Alex Morgan',
  noMinimumAccepted: true,
  commissionAccepted: true,
  informationAccurate: true,
};
const valid = {
  version: 0,
  profile: {
    fullName: 'Alex Morgan',
    engagement,
    businessName: 'Example Professional',
    country: 'gb',
    kind: 'both',
    website: 'https://example.test',
    expertise: ['training'],
    experience: 'We support organisations with fraud training and appropriate package referrals.',
  },
  acknowledged: true,
};
describe('provider programme policy', () => {
  it('records the owner-defined 17% VAT-exclusive referral rate and explicit acknowledgement', () => {
    expect(PROVIDER_COMMISSION_BPS).toBe(1700);
    expect(providerSubmissionSchema.parse(valid).profile.country).toBe('GB');
    expect(providerSubmissionSchema.safeParse({ ...valid, acknowledged: false }).success).toBe(
      false
    );
    expect(
      providerSubmissionSchema.safeParse({
        ...valid,
        commissionBasisPoints: 9999,
        status: 'approved',
      }).success
    ).toBe(false);
  });
  it.each([
    'not-a-url',
    'https://',
    'javascript:alert(1)',
    'http://example.test',
    'https://owner:password@example.test',
  ])('rejects unsafe website %s', (website) => {
    expect(
      providerSubmissionSchema.safeParse({ ...valid, profile: { ...valid.profile, website } })
        .success
    ).toBe(false);
  });
  it('requires experience, unique areas and valid recipient details without collecting payout secrets', () => {
    expect(
      providerSubmissionSchema.safeParse({
        ...valid,
        profile: { ...valid.profile, experience: 'Too short' },
      }).success
    ).toBe(false);
    expect(
      providerSubmissionSchema.safeParse({
        ...valid,
        profile: { ...valid.profile, expertise: ['training', 'training'] },
      }).success
    ).toBe(false);
    expect(
      providerSubmissionSchema.safeParse({
        ...valid,
        profile: { ...valid.profile, bankAccount: '123' },
      }).success
    ).toBe(false);
  });
  it('requires a current revision and an applicant-visible review message', () => {
    expect(
      providerReviewSchema.safeParse({ version: 0, status: 'approved', message: 'Reviewed' })
        .success
    ).toBe(false);
    expect(
      providerReviewSchema.safeParse({ version: 1, status: 'approved', message: '' }).success
    ).toBe(false);
    expect(reviewTransitions.approved).toEqual(['suspended']);
    expect(reviewTransitions.rejected).toEqual([]);
  });
});

describe('independent engagement candidate forms', () => {
  it('requires the new forms without inventing legacy answers or a signed contract', () => {
    const parsed = providerSubmissionSchema.parse(valid);
    expect(hasCompleteIndependentEngagement(parsed.profile)).toBe(true);
    const legacy = { ...valid.profile };
    delete (legacy as { engagement?: unknown }).engagement;
    expect(hasCompleteIndependentEngagement(legacy)).toBe(false);
    expect(providerSubmissionSchema.safeParse({ ...valid, profile: legacy }).success).toBe(false);
  });
  it.each([
    { noMinimumAccepted: false },
    { commissionAccepted: false },
    { informationAccurate: false },
    { declarationName: 'Someone Else' },
    { legalStructure: 'limited_company', companyNumber: '' },
    { vatRegistered: 'yes', vatNumber: '' },
    { vatRegistered: 'no', vatNumber: 'GB1234' },
    { businessAddress: { line1: '', line2: '', city: 'London', postalCode: '' } },
  ])('rejects incomplete or contradictory candidate information %j', (patch) => {
    expect(
      providerSubmissionSchema.safeParse({
        ...valid,
        profile: { ...valid.profile, engagement: { ...engagement, ...patch } },
      }).success
    ).toBe(false);
  });
  it('accepts factual uncertainty without automatically determining self-employment and requires reviewer confirmation', () => {
    expect(
      providerSubmissionSchema.safeParse({
        ...valid,
        profile: {
          ...valid.profile,
          engagement: {
            ...engagement,
            otherClients: 'no',
            declineAssignments: 'not_sure',
            deliveryControl: 'shared',
          },
        },
      }).success
    ).toBe(true);
    expect(
      providerReviewSchema.safeParse({
        version: 1,
        status: 'approved',
        message: 'Reviewed the information.',
      }).success
    ).toBe(false);
    expect(
      providerReviewSchema.safeParse({
        version: 1,
        status: 'approved',
        message: 'Reviewed the information.',
        engagementReviewed: true,
      }).success
    ).toBe(true);
    expect(
      providerSubmissionSchema.safeParse({
        ...valid,
        profile: {
          ...valid.profile,
          engagement: { ...engagement, model: 'zero_hours_employment' },
        },
      }).success
    ).toBe(false);
  });
});

it('accepts declared registered-business and VAT details without treating them as verified', () => {
  const result = providerSubmissionSchema.parse({
    ...valid,
    profile: {
      ...valid.profile,
      engagement: {
        ...engagement,
        legalStructure: 'limited_liability_partnership',
        companyNumber: 'OC123456',
        vatRegistered: 'yes',
        vatNumber: 'GB123456789',
      },
    },
  });
  expect(result.profile.engagement.companyNumber).toBe('OC123456');
  expect(result.profile.engagement.vatNumber).toBe('GB123456789');
  expect(result.profile.engagement.model).toBe('independent_no_minimum');
});
