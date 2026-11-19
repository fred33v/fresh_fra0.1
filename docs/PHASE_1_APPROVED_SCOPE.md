# Phase 1 — approved scope and external test gates

Updated 2026-11-19. This records the owner's decisions and verified implementation status, not production acceptance.

## Scope

- Web application and backend reliability/security, existing certificates, purchases, budget planning, tests and deployment preparation.
- Provider/professional recruitment, including review and approval.
- The provider or referrer receives **17% of the VAT-exclusive package sales they bring**. This is a referral commission; it is not a platform fee on the professional's services. Attribution, refunds, disputes, idempotency and payout recovery must be tested.
- The owner accepted staff-approved manual bank settlement records on 18 November, replacing automated Stripe Connect payouts in this increment. Finance sends the bank payment separately. A different operator reviewer approves and records it; the preparer cannot approve or record. No real charges or transfers are authorised during development.
- The owner has now requested an **internal electronic-signing service**, replacing OpenSign and the earlier provider options. This implementation covers email OTP, consent, typed signatures, a hash-chained audit trail and a platform PDF seal. It does not establish advanced/qualified eIDAS signer identity. See [implementation and activation](ESIGN_SETUP.md).
- Preserve all newly introduced Phase 1 data without automatic purging. Existing retention jobs must not indirectly delete new evidence through cascading foreign keys. Production deletion is outside this work.
- Native applications remain preserved with development suspended.

## External prerequisites

The earlier Stripe CLI probe reported `authenticated: false`. It is historical evidence, not the current target environment's status. No automated Connect onboarding or transfer is part of the accepted manual-settlement increment. Actual payment/refund/dispute webhook delivery and target configuration remain to be verified before activation.

The current signing module is described in [ESIGN_SETUP.md](ESIGN_SETUP.md). PR #78 records owner-reported local real-service acceptance on 17 November: invitation/OTP email, completed signing, exact-version S3 retention and PDF seal verification using a development certificate. The retained audit checkpoint was not independently rechecked during the manual recovery. Deployed HTTPS/proxy checks, a production-appropriate certificate, database ownership separation and target rollout remain open. The feature defaults to disabled. An internal platform seal must not be labelled an advanced/qualified signer signature.

Credentials belong in server-side secrets, never source control, browser bundles, logs or chat. Sandbox signing is a test and must not be displayed as a legally effective production signature.

## Completed increment: current compliance authority

Compliance endpoints now check the persisted user role and organisation on every request in addition to the JWT and Enterprise entitlement. An old manager token loses export/report/audit access immediately after demotion or organisation transfer. Authorised evidence responses use `Cache-Control: no-store`.

Validation: three dedicated unit cases, the existing compliance-evidence suite (25 targeted tests total), backend TypeScript, and the disposable PostgreSQL domain/budget integration suite (11 scenarios, including stale-role and stale-tenant rejection). The complete backend suite also passed: 58 suites, 749 tests (327.604 seconds). `npm run build` passed; backend ESLint reported zero errors and five existing warnings in unrelated files. No production database was changed.

PR #78 (signing/reliability) and PR #86 (provider recruitment, attribution, commission ledger and manual settlement records, including review fixes #88–#91) are merged. Main at `75f5f17efede3f49acebba5236ec8db771d6eb83` passed CI, including PostgreSQL and browser fixture checks: [run 44571587118](https://github.com/fred33v/fresh_fra0.1/actions/runs/44571587118).

Final Phase 1 acceptance remains open: verify the target migration history through 039, the real operator organisation and two verified reviewers, deployed HTTPS, payment/refund/dispute webhook delivery, and the retained signing checkpoint. Run the documented read-only preflights in that configured environment. Passing local/CI fixtures is not production verification. See [provider rollout](PROVIDER_RECRUITMENT.md) and [continuation work](PHASE_2_3_CONTINUATION.md).
