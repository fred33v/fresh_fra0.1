import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FinanceHub from '@/components/finance/FinanceHub';
import { api } from '@/lib/api';
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { userId: 'finance-staff', organisationId: 'operator' } }),
}));
const supplier = { id: 'supplier', code: 'SUP-fixture', kind: 'supplier', status: 'active' };
const payroll = { id: 'employee', code: 'EMP-fixture', kind: 'employee', status: 'active' };
const profile = {
  id: 'profile',
  identifier_id: 'supplier',
  kind: 'supplier',
  version: 1,
  revision: 1,
  last4: '2345',
  status: 'submitted',
  verification_method: null,
};
let data: { identities: unknown[]; profiles: unknown[]; fees: unknown[]; instructions: unknown[] };
function page() {
  return render(
    <MemoryRouter>
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
          })
        }
      >
        <FinanceHub />
      </QueryClientProvider>
    </MemoryRouter>
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  data = { identities: [supplier, payroll], profiles: [], fees: [], instructions: [] };
  vi.mocked(api.get).mockImplementation(async (path) =>
    path.endsWith('/config')
      ? { bankVaultReady: true, financeAccess: true }
      : path.includes('/identities')
        ? data.identities
        : path.includes('/profiles')
          ? data.profiles
          : path.includes('/fees')
            ? data.fees
            : path.includes('/instructions')
              ? data.instructions
              : []
  );
  vi.mocked(api.post).mockResolvedValue({});
});
it('collects bank data only for the selected relationship and clears sensitive fields after submission', async () => {
  page();
  await screen.findByLabelText('Account holder name');
  fireEvent.change(screen.getByLabelText('Account holder name'), {
    target: { value: 'Synthetic Supplier Ltd' },
  });
  fireEvent.change(screen.getByLabelText('UK sort code'), { target: { value: '10-88-00' } });
  fireEvent.change(screen.getByLabelText('UK account number'), { target: { value: '00012345' } });
  fireEvent.change(screen.getByLabelText('Confirm account number'), {
    target: { value: '00012345' },
  });
  fireEvent.click(
    screen.getByLabelText(
      'I am authorised to receive payments into this account and these details are accurate.'
    )
  );
  fireEvent.click(screen.getByRole('button', { name: 'Submit encrypted bank details' }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/api/v1/finance/profiles', {
      identifierId: 'supplier',
      expectedVersion: 0,
      accountHolder: 'Synthetic Supplier Ltd',
      sortCode: '10-88-00',
      accountNumber: '00012345',
      declaration: true,
    })
  );
  await waitFor(() => expect(screen.getByLabelText('UK account number')).toHaveValue(''));
  expect(screen.getByLabelText('UK sort code')).toHaveValue('');
});
it('fails closed in the UI when the private bank vault is unavailable', async () => {
  vi.mocked(api.get).mockImplementation(async (path) =>
    path.endsWith('/config')
      ? { bankVaultReady: false, financeAccess: false }
      : path.includes('/identities')
        ? [supplier]
        : []
  );
  page();
  await screen.findByText(/The secure bank vault is not configured/);
  expect(screen.getByRole('button', { name: 'Submit encrypted bank details' })).toBeDisabled();
});
it('keeps internal evidence approval disabled until an explicit checked reference is supplied', async () => {
  data.profiles = [profile];
  page();
  fireEvent.click(await screen.findByLabelText('Restricted finance review view'));
  const approve = await screen.findByRole('button', { name: 'Approve payment profile' });
  expect(approve).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Beneficiary evidence review purpose / reason'), {
    target: { value: 'Independently checked bank evidence' },
  });
  fireEvent.change(
    screen.getByLabelText('Beneficiary verification evidence reference (no bank numbers)'),
    { target: { value: 'SYNTHETIC-REVIEW-REF' } }
  );
  fireEvent.click(
    screen.getByLabelText(
      'I independently checked beneficiary evidence. This is staff review, not automatic bank verification.'
    )
  );
  fireEvent.click(approve);
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/api/v1/finance/profiles/profile/review', {
      revision: 1,
      status: 'approved',
      reason: 'Independently checked bank evidence',
      verificationReference: 'SYNTHETIC-REVIEW-REF',
      evidenceChecked: true,
    })
  );
});
it('lets the supplier accept exact fee terms independently of commission and finance controls', async () => {
  data.fees = [
    {
      id: 'fee',
      identifier_id: 'supplier',
      delivery_id: 'delivery',
      version: 2,
      revision: 1,
      net_cents: 5000,
      vat_cents: 1000,
      total_cents: 6000,
      status: 'proposed',
      terms: 'Agreed fixed service scope, GBP 50 plus GBP 10 invoice VAT.',
    },
  ];
  page();
  fireEvent.click(await screen.findByRole('button', { name: 'Accept these service fee terms' }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/api/v1/finance/fees/fee/decision', {
      revision: 1,
      status: 'accepted',
    })
  );
});
it('prepares payroll as gross-period instructions using only an approved employee profile', async () => {
  data.profiles = [
    {
      ...profile,
      id: 'employee-profile',
      identifier_id: 'employee',
      kind: 'payroll',
      status: 'approved',
    },
  ];
  page();
  fireEvent.click(await screen.findByLabelText('Restricted finance review view'));
  fireEvent.change(await screen.findByLabelText('Payment channel'), {
    target: { value: 'payroll_gross' },
  });
  await screen.findByText(/Do not transfer this gross amount as net wages/);
  fireEvent.change(screen.getByLabelText('Agreed gross pay (GBP)'), {
    target: { value: '1200.00' },
  });
  fireEvent.change(screen.getByLabelText('Pay period from (inclusive)'), {
    target: { value: '2026-11-01' },
  });
  fireEvent.change(screen.getByLabelText('Pay period until (exclusive)'), {
    target: { value: '2026-12-01' },
  });
  fireEvent.change(screen.getByLabelText('Finance preparation reason'), {
    target: { value: 'November external payroll gross instruction' },
  });
  fireEvent.click(
    screen.getByRole('button', { name: 'Prepare instruction for independent approval' })
  );
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      '/api/v1/finance/instructions',
      expect.objectContaining({
        kind: 'payroll_gross',
        profileId: 'employee-profile',
        grossCents: 120000,
        periodFrom: '2026-11-01',
        periodUntil: '2026-12-01',
        reason: 'November external payroll gross instruction',
      })
    )
  );
});
it('displays generated references and keeps the preparer from approving the same instruction', async () => {
  data.instructions = [
    {
      id: 'instruction',
      identifier_id: 'employee',
      kind: 'payroll_gross',
      gross_cents: 120000,
      revision: 1,
      status: 'prepared',
      instruction_reference: 'FRA-PAYROLL-generated',
      confirmation_reference: null,
      external_reference: null,
      recording_method: null,
      prepared_by: 'finance-staff',
    },
  ];
  page();
  fireEvent.click(await screen.findByLabelText('Restricted finance review view'));
  await screen.findByText('Generated instruction reference: FRA-PAYROLL-generated');
  fireEvent.change(screen.getByLabelText('Independent finance decision reason'), {
    target: { value: 'Preparer cannot self-approve this instruction' },
  });
  expect(screen.getByRole('button', { name: 'Approve instruction' })).toBeDisabled();
});
