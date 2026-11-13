# Phase 1 — Atomic domain publication and assessment budget planning

Local implementation, 13 November 2026. Extends the previous six repair commits from main baseline `5fcfb4d89749a729aae5274d533ee5e337b09d75`; this is not a deployed or remote-CI acceptance record.

## Atomic assessment and risk publication

With PostgreSQL enabled, assessment creation, patching and submission, risk creation/editing/removal, owner progress, manager review and assessment-to-risk imports use a shared transaction wrapper. The source mutation, its audit entry and every subscribed webhook queue insertion use the same client. A refused response or SQL failure rolls back the transaction, including any earlier event in a multi-event fan-out or any earlier risk in an import batch. API success follows commit; outgoing HTTP delivery remains the existing asynchronous, retryable outbox worker.

The organisation advisory lock matches key-pass/payment operations. Assessment reads in transactions also lock the source row. Concurrent submission therefore produces one submission transition/publication, while risk imports and edits cannot interleave through these routes. Assessment allowance checks use that transaction too. Payloads and existing event names are preserved; assessment answers remain excluded. No new deletion event is invented.

Certificate issuance starts **after commit** and retains its existing best-effort repair behaviour. It is not part of the source/outbox transaction. A queue insertion failure cannot issue a certificate for a rolled-back submission. Receiver delivery is still at-least-once, so consumers must deduplicate event IDs. The in-memory development fallback remains supported but does not provide PostgreSQL rollback/durability guarantees.

## Budget planning contract

Migration `035_budget_planning.sql` adds assessment-specific plans and strategy history. The existing training-course budget tables/endpoints and native applications are preserved. Shared planning types describe this new contract separately from training models.

All routes are under `/api/v1/budget-guide/plans/:assessmentId`:

| Route | Behaviour |
| --- | --- |
| GET base | Load plan or null |
| POST base `{}` | Idempotently initialise a plan |
| PATCH `/risk-appetite` | Save level and justification |
| POST `/mitigations` | Add a strategy |
| PATCH `/mitigations/:mitigationId` | Edit an existing strategy |
| DELETE `/mitigations/:mitigationId?expectedVersion=N` | Archive a strategy without deleting its history |
| POST `/complete` | Complete a plan with appetite and at least one funded strategy |
| GET `/report` | Download an escaped HTML implementation report with GBP totals |

Writes carry `expectedVersion` (DELETE uses the query parameter). The parent row is locked, version checked, mutation/audit committed together and canonical saved plan returned. Stale saves receive 409 rather than overwriting another session. Edits/archive reopen completed plans. Plans allow at most 100 active strategies; bounded fields, enums and finite nonnegative two-decimal GBP budgets are validated server-side. Money is stored as integer pence. The report is printable HTML, not a server-generated PDF.

Authority is checked against the current persisted account, assessment organisation and ownership/manager role. Only submitted/completed assessments can be planned. Editing requires an active Starter package or higher; previously saved plans/reports remain readable after expiry. Authentication, no-store responses and per-user rate limiting apply. A strategy cannot be edited through another assessment's plan.

The dashboard now restores saved appetite, strategies and completion. It calls PATCH for edits, shows save/load errors, retains failed modal drafts, disables overlapping saves, confirms removal, supports implementation status, shows accurate GBP amounts, completes the plan and downloads its report. Account/assessment changes remount the page and discard stale responses. Failed score loading shows unavailable recommendations rather than inventing a low risk score.

No cascading source FK is added: assessment retention cannot silently erase saved plan/history. Reading still requires the source assessment and current authority, so a retained plan whose source is removed is inaccessible through this API. An explicit organisation-wide retention/export policy remains a release task.

## Verification and rollout

The disposable PostgreSQL script `scripts/domain-budget-integration.mjs` injects outbox and audit failures, checks source/result/audit rollback, concurrent submission, multi-risk import rollback/retry, risk fan-out/progress/review rollback, plan initialisation/authority/tenant isolation, exact pence, stale-save conflicts, completion/reopening, escaped report, archive retention and expiry behaviour. It runs in the existing PostgreSQL CI job with the worker disabled and no external deliveries. The Playwright budget contract uses a mocked API; it is not a real authenticated browser-to-PostgreSQL test.

Apply migrations through 035 before the updated backend and dashboard. Preserve additive tables/history on rollback. Earlier payment/certificate/outbox cutover requirements still apply. Local checks and final counts are recorded in the delivery message; fresh remote CI, production deployment and real provider delivery are not claimed.

## Remaining Phase 1 work

These changes close the previously documented domain publication gap and assessment budget persistence/edit/delete/failure gap locally. SSE reconnect/atomic Redis claims, role alignment, real authenticated browser CI, database TLS/address pinning and explicit visibility/retention policy remain open. Verified professional signing and provider recruitment/17% commissions remain new features. Native applications remain preserved with development suspended.
