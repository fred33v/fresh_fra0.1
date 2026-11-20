# Phase 1 — approved scope and external test gates

Updated 2026-11-19. This records the owner's decisions, not an assertion that the features are implemented.

## Scope

- Web application and backend reliability/security, existing certificates, purchases, budget planning, tests and deployment preparation.
- Provider/professional recruitment, including review and approval.
- The provider or referrer receives **17% of the VAT-exclusive package sales they bring**. This is a referral commission; it is not a platform fee on the professional's services. Attribution, refunds, disputes, idempotency and payout recovery must be tested.
- **Owner clarification, 19 November 2026:** the intended engagement is independent services with no guaranteed minimum assignments, hours or income. It is not the payroll zero-hours employment model. Candidates must supply independent-engagement forms; declarations do not determine employment/tax status. The 17% VAT-exclusive referred-package-sales rule remains unchanged.
- Integrated commissions through Stripe Connect, with recipient verification/onboarding. No real charges or transfers are authorised during development.
- The owner has now requested an **internal electronic-signing service**, replacing OpenSign and the earlier provider options. This implementation covers email OTP, consent, typed signatures, a hash-chained audit trail and a platform PDF seal. It does not establish advanced/qualified eIDAS signer identity. See [implementation and activation](ESIGN_SETUP.md).
- Preserve all newly introduced Phase 1 data without automatic purging. Existing retention jobs must not indirectly delete new evidence through cascading foreign keys. Production deletion is outside this work.
- Native applications remain preserved with development suspended.

## Implementation order

Owner instruction, 19 November 2026: defer Stripe onboarding, commission payment integration and external financial tests until the end. Continue the non-financial candidate and signing preparation first. This changes sequencing, not the agreed 17% VAT-exclusive referral rule.

## External prerequisites

The owner confirmed the Stripe reference account and authorised the CLI browser flow. The subsequent local `stripe whoami --format json` still reports `authenticated: false`. Separate development and CI sandboxes have **not** been provisioned; no test credential or successful external Connect transfer is claimed.

The current plan is the internal signing module described in [ESIGN_SETUP.md](ESIGN_SETUP.md). The owner configured a development P12 seal and the London bucket `fresh-fra-s`, with versioning, Object Lock and blocked public access. On 17 November the owner verified actual email-code signing, completed status, exact-version S3 download, COMPLIANCE retention, legal hold ON, matching SHA-256 and OpenSSL CMS verification on their Mac. The feature defaults to disabled. No paid provider account or real production signature is authorised. An internal platform seal must not be labelled an advanced/qualified signer signature.

Credentials belong in server-side secrets, never source control, browser bundles, logs or chat. Sandbox signing is a test and must not be displayed as a legally effective production signature.

## Completed increment: current compliance authority

Compliance endpoints now check the persisted user role and organisation on every request in addition to the JWT and Enterprise entitlement. An old manager token loses export/report/audit access immediately after demotion or organisation transfer. Authorised evidence responses use `Cache-Control: no-store`.

Validation: three dedicated unit cases, the existing compliance-evidence suite (25 targeted tests total), backend TypeScript, and the disposable PostgreSQL domain/budget integration suite (11 scenarios, including stale-role and stale-tenant rejection). The complete backend suite also passed: 58 suites, 749 tests (327.604 seconds). `npm run build` passed; backend ESLint reported zero errors and five existing warnings in unrelated files. No production database was changed.

The overall Phase 1 is still open until recruitment, Connect commissions, the agreed signature assurance and real-service activation, preservation/visibility controls and their end-to-end acceptance checks are implemented and verified. PR #78 was merged into main after the owner requested it. PR #79 adds the signing UI, logo and guarded local account access; it remains a draft. These changes do not imply production deployment.


## Next increment resumed — 19 November 2026

The Phase 0 baseline was reread and PR #69 was confirmed merged. The signing workflow remains preserved and AWS deployment stays deferred at the owner's request.

Provider/professional recruitment is implemented on `feat/phase1-provider-recruitment` as the next Phase 1 increment: verified-account applications, retained revision history, explicitly appointed administrator reviews, no self-review, revision-safe decisions, rejection/resubmission and suspension/reinstatement. Migration 037 is additive, the module defaults to disabled, and no new evidence is included in an automatic purge rule. See [provider recruitment](PHASE_1_PROVIDER_RECRUITMENT.md) for validation and activation details.

The 17% VAT-exclusive referral policy is recorded as 1700 basis points. **No commission has been earned, calculated, attributed or paid by this increment.** Stripe Connect onboarding, checkout attribution, reversal/recovery handling and sandbox end-to-end commission validation remain the next financial increment. Programme approval is not Stripe verification or qualification verification, and payouts remain inactive.

## Candidate agreement and administrative follow-up — 20 November 2026

The owner requested continuation through approved candidate → reviewed services agreement → linked signing → explicit administrative readiness. This is implemented with additive migration 038, two fixed signatories, immutable revision links, current-account/application gates and retained final-evidence verification. Programme approval alone never implies signing/readiness. No Stripe integration or payment activation was performed. See [candidate agreements](PHASE_1_PROVIDER_AGREEMENTS.md) for workflow, limitations and local activation.
