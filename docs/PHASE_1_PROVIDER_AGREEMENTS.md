# Candidate agreements and administrative follow-up

Implemented 20 November 2026 on `feat/phase1-provider-recruitment`, following the owner's instruction to complete recruitment → agreement → signing → administrative follow-up before Stripe. This is not production deployment or payment activation.

## Workflow

1. A verified account completes the independent-engagement forms at `/partners`. An explicitly appointed administrator reviews the application. Approval is programme membership only.
2. On `/partners/review/:id`, the reviewer prepares a services agreement against that **approved application revision**. The form requires the organisation's legal name/address, a separate authorised organisation signatory, services/assignment scope and any service fees, payment timing/referral attribution/refunds/disputes, expenses, confidentiality, data handling, termination and governing law/jurisdiction. An applicant-visible working-arrangement/status review summary and two explicit reviewer confirmations are required.
3. The server creates a PDF with the fixed owner policy: independent services, no guaranteed minimum assignments/hours/income, and **17% of VAT-exclusive package sales brought by the provider/referrer**. No commercial fee is calculated or accrued by this module. Contract clauses are supplied by the reviewer, not invented defaults. The form and generated PDF need appropriate contract/status review for the actual engagement; a checkbox does not establish legal validity or worker/tax status.
4. A retained agreement record binds the PDF's SHA-256, application revision/snapshot, reviewed terms, reviewer and timestamp. The PDF and its two signer identities are immutable, including while still a draft. The candidate's recorded verified account email is used. The organisation signatory must have a different email. Authority is affirmed by the reviewer, not independently verified by the software.
5. Open the linked PDF in **Documents & signing**. Review the prepared PDF and the two pre-positioned signature fields; adjust the fields if necessary, save them and explicitly send invitations. Merely preparing the agreement sends no email. Both parties use the existing email-code, review, consent and signature flow. The platform seal is not an advanced/qualified signer identity.
6. Once both signatures and PDF sealing complete, the application shows **Signed · administrative review needed**. An appointed non-self reviewer supplies an applicant-visible review note and confirms contract and engagement/status review. The server verifies the exact retained PDF and manifest versions, SHA-256, audit chain/checkpoint, COMPLIANCE retention and legal hold ON. Only then is a separate immutable readiness record added.
7. The administration queue shows agreement progress separately from the programme decision. If both signatures are collected but storage/sealing failed, the detail shows **Signatures collected · PDF sealing pending** and the sender can retry finalisation. The candidate and administrator see **Engagement ready**, the review note/date, signature counts and the linked final-PDF download. Candidate access is limited to their own retained agreement; it does not grant manager or cross-tenant signing access. Downloads verify evidence again. **Payouts remain inactive.**

## Changes, suspension and preservation

Only the latest agreement for the current approved application revision can proceed. Suspended applications, changed candidate email/verification/affiliation, superseded agreements and changed application revisions block invitations/signing and current readiness. Reinstatement creates a new application revision and requires a new agreement; earlier signatures/reviews remain historical evidence, not current readiness.

Drafts, declined agreements, expired invitations and agreements from an earlier application revision can be replaced by an explicitly prepared retained agreement. Concurrent replacements require the expected previous agreement ID and application revision; only one wins. An active signing round or completed agreement for the current revision cannot be silently replaced. Retry the existing finalisation if sealing/storage failed.

Migration `038_provider_agreements.sql` is additive. It introduces retained agreement links and immutable readiness reviews with RESTRICT foreign keys to retained provider/e-sign records, without cascade references into legacy users/organisations/payment purges. No automatic purge is added. Database owners/superusers remain trusted administrators. The detail panel currently returns the latest 20 agreements; all older rows remain retained. The latest agreement progress also appears in the programme review queue.

## API and authority

All routes are below `/api/v1/providers`, require `PROVIDERS_ENABLED=true`, a verified persisted account and `Cache-Control: no-store`. Administrative operations require current `admin` role and explicit `PROVIDER_REVIEWER_IDS` appointment. No self-preparation/readiness is permitted. Agreement creation also requires `ESIGN_ENABLED=true`.

- `POST /admin/applications/:id/agreements`: `{version, previousAgreementId: UUID|null, terms, termsReviewed:true, statusReviewed:true}`. Creates draft PDF, signers, fields, linked snapshot and e-sign audit entries atomically. The draft belongs to the preparing reviewer's organisation; normal e-sign tenant checks still apply.
- `GET /admin/applications/:id/agreements`: agreement lifecycle, whether this reviewer can prepare, and document IDs manageable within their own organisation.
- `POST /admin/applications/:id/engagement-ready`: `{version,agreementId,reviewNote,contractReviewed:true,statusReviewed:true}`. Protected evidence must verify. Repeating the same validation does not overwrite its first retained note/reviewer.
- `GET /me`: includes the candidate's agreement summaries; administrative detail includes the same summaries.
- `GET /me/agreements/:agreementId/final`: own linked completed agreement only.
- `GET /admin/applications/:id/agreements/:agreementId/final`: appointed reviewer, exact application/agreement binding.

Generic signing routes never grant additional tenant access. Linked agreement sending/resending additionally requires an appointed reviewer, current candidate account and current approved revision. Signer access also checks the current agreement/application. A generic organisation manager cannot send the linked agreement merely because it belongs to their organisation. Evidence remains downloadable for the authorised candidate/reviewer after suspension; it is not deleted.

## Local activation and verification

Apply migrations to an isolated database first; restart the backend. Existing private signing configuration is reused: OTP secret, email, public signing origin, P12 seal and dedicated versioned S3 Object Lock bucket. The application IAM identity needs exact-object read plus retention/legal-hold read permissions for the final PDF and manifest. No resource, credential or production migration was created by this change.

`node --import tsx scripts/provider-agreements-integration.mjs` requires `PROVIDER_TEST_DATABASE=1`, non-production mode, loopback PostgreSQL and the dedicated database name `provider_recruitment_test`. It exercises real API/authentication, transactions, PDF creation, both OTP/consent decisions and CMS sealing with a generated test certificate. SMTP capture and S3 command responses are explicit memory doubles; no external email/AWS/Stripe call is made. OpenSSL independently verifies the resulting CMS signature and full PDF byte-range coverage.

With `PROVIDER_BROWSER_TEST=1`, a running loopback dashboard and installed Chromium, the same script additionally fills the agreement form, sends invitations through Documents & signing, completes both browser signer journeys, records administrative readiness and downloads the candidate's final PDF. Only loopback API traffic is forwarded to the real disposable API; responses are not mocked. The workflow is included in the database/browser CI gate.

Production agreement signing against the owner's actual SMTP/S3 and legal review of the chosen clauses remain activation checks. Stripe remains the final financial increment.

## Verification recorded for this increment

- Root `npm run build`: 5 successful tasks out of 5.
- Frontend: all 71 suites / 788 tests passed; TypeScript checks passed. ESLint reports no errors and five pre-existing warnings outside this change.
- Backend focused provider/agreement/e-sign policy suites: 3 suites / 30 tests passed; TypeScript passed; ESLint has no errors and five pre-existing warnings.
- Agreement integration: 9 scenarios passed, including real Chromium preparation/sending, both signer browser journeys, administrative readiness, candidate download, transaction rollback, stale identity/revision/suspension controls, sealing retry, protected evidence checks and independent OpenSSL CMS verification.
- All agreement service tests use isolated local PostgreSQL, captured email and an S3 command double. Actual SMTP/S3 production delivery and deployment are not claimed by these tests.
