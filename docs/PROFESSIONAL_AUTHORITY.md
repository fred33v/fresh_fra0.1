# Professional subject authority

This additive increment follows the candidate-only #95 port. Migration **042** keeps main #86's provider applications, assignments, commission ledger and payment reconciliation. It adds platform authority to deliver and assess the existing Fraud Risk Awareness course, and issue its **learner completion** certificates. It does not award external professional accreditation, create an employment agreement, change payroll, or authorize payments.

## Workflow

1. The verified applicant submits the existing training/both provider application and completes its agreement workflow. Global provider approval remains a separate prerequisite.
2. On `/provider-application`, open **Manage professional scopes**. Select the real course/version, request explicit rights and provide qualifications, experience and demonstration evidence references. A request confers no authority.
3. An independently authenticated current administrator in `PROVIDER_REVIEW_ORGANISATION_ID` opens `/provider-review`. Review the application and agreement, then open its professional scopes. Record the qualification and demonstration checks, reason, explicit rights, start and expiry dates, and evidence confirmation. Self-approval is rejected. This is a human verification record; it does not automatically validate uploaded qualifications with an external awarding body.
4. Offer a **training** package assignment with the approved subject scope selected. The assignment permanently captures that scope revision. The professional accepts it through the existing application page.
5. In **Open professional training console** (`/professional-training`), create a class using the accepted scoped assignment. Share the existing learner Workshop link/code with entitled learners. The trainer is not promoted to a general internal facilitator role.
6. The console shows attendance, server quiz result, missing sections/quizzes and completion status. A trainer with `assess` records an approval/rejection and reason for each learner. Approval requires the server's completed sections and passing quiz result; it captures a hash of the exact progress reviewed. The console is a completion review, not an external competency accreditation examination.
7. A trainer with `issue_completion` separately issues the learner certificate. The server rechecks current provider, subject, action, expiry, accepted assignment, session ownership, learner membership, verified identity, no self-certification, exact approved assessment revision and unchanged completed progress. Concurrent assessment submissions use optimistic revision checks and serialized locking. A scope review or audit failure rolls back atomically.
8. The existing certificate registry stores immutable professional-authority provenance privately (scope/application/session/assignment/assessment/issuer), plus public course/version, trainer name and provider reference. Public certificate details exclude the private identifiers. Repeated issuance preserves the canonical existing course certificate; it never rewrites a historic self-study certificate to claim professional delivery. The PDF labels course completion, not professional accreditation.

Only the existing `fraud-risk-awareness` / `2026-10-30` curriculum is seeded. Adding a new subject requires a migration and an implemented curriculum/completion policy; typing arbitrary subject names into a form cannot authorize another qualification.

## Authority changes and evidence

Every scope request/review, class creation, completion assessment and new professional certificate issuance appends to the per-application hash chain in `professional_audit`. Reviewers can read and verify it at `GET /api/v1/professional/applications/:id/audit`. Database triggers reject event updates, deletion and truncation. This detects changes relative to the retained chain/head; it is not an independently anchored ledger against a database owner who can disable triggers and recompute all hashes.

Suspension, revocation, expiry, inactive subject, changed provider application revision, changed verified provider email/organisation, or a cancelled assignment blocks future affected actions. Reapproval increments the scope revision: create a new scoped assignment and class. It does not silently reactivate an old class. Revocation is terminal for that grant. Existing unscoped assignments remain visible and retain their history, but cannot start a new professional class.

Previously issued certificates and immutable snapshots remain retained. A scope change does not automatically revoke learner certificates; use the existing explicit certificate-revocation workflow if justified. Legacy internal facilitator and legitimate self-study completion paths remain supported. Provider-session provenance remains attached to progress even if legacy session retention clears `session_id`, preventing that progress becoming unscoped completion evidence.

This increment reuses existing verified-account/admin authority. It does not implement MFA enrollment/enforcement, regulated professional accreditation, qualification-provider verification, or the remaining employment/payroll requirements of the broader Hire, Sell & Earn specification.

## Local activation

Back up the local database first. If it contains PR94's conflicting 037/038 schema, follow `PROVIDER_CANDIDATE_PORT.md` and run the one-off reconcile dry run before applying anything. Do not delete old migration receipts or rename already applied SQL migrations.

From `apps/fra-backend/backend`, with the existing private local environment loaded:

```sh
npm run migrate
npm run dev
```

From the repository root, in a second terminal:

```sh
VITE_API_URL=http://localhost:3080 npm --prefix apps/fra-web-dashboard run dev
```

Keep secrets out of Git. Use two separate verified accounts (candidate and operator reviewer) for the workflow above. The existing signed-agreement checks remain required; a scope form cannot bypass them. No local Mac database, cloud service or production data was changed by the isolated implementation tests.

## Verification

The disposable PostgreSQL integration script requires `PROFESSIONAL_TEST_DATABASE=1`, a loopback URL whose database name contains `professional`, and non-production mode. Apply all migrations to that empty isolated database before running:

```sh
PROFESSIONAL_TEST_DATABASE=1 node --import tsx scripts/professional-scope-integration.mjs
```

It exercises current operator/provider authorization, self-approval denial, atomic audit failure rollback, explicit subject/version, accepted scoped assignments, self-certification denial, incomplete/stale work, concurrent assessments, issuance/private provenance/public filtering, audit verification and immutability, suspension/expiry, changed provider identity, retained progress context and normal self-study. It uses local signed-evidence fixtures, not SMTP/S3 calls or live payments. CI runs it against a dedicated database, alongside the unchanged main recruitment/commission integration suite.

Validated locally on 21 November 2026 against PostgreSQL 17:

- Fresh migrations through 042; 7 grouped professional-authority integration scenarios.
- Existing main recruitment/commission suite: 98 checks; candidate port: 3 scenarios, including unchanged accounting fingerprints.
- Existing certificate lifecycle integration: 11 scenarios, including real Chromium PDF rendering and transactional rollback; the new professional-completion PDF was also rendered successfully.
- Targeted backend suites: 112 existing tests plus 10 new authority-policy tests.
- Full Web suite: 772 tests across 70 files; the targeted provider/professional UI suites also passed after the final interface refinements.
- Root build: 5/5 tasks; backend and Web TypeScript checks pass. Lint has no errors (5 existing unrelated warnings in each application).
- Actual development server: `/health` reports database `ok`; unauthenticated access to the new subject API returns HTTP 401.

These results validate the implementation in the disposable test environment. They do not record migration or deployment of the owner's Mac or production services.
