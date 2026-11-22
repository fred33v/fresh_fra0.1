import { scopeReviewSchema, scopeRequestSchema } from '../src/professional-policy.js';
const approval = {
  revision: 1,
  status: 'approved',
  reason: 'Human review completed',
  actions: ['deliver', 'assess', 'issue_completion'],
  validFrom: new Date(Date.now() - 60000).toISOString(),
  validUntil: new Date(Date.now() + 86400000).toISOString(),
  qualificationCheck: 'Original evidence verified',
  demonstrationCheck: 'Delivery demonstration reviewed',
  checksConfirmed: true,
};
describe('professional approval boundaries', () => {
  it.each([
    'actions',
    'validFrom',
    'validUntil',
    'qualificationCheck',
    'demonstrationCheck',
    'checksConfirmed',
  ])('does not approve without %s', (key) => {
    const value = { ...approval, [key]: undefined };
    expect(scopeReviewSchema.safeParse(value).success).toBe(false);
  });
  it('requires assessment authority explicitly when issuance is requested', () => {
    expect(
      scopeReviewSchema.safeParse({ ...approval, actions: ['deliver', 'issue_completion'] }).success
    ).toBe(false);
  });
  it('rejects expired and backwards validity windows', () => {
    expect(
      scopeReviewSchema.safeParse({
        ...approval,
        validUntil: new Date(Date.now() - 1000).toISOString(),
      }).success
    ).toBe(false);
    expect(
      scopeReviewSchema.safeParse({
        ...approval,
        validFrom: new Date(Date.now() + 172800000).toISOString(),
      }).success
    ).toBe(false);
  });
  it('does not accept a forged approval in the candidate request', () => {
    expect(
      scopeRequestSchema.safeParse({
        subjectId: 'fraud-risk-awareness',
        subjectVersion: '2026-10-30',
        revision: 0,
        actions: ['deliver'],
        evidence: 'Evidence submitted for human review',
        status: 'approved',
      }).success
    ).toBe(false);
  });
  it('allows a reasoned suspension without manufacturing fresh qualification checks', () => {
    expect(
      scopeReviewSchema.safeParse({
        revision: 2,
        status: 'suspended',
        reason: 'Evidence requires reassessment',
      }).success
    ).toBe(true);
  });
});
