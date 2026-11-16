# Phase 1 — approved scope and external test gates

Updated 2026-11-16. This records the owner's decisions, not an assertion that the features are implemented.

## Scope

- Web application and backend reliability/security, existing certificates, purchases, budget planning, tests and deployment preparation.
- Provider/professional recruitment, including review and approval.
- The provider or referrer receives **17% of the VAT-exclusive package sales they bring**. This is a referral commission; it is not a platform fee on the professional's services. Attribution, refunds, disputes, idempotency and payout recovery must be tested.
- Integrated commissions through Stripe Connect, with recipient verification/onboarding. No real charges or transfers are authorised during development.
- Professional signing through **Yousign/Youtrust in sandbox**, at advanced or qualified level. An internal certificate/HMAC or a browser success redirect is not evidence of external signing. Tenant-specific professional access, immutable document binding, provider status verification and retained signed documents/audit evidence remain implementation and acceptance requirements.
- Preserve all newly introduced Phase 1 data without automatic purging. Existing retention jobs must not indirectly delete new evidence through cascading foreign keys. Production deletion is outside this work.
- Native applications remain preserved with development suspended.

## External prerequisites

The owner confirmed the Stripe reference account and authorised the CLI browser flow. The subsequent local `stripe whoami --format json` still reports `authenticated: false`. Separate development and CI sandboxes have **not** been provisioned; no test credential or successful external Connect transfer is claimed.

The owner selected Yousign/Youtrust sandbox and needs to create an account. Stripe Projects catalog search for `yousign` returned zero services, so it cannot provision that account. Use the provider's [account setup guide](https://developers.youtrust.com/docs/set-up-your-account). The documented API trial is 40 days and the sandbox API base is `https://api-sandbox.yousign.app/v3`. AES sandbox access requires provider support activation; QES requires the corresponding add-on. Confirm actual availability before claiming either level works. No paid subscription has been authorised.

Credentials belong in server-side secrets, never source control, browser bundles, logs or chat. Sandbox signing is a test and must not be displayed as a legally effective production signature.

## Completed increment: current compliance authority

Compliance endpoints now check the persisted user role and organisation on every request in addition to the JWT and Enterprise entitlement. An old manager token loses export/report/audit access immediately after demotion or organisation transfer. Authorised evidence responses use `Cache-Control: no-store`.

Validation: three dedicated unit cases, the existing compliance-evidence suite (25 targeted tests total), backend TypeScript, and the disposable PostgreSQL domain/budget integration suite (11 scenarios, including stale-role and stale-tenant rejection). The complete backend suite also passed: 58 suites, 749 tests (327.604 seconds). `npm run build` passed; backend ESLint reported zero errors and five existing warnings in unrelated files. No production database was changed.

The overall Phase 1 is still open until recruitment, Connect commissions, external AES/QES signing, preservation/visibility controls and their end-to-end acceptance checks are implemented and verified. PR #78 remains a draft; no merge or production deployment is implied.
