import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Partners from '@/pages/Partners';
import PartnerReviews from '@/pages/PartnerReviews';
import { api } from '@/lib/api';
import type { ProviderApplication } from '@/lib/providers';
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { userId: 'fixture-user', email: 'owner@example.test', role: 'admin' } }),
}));
vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
const confirm = vi.fn();
vi.mock('@/hooks/useConfirm', () => ({ useConfirm: () => confirm }));
const mocked = vi.mocked(api);
let application: ProviderApplication;
const policy = {
  commissionBasisPoints: 1700,
  termsVersion: 'provider-programme-2026-11',
  payoutsActive: false,
  canReview: false,
};
function show(path = '/partners') {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/partners" element={<Partners />} />
          <Route path="/partners/review/:id" element={<PartnerReviews />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  confirm.mockResolvedValue(true);
  application = {
    id: 'app-1',
    profile: {
      fullName: 'Alex Morgan',
      engagement: {
        model: 'independent_no_minimum',
        formVersion: 'independent-engagement-2026-11-v1',
        legalStructure: 'sole_trader',
        companyNumber: '',
        businessAddress: {
          line1: '10 Example Street',
          line2: '',
          city: 'London',
          postalCode: 'SW1A 1AA',
        },
        vatRegistered: 'no',
        vatNumber: '',
        availability: 'Available for independently agreed assignments on weekdays.',
        declineAssignments: 'yes',
        deliveryControl: 'self',
        otherClients: 'yes',
        personalService: 'substitution_by_agreement',
        declarationName: 'Alex Morgan',
        noMinimumAccepted: true,
        commissionAccepted: true,
        informationAccurate: true,
      },
      businessName: 'Example Prevention',
      country: 'GB',
      kind: 'both',
      website: '',
      expertise: ['training'],
      experience: 'We support organisations through fraud training and relevant referrals.',
    },
    contactEmail: 'owner@example.test',
    status: 'submitted',
    version: 1,
    commissionBasisPoints: 1700,
    termsVersion: policy.termsVersion,
    submittedAt: '2026-11-19T10:00:00Z',
    updatedAt: '2026-11-19T10:00:00Z',
    reviewedAt: null,
    reviewMessage: null,
    payoutsActive: false,
    independentEngagementComplete: true,
    history: [],
  };
  mocked.get.mockResolvedValue({ application: null, policy });
});
it('requires explicit acknowledgement and submits only applicant-owned fields', async () => {
  const user = userEvent.setup();
  mocked.post.mockResolvedValue({ application });
  show();
  await screen.findByLabelText('Full name');
  expect(screen.getByRole('button', { name: 'Submit application' })).toBeDisabled();
  await user.type(screen.getByLabelText('Full name'), 'Alex Morgan');
  await user.type(screen.getByLabelText('Business or professional name'), 'Example Prevention');
  await user.click(screen.getByRole('checkbox', { name: 'Training' }));
  await user.type(
    screen.getByLabelText('Experience and proposed contribution'),
    application.profile.experience
  );
  await user.selectOptions(screen.getByLabelText('Business legal structure'), 'sole_trader');
  await user.type(
    screen.getByLabelText('Business correspondence address'),
    application.profile.engagement!.businessAddress.line1
  );
  await user.type(
    screen.getByLabelText('Town / city'),
    application.profile.engagement!.businessAddress.city
  );
  await user.type(
    screen.getByLabelText('Postcode / postal code'),
    application.profile.engagement!.businessAddress.postalCode
  );
  await user.selectOptions(screen.getByLabelText('Are you VAT registered?'), 'no');
  await user.type(
    screen.getByLabelText('Availability and preferred working arrangements'),
    application.profile.engagement!.availability
  );
  await user.selectOptions(
    screen.getByLabelText('Can you choose whether to accept a proposed assignment?'),
    'yes'
  );
  await user.selectOptions(
    screen.getByLabelText('Who would normally decide how the agreed services are delivered?'),
    'self'
  );
  await user.selectOptions(
    screen.getByLabelText('Do you currently provide services to other clients?'),
    'yes'
  );
  await user.selectOptions(
    screen.getByLabelText('What personal-service arrangement is proposed?'),
    'substitution_by_agreement'
  );
  await user.click(screen.getByRole('checkbox', { name: /I understand that no minimum/ }));
  await user.click(screen.getByRole('checkbox', { name: /I understand the 17%/ }));
  await user.click(screen.getByRole('checkbox', { name: /I confirm the business information/ }));
  await user.type(screen.getByLabelText('Declaration full name'), 'Alex Morgan');
  await user.click(screen.getByRole('checkbox', { name: /I confirm these details/ }));
  mocked.get.mockResolvedValue({ application, policy });
  await user.click(screen.getByRole('button', { name: 'Submit application' }));
  await waitFor(() =>
    expect(mocked.post).toHaveBeenCalledWith('/api/v1/providers/me', {
      version: 0,
      profile: application.profile,
      acknowledged: true,
    })
  );
  expect(
    await screen.findByText('Your application has been submitted. You can follow its review here.')
  ).toBeInTheDocument();
  expect(mocked.post.mock.calls[0][1]).not.toHaveProperty('commissionBasisPoints');
});
it('does not offer submissions when the service is disabled', async () => {
  mocked.get.mockRejectedValue(new Error('Partner applications are not enabled yet'));
  show();
  expect(await screen.findByRole('alert')).toHaveTextContent('not enabled');
  expect(screen.queryByRole('button', { name: 'Submit application' })).not.toBeInTheDocument();
});
it('shows approval separately from payout activation and keeps historical revisions visible', async () => {
  application.status = 'approved';
  application.version = 2;
  application.reviewMessage = 'Approved for the programme. Verification remains separate.';
  application.history = [
    {
      id: 'event-1',
      version: 1,
      event: 'application.submitted',
      actorRole: 'employee',
      createdAt: application.submittedAt,
      profile: { ...application.profile, businessName: 'Original Professional Name' },
      contactEmail: application.contactEmail,
      status: 'submitted',
      message: null,
    },
  ];
  mocked.get.mockResolvedValue({ application, policy });
  show();
  expect(await screen.findByText('Approved', { exact: true })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Update & resubmit' })).not.toBeInTheDocument();
  expect(
    screen.getByText(/Stripe recipient verification and payout activation are a separate step/)
  ).toBeInTheDocument();
  await userEvent.click(screen.getByText('Details recorded at this revision'));
  expect(screen.getByText(/Original Professional Name/)).toBeInTheDocument();
});
it('prevents self-review and offers no decision controls for the applicant', async () => {
  mocked.get.mockResolvedValue({ application, canReview: false });
  show('/partners/review/app-1');
  expect(
    await screen.findByText('Another administrator must review your own application.')
  ).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Record decision' })).not.toBeInTheDocument();
});
it('honours confirmation cancellation and then records a versioned applicant-visible decision', async () => {
  const user = userEvent.setup();
  mocked.get.mockResolvedValue({ application, canReview: true });
  confirm.mockResolvedValueOnce(false);
  show('/partners/review/app-1');
  await user.selectOptions(await screen.findByLabelText('Decision'), 'approved');
  await user.type(
    screen.getByLabelText('Message to the applicant'),
    'Reviewed for programme membership.'
  );
  await user.click(screen.getByRole('checkbox', { name: /I have reviewed the candidate/ }));
  await user.click(screen.getByRole('button', { name: 'Record decision' }));
  await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
  expect(mocked.post).not.toHaveBeenCalled();
  mocked.post.mockResolvedValue({
    application: { ...application, status: 'approved', version: 2 },
    canReview: true,
  });
  mocked.get.mockResolvedValue({
    application: { ...application, status: 'approved', version: 2 },
    canReview: true,
  });
  await user.click(screen.getByRole('button', { name: 'Record decision' }));
  await waitFor(() =>
    expect(mocked.post).toHaveBeenCalledWith('/api/v1/providers/admin/applications/app-1/review', {
      version: 1,
      status: 'approved',
      message: 'Reviewed for programme membership.',
      engagementReviewed: true,
    })
  );
  expect(
    await screen.findByText('Decision recorded. Payouts remain inactive.')
  ).toBeInTheDocument();
});

it('shows company and VAT fields only when relevant and clears a stale VAT declaration', async () => {
  const user = userEvent.setup();
  show();
  await user.selectOptions(
    await screen.findByLabelText('Business legal structure'),
    'limited_company'
  );
  expect(screen.getByLabelText('Company / LLP registration number')).toBeRequired();
  await user.selectOptions(screen.getByLabelText('Are you VAT registered?'), 'yes');
  await user.type(screen.getByLabelText('Declared VAT registration number'), 'GB123456789');
  await user.selectOptions(screen.getByLabelText('Are you VAT registered?'), 'no');
  expect(screen.queryByLabelText('Declared VAT registration number')).not.toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText('Are you VAT registered?'), 'yes');
  expect(screen.getByLabelText('Declared VAT registration number')).toHaveValue('');
  expect(mocked.post).not.toHaveBeenCalled();
});
it('preserves a legacy application without inventing declarations or offering approval', async () => {
  delete application.profile.engagement;
  application.independentEngagementComplete = false;
  mocked.get.mockResolvedValue({ application, canReview: true });
  show('/partners/review/app-1');
  expect(
    await screen.findByText(/Independent engagement forms were not supplied at this revision/)
  ).toBeInTheDocument();
  expect(screen.queryByRole('option', { name: 'Approved' })).not.toBeInTheDocument();
  expect(screen.queryByText(/Declaration recorded as/)).not.toBeInTheDocument();
});
