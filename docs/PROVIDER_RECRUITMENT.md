# Provider recruitment

This feature extends the existing application intake. It preserves applications and signing evidence.

## Operating flow

1. A verified personal account opens `/provider-application`, chooses sales, training or both, and submits company details. Training applicants must describe their experience. Identity is taken from the verified account, not supplied in the request. Duplicate applications are rejected.
2. A verified administrator in the operator organisation opens `/provider-review`. Configure `PROVIDER_REVIEW_ORGANISATION_ID` on the backend to that organisation UUID. An unset value denies reviewer access. Administrators at applicant companies cannot review applications, and nobody can review their own application.
3. The reviewer verifies company details, credentials and a training demonstration where applicable. Record the evidence and a reason. The decision reason is visible to the applicant; detailed qualification evidence stays with reviewers.
4. Prepare a legally approved agreement appropriate to the relationship using the existing electronic-signing workflow. This feature does not select an employment classification or generate contract terms. Title the document "Provider agreement …" (the title is frozen once sent) and make the applicant its only signer. Record the completed document UUID. Approval checks completed retained signing evidence in the operator organisation, with that title and no other signer, and a signed participant matching both the applicant snapshot and the current verified account email. Missing evidence blocks approval. Existing signing configuration and live service checks remain prerequisites.
5. Approval issues an unpredictable provider reference. It is an identifier, not a bearer credential or customer access key. The authenticated approved provider receives package work offers through their account. The reviewer chooses an active catalogue package, service and unique work reference. Training-only providers cannot receive sales work and vice versa.
6. Providers accept or refuse an offered assignment once. Staff can cancel an offer or accepted assignment, or mark accepted work completed with a reason. Completing work does not confirm a sale or customer payment. Suspension atomically cancels outstanding offers/accepted work and blocks further decisions and offers. Reapproval needs agreement and qualification checks again.
7. Reviews and assignment decisions are recorded in an append-only audit table. Current identity is checked within the write transaction. Row locking serializes assignment decisions with suspension; application revisions reject stale review forms.

The review queue has pages of 50. Applicant and reviewer assignment lists show the latest 200 assignments; audit API returns the first 500 events. References to existing agreements must be obtained through the existing signing API; this feature does not add a document authoring screen.

## Sales attribution, commission and payout records

Checkout accepts an optional provider reference. Attribution is fixed in the purchase-creation transaction, before opening Stripe Checkout, and cannot be edited later. The provider must be approved for sales, have a current verified account and an accepted/completed sales assignment for that package. Self-referrals (same person or organisation) are refused. A pending checkout cannot be reassigned to a different provider. Commission attribution is unavailable for simulated payments.

After the existing payment lifecycle verifies Stripe's payment amount, currency and identity, commission entries are committed in the same database transaction as the payment state. The rate is snapshotted at 1,700 basis points (17%). The target is the VAT-exclusive sale value times 17%, reduced proportionally for successful gross refunds, rounded once to integer pennies. Disputed payments have a zero target until cleared. Reconciliation appends only the difference from the previous target, so retries do not earn twice and refund/dispute history is preserved.

Example: £1,000 excluding VAT (£1,200 including VAT) earns £170. A £600 gross refund reduces it to £85. A dispute holds the remaining £85; winning restores it. A full refund reverses all commission. If a settlement was already recorded, the negative balance remains visible and reduces future available commission. Past payout history is never rewritten.

The provider's page shows earned, reserved, recorded and available balances, adjustments and settlement references. No customer names, bank details or payment credentials appear in the statement. The review page adds staff payout controls. Financial lists show their latest 200 entries.

### Staff-approved bank settlement workflow

This implementation records manual bank payments. It does not call a bank transfer or Stripe Connect payout API, collect bank account numbers, or claim bank API confirmation. Your finance team uses its established secure bank instructions and banking channel.

1. Configure `PROVIDER_PAYOUTS_ENABLED=true` only after the operator organisation has at least two verified administrators and Stripe reconciliation/webhooks are configured.
2. A reviewer prepares a GBP payout with an idempotency key and reason. The server refreshes the provider's payment state from Stripe and atomically reserves no more than the available commission. GBP is the supported payout-recording currency; other currency balances are reported for finance review.
3. A different current operator reviewer approves it. The server refreshes Stripe again and rejects approval if refunds/disputes reduced the balance. The provider cannot authorise their own payout.
4. Finance sends the bank payment outside this app. A reviewer other than the preparer verifies that payment and records its unique bank reference. “Recorded” is a staff attestation. The server refreshes payment state again and retains the instruction, preparer, approver, recorder and audit history. Repeating the same recorded reference on the same payout is idempotent. A reference cannot be reused for another payout.
5. Cancel prepared/approved instructions when they need correction. Recorded instructions cannot be cancelled, updated or deleted. If money was sent but a refund subsequently blocks recording, stop and reconcile the bank evidence and debt with finance; do not send the payment again.

Concurrent reservations serialize on the provider row. Suspended providers cannot receive newly prepared, approved or recorded settlements. Manual settlement remains subject to refunds that occur after approval; future negative balances are tracked rather than silently erased. Refresh is bounded at 2,000 non-refunded attributed purchases per provider; exceeding the limit blocks payout operations for finance review. This is an operational limit, not permission to skip reconciliation.

Automated payouts through Stripe Connect would require a separately approved account configuration and onboarding process, including agreement on fees, negative balance liability, bank-payout readiness and transfer/reversal recovery. No live Connect accounts or transfers are created by this implementation.

## Deployment and verification

- Apply the normal migration runner, including `037_provider_applications.sql`, `038_provider_recruitment.sql` and `039_provider_commissions.sql`, after the normal database backup and staging checks. No production migration is run by this change.
- Set the reviewer organisation; retain existing electronic signing configuration and operator access.
- On a disposable local PostgreSQL database after migrations, run:

  ```sh
  PROVIDER_TEST_DATABASE=1 node --import tsx scripts/provider-recruitment-integration.mjs
  ```

  Run from `apps/fra-backend/backend` with `DATABASE_URL` set to that disposable database. The script refuses non-local databases and production mode. It uses retained signing fixtures without external email, object uploads or payments. It covers account verification, cross-organisation denial, self-review, agreement identity, qualification checks, stale revisions/roles, concurrent assignment decisions, service eligibility, completion, suspension and audit immutability. CI runs it in the PostgreSQL job after migrations.
- Frontend interactions are covered by `ProviderRecruitment.test.tsx` (submission, acceptance, reviewer denial and approval evidence).
- Live signed-agreement generation and retention must still be checked using the existing signing deployment process. Passing fixtures is not proof of live email/S3 readiness.

### Reviewer configuration and migration preflight

Use the actual operator organisation UUID, not an applicant organisation. No organisation ID or administrator is guessed or automatically promoted. `infra/scripts/setup-ssm-params.sh` now accepts the reviewer organisation and payout-recording flag; backend startup already reads these SSM parameters. Empty inputs preserve existing settings.

After the database snapshot and migration steps in `infra/LAUNCH.md`, run from `apps/fra-backend/backend`:

```sh
pnpm migrate
pnpm build
pnpm providers:check
```

`providers:check` only reads migration versions and counts current verified administrators in the configured operator organisation. It requires one for recruitment or two when payout recording is enabled, and checks Stripe configuration for financial reviews. It prints no database secrets and does not grant roles or send funds. Run it in the target environment where `DATABASE_URL` and `PROVIDER_REVIEW_ORGANISATION_ID` are already configured. Migration execution is a separate write operation; the preflight never runs migrations automatically.

Production migration execution and configuration cannot be certified from fixture tests. They require the real deployment environment, its connection and the chosen operator organisation. Never paste connection secrets into an issue, PR or chat.
