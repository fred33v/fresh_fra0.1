import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProviderApplication from '@/pages/ProviderApplication';
import ProviderReview from '@/pages/ProviderReview';
import { api } from '@/lib/api';
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), download: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { userId: 'user', organisationId: 'org', role: 'admin' } }),
}));
vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
function page(component: React.ReactNode) {
  return render(
    <MemoryRouter>
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
          })
        }
      >
        {component}
      </QueryClientProvider>
    </MemoryRouter>
  );
}
beforeEach(() => vi.resetAllMocks());
it('submits a training application with experience and verified identity supplied by server', async () => {
  vi.mocked(api.get).mockImplementation(async (path) =>
    path.endsWith('/statement') ? { balances: [], entries: [], payouts: [] } : null
  );
  vi.mocked(api.post).mockResolvedValue({ companyName: 'Training Ltd', status: 'submitted' });
  page(<ProviderApplication />);
  fireEvent.change(await screen.findByLabelText('Company name'), {
    target: { value: 'Training Ltd' },
  });
  fireEvent.change(screen.getByLabelText('I want to'), { target: { value: 'training' } });
  fireEvent.change(screen.getByLabelText('Training experience and qualifications'), {
    target: { value: 'Ten years delivering workshops' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));
  await screen.findByText(/Awaiting review/);
  expect(api.post).toHaveBeenCalledWith('/api/v1/provider-applications/me', {
    companyName: 'Training Ltd',
    serviceInterest: 'training',
    trainingExperience: 'Ten years delivering workshops',
  });
});
it('allows the approved applicant to accept an offer', async () => {
  vi.mocked(api.get).mockImplementation(async (path) =>
    path.endsWith('/statement')
      ? { balances: [], entries: [], payouts: [] }
      : path.endsWith('/assignments')
        ? [
            {
              id: 'offer',
              packageName: 'Starter',
              reference: 'WORK-1',
              service: 'sales',
              status: 'offered',
            },
          ]
        : { companyName: 'Sales Ltd', status: 'approved', providerCode: 'PRV-reference' }
  );
  vi.mocked(api.post).mockResolvedValue({ status: 'accepted' });
  page(<ProviderApplication />);
  fireEvent.click(await screen.findByRole('button', { name: 'Accept WORK-1' }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      '/api/v1/provider-applications/me/assignments/offer/decision',
      { status: 'accepted' }
    )
  );
  expect(screen.getByText('PRV-reference')).toBeInTheDocument();
});
it('shows a permission error instead of an empty review queue', async () => {
  vi.mocked(api.get).mockRejectedValue(new Error('Recruitment reviewer authority required'));
  page(<ProviderReview />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Recruitment reviewer authority required'
  );
  expect(screen.queryByText('No applications yet.')).not.toBeInTheDocument();
});
it('submits an approval with concurrency revision, agreement and qualification evidence', async () => {
  vi.mocked(api.get).mockImplementation(async (path) =>
    path.endsWith('/statement')
      ? { balances: [], entries: [], payouts: [] }
      : path.includes('/review?')
        ? [
            {
              id: 'application',
              applicantName: 'Alice',
              applicantEmail: 'alice@example.test',
              companyName: 'Training Ltd',
              serviceInterest: 'training',
              trainingExperience: 'Workshop delivery',
              status: 'submitted',
              revision: 3,
            },
          ]
        : []
  );
  vi.mocked(api.post).mockResolvedValue({});
  page(<ProviderReview />);
  fireEvent.change(await screen.findByLabelText('Decision reason (visible to applicant)'), {
    target: { value: 'Checked references and agreement' },
  });
  fireEvent.change(screen.getByLabelText('Completed signing document UUID'), {
    target: { value: 'agreement-id' },
  });
  fireEvent.change(
    screen.getByLabelText('Qualification verification and training demonstration evidence'),
    { target: { value: 'Register verified and demo observed' } }
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save review decision' }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/api/v1/provider-applications/application/review', {
      revision: 3,
      status: 'approved',
      reason: 'Checked references and agreement',
      qualificationEvidence: 'Register verified and demo observed',
      agreementDocumentId: 'agreement-id',
    })
  );
});
const reviewQueue = (application: object, packages: object[] = []) =>
  vi
    .mocked(api.get)
    .mockImplementation(async (path) =>
      path.endsWith('/statement')
        ? { balances: [], entries: [], payouts: [] }
        : path.includes('/review?')
          ? [application]
          : path.endsWith('/api/v1/packages')
            ? packages
            : []
    );
it('lets a reviewer reopen a declined application instead of leaving it stuck', async () => {
  reviewQueue({
    id: 'application',
    applicantName: 'Alice',
    applicantEmail: 'alice@example.test',
    companyName: 'Sales Ltd',
    serviceInterest: 'sales',
    status: 'declined',
    revision: 2,
  });
  vi.mocked(api.post).mockResolvedValue({});
  page(<ProviderReview />);
  const decision = await screen.findByLabelText('Decision');
  expect(decision).toHaveValue('submitted');
  expect(screen.queryByRole('option', { name: 'Approve' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Decision reason (visible to applicant)'), {
    target: { value: 'Evidence supplied later' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save review decision' }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/api/v1/provider-applications/application/review', {
      revision: 2,
      status: 'submitted',
      reason: 'Evidence supplied later',
    })
  );
});
it('offers the first package in the catalogue, not a fixed id that may be inactive', async () => {
  reviewQueue(
    {
      id: 'application',
      applicantName: 'Alice',
      applicantEmail: 'alice@example.test',
      companyName: 'Sales Ltd',
      serviceInterest: 'sales',
      status: 'approved',
      revision: 1,
    },
    [
      { id: 'pkg_pro', name: 'Professional' },
      { id: 'pkg_plus', name: 'Plus' },
    ]
  );
  vi.mocked(api.post).mockResolvedValue({});
  page(<ProviderReview />);
  await screen.findByRole('option', { name: 'Professional' });
  fireEvent.change(screen.getByLabelText('Unique work reference'), { target: { value: 'WORK-1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Offer assignment' }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/api/v1/provider-applications/application/assignments', {
      packageId: 'pkg_pro',
      reference: 'WORK-1',
      service: 'sales',
    })
  );
});

it('amends a declined application with its expected revision while retaining the statement view', async () => {
  vi.mocked(api.get).mockImplementation(async (path) =>
    path.endsWith('/statement')
      ? { balances: [], entries: [], payouts: [] }
      : {
          id: 'app',
          companyName: 'Original Ltd',
          serviceInterest: 'sales',
          revision: 2,
          status: 'declined',
          providerCode: null,
        }
  );
  vi.mocked(api.post).mockResolvedValue({
    id: 'app',
    companyName: 'Updated Ltd',
    serviceInterest: 'sales',
    revision: 3,
    status: 'submitted',
    providerCode: null,
  });
  page(<ProviderApplication />);
  fireEvent.click(await screen.findByRole('button', { name: 'Amend and resubmit application' }));
  fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'Updated Ltd' } });
  fireEvent.click(screen.getByRole('button', { name: 'Resubmit candidate amendment' }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/api/v1/provider-applications/me/amend', {
      revision: 2,
      companyName: 'Updated Ltd',
      serviceInterest: 'sales',
      trainingExperience: undefined,
    })
  );
  expect(await screen.findByText(/Updated Ltd — Awaiting review/)).toBeInTheDocument();
});
it('keeps approved candidates out of the amendment form and uses the existing scoped dossier endpoint', async () => {
  vi.mocked(api.get).mockImplementation(async (path) =>
    path.endsWith('/statement')
      ? { balances: [], entries: [], payouts: [] }
      : path.endsWith('/assignments')
        ? []
        : {
            id: 'app',
            companyName: 'Approved Ltd',
            status: 'approved',
            providerCode: 'PRV-kept',
            revision: 1,
          }
  );
  page(<ProviderApplication />);
  const download = await screen.findByRole('button', {
    name: 'Download agreement preparation dossier',
  });
  expect(
    screen.queryByRole('button', { name: 'Amend and resubmit application' })
  ).not.toBeInTheDocument();
  fireEvent.click(download);
  await waitFor(() =>
    expect(api.download).toHaveBeenCalledWith(
      '/api/v1/provider-applications/me/dossier',
      'provider-agreement-dossier.txt'
    )
  );
  expect(screen.getByText('PRV-kept')).toBeInTheDocument();
});
it('collects an optional independent declaration without overriding the existing company/sales contract', async () => {
  vi.mocked(api.get).mockImplementation(async (path) =>
    path.endsWith('/statement') ? { balances: [], entries: [], payouts: [] } : null
  );
  vi.mocked(api.post).mockResolvedValue({
    id: 'app',
    companyName: 'Independent Ltd',
    serviceInterest: 'sales',
    status: 'submitted',
    revision: 0,
  });
  page(<ProviderApplication />);
  fireEvent.change(await screen.findByLabelText('Company name'), {
    target: { value: 'Independent Ltd' },
  });
  fireEvent.click(
    screen.getByLabelText('Include an independent candidate declaration (no guaranteed minimum)')
  );
  expect(screen.getByRole('button', { name: 'Submit application' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Candidate full name'), {
    target: { value: 'Alex Morgan' },
  });
  fireEvent.click(screen.getByLabelText('Training', { exact: true }));
  fireEvent.change(screen.getByLabelText('Experience and proposed contribution'), {
    target: { value: 'Independently agreed training and prevention services.' },
  });
  fireEvent.change(screen.getByLabelText('Business legal structure'), {
    target: { value: 'sole_trader' },
  });
  for (const [label, value] of [
    ['Business correspondence address', '10 Example Street'],
    ['Town / city', 'London'],
    ['Postcode / postal code', 'SW1A 1AA'],
  ])
    fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
  fireEvent.change(screen.getByLabelText('Are you VAT registered?'), { target: { value: 'no' } });
  fireEvent.change(screen.getByLabelText('Availability and preferred working arrangements'), {
    target: { value: 'By agreement on weekdays.' },
  });
  for (const label of [
    'Can you choose whether to accept a proposed assignment?',
    'Do you currently provide services to other clients?',
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value: 'not_sure' } });
  fireEvent.change(
    screen.getByLabelText('Who would normally decide how the agreed services are delivered?'),
    { target: { value: 'shared' } }
  );
  fireEvent.change(screen.getByLabelText('What personal-service arrangement is proposed?'), {
    target: { value: 'substitution_by_agreement' },
  });
  for (const label of [
    /I understand that no minimum/,
    /I understand the 17%/,
    /I confirm the business information/,
  ])
    fireEvent.click(screen.getByRole('checkbox', { name: label }));
  fireEvent.change(screen.getByLabelText('Declaration full name'), {
    target: { value: 'Alex Morgan' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Submit application' }));
  await waitFor(() => expect(api.post).toHaveBeenCalled());
  expect(vi.mocked(api.post).mock.calls[0][1]).toMatchObject({
    companyName: 'Independent Ltd',
    serviceInterest: 'sales',
    candidateProfile: {
      businessName: 'Independent Ltd',
      fullName: 'Alex Morgan',
      kind: 'referrer',
      engagement: {
        noMinimumAccepted: true,
        informationAccurate: true,
        commissionAccepted: true,
        otherClients: 'not_sure',
      },
    },
  });
  expect(vi.mocked(api.post).mock.calls[0][1]).not.toHaveProperty('commissionRate');
});
