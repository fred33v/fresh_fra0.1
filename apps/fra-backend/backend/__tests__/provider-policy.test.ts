import { describe, expect, it } from '@jest/globals';
import {
  providerSubmissionSchema,
  providerReviewSchema,
  PROVIDER_COMMISSION_BPS,
  reviewTransitions,
} from '../src/providers/policy.js';
const valid = {
  version: 0,
  profile: {
    fullName: 'Alex Morgan',
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
  it.each(['javascript:alert(1)', 'http://example.test', 'https://owner:password@example.test'])(
    'rejects unsafe website %s',
    (website) => {
      expect(
        providerSubmissionSchema.safeParse({ ...valid, profile: { ...valid.profile, website } })
          .success
      ).toBe(false);
    }
  );
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
