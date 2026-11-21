import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProviderSalesReport from '@/components/providers/ProviderSalesReport';
import { api } from '@/lib/api';
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), download: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { userId: 'reviewer', organisationId: 'operator' } }),
}));
const report = {
  generatedAt: '2026-11-21T12:00:00Z',
  scope: 'Attributed provider purchases',
  basis: {
    id: 'package-ht-proportional-refunds-v1',
    description: '17% before processing/bank fees; verified amounts only',
  },
  pageSize: 50,
  total: 0,
  summary: [],
  rows: [],
};
function page() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ProviderSalesReport />
    </QueryClientProvider>
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.get).mockResolvedValue(report);
  vi.mocked(api.download).mockResolvedValue(undefined);
});
it('loads only on demand and explains the existing before-fee basis', async () => {
  page();
  expect(api.get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Open sales report' }));
  await screen.findByText('No attributed sales match.');
  expect(screen.getByText(/17% before processing/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Next sales page' })).toBeDisabled();
});
it('sends explicit filters, exports the applied scope and preserves errors from the server', async () => {
  page();
  fireEvent.click(screen.getByRole('button', { name: 'Open sales report' }));
  await screen.findByText('No attributed sales match.');
  fireEvent.change(screen.getByLabelText('Purchase date from (UTC, inclusive)'), {
    target: { value: '2026-11-01' },
  });
  fireEvent.change(screen.getByLabelText('Purchase date until (UTC, exclusive)'), {
    target: { value: '2026-12-01' },
  });
  fireEvent.change(screen.getByLabelText('Currency (optional, e.g. gbp)'), {
    target: { value: 'gbp' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply sales filters' }));
  await waitFor(() =>
    expect(api.get).toHaveBeenCalledWith(
      '/api/v1/provider-sales/report?from=2026-11-01&until=2026-12-01&page=0&currency=gbp'
    )
  );
  fireEvent.click(await screen.findByRole('button', { name: 'Export filtered sales CSV' }));
  await waitFor(() =>
    expect(api.download).toHaveBeenCalledWith(
      '/api/v1/provider-sales/report?from=2026-11-01&until=2026-12-01&page=0&currency=gbp&format=csv',
      'provider-sales.csv'
    )
  );
});
it('shows an operator-authority refusal instead of claiming there were no sales', async () => {
  vi.mocked(api.get).mockRejectedValue(new Error('Recruitment reviewer authority required'));
  page();
  fireEvent.click(screen.getByRole('button', { name: 'Open sales report' }));
  await screen.findByRole('alert');
  expect(screen.getByText('Recruitment reviewer authority required')).toBeInTheDocument();
  expect(screen.queryByText('No attributed sales match.')).not.toBeInTheDocument();
});
it('keeps summary totals separate by currency and marks unverified rows and ledger differences', async () => {
  vi.mocked(api.get).mockResolvedValue({
    ...report,
    total: 51,
    summary: [
      {
        currency: 'gbp',
        sales: 50,
        unverified: 1,
        disputed: 1,
        anomalies: 0,
        verifiedRetainedGrossCents: '12000',
        eligibleNetCents: '10000',
        targetCommissionCents: '1700',
        postedCommissionCents: '1701',
        commissionDifferenceCents: '-1',
      },
      {
        currency: 'eur',
        sales: 1,
        unverified: 0,
        disputed: 0,
        anomalies: 0,
        verifiedRetainedGrossCents: '12000',
        eligibleNetCents: '10000',
        targetCommissionCents: '1700',
        postedCommissionCents: '1700',
        commissionDifferenceCents: '0',
      },
    ],
    rows: [
      {
        purchaseId: 'sale',
        createdAt: '2026-11-21T12:00:00Z',
        companyName: 'Seller',
        providerCode: 'PRV-test',
        packageName: 'Starter',
        status: 'requires_confirmation',
        currency: 'gbp',
        netPriceCents: '10000',
        refundedGrossCents: '0',
        eligibleNetCents: '0',
        targetCommissionCents: '0',
        postedCommissionCents: '1',
        commissionDifferenceCents: '-1',
        paymentVerifiedAt: null,
        anomaly: false,
      },
    ],
  });
  page();
  fireEvent.click(screen.getByRole('button', { name: 'Open sales report' }));
  await screen.findByText('GBP: 50 sales');
  expect(screen.getByText('EUR: 1 sales')).toBeInTheDocument();
  expect(screen.getByText('Not independently verified')).toBeInTheDocument();
  expect(screen.getByText('Ledger difference: review reconciliation')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Next sales page' })).toBeEnabled();
});
