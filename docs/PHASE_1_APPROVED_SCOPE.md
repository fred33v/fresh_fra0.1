# Phase 1 — approved scope and external test gates

Updated 2026-11-16. This records the owner's decisions, not an assertion that the features are implemented.

## Scope

- Web application and backend reliability/security, existing certificates, purchases, budget planning, tests and deployment preparation.
- Provider/professional recruitment, including review and approval.
- The provider or referrer receives **17% of the VAT-exclusive package sales they bring**. This is a referral commission; it is not a platform fee on the professional's services. Attribution, refunds, disputes, idempotency and payout recovery must be tested.
- Integrated commissions through Stripe Connect, with recipient verification/onboarding. No real charges or transfers are authorised during development.
- Professional signing through an external provider, at advanced or qualified level. The owner has withdrawn the Yousign/Youtrust choice and requested Documenso or DocuSeal; DocuSeal EU is the recommended candidate, pending account and feature verification. An internal certificate/HMAC or a browser success redirect is not evidence of external signing. Tenant-specific professional access, immutable document binding, provider status verification and retained signed documents/audit evidence remain implementation and acceptance requirements.
- Preserve all newly introduced Phase 1 data without automatic purging. Existing retention jobs must not indirectly delete new evidence through cascading foreign keys. Production deletion is outside this work.
- Native applications remain preserved with development suspended.

## External prerequisites

The owner confirmed the Stripe reference account and authorised the CLI browser flow. The subsequent local `stripe whoami --format json` still reports `authenticated: false`. Separate development and CI sandboxes have **not** been provisioned; no test credential or successful external Connect transfer is claimed.

The owner changed the provider requirement to Documenso or DocuSeal. No Youtrust account creation is required for the current plan. Stripe Projects searches for both candidates returned zero services; account setup must use the provider's documented path.

[DocuSeal Test Mode](https://www.docuseal.com/resources/use-test-mode) provides isolated API/embedding tests. Its [AES/QES documentation](https://www.docuseal.com/resources/sign-with-qes-or-aes) requires the EU Cloud Pro offer and additional signature charges; some trust providers require support activation. General sandbox access does not establish that AES/QES identity-provider flows can be tested without payment. Confirm that capability before claiming an end-to-end advanced/qualified signature. DocuSeal EU is recommended for the integration; no paid subscription or signature charge is authorised.

[Documenso's self-hosted CSC transport](https://docs.documenso.com/docs/self-hosting/configuration/signing-certificate/csc-qes) supports AES/QES through a separate trust service provider and requires an Enterprise licence. A default self-hosted installation is not evidence of qualified signing.

Credentials belong in server-side secrets, never source control, browser bundles, logs or chat. Sandbox signing is a test and must not be displayed as a legally effective production signature.

## Completed increment: current compliance authority

Compliance endpoints now check the persisted user role and organisation on every request in addition to the JWT and Enterprise entitlement. An old manager token loses export/report/audit access immediately after demotion or organisation transfer. Authorised evidence responses use `Cache-Control: no-store`.

Validation: three dedicated unit cases, the existing compliance-evidence suite (25 targeted tests total), backend TypeScript, and the disposable PostgreSQL domain/budget integration suite (11 scenarios, including stale-role and stale-tenant rejection). The complete backend suite also passed: 58 suites, 749 tests (327.604 seconds). `npm run build` passed; backend ESLint reported zero errors and five existing warnings in unrelated files. No production database was changed.

The overall Phase 1 is still open until recruitment, Connect commissions, external AES/QES signing, preservation/visibility controls and their end-to-end acceptance checks are implemented and verified. PR #78 remains a draft; no merge or production deployment is implied.
