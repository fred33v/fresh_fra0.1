# Phase 1 — Payment reversals and durable event receipts

Prepared on 13 November 2026. This change addresses refund/dispute handling (F05) and the incoming Stripe deduplication portion of F10. It preserves hosted Checkout, existing purchases and earned certificate evidence. It does not issue refunds, contest disputes, transfer money, deploy code or configure a real Stripe account.

## Access policy

| Current provider state | Local purchase/access effect |
| --- | --- |
| Successful payment; no completed full refund or blocking dispute | `succeeded`; existing package rules apply |
| Successful partial refund | Keep access; record the successful refunded amount |
| Pending/failed refund | No completed refund amount attributed to it |
| Successful refunds total the gross amount paid | `refunded`; remove that purchase's entitlement contribution |
| Chargeback needs response, under review or lost | `disputed`; suspend that purchase's contribution |
| Inquiry/warning phase, prevented dispute or closed warning | No suspension on this basis alone |
| Dispute won, no completed full refund | Restore `succeeded`, retaining the original activation date and term |
| Previously fully refunded purchase | Terminal; a later paid/won event cannot restore it |
| Unknown dispute status, or disputed charge without a readable dispute | Suspend until reconciled |

Other valid purchases retain their contributions. Existing subscription-window stacking logic recomputes access from eligible purchases; this is not an organisation/account deletion. Assessments, training, employee accounts and certificate validity are not automatically erased or revoked on financial reversal. There is no new accounting, tax-credit-note, refund-issuance, professional-signing or commission/payout feature.

Refund amounts are gross minor currency units (including the integration's existing VAT calculation), while the existing purchase `amountCents` remains the net package price. A legacy row's default stored refund amount is not historic refund evidence: the API omits `refundedAmountCents` until `paymentReconciledAt` exists. Existing confirmed activation dates are preserved. For a previously unsettled payment, the verified charge's creation time establishes the activation date in this automatic-capture Checkout integration.

## Event processing and provider reads

The signed webhook handles Checkout completion/failure/expiry plus `charge.refunded`, `charge.refund.updated`, `refund.created`, `refund.updated`, `refund.failed` and the created/updated/closed/funds-withdrawn/funds-reinstated dispute events. Configure the real destination to deliver these before relying on them. Existing signature verification remains mandatory in production.

A reversal resolves the PaymentIntent to a stored purchase or to the purchase metadata supplied when Checkout was created. Missing linked local purchases fail for retry; unrelated payments without a purchase link are ignored. Provider metadata, organisation/package linkage, currency, gross amount received, paid charge and captured amount are verified. No event body is trusted to assert its own refund amount or dispute outcome.

Under the organisation/purchase lock, the service reads the current PaymentIntent and expanded latest charge, successful refunds, and all disputes for that PaymentIntent. Provider calls are read-only. Lists are paginated with a 10,000-item safety limit; reaching it fails reconciliation for retry/operational investigation rather than silently applying a truncated total. Temporary API/read failures leave local effects uncommitted. This prevents late delivery of an older event from reversing a newer local decision based on current provider state. It is not a transaction spanning Stripe and PostgreSQL; later provider changes still require their next event/reconciliation.

Reconciliation also protects the buyer's Checkout return path. It must not report a refunded/disputed purchase as successfully granting access merely because its historic Checkout Session still says paid.

## Durability boundary

Migration `033_payment_lifecycle.sql` adds refund/dispute/reconciliation fields and `payment_events`. The latter stores only event ID, type and processed timestamp, without raw provider payloads or card/customer details.

Event deduplication uses a PostgreSQL advisory lock and persisted receipt. Purchase state, required audit and receipt commit in one transaction. A duplicate on another worker or after restart observes the receipt; an event/type identity conflict refuses processing. Failed processing/commit returns HTTP 500, leaves no completed receipt and relies on Stripe's retry. The service acknowledges success only after commit. Organisation locking is shared with key-pass joins/quotas.

This is a durable completed-event receipt, not an internal incoming job queue. Provider retries are required; operators still need provider-event monitoring and resends/reconciliation when a destination has been unavailable beyond the provider's retry window. There is no automatic historic backfill of reversals that were acknowledged and ignored by the old implementation. Before rollout acceptance, reconcile affected historic payments/provider events separately; none were accessed here.

Memory-mode deduplication is serialized but remains process-local, appropriate only for the existing development/test fallback. Production requires PostgreSQL. General outgoing SIEM/GRC webhook retry timers are unchanged: a durable outgoing delivery/outbox and atomic domain-event enqueue are still open work under the remaining portion of F10.

## Verification

- Backend full suite: 667 tests in 50 suites passed, including 12 new lifecycle cases and the existing hosted Checkout tests. The final targeted payment/Checkout run was repeated after pagination-limit hardening and passed all 23 tests.
- Dedicated disposable PostgreSQL 17.7 integration: seven scenarios passed. They cover concurrent duplicate commits, receipt persistence observed by a separate process, receipt-insert failure rolling back purchase/audit before retry, dispute restoration without term extension, reversal-before-settlement plus late Checkout delivery, entitlement loss with account preservation, and refund racing key-pass redemption without a refused orphan account.
- Existing PostgreSQL API smoke: 106/106 checks passed after migration 033.
- Backend TypeScript/build and changed production-file lint passed. No frontend source was changed; the previous frontend/browser suites were not represented as a fresh run for this change.
- Stripe reads were supplied by an isolated fake provider in tests; no real sandbox/live refund, dispute or API operation was performed. A real sandbox acceptance run and a fresh remote CI run remain unverified.
- The new PostgreSQL script is wired into the existing CI database job using `node --import tsx scripts/payment-integration.mjs`. Existing required check names are retained.

## Rollout and current status

Apply migration 033 before the updated backend serves purchase queries. The configured restricted Stripe key needs read access to PaymentIntents, refunds and disputes in addition to the existing Checkout operations; verify those permissions in an isolated sandbox. Drain old payment webhook workers: they can acknowledge reversals without applying them and do not share durable receipts. Preserve the additive migration on rollback. The cumulative delivery also retains the earlier certificate registry's coordinated-cutover requirements. No production migration, release, push or merge was executed here.

This follows the transaction/permission, certificate, frontend-typecheck and account/session repairs. Remaining work includes durable outgoing webhook delivery, budget-planning persistence/edit/delete/failure handling, SSE reconnect/atomic Redis claims, role alignment, real authenticated browser CI, database TLS and other release safeguards, explicit visibility/retention policy, then professional signing and provider recruitment/17% commissions. Native applications remain preserved with development suspended.

Primary implementation references: [Stripe webhook guidance](https://docs.stripe.com/webhooks), [refund lifecycle](https://docs.stripe.com/refunds), [dispute lifecycle](https://docs.stripe.com/disputes/how-disputes-work), and the installed Stripe SDK's typed PaymentIntent/refund/dispute interfaces. The access decisions above are this application's explicit policy, not a claim that Stripe mandates a particular product-access policy.
