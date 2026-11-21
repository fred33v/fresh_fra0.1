import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
const endpoint = '/api/v1/provider-sales/report';
const date = (value: Date) => value.toISOString().slice(0, 10);
type Filter = {
  from: string;
  until: string;
  providerCode: string;
  packageId: string;
  currency: string;
  status: string;
};
type Totals = {
  currency: string;
  sales: number;
  unverified: number;
  disputed: number;
  anomalies: number;
  listedNetCents: string;
  verifiedRetainedGrossCents: string;
  eligibleNetCents: string;
  targetCommissionCents: string;
  postedCommissionCents: string;
  commissionDifferenceCents: string;
};
type Sale = {
  purchaseId: string;
  createdAt: string;
  companyName: string;
  providerCode: string;
  packageName: string;
  status: string;
  currency: string;
  netPriceCents: string;
  refundedGrossCents: string;
  eligibleNetCents: string;
  postedCommissionCents: string;
  targetCommissionCents: string;
  commissionDifferenceCents: string;
  paymentVerifiedAt: string | null;
  anomaly: boolean;
};
type Report = {
  generatedAt: string;
  scope: string;
  basis: { id: string; description: string };
  total: number;
  pageSize: number;
  summary: Totals[];
  rows: Sale[];
};
function money(cents: string, currency: string) {
  const value = Number(cents);
  return Number.isSafeInteger(value)
    ? new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(value / 100)
    : `${cents} minor units ${currency.toUpperCase()}`;
}
function params(f: Filter, page: number) {
  const p = new URLSearchParams({ from: f.from, until: f.until, page: String(page) });
  for (const k of ['providerCode', 'packageId', 'currency', 'status'] as const)
    if (f[k]) p.set(k, f[k]);
  return p.toString();
}
export default function ProviderSalesReport() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false),
    [form, setForm] = useState<Filter>({
      from: date(new Date(Date.now() - 30 * 86400000)),
      until: date(new Date(Date.now() + 86400000)),
      providerCode: '',
      packageId: '',
      currency: '',
      status: '',
    }),
    [filter, setFilter] = useState(form),
    [page, setPage] = useState(0),
    [exporting, setExporting] = useState(false),
    [error, setError] = useState('');
  const query = useQuery({
    queryKey: ['provider-sales-report', user?.userId, user?.organisationId, filter, page],
    queryFn: () => api.get<Report>(`${endpoint}?${params(filter, page)}`),
    enabled: open,
    retry: false,
  });
  async function download() {
    setExporting(true);
    setError('');
    try {
      await api.download(`${endpoint}?${params(filter, 0)}&format=csv`, 'provider-sales.csv');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sales export failed');
    } finally {
      setExporting(false);
    }
  }
  const change = (key: keyof Filter, value: string) => setForm({ ...form, [key]: value });
  return (
    <section className="space-y-4 rounded border p-4">
      <h2 className="text-xl font-semibold">Administrator provider sales report</h2>
      <p>
        Attributed package sales across providers. Commission is calculated before processing/bank
        fees; those fees are not deducted. This report does not authorise payouts.
      </p>
      <Button variant="outline" onClick={() => setOpen(!open)}>
        {open ? 'Hide sales report' : 'Open sales report'}
      </Button>
      {open && (
        <>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(0);
              setFilter({ ...form });
            }}
          >
            <div>
              <Label htmlFor="sales-from">Purchase date from (UTC, inclusive)</Label>
              <Input
                id="sales-from"
                type="date"
                required
                value={form.from}
                onChange={(e) => change('from', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="sales-until">Purchase date until (UTC, exclusive)</Label>
              <Input
                id="sales-until"
                type="date"
                required
                value={form.until}
                onChange={(e) => change('until', e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="sales-provider">Provider sales reference (optional)</Label>
              <Input
                id="sales-provider"
                value={form.providerCode}
                onChange={(e) => change('providerCode', e.target.value.trim())}
              />
            </div>
            <div>
              <Label htmlFor="sales-package">Package reference (optional)</Label>
              <Input
                id="sales-package"
                value={form.packageId}
                onChange={(e) => change('packageId', e.target.value.trim())}
              />
            </div>
            <div>
              <Label htmlFor="sales-currency">Currency (optional, e.g. gbp)</Label>
              <Input
                id="sales-currency"
                maxLength={3}
                value={form.currency}
                onChange={(e) => change('currency', e.target.value.toLowerCase())}
              />
            </div>
            <div>
              <Label htmlFor="sales-status">Payment status</Label>
              <select
                id="sales-status"
                className="block w-full rounded border bg-background p-2"
                value={form.status}
                onChange={(e) => change('status', e.target.value)}
              >
                <option value="">All statuses</option>
                {['requires_confirmation', 'succeeded', 'failed', 'refunded', 'disputed'].map(
                  (s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  )
                )}
              </select>
            </div>
            <Button>Apply sales filters</Button>
          </form>
          {query.isPending && <p role="status">Loading sales report…</p>}
          {query.isError && <p role="alert">{query.error.message}</p>}
          {error && <p role="alert">{error}</p>}
          {query.data && (
            <>
              <p className="text-sm">{query.data.scope}</p>
              <p className="text-sm">{query.data.basis.description}</p>
              <p className="text-xs text-muted-foreground">
                Generated {new Date(query.data.generatedAt).toLocaleString('en-GB')}. “Verified” is
                the last stored payment check, not a live bank settlement check.
              </p>
              {query.data.summary.map((t) => (
                <article key={t.currency} className="space-y-1 rounded border p-3">
                  <h3 className="font-semibold">
                    {t.currency.toUpperCase()}: {t.sales} sales
                  </h3>
                  <p>
                    Unverified: {t.unverified} · Disputed: {t.disputed} · Anomalies: {t.anomalies}
                  </p>
                  <p>
                    Verified retained gross before dispute exclusions:{' '}
                    {money(t.verifiedRetainedGrossCents, t.currency)}
                  </p>
                  <p>
                    Eligible retained HT before processing/bank fees:{' '}
                    {money(t.eligibleNetCents, t.currency)}
                  </p>
                  <p>
                    Current policy commission: {money(t.targetCommissionCents, t.currency)} · Posted
                    ledger: {money(t.postedCommissionCents, t.currency)} · Difference:{' '}
                    {money(t.commissionDifferenceCents, t.currency)}
                  </p>
                </article>
              ))}
              <p>
                {query.data.total} attributed purchases match these filters. Summary totals cover
                all matches, not just this page.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void query.refetch()}>
                  Refresh sales report
                </Button>
                <Button
                  variant="outline"
                  disabled={exporting || query.data.total > 10000}
                  onClick={() => void download()}
                >
                  {exporting ? 'Exporting…' : 'Export filtered sales CSV'}
                </Button>
              </div>
              {query.data.total > 10000 && (
                <p>Narrow the filters to at most 10,000 sales to export.</p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr>
                      {[
                        'Purchase / provider',
                        'Package / status',
                        'HT price / refunds TTC',
                        'Eligible HT / commission',
                        'Verification',
                      ].map((h) => (
                        <th className="p-2" key={h}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {query.data.rows.map((s) => (
                      <tr key={s.purchaseId} className="border-t">
                        <td className="p-2">
                          <span className="break-all">{s.purchaseId}</span>
                          <br />
                          {s.companyName}
                          <br />
                          <span className="break-all">{s.providerCode}</span>
                          <br />
                          {new Date(s.createdAt).toLocaleString('en-GB')}
                        </td>
                        <td className="p-2">
                          {s.packageName}
                          <br />
                          {s.status}
                        </td>
                        <td className="p-2">
                          {money(s.netPriceCents, s.currency)}
                          <br />
                          {money(s.refundedGrossCents, s.currency)}
                        </td>
                        <td className="p-2">
                          {money(s.eligibleNetCents, s.currency)}
                          <br />
                          Policy: {money(s.targetCommissionCents, s.currency)}
                          <br />
                          Ledger: {money(s.postedCommissionCents, s.currency)}
                        </td>
                        <td className="p-2">
                          {s.paymentVerifiedAt
                            ? new Date(s.paymentVerifiedAt).toLocaleString('en-GB')
                            : 'Not independently verified'}
                          {s.anomaly && <strong className="block">Finance anomaly</strong>}
                          {s.commissionDifferenceCents !== '0' && (
                            <strong className="block">
                              Ledger difference: review reconciliation
                            </strong>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {query.data.total === 0 && <p>No attributed sales match.</p>}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={page === 0 || query.isFetching}
                  onClick={() => setPage(page - 1)}
                >
                  Previous sales page
                </Button>
                <span>Page {page + 1}</span>
                <Button
                  variant="outline"
                  disabled={
                    query.isFetching || (page + 1) * query.data.pageSize >= query.data.total
                  }
                  onClick={() => setPage(page + 1)}
                >
                  Next sales page
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
