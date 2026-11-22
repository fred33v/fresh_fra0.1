# Employee, supplier and provider identifier lifecycle

Migration **043**, after #95/#96, adds a retained identifier register to the existing provider module. It preserves the canonical provider application, original referral code, assignments and commission ledger.

| Reference                                   | Creation                                                                                                                                                     | Meaning                                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `EMP-` + 32 hexadecimal characters          | Current operator reviewer explicitly verifies employment and supplies a retained, completed `Employment agreement …` signed by that current verified account | Administrative employee relationship reference; not a payroll record, employment-status determination or login credential |
| `SUP-` + 32 hexadecimal characters          | Existing canonical provider approval; also backfilled for existing provider references                                                                       | Supplier relationship reference; no inferred employee status or automatic professional scope                              |
| Existing `PRV-` + 32 hexadecimal characters | Existing provider approval mechanism, unchanged                                                                                                              | Original provider sales reference; preserved exactly                                                                      |

References are globally unique, permanently bound to their original user/organisation, and never reassigned. There is at most one employee reference per user/organisation and one supplier/provider-code reference per provider application. Revocation is terminal; replacement/rotation and a separate re-employment relationship workflow are not implemented. IDs do not grant roles, login access or professional certification authority.

## Controls and history

Verified current administrators in `PROVIDER_REVIEW_ORGANISATION_ID` can suspend, reactivate or permanently revoke references, with a required reason and expected revision. They cannot issue their own employee ID or control their own reference. Revoked references cannot be reactivated. Reactivation requires a current verified account and, for provider references, a currently approved provider. Employee reactivation also rechecks the retained employment-agreement binding. The employment verification is a staff attestation with retained signing evidence, not an external legal or payroll verification service.

Provider application suspension automatically suspends active supplier and PRV references and records why, when and who. Reapproval only lifts suspensions whose source was that application. It never lifts an existing manual suspension or revocation. A manually suspended reference must be explicitly reactivated by an independent reviewer. Repeated/stale decisions conflict rather than overwriting history.

Both supplier and PRV references must be active for new provider sales attribution, new assignment offers/acceptance and current professional session authority. Suspending either therefore pauses these provider activities; restoring one does not bypass suspension of the other. Provider status, verified identity, package assignment, professional scope and learner eligibility checks still apply separately.

Historical sales, already attributed purchases, payment reconciliation and earned commission entries are not erased or recalculated merely because an identifier is disabled. Previously initiated customer payments may still settle through the existing payment workflow. Identifier control does not itself cancel external checkouts, revoke account login sessions or invalidate previously issued learner certificates. Employee identifiers currently serve the administrative register; they do not replace existing keypasses or implement payroll access controls.

Database triggers append an immutable snapshot on every creation or status transition, in the same transaction as the change. Events include revision, status, reason, actor and timestamp and form a SHA-256 chain. The reviewer history endpoint verifies the chain, canonical fields, current snapshot and revision count. An audit failure rolls back the decision. Database triggers reject record deletion, code reassignment, event updates/deletion/truncation and terminal-state changes. As with the professional audit, this is not independently anchored protection against a database owner disabling triggers and rewriting the complete chain.

## Interface and API

- Applicant: **Relationship identifiers → Manage identifiers**, read-only on `/provider-application`.
- Reviewer: the same panel per application on `/provider-review`, with status controls and **Verify identifier history**.
- Employee register: `/provider-review` includes issuance and account-based lookup. Supply the existing verified account/organisation and signed employment-agreement references; no new employee relationship is inferred from the independent contractor declaration.
- API base: `/api/v1/relationship-identifiers`; `GET /me`, `GET /review?applicationId=…` or `?userId=…`, `POST /employees`, `POST /:id/status`, `GET /:id/events`. API keys cannot administer these references.

## Migration and verification

Apply normal forward migrations only after reconciling any incompatible local PR94 schema using the existing guarded procedure. Migration 043 preserves every existing PRV/application value, creates the corresponding SUP reference, and retains existing provider suspension. Backfill events are explicitly labelled as migration records (actor unknown); they do not fabricate historical creation dates, new approvals or verification decisions. No employee IDs are backfilled. The migration receipt makes reruns a no-op.

In a disposable loopback PostgreSQL database whose name contains `professional`, apply migrations and run from the backend directory:

```sh
IDENTIFIER_TEST_DATABASE=1 node --import tsx scripts/identifier-integration.mjs
IDENTIFIER_TEST_DATABASE=1 node --import tsx scripts/identifier-backfill-integration.mjs
```

The first covers issuance, separate categories, operator/self controls, manual suspension, irreversible revocation, concurrent decisions, blocked sales/professional actions, preserved financial counts, employment-agreement evidence, verified immutable history and transactional audit failure. The second creates a separate 042 database and runs the real 043 upgrade plus no-op rerun. Existing main recruitment/commission and professional-authority integrations remain required in CI. No local Mac or production database is changed by these isolated tests.

Verified on 21 November 2026: fresh migrations through 043; 4 grouped identifier lifecycle scenarios plus the real 042-to-043 backfill/no-op test; unchanged main recruitment/commission integration (98 checks), candidate port (3 scenarios) and professional authority (7 scenarios); 776 Web tests across 71 files; 122 targeted backend tests across 8 suites; TypeScript/lint without errors (existing unrelated warnings); root build 5/5. Tests used only disposable PostgreSQL and retained synthetic evidence fixtures.
