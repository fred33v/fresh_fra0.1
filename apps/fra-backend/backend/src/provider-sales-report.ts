import { z } from 'zod';
import type { DbExecutor } from './db/transaction.js';
import { VAT_RATE } from './stripe.js';
export const salesReportFilters = z
  .strictObject({
    from: z.iso.date(),
    until: z.iso.date(),
    providerCode: z
      .string()
      .regex(/^PRV-[a-f0-9]{32}$/)
      .optional(),
    packageId: z.string().min(1).max(100).optional(),
    currency: z
      .string()
      .regex(/^[a-z]{3}$/)
      .optional(),
    status: z
      .enum(['requires_confirmation', 'succeeded', 'failed', 'refunded', 'disputed'])
      .optional(),
    page: z.coerce.number().int().min(0).max(100000).default(0),
  })
  .refine(
    (v) => v.until > v.from && Date.parse(v.until) - Date.parse(v.from) <= 366 * 86400000,
    'Use an exclusive end date after the start, within 366 days'
  );
export type SalesReportFilters = z.infer<typeof salesReportFilters>;
export const COMMISSION_BASIS = {
  id: 'package-ht-proportional-refunds-v1',
  rateBps: 1700,
  vatRate: VAT_RATE,
  feesDeducted: false,
  providerFeesAvailable: false,
  description:
    '17% of verified package price excluding VAT, proportionally reduced by gross refunds; disputed payments excluded. Processing/bank fees are not deducted. Retained HT base is rounded for display only; commission rounds once per purchase.',
};
/** One SQL snapshot covers summary and detail; no payment refresh, ledger change or payout authorization. */
export async function providerSalesReport(
  db: DbExecutor,
  f: SalesReportFilters,
  exportCsv = false
) {
  const {
    rows: [result],
  } = await db.query(
    `WITH raw AS (
 SELECT p.id,p.created_at,p.package_id,p.status,p.currency,p.amount_cents AS net,p.refunded_amount_cents AS refunded,
 p.payment_reconciled_at,p.dispute_status,a.id AS application_id,a.company_name,a.provider_code,s.assignment_id,
 COALESCE(k.name,p.package_id) AS package_name,
 round(p.amount_cents::numeric*(1+$7::numeric)) AS gross,
 COALESCE(l.posted,0) AS posted,COALESCE(l.currency_mismatch,false) AS currency_mismatch
 FROM public.provider_sale_attributions s JOIN public.purchases p ON p.id=s.purchase_id
 JOIN public.provider_applications a ON a.id=s.application_id LEFT JOIN public.packages k ON k.id=p.package_id
 LEFT JOIN LATERAL(SELECT sum(e.delta_cents) FILTER(WHERE e.currency=p.currency) AS posted,
 bool_or(e.currency<>p.currency) AS currency_mismatch FROM public.provider_commission_entries e WHERE e.purchase_id=p.id) l ON true
 WHERE p.created_at >= ($1::date::timestamp AT TIME ZONE 'UTC') AND p.created_at < ($2::date::timestamp AT TIME ZONE 'UTC')
 AND ($3::text IS NULL OR a.provider_code=$3) AND ($4::text IS NULL OR p.package_id=$4)
 AND ($5::text IS NULL OR p.currency=$5) AND ($6::text IS NULL OR p.status=$6)
 ), bases AS (
 SELECT *,CASE WHEN payment_reconciled_at IS NOT NULL AND status IN ('succeeded','refunded','disputed') THEN greatest(gross-refunded,0) END AS retained_gross,
 CASE WHEN payment_reconciled_at IS NOT NULL AND status='succeeded' AND net>=0 AND refunded>=0 AND gross>refunded THEN gross-refunded ELSE 0 END AS eligible_gross
 FROM raw
 ), sales AS (
 SELECT *,CASE WHEN gross>0 THEN round(net::numeric*eligible_gross/gross) ELSE 0 END AS eligible_net,
 CASE WHEN gross>0 THEN round(net::numeric*1700*eligible_gross/(10000*gross)) ELSE 0 END AS target
 FROM bases
 ), page AS (SELECT * FROM sales ORDER BY created_at DESC,id DESC LIMIT $8 OFFSET $9)
 SELECT (SELECT count(*)::text FROM sales) AS total,
 COALESCE((SELECT jsonb_agg(t ORDER BY t->>'currency') FROM (SELECT jsonb_build_object(
 'currency',currency,'sales',count(*),'unverified',count(*) FILTER(WHERE payment_reconciled_at IS NULL),
 'disputed',count(*) FILTER(WHERE status='disputed'),'anomalies',count(*) FILTER(WHERE refunded>gross OR currency_mismatch),
 'listedNetCents',sum(net)::text,'verifiedRetainedGrossCents',COALESCE(sum(retained_gross),0)::text,
 'eligibleNetCents',sum(eligible_net)::text,'targetCommissionCents',sum(target)::text,'postedCommissionCents',sum(posted)::text,
 'commissionDifferenceCents',sum(target-posted)::text) AS t FROM sales GROUP BY currency) x),'[]') AS summary,
 COALESCE((SELECT jsonb_agg(jsonb_build_object(
 'purchaseId',id,'createdAt',created_at,'packageId',package_id,'packageName',package_name,'applicationId',application_id,
 'companyName',company_name,'providerCode',provider_code,'assignmentId',assignment_id,'status',status,'currency',currency,
 'netPriceCents',net::text,'expectedGrossCents',gross::text,'refundedGrossCents',refunded::text,'verifiedRetainedGrossCents',retained_gross::text,
 'eligibleNetCents',eligible_net::text,'targetCommissionCents',target::text,'postedCommissionCents',posted::text,
 'commissionDifferenceCents',(target-posted)::text,'paymentVerifiedAt',payment_reconciled_at,'disputeStatus',dispute_status,
 'anomaly',refunded>gross OR currency_mismatch) ORDER BY created_at DESC,id DESC) FROM page),'[]') AS rows`,
    [
      f.from,
      f.until,
      f.providerCode ?? null,
      f.packageId ?? null,
      f.currency ?? null,
      f.status ?? null,
      String(VAT_RATE),
      exportCsv ? 10001 : 50,
      exportCsv ? 0 : f.page * 50,
    ]
  );
  return {
    generatedAt: new Date().toISOString(),
    scope:
      'Attributed provider package purchases; purchase-created dates [from, until) UTC. Current stored payment/ledger state, not settlement-period cash flow.',
    basis: COMMISSION_BASIS,
    filters: f,
    pageSize: 50,
    total: Number(result.total),
    summary: result.summary,
    rows: result.rows,
  };
}
export function salesReportCsv(report: Awaited<ReturnType<typeof providerSalesReport>>) {
  const columns = [
    'purchaseId',
    'createdAt',
    'companyName',
    'providerCode',
    'packageName',
    'status',
    'currency',
    'netPriceCents',
    'expectedGrossCents',
    'refundedGrossCents',
    'verifiedRetainedGrossCents',
    'eligibleNetCents',
    'targetCommissionCents',
    'postedCommissionCents',
    'commissionDifferenceCents',
    'paymentVerifiedAt',
    'disputeStatus',
    'anomaly',
    'basisId',
    'feesDeducted',
    'rateBps',
    'vatRate',
  ];
  const cell = (value: unknown) => {
    let s = value === null || value === undefined ? '' : String(value);
    if (!/^-?\d+$/.test(s) && /^[\s\u0000-\u001f]*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    [
      columns,
      ...report.rows.map((r: Record<string, unknown>) =>
        columns.map(
          (c) =>
            ({
              ...r,
              basisId: report.basis.id,
              feesDeducted: report.basis.feesDeducted,
              rateBps: report.basis.rateBps,
              vatRate: report.basis.vatRate,
            })[c]
        )
      ),
    ]
      .map((row) => row.map(cell).join(','))
      .join('\r\n') + '\r\n'
  );
}
