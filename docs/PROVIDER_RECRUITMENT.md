# Provider recruitment

This feature extends the existing application intake. It preserves applications and signing evidence.

## Operating flow

1. A verified personal account opens `/provider-application`, chooses sales, training or both, and submits company details. Training applicants must describe their experience. Identity is taken from the verified account, not supplied in the request. Duplicate applications are rejected.
2. A verified administrator in the operator organisation opens `/provider-review`. Configure `PROVIDER_REVIEW_ORGANISATION_ID` on the backend to that organisation UUID. An unset value denies reviewer access. Administrators at applicant companies cannot review applications, and nobody can review their own application.
3. The reviewer verifies company details, credentials and a training demonstration where applicable. Record the evidence and a reason. The decision reason is visible to the applicant; detailed qualification evidence stays with reviewers.
4. Prepare a legally approved agreement appropriate to the relationship using the existing electronic-signing workflow. This feature does not select an employment classification or generate contract terms. Record the completed document UUID. Approval checks completed retained signing evidence in the operator organisation and a signed participant matching both the applicant snapshot and the current verified account email. Missing evidence blocks approval. Existing signing configuration and live service checks remain prerequisites.
5. Approval issues an unpredictable provider reference. It is an identifier, not a bearer credential or customer access key. The authenticated approved provider receives package work offers through their account. The reviewer chooses an active catalogue package, service and unique work reference. Training-only providers cannot receive sales work and vice versa.
6. Providers accept or refuse an offered assignment once. Staff can cancel an offer or accepted assignment, or mark accepted work completed with a reason. Completing work does not confirm a sale or customer payment. Suspension atomically cancels outstanding offers/accepted work and blocks further decisions and offers. Reapproval needs agreement and qualification checks again.
7. Reviews and assignment decisions are recorded in an append-only audit table. Current identity is checked within the write transaction. Row locking serializes assignment decisions with suspension; application revisions reject stale review forms.

The review queue has pages of 50. Applicant and reviewer assignment lists show the latest 200 assignments; audit API returns the first 500 events. References to existing agreements must be obtained through the existing signing API; this feature does not add a document authoring screen.

## Financial boundary

The application explains the agreed 17% VAT-exclusive referral rate. Recruitment approval, a provider reference, assignment acceptance and work completion do **not** calculate a commission, verify a sale, transfer funds or grant access to customer records. Sales attribution, a reconciled commission ledger, refunds/disputes, bank/payout onboarding and actual payments remain a separate financial implementation. Bank details are not collected by these recruitment forms.

## Deployment and verification

- Apply the normal migration runner, including `037_provider_applications.sql` and `038_provider_recruitment.sql`, after the normal database backup and staging checks. No production migration is run by this change.
- Set the reviewer organisation; retain existing electronic signing configuration and operator access.
- On a disposable local PostgreSQL database after migrations, run:

  ```sh
  PROVIDER_TEST_DATABASE=1 node --import tsx scripts/provider-recruitment-integration.mjs
  ```

  Run from `apps/fra-backend/backend` with `DATABASE_URL` set to that disposable database. The script refuses non-local databases and production mode. It uses retained signing fixtures without external email, object uploads or payments. It covers account verification, cross-organisation denial, self-review, agreement identity, qualification checks, stale revisions/roles, concurrent assignment decisions, service eligibility, completion, suspension and audit immutability. CI runs it in the PostgreSQL job after migrations.
- Frontend interactions are covered by `ProviderRecruitment.test.tsx` (submission, acceptance, reviewer denial and approval evidence).
- Live signed-agreement generation and retention must still be checked using the existing signing deployment process. Passing fixtures is not proof of live email/S3 readiness.
