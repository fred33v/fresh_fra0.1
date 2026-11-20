# Phase 1 — Provider and referrer recruitment

The next approved Phase 1 increment after internal signing. This branch is based on the signing UI branch; merge/review it after PR #79 or retarget/rebase when that parent lands. It does not complete Phase 1 or deploy AWS.

## Behaviour

- `/partners`: a verified signed-in account applies as a professional, package referrer or both. No package purchase is required to apply.
- Applications collect a name, business/professional name, country code, optional HTTPS website, relevant areas and proposed experience/contribution. Websites are displayed as text and never fetched by the service. The country and supplied qualifications are claims for review, not identity/KYC verification.
- Contact email comes from the persisted verified account, never the request body. Programme information must be acknowledged. It records the owner's policy: the provider/referrer receives **17% of VAT-exclusive package sales they bring**, not a fee on professional services.
- A submitted application can be revised; one under review is frozen. Rejected applicants can resubmit. Each revision remains in the history.
- `/partners/review`: only explicitly appointed administrators can see the cross-organisation programme queue or record decisions. A current database `admin` role **and** inclusion in server-only `PROVIDER_REVIEWER_IDS` are required; an organisation administrator alone has no global programme access.
- Administrators cannot review their own application. Decisions carry an applicant-visible message and the expected revision. Simultaneous/stale reviews return a conflict instead of overwriting a decision.
- Approval can be suspended and reinstated. This changes programme membership only; all responses keep `payoutsActive: false`.

No bank details, identity document upload, Stripe account creation, commission accrual, referral checkout linkage, charge or transfer is implemented by recruitment. Those remain the separate Connect/commission increment and require separate development/CI sandboxes. No real financial operation is authorised during development.

## Storage and permissions

Forward-only migration `037_provider_recruitment.sql` adds `provider_applications` and `provider_application_events`. Existing migrations 001–036 remain unchanged.

Application updates and their complete version snapshots commit in the same transaction. A failure to append evidence rolls back the application change. Events reject UPDATE, DELETE and TRUNCATE; application deletion/truncation is also refused. Database owners/superusers remain trusted administrators and can bypass database-level controls.

Applicant/reviewer UUIDs and organisation UUIDs are retained snapshots, without cascade references into the legacy user/organisation/payment retention graph. The only new foreign key points from events to their application with RESTRICT. No automatic purge rule is added. Revision and status-transition triggers prevent silently rewriting applicant identity, commission policy or earlier application history.

Every request checks the current persisted account and organisation. Writes lock that identity while checking authority. Demoted/removed reviewers, changed affiliations, unverified accounts and API keys cannot use these routes. Evidence responses use `Cache-Control: no-store`; browser caches are scoped to the current user. Review appointment does not assign an admin role.

## Activation

Apply migration 037 on an isolated test database first. Production schema and data have not been changed during this increment.

```dotenv
PROVIDERS_ENABLED=false
PROVIDER_REVIEWER_IDS=
```

To test locally after migrating, set `PROVIDERS_ENABLED=true` in the backend's private `.env.local`. Set `PROVIDER_REVIEWER_IDS` to the comma-separated UUIDs of the intended **existing** verified administrators; keep it server-side. Empty means nobody can read the programme-wide queue. Restart the backend. No account has been promoted automatically and no new administrator password is supplied by this feature.

The Web dashboard needs its usual `VITE_API_URL` pointing to that backend. Open `/partners`; an appointed administrator sees a Review applications link there. The current email and affiliation are checked again server-side.

## API

| Method | Route under `/api/v1/providers` | Access |
| --- | --- | --- |
| GET | `/me` | Own application/history and programme policy |
| POST | `/me` | Submit/revise own application with `version`, `profile`, `acknowledged: true` |
| GET | `/admin/applications?status=submitted&offset=0` | Appointed current administrator; 25 per page |
| GET | `/admin/applications/:id` | Appointed current administrator; includes self-review restriction |
| POST | `/admin/applications/:id/review` | Appointed non-self reviewer; `version`, `status`, applicant-visible `message`; approval also requires `engagementReviewed: true` |

The server owns status, contact email, 1700 basis points, acknowledgement time and terms version (`provider-programme-2026-11`). Extra fields and invalid state transitions are rejected. The fixed commercial rule is not a payout entitlement or signed service contract.

## Validation

- Pure policy tests cover acknowledgement, server-owned rate/status, website schemes/credentials, profile limits and review requirements.
- React tests cover submission, disabled service, historical visibility, no self-review and confirmation cancellation.
- `scripts/provider-recruitment-integration.mjs` requires `PROVIDER_TEST_DATABASE=1`, loopback PostgreSQL and the dedicated database name `provider_recruitment_test`. It never contacts Stripe, SMTP, AWS or production.
- Nine database scenarios cover gates, private/appointee access, revision preservation, concurrent reviews, suspension/reinstatement, stale authority, resubmission, rollback on injected event failure, duplicate creation and immutable retention boundaries.
- Optional `PROVIDER_BROWSER_TEST=1` adds a real Chromium applicant/reviewer journey against the same real API and PostgreSQL. Only loopback API traffic is forwarded to the isolated API; no API responses are mocked. Fixture JWTs identify verified disposable database users. An optional `PROVIDER_BROWSER_ARTIFACTS` directory captures synthetic screenshots, not passwords/tokens.
- Database CI creates a separate `provider_recruitment_test` database, applies all migrations, runs the scenarios, and runs the browser journey after installing Chromium. Nothing is run on the owner's local application database or Neon production database.

## Remaining Phase 1 financial work

1. Separate Stripe development/CI sandboxes and restricted credentials.
2. Approved-recipient Connect onboarding and verified capability lifecycle.
3. Trusted referral attribution and 17% calculation on VAT-exclusive package revenue.
4. Idempotent commission ledger, refunds/disputes and transfer reversals/recovery.
5. Sandbox end-to-end acceptance, then a separate production readiness decision.

The existing local signing result and owner-approved retention policy remain in force. No purge, live payout, live charge or deployment was performed here.


## Owner-confirmed independent model and candidate forms — 19 November 2026

The owner clarified the intended model as **independent services, with no guaranteed minimum work or income**, paid by the existing **17% VAT-exclusive referred-package-sales** rule. It is not a payroll zero-hours employment contract. This records the intended commercial arrangement, not a legal determination about any individual.

New/revised applications require:

- Business legal structure; company/LLP registration number where applicable; business correspondence address and declared VAT registration/number.
- Availability and factual proposed arrangements: ability to decline assignments, control over delivery method, other clients and personal-service/substitution arrangements. Uncertainty is accepted for human discussion and never converted into an automatic status verdict.
- Separate acknowledgements of no guaranteed minimum, the 17% referral basis and accuracy, plus a typed declaration name matching the application name.

No bank details, National Insurance number or personal UTR are requested by the forms. The VAT field records a claim, not verification, and a candidate's own invoice VAT is separate from the VAT-exclusive package-revenue basis. The forms are an application declaration, not an executed services agreement or a qualified signature.

The actual working arrangement still needs appropriate employment-rights/tax consideration before engagement. GOV.UK distinguishes tax status from employment-rights status; HMRC's CEST guidance addresses a specific actual/expected engagement. The application does not replace either assessment: [self-employed and contractor status](https://www.gov.uk/employment-status/selfemployed-contractor), [HMRC CEST guidance](https://www.gov.uk/guidance/check-employment-status-for-tax).

Versioned data is stored in `profile.engagement` (`model: independent_no_minimum`, `formVersion: independent-engagement-2026-11-v1`) and the existing retained revision snapshots. Migration 037 already provides the JSON storage; no applied migration is rewritten and no extra migration/backfill is needed. Legacy records remain readable with an explicit missing-forms notice. Missing forms block new approval; the reviewer requests a revision rather than fabricating historical declarations or erasing an earlier decision.

Approval now also requires an explicit reviewer acknowledgement of reading the independent-engagement information. Its version and reviewer confirmation are retained in the approval event. This acknowledgement is administrative review, not tax-status determination or contract execution. Programme approval and completed forms still leave payouts inactive.

Validation was extended to incomplete/contradictory declarations, matching names, conditional company/VAT details, legacy read/resubmission and approval gates. The real-browser journey fills the new candidate forms and records reviewer acknowledgement against the isolated real API/PostgreSQL.

Before financial activation, review the actual working arrangements and applicable employment/tax status, and execute the appropriate services agreement. Candidate declarations and programme approval do not complete these steps.

## Agreement preparation handover

Both the applicant and appointed reviewer can download a private, current-revision text dossier from the application detail. It includes candidate declarations, missing-form notices, application/revision references, and the confirmed no-minimum/17% referral basis. It preserves uncertainty and does not invent legacy declarations. No network request, external share or server-side document is created by this download. The local file contains personal/business information and must be shared only with authorised reviewers.

The preparation checklist identifies actual working-arrangement/status review, agreement of outstanding contract terms, preparation/review of a separate contract PDF, signing and verification of the retained PDF. It does not claim these steps are complete, generate a contract, or link an application to a signing record. An approved contract can use the existing Documents & signing workflow separately. The separate [linked agreement workflow](PHASE_1_PROVIDER_AGREEMENTS.md) now implements agreement preparation, signing linkage and explicit administrative readiness. The preparation dossier itself remains a summary, not a contract. Stripe integration is sequenced last at the owner's request.
