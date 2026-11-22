# Keep main #86; port only the missing candidate workflow from #94

Checked 21 November 2026 against `origin/main` commit `75f5f17` (merged PR #86) and PR #94 commit `c5ad479`. Work branch: `feat/provider-candidate-port`, based directly on main. **Do not merge PR #94's competing provider module or migrations into main.** Keep it as a reference for the port and the old local schema.

## Confirmed comparison

Main already implements verified provider applications and operator-organisation review, qualification/agreement checks, approval/decline/reopening/suspension, provider codes, package assignments and acceptance/refusal, seller attribution, the 17% VAT-exclusive commission ledger, refunds/dispute holds, statements and separately approved manual-bank payout records. A recorded bank reference is staff attestation, not independent bank API confirmation. Connect automation is not present and is not added by this port.

Main's `provider-recruitment.ts`, `provider-commissions.ts`, payment routes/lifecycle, signing service and migrations 001–039 remain unchanged. In particular, keep the main approval requirement: a completed retained **Provider agreement …** document signed only by the applicant. Do not replace it with #94's two-party agreement/readiness model, reviewer UUID allowlist, separate `/partners` backend, alternate status vocabulary or a second commission implementation.

Only these deltas are ported into the existing `/provider-application` and `/provider-review` screens and `/api/v1/provider-applications` API:

1. **Independent candidate declaration.** Optional additional profile: name, company, country, website, claimed experience, business structure/address/VAT, availability, working-arrangement facts and explicit no-minimum/17%/accuracy acknowledgements. Uncertainty is allowed for discussion. Declared details are not identity/qualification/tax verification and never alter the commission calculation. Existing applications are not retroactively classified as independent or forced to supply declarations.
2. **Amend and resubmit.** Only submitted/declined applicants can amend. Server-side identity and expected revision are rechecked under locks. Submitted snapshots are retained; an amendment returns to submitted and clears stale review/evidence references. Approved/suspended providers cannot amend this way, so active assignment/sale/payment identity stays stable. Existing operator reopening remains available. A supplied independent declaration cannot silently be dropped and its acknowledgements must be reaffirmed in the edit form.
3. **Agreement preparation dossier and revision visibility.** Applicant and authorised operator reviewer can download a private text dossier with current declared details, revision history and preparation guidance. It is **not** a contract, a signature, an approval or a payment confirmation. Review decisions remain in the existing audit. Candidate downloads redact internal reviewer IDs and private qualification-verification notes; banking details are not added.

## Forward-only schema changes

- `040_provider_candidate_profile.sql`: nullable `candidate_profile` on main's existing application table.
- `041_provider_candidate_amendments.sql`: retained revision snapshots and a guard against changing identities or amending an active approved/suspended provider.

No migration 037 or 038 is renamed or redefined to pretend both branches shared a schema. No commission, attribution, assignment or payout table is replaced. Existing 037–039 receipts must represent actual execution of those canonical files.

### Added API surface

- Existing `POST /me` accepts optional `candidateProfile`; existing request bodies and 201 response remain valid.
- `POST /me/amend`: same application fields plus expected `revision`; only submitted/declined applications.
- `GET /me/revisions`, `GET /:id/revisions`: own or current authorised operator-reviewer access.
- `GET /me/dossier`, `GET /:id/dossier`: scoped no-store text attachments.

The existing review, assignment, statement, checkout, reconciliation and payout routes retain their behaviour and authority checks. The independent form does not grant trainer approval, certificates, access codes or financial eligibility.

## One-off reconciliation for a local DB that applied PR94

The owner's Mac previously applied **037_provider_recruitment.sql** and **038_provider_agreements.sql** from PR94. Canonical main instead uses **037_provider_applications.sql**, **038_provider_recruitment.sql**, **039_provider_commissions.sql**. The filenames and table shapes conflict. Merely switching branches and running migrate is unsafe; the runner now recognises PR94's `user_id/profile` shape and stops before applying main's provider migrations.

The one-off `scripts/reconcile-pr94-local.mjs` defaults to inspection and permits only a non-production, direct loopback database named `fresh_fra_esign_dev` (or its explicit development suffix). It rejects remote URLs, mismatched direct URLs, mixed canonical/legacy schemas and any existing main accounting tables in the PR94 layout. It never selects an AWS project, touches S3, sends email, creates a reviewer or grants approval.

### What apply actually does

1. Require other database/application clients to be stopped and take the same migration advisory lock as the normal runner.
2. Create a private custom-format **whole-database pg_dump backup** under backend `.local/provider-reconcile/` (ignored by Git, directory 0700/file 0600).
3. In one transaction, move the four old PR94 provider application/event/agreement/readiness tables and associated functions to **pr94_legacy**, preserving their rows, foreign keys and immutability triggers. Remove only PR94's two extra triggers on shared e-sign tables. Common main signing/audit guards and all document bytes, signer decisions, S3 references and signing audit remain unchanged.
4. Preserve an exact copy of the old migration receipts in that archive; retain the original public receipt names/timestamps. Execute canonical 037–039 and new 040–041 SQL, then record their actual filenames. Never fabricate applied receipts or erase old history.
5. Check archived row counts before commit; no old approvals, qualification checks, assignments or financial entitlements are inferred. A failure rolls back the schema changes. A rerun on canonical main is a no-op and directs the operator to the normal migration runner.

**Important:** old PR94 candidate/contract records remain in the read-only application archive, not in the new UI. No automatic semantic import is performed: #94's `professional/both` and prior approval/signing model do not map reliably to main's reviewed training/sales model. The inspection prints counts before applying. If those records must be active in the main UI, plan and review a separate explicit mapping/import after inspecting the archive; do not recreate an old approval or invent trainer authority. Historical signed PDFs remain in the unchanged signing service/S3.

### Guided Mac sequence — inspect before apply

Fetch/switch to the replacement port branch only after checking the current worktree is clean. Keep the existing private local environment/certificate files. Stop backend and other DB clients before actual reconciliation.

From `/Users/fred/Desktop/fresh_fra_esign/apps/fra-backend/backend`:

```bash
npm run providers:reconcile-local
```

This is a **dry run**. Review the schema identification and all row counts first. Do not run apply on a production database or change migration receipts by hand.

For a reviewed plan on that same dedicated local database, with Homebrew PostgreSQL 17:

```bash
PG_DUMP="$(brew --prefix postgresql@17)/bin/pg_dump" npm run providers:reconcile-local -- --apply
npm run migrate
```

Keep the printed private backup path. To restore, use pg_restore into a **separate empty local database** and verify it before considering any cutover; never drop the current database or overwrite it automatically. Backups contain personal data and must not be uploaded to chat/GitHub. Ordinary canonical main databases need only the normal `npm run migrate`, not this one-off.

Use main's existing `PROVIDER_REVIEW_ORGANISATION_ID`; do not copy #94's reviewer-UUID flag. Preserve existing payout configuration and do not enable live payments for this test. This work has **not** changed or reconciled the owner's Mac database remotely.

## Verification

- The unmodified main recruitment/commission integration script retains its 98 checks, including attribution, refunds/disputes, replay handling, tenant/current-role restrictions and separate bank payout approval.
- Added candidate integration covers optional forms, expected revisions/concurrent amendments, declined resubmission, immutable old snapshots, rollback, scoped dossier access and reviewer-ID redaction. Financial table fingerprints must stay identical across these new candidate operations.
- The isolated `provider-reconcile-integration.mjs` builds the exact old PR94 schema from test fixtures, tests dry run and migration refusal, creates a real pg_dump, restores it into a separate disposable database and compares old records/signing references, then checks the archive, actual canonical receipts and no-op rerun.
- Pure candidate-policy and Web form tests supplement the existing commission-math/reconciliation and recruitment screen tests. Both normal forward migrations and the one-off legacy path are tested separately.
- No live charge, payout, email, S3 operation or deployment is part of these checks. This port does not claim the expanded Hire, Sell & Earn scope, MFA, payroll, public intake or professional accreditation is complete.

### Local verification recorded

- Main's unmodified provider/commission integration: **98 checks passed**.
- Added candidate API/PostgreSQL scenarios: **3 passed**, including identical fingerprints for existing attribution, commission, assignment and payout data.
- One-off reconciliation: real custom-format backup **restored into a separate disposable database**, original application/signing references compared, canonical receipts and archived evidence checked, normal-runner refusal and idempotent rerun verified.
- Web suite: **69 files, 767 tests passed**; focused candidate and existing commission suites: **3 suites, 25 tests passed**.
- Backend/Web TypeScript and lint passed (zero errors; existing warnings); root build **5/5 tasks successful**. CI YAML and script syntax checked.

Only dedicated disposable loopback databases were changed for these checks. The owner's Mac database and all external services remain untouched.

## Explicit professional-authority gap

A [source-backed follow-up finding](PROFESSIONAL_SCOPE_GAP.md) confirms that main does not model approval by training subject/professional scope or connect such approval to certificate authority. Existing qualification notes, facilitator roles and learner completion certificates are not substitutes. Existing learner eligibility/revocation controls do exist; the missing model is professional permission/provenance. This remains outside #95 and must be resolved before claiming the expanded professional-onboarding/certification acceptance criteria are met.
