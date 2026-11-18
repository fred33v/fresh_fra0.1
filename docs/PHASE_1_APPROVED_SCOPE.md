# Phase 1 — approved scope and external test gates

Updated 2026-11-16. This records the owner's decisions, not an assertion that the features are implemented.

## Scope

- Web application and backend reliability/security, existing certificates, purchases, budget planning, tests and deployment preparation.
- Provider/professional recruitment, including review and approval.
- The provider or referrer receives **17% of the VAT-exclusive package sales they bring**. This is a referral commission; it is not a platform fee on the professional's services. Attribution, refunds, disputes, idempotency and payout recovery must be tested.
- Integrated commissions through Stripe Connect, with recipient verification/onboarding. No real charges or transfers are authorised during development.
- The owner has now requested an **internal electronic-signing service**, replacing OpenSign and the earlier provider options. This implementation covers email OTP, consent, typed signatures, a hash-chained audit trail and a platform PDF seal. It does not establish advanced/qualified eIDAS signer identity. See [implementation and activation](ESIGN_SETUP.md).
- Preserve all newly introduced Phase 1 data without automatic purging. Existing retention jobs must not indirectly delete new evidence through cascading foreign keys. Production deletion is outside this work.
- Native applications remain preserved with development suspended.

## External prerequisites

The owner confirmed the Stripe reference account and authorised the CLI browser flow. The subsequent local `stripe whoami --format json` still reports `authenticated: false`. Separate development and CI sandboxes have **not** been provisioned; no test credential or successful external Connect transfer is claimed.

The current plan is the internal signing module described in [ESIGN_SETUP.md](ESIGN_SETUP.md). The owner confirmed that a P12/PFX seal and dedicated S3 Object Lock bucket still need to be configured and requested step-by-step guidance. The feature defaults to disabled. No paid provider account or real production signature is authorised. An internal platform seal must not be labelled an advanced/qualified signer signature.

Credentials belong in server-side secrets, never source control, browser bundles, logs or chat. Sandbox signing is a test and must not be displayed as a legally effective production signature.

## Completed increment: current compliance authority

Compliance endpoints now check the persisted user role and organisation on every request in addition to the JWT and Enterprise entitlement. An old manager token loses export/report/audit access immediately after demotion or organisation transfer. Authorised evidence responses use `Cache-Control: no-store`.

Validation: three dedicated unit cases, the existing compliance-evidence suite (25 targeted tests total), backend TypeScript, and the disposable PostgreSQL domain/budget integration suite (11 scenarios, including stale-role and stale-tenant rejection). The complete backend suite also passed: 58 suites, 749 tests (327.604 seconds). `npm run build` passed; backend ESLint reported zero errors and five existing warnings in unrelated files. No production database was changed.

The overall Phase 1 is still open until recruitment, Connect commissions, the agreed signature assurance and real-service activation, preservation/visibility controls and their end-to-end acceptance checks are implemented and verified. PR #78 remains a draft; no merge or production deployment is implied.
