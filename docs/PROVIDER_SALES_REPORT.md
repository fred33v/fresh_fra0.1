# Administrator provider sales report and commission basis

## Verified gap and delivered report

The prior UI had a per-provider commission/payout statement and the administrator recruitment queue, not a consolidated report of attributed package sales. `/provider-review` now includes **Administrator provider sales report → Open sales report**.

The report covers purchases linked through main #86's immutable provider attribution table. Direct/unattributed sales are outside this report. Current verified operator administrators in `PROVIDER_REVIEW_ORGANISATION_ID` can read it; ordinary providers, administrators of other organisations, stale administrator claims and API keys cannot. Report reads/exports append the existing access audit and do not refresh payment state, create commissions, authorise payouts or send money.

Filters are purchase-created date (`from` inclusive, `until` exclusive, **UTC**), provider PRV reference, package reference, currency and payment status. Date ranges are limited to 366 days. The summary covers every match, grouped by currency; the detail page contains 50 rows. These are current stored payment/ledger states for purchases created in that interval, not bank settlements or ledger movements occurring during that interval. Each request uses one SQL snapshot for its summary, total and detail. Later page/export requests may reflect newer data; their generation time and each purchase's last verification time are shown.

The report distinguishes:

- listed package price HT and expected gross, gross refunds and last trusted payment verification;
- verified retained gross **before** dispute exclusions, versus eligible retained HT **before** processing/bank fees;
- current-policy commission target, actual posted commission and their difference;
- pending/unverified/disputed states and over-refund/currency anomalies.

It retains inactive/revoked providers' historical sales. It displays current provider/company/package labels, not an immutable invoice-name snapshot; the purchase's stored price is used rather than the current catalogue price. Refunds and commission movements are shown cumulatively for the selected purchases. It does not equate a commission statement, finance reservation or staff-recorded payout reference with a verified bank settlement.

CSV exports the applied filters' complete set, up to 10,000 matching sales, with amounts in integer minor units, verification state and explicit commission-basis metadata. Larger exports fail with an instruction to narrow the filters, rather than silently truncating. Cells protect against spreadsheet-formula injection while signed integer amounts remain machine-readable. No payment client secrets, customer email addresses or banking details are exported. Migration **044** adds date and per-purchase ledger lookup indexes only; it changes no financial records.

## Existing calculation, preserved

The report declares basis `package-ht-proportional-refunds-v1`, 17% and the current fixed VAT rate (20%). It uses the same policy as `commissionTarget` in `src/provider-commissions.ts`:

```text
N = stored package price excluding VAT, in minor units
G = round(N × 1.20)
R = verified cumulative gross refunds, in minor units

If payment was not independently reconciled, or status is not succeeded:
    eligible commission = 0
Otherwise, for 0 <= R < G:
    commission = round-half-up(N × 1700 × (G - R) / (10000 × G))
A full/over refund gives zero commission.
```

The displayed retained HT base is rounded per purchase for readability. Commission is rounded **once from the original ratio**, not recalculated from that rounded display base. SQL report targets are checked against the unchanged integer financial function, including odd-cent refunds. Posted ledger entries remain the financial record; a report discrepancy is surfaced for reconciliation, never automatically repaired.

Existing trusted payment reconciliation verifies that the captured amount, payment currency and received amount match the expected purchase gross and reads current refunds/disputes. Simulated/unverified `succeeded` flags alone do not qualify. The report uses the last persisted result and does not perform a new external verification; payout review retains its existing separate verification requirements. It does not include processor/bank fees, FX costs or an actual bank-net settlement amount: those costs are not stored as a commission basis in the existing schema. Historic tax-policy snapshots are also not introduced by this report.

Example: £100 HT / £120 TTC gives £17 commission once verified. A £60 TTC refund leaves a £50 HT eligible base and £8.50 commission. A £3 processing fee does **not** reduce the current £100 base to £97.

## “Decision C” remains unspecified

The request refers to “net collected” and “decision C below”, but the text of decision C is not present in the supplied request or repository documents searched. Clarification was requested. No after-fee interpretation or financial-policy change is inferred.

If decision C means actual receipts after processor/bank fees, the current policy does not implement it. That would require an explicit definition of taxes, discounts, refunds, non-refundable fees, disputes, FX, recognition timing and treatment of existing agreements/earned entries, plus trusted reconciled cost data and a versioned policy. This increment documents the current meaning and exposes it in the UI/CSV; it does not silently reinterpret existing 17% agreements or rewrite the commission ledger.

## Verification

From the backend directory, after migrations on a disposable loopback database whose name contains `professional`:

```sh
SALES_REPORT_TEST_DATABASE=1 node --import tsx scripts/sales-report-integration.mjs
```

The integration covers operator-only access and stale roles, current basis, date boundaries under a non-UTC DB timezone, unverified/disputed/full/partial/over refunds, separate currencies, exact rounding, full-scope totals and pagination, discrepancy visibility, read-only financial fingerprints, CSV injection protection/basis metadata, access audit and an actual >10,000-row export refusal. Existing main recruitment/commission tests remain unchanged. No production or owner's Mac database is migrated during these tests.

Verified on 21 November 2026: 4 grouped PostgreSQL report scenarios (including >10,000 matching purchases and comparison with the existing commission function), 98 unchanged recruitment/commission checks, 780 Web tests across 72 files, targeted report/statement/recruitment UI 16/16, backend/Web TypeScript and lint without errors (5 existing unrelated warnings per application), and root build 5/5. Migration 044 was applied only to the disposable local test database.
