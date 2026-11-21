import { describe, expect, it } from '@jest/globals';
import {
  agreementTermsSchema,
  prepareAgreementSchema,
  engagementReadySchema,
} from '../src/providers/agreement-policy.js';
const terms = {
  operatorName: 'Example Ltd',
  operatorAddress: '10 Example Road, London',
  signatoryName: 'Company Signer',
  signatoryEmail: 'COMPANY@example.test',
  scope: 'Individually agreed assignments.',
  paymentTerms: 'Payment after accepted referrals; reconcile refunds before payment.',
  expenses: 'Written preapproval required.',
  confidentiality: 'Use confidential information only for agreed services.',
  dataHandling: 'Agreed access and incident responsibilities.',
  termination: 'Thirty days written notice.',
  governingLaw: 'England and Wales courts.',
  arrangementsReview: 'Actual proposed arrangements reviewed separately.',
};
describe('Independent agreement policy', () => {
  it('requires reviewed explicit terms and normalises only the email', () => {
    expect(agreementTermsSchema.parse(terms).signatoryEmail).toBe('company@example.test');
    expect(agreementTermsSchema.safeParse({ ...terms, paymentTerms: '' }).success).toBe(false);
    expect(agreementTermsSchema.safeParse({ ...terms, commissionRate: 5 }).success).toBe(false);
  });
  it('requires both human confirmations and expected application/replacement revisions', () => {
    const body = {
      version: 2,
      previousAgreementId: null,
      terms,
      termsReviewed: true,
      statusReviewed: true,
    };
    expect(prepareAgreementSchema.safeParse(body).success).toBe(true);
    for (const patch of [
      { version: 0 },
      { previousAgreementId: 'unknown' },
      { termsReviewed: false },
      { statusReviewed: false },
      { termsReviewed: undefined },
    ])
      expect(prepareAgreementSchema.safeParse({ ...body, ...patch }).success).toBe(false);
  });
  it('does not accept readiness without explicit contract/status review and a note', () => {
    const body = {
      version: 2,
      agreementId: '57e94fd2-6b74-4aae-b399-ac4f806773db',
      reviewNote: 'Agreement and arrangements checked.',
      contractReviewed: true,
      statusReviewed: true,
    };
    expect(engagementReadySchema.safeParse(body).success).toBe(true);
    for (const patch of [
      { contractReviewed: false },
      { statusReviewed: false },
      { reviewNote: 'ok' },
      { ready: true },
    ])
      expect(engagementReadySchema.safeParse({ ...body, ...patch }).success).toBe(false);
  });
  it('rejects unsupported PDF text and bounds contract clauses', () => {
    expect(
      agreementTermsSchema.safeParse({ ...terms, scope: 'Unsupported emoji 🔒' }).success
    ).toBe(false);
    expect(agreementTermsSchema.safeParse({ ...terms, scope: 'A'.repeat(4001) }).success).toBe(
      false
    );
  });
});
