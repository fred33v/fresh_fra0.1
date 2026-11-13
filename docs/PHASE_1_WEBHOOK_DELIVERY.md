# Phase 1 — Durable outgoing webhook delivery

> Follow-up: [atomic publication and assessment budget planning](PHASE_1_DOMAIN_PUBLICATION_AND_BUDGET.md) now implements the publication/planning gaps described below locally. Earlier validation counts remain historical.

Prepared on 13 November 2026. This addresses the outgoing retry/restart portion of F10. All work is local; no real receiver was contacted, no application was deployed and no GitHub write/merge was performed.

## Behavior and compatibility

Database-backed event publication now writes one persisted delivery per subscribed active endpoint. The event payload fields, event names, signing format and `X-StopFRA-Delivery` value remain compatible. One event ID is retained across retries; signatures use the current endpoint secret and a fresh signing timestamp. No signing secret is copied into the queue. Delivery bodies are persisted as JSON so they can be reconstructed after restart; response bodies are not stored or consumed and their streams are released.

Delivery is **at least once**, not exactly once. If a receiver accepts a request but the sender crashes before recording success, the request can be repeated. Receivers must deduplicate the delivery/event ID. Different events can arrive out of order across workers or retries; global event ordering is not promised.

Migration `034_webhook_deliveries.sql` adds the queue, due/lease indexes and per-endpoint event uniqueness. Endpoint deletion does not cascade-delete queued history; an orphaned job is cancelled without transport. Domain accounts, assessments, risks, purchases, training and certificate evidence are not removed.

## Leases, retries and lifecycle

- Each worker claims a single due job atomically using `FOR UPDATE SKIP LOCKED` and a 30-second lease. The database claim commits before the HTTP request. Other workers cannot claim that live lease.
- A new worker recovers an expired lease. A unique lease token fences acknowledgements, so a stale worker cannot overwrite a recovered delivery's state or endpoint summary.
- HTTP 2xx completes the job. HTTP 4xx other than 429 goes to `dead`. Network/timeout status 0, 429, 5xx and the existing non-followed redirect behavior retry after 1s, 10s and 60s; normally the fourth claimed attempt ends the cycle.
- Uncertain attempts recovered after crashes can produce extra attempts/duplicates. The normal retry budget bounds observed failures, not an exactly-once external side effect.
- Every attempt rechecks the endpoint, active subscription, URL validity and current Enterprise entitlement. Missing/disabled endpoints, removed subscriptions, invalid destinations and inactive package access cancel queued work without sending it. Disabling/deleting cannot retract a request already in flight.
- Total `attempts` counts claims, including cancelled checks and uncertain crashed attempts. `cycleAttempts` counts claims since the last manual requeue; `retryCount` counts manual requeues. These are not a per-attempt accounting ledger.
- Startup begins a bounded polling worker. Shutdown stops new claims and waits for the current attempt/pass before closing the pool. Forced termination leaves persisted work/leases recoverable.

`WEBHOOK_WORKER_ENABLED=false` pauses polling while keeping newly enqueued rows. It is also used by the CI database job; integration tests explicitly drain with a fake transport. Otherwise polling is enabled when PostgreSQL is configured. Development without a database preserves the original immediate/in-memory retry behavior and does not claim restart durability.

The existing URL/private-address checks remain in place. DNS validation is still separate from the connection's address resolution; address pinning (F19) has not been represented as fixed by this change.

## Transaction boundary

`enqueueOrgEvent(..., db)` accepts the caller's transaction and propagates failures. Key-pass redemption now uses it inside the existing membership/code/token/audit transaction. A queue-insert failure rolls back the join; a successful join and its subscribed notification commit together.

The compatibility `emitOrgEvent` wrapper remains non-throwing. Assessment submission and risk-register changes still call it after their source mutations. Once their queue insert commits, delivery/retry is durable; a crash or enqueue failure **between the source write and that insert can still lose publication**. Connecting those domain writes and publications transactionally remains the next part of F10. This is not a claim that every domain operation now has a fully transactional outbox.

## Manager operations

- `GET /api/v1/webhook-endpoints/:id/deliveries` returns paginated delivery metadata: IDs/event type, status, counters, timings, HTTP status and a safe error category. It never returns the payload or secret.
- `POST /api/v1/webhook-endpoints/:id/deliveries/:deliveryId/retry` requeues only a dead/cancelled delivery owned by that endpoint/organisation. It preserves the original payload/event ID and total claims, starts a new retry cycle and records a required audit event, including previous status/counters/completion metadata. An audit failure rolls back the requeue.
- Current persisted employer/admin authority and organisation are checked; employee, stale-manager and foreign-tenant requests are refused. Retry requests are limited to ten per minute per user/client-address limiter key. Live, pending and already delivered rows cannot be manually requeued.
- Delivery still rechecks subscription/package access after a manual requeue. A still-ineligible job can cancel again. Deleted endpoints cannot be used to retarget old deliveries.

The existing endpoint-test operation remains a synchronous one-attempt diagnostic; it is not added to the durable domain-event queue. No new browser delivery-management UI is claimed. Operators can use the authenticated APIs. Dead/cancelled job payloads remain stored; payloads can contain business/user data, so an explicit retention policy remains necessary. This change adds no automatic payload/history deletion or broad replay operation.

## Verification

- Full backend unit suite: **683 tests, 51 suites passed**, including 16 new retry-policy/fallback cases and existing signature, endpoint, enterprise and key-pass tests.
- Disposable PostgreSQL 17.7: **eight outgoing webhook scenarios passed**. These exercise retry in a separate process with the same signed payload; concurrent live leases; shutdown claim control; expired-lease recovery/stale acknowledgement fencing; bounded retries, role/tenant checks and audited requeue rollback; disabled/subscription cancellation; domain/enqueue failure rollback and atomic key-pass redemption; and package/endpoint removal cancellation.
- Existing PostgreSQL API smoke: **106/106 checks passed**. Its backend worker is explicitly paused, matching CI isolation.
- Backend build/typecheck and changed production-file lint pass. No frontend source was changed or new full frontend/browser run claimed.
- Test delivery transport was replaced with an in-process fake before draining; no external messages were sent. The new PostgreSQL script is wired into the existing CI database job with `node --import tsx scripts/webhook-delivery-integration.mjs`. No fresh remote CI result, production receiver test or rollout rehearsal is claimed.

## Rollout and remaining work

Apply migration 034 before starting the updated backend/worker. Drain/stop old processes and their memory-only timers as part of the existing coordinated Phase 1 cutover. Old lost timer jobs cannot be reconstructed automatically; any required historical replay needs explicit reconciliation. Preserve additive schema/history on rollback. Existing payment/certificate migration and cutover requirements remain applicable to the cumulative patch.

Next: make assessment/risk publication atomic with source mutations, then complete budget-planning persistence/edit/delete/failure behavior. SSE repairs, role alignment, real authenticated browser CI, database TLS/address pinning and explicit visibility/retention policy remain open. Professional signing and provider recruitment/17% commissions remain new features; native applications remain preserved with development suspended.
