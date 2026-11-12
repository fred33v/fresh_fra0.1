# Phase 1 — transaction and permission repairs

Base: `5fcfb4d89749a729aae5274d533ee5e337b09d75`.
Verified locally on 12 November 2026. This is the first repair set, not completion of the whole Phase 1 roadmap.

## Problem and resulting behavior

Previously, PostgreSQL key-pass redemption inserted the employee before claiming the code. Ten simultaneous requests for a single code could leave ten accounts even though only one response succeeded. Refresh-token rotation likewise checked, deleted and replaced the token through separate pool queries.

Key-pass generation, invitations, redemption and single/bulk revocation now serialize per organisation. PostgreSQL performs checks and writes on one transaction client; account creation, conditional code claim, refresh-token storage and required key-pass audit records roll back together. In-memory mode uses an organisation queue. Expiry updates cannot change an already consumed code to expired/revoked and free its seat. Email/event notifications start after commit.

Refresh rotation atomically consumes the old token hash and stores its replacement in one transaction. A lost race returns 401; an insertion/database failure rolls back rather than destroying the previous session. In-memory rotation also claims the token before issuing a replacement.

The API now requires the existing server-assigned facilitator role (or admin) to create workshop sessions. An active package alone does not grant delivery authority. Participant behavior and owner checks on existing sessions remain in place. Database smoke fixtures explicitly seed delivery authority; no public role-assignment endpoint was added.

The signed assessment webhook records a system actor with a null UUID, retaining its system email/event type, rather than trying to insert the invalid UUID `system`.

## Compatibility and scope

- No schema migrations, dependency manifests or lockfile changes.
- Existing apps, data, access codes, payment, assessment, certificate and training workflows retained.
- Intentional security refusal: entitled employees/employers without delivery authority cannot create sessions directly.
- Existing response envelopes and success payloads preserved; concurrent/refused operations do not leave partial membership/session writes.
- Required key-pass audit failures roll back the transaction. Standalone audit behavior remains best effort for existing callers; durable global audit/outbox work is separate.
- Native development remains suspended. No production migration, deployment or real payment was attempted.

## Verification

- Backend TypeScript typecheck: passed.
- Backend TypeScript build: passed.
- Backend Jest suite: **644 tests across 46 suites passed**.
- PostgreSQL **17.7**, disposable local database: all 31 migrations applied, then reran without reapplying SQL.
- API/database smoke: **106/106 checks passed**, with PDF rendering explicitly skipped.
- New PostgreSQL concurrency/failure script: **12 scenarios passed**:
  1. Ten simultaneous redemptions produce one account, claim and refresh session.
  2. Distinct codes cannot consume the same last package seat.
  3. Concurrent code generation does not exceed quota.
  4. Concurrent email invitations create one pending invite.
  5. Refresh-token insertion failure rolls back the entire join.
  6. A lost code-claim update rolls back user creation.
  7. Required audit insertion failure rolls back the entire join.
  8. Redemption versus single/bulk revocation preserves a consistent consumed seat.
  9. Six simultaneous refreshes consume the old token once.
  10. Failed refresh replacement preserves the previous token for retry.
  11. Unqualified employer/employee refused; server-assigned facilitator accepted.
  12. Signed system webhook actually persists its PostgreSQL audit row.
- Regression control: the same concurrency script against the untouched base failed its first scenario because **10 accounts persisted instead of 1**.
- Local lint: zero errors and five warnings on existing code, using the existing backend rules with ESLint 9.39.2 and available typescript-eslint 8.62.1. Installing the repository-pinned parser 8.54.0 was refused by the package registry policy; exact pinned lint remains for GitHub CI. No dependency versions were changed to work around that refusal.
- The existing migration-integration script deliberately refused this local database because it only accepts the exact isolated GitHub CI environment. Its guard was preserved. The new regression script accepts an explicitly flagged disposable local database and runs in the existing PostgreSQL CI job.
- Full monorepo/frontend/native verification and remote CI on this repair commit remain pending.

## Run the new PostgreSQL regression checks

Use a disposable, already migrated local PostgreSQL database. The script creates fixture accounts, temporary failure-injection triggers, and its own backend on port 3001. Never use a production or important local database.

```bash
TRANSACTION_TEST_DATABASE=1 DATABASE_URL=postgresql://... node scripts/transaction-integration.mjs
```

Run from `apps/fra-backend/backend`. GitHub's PostgreSQL job runs this automatically after the ordinary smoke test. The script uses generated test-only secrets and a separate backend so its rate-limit state does not affect the smoke test.

## Remaining roadmap

Certificate revocation/immutable issuance, refund/dispute handling, durable provider events/outbox, SSE repairs, real browser/PDF CI, deployment safeguards, provider applications/17% commissions and verified professional signing remain separate changes. These repairs must pass the existing five required CI checks before merge.
