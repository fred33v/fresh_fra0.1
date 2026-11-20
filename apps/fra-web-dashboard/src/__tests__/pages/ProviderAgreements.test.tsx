import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProviderAgreementPanel from '@/components/providers/ProviderAgreementPanel';
import {
  agreementTermFields,
  type AgreementTerms,
  type ProviderAgreement,
} from '@/lib/providerAgreements';
import type { ProviderApplication } from '@/lib/providers';
import { api } from '@/lib/api';
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), download: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'reviewer' } }) }));
const confirm = vi.fn();
vi.mock('@/hooks/useConfirm', () => ({ useConfirm: () => confirm }));
const mocked = vi.mocked(api);
const terms = Object.fromEntries(
  agreementTermFields.map((f) => [
    f.key,
    f.key === 'signatoryEmail' ? 'signer@example.test' : 'Reviewed terms for this engagement.',
  ])
) as unknown as AgreementTerms;
let application: ProviderApplication, g: ProviderAgreement;
function show(admin = false) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <ProviderAgreementPanel application={application} administrator={admin} />
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
      businessName: 'Example',
      country: 'GB',
      kind: 'both',
      website: '',
      expertise: [],
      experience: 'Example contribution.',
    },
    contactEmail: 'candidate@example.test',
    status: 'approved',
    version: 2,
    commissionBasisPoints: 1700,
    termsVersion: 'provider-programme-2026-11',
    submittedAt: '2026-11-19T00:00:00Z',
    updatedAt: '2026-11-19T00:00:00Z',
    reviewedAt: null,
    reviewMessage: null,
    payoutsActive: false,
    independentEngagementComplete: true,
    agreements: [],
  };
  g = {
    id: 'agreement-1',
    documentId: 'document-1',
    applicationVersion: 2,
    createdAt: '2026-11-19T00:00:00Z',
    terms,
    sourceSha256: 'a'.repeat(64),
    current: true,
    matchingRevision: true,
    documentStatus: 'draft',
    expired: false,
    signedCount: 0,
    signerCount: 2,
    ready: false,
    readyAt: null,
    reviewNote: null,
    state: 'draft',
    payoutsActive: false,
  };
  mocked.get.mockResolvedValue({ agreements: [], canPrepare: true, manageableDocumentIds: [] });
});
it('candidate sees the agreement lifecycle without administrative controls or inferred readiness', () => {
  application.agreements = [
    { ...g, state: 'signed_pending_review', documentStatus: 'completed', signedCount: 2 },
  ];
  show();
  expect(screen.getByText('Signed · administrative review needed')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Prepare services agreement' })
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Open agreement/ })).not.toBeInTheDocument();
  expect(screen.queryByText('Engagement ready', { exact: true })).not.toBeInTheDocument();
});
it('prepares explicit reviewed terms against the current application revision', async () => {
  show(true);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Prepare services agreement' }));
  for (const f of agreementTermFields)
    await user.type(screen.getByLabelText(f.label), terms[f.key]);
  const submit = screen.getByRole('button', { name: 'Prepare agreement PDF' });
  expect(submit).toBeDisabled();
  await user.click(screen.getByLabelText(/reviewed the proposed contract terms/));
  await user.click(screen.getByLabelText(/reviewed the actual working arrangements/));
  mocked.post.mockResolvedValue({ agreements: [g], documentId: g.documentId });
  await user.click(submit);
  await waitFor(() =>
    expect(mocked.post).toHaveBeenCalledWith(
      '/api/v1/providers/admin/applications/app-1/agreements',
      { version: 2, previousAgreementId: null, terms, termsReviewed: true, statusReviewed: true }
    )
  );
  expect(await screen.findByRole('status')).toHaveTextContent('Agreement prepared');
});
it('retains entered terms on a conflict and never implies successful preparation', async () => {
  mocked.get.mockResolvedValue({
    agreements: [g],
    canPrepare: true,
    manageableDocumentIds: [g.documentId],
  });
  mocked.post.mockRejectedValue(new Error('Refresh the latest agreement'));
  show(true);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Prepare a retained replacement' }));
  await user.click(screen.getByLabelText(/reviewed the proposed contract terms/));
  await user.click(screen.getByLabelText(/reviewed the actual working arrangements/));
  await user.click(screen.getByRole('button', { name: 'Prepare agreement PDF' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Refresh the latest agreement');
  expect(screen.getByLabelText('Contracting organisation legal name')).toHaveValue(
    terms.operatorName
  );
  expect(screen.queryByText(/Agreement prepared\. Review/)).not.toBeInTheDocument();
});
it('requires a final human review and retains pending status if evidence verification fails', async () => {
  g = { ...g, state: 'signed_pending_review', documentStatus: 'completed', signedCount: 2 };
  mocked.get.mockResolvedValue({
    agreements: [g],
    canPrepare: true,
    manageableDocumentIds: [g.documentId],
  });
  mocked.post.mockRejectedValue(new Error('Evidence could not be verified'));
  show(true);
  const user = userEvent.setup();
  const button = await screen.findByRole('button', {
    name: 'Verify evidence & record engagement ready',
  });
  expect(button).toBeDisabled();
  await user.type(
    screen.getByLabelText('Readiness review note (visible to candidate)'),
    'Both parties and arrangements reviewed.'
  );
  await user.click(screen.getByLabelText(/reviewed the completed agreement/));
  await user.click(screen.getByLabelText(/confirm the engagement arrangements/));
  await user.click(button);
  await waitFor(() =>
    expect(mocked.post).toHaveBeenCalledWith(
      '/api/v1/providers/admin/applications/app-1/engagement-ready',
      {
        version: 2,
        agreementId: g.id,
        reviewNote: 'Both parties and arrangements reviewed.',
        contractReviewed: true,
        statusReviewed: true,
      }
    )
  );
  expect(await screen.findByRole('alert')).toHaveTextContent('Evidence could not be verified');
  expect(screen.getByText('Signed · administrative review needed')).toBeInTheDocument();
});
it('shows the blocked historical review and downloads only the candidate-linked final endpoint', async () => {
  application.status = 'suspended';
  application.agreements = [
    {
      ...g,
      state: 'blocked',
      documentStatus: 'completed',
      signedCount: 2,
      readyAt: '2026-11-19T00:00:00Z',
    },
  ];
  show();
  expect(
    screen.getByText(/earlier review does not make the current engagement ready/)
  ).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Download verified signed agreement' }));
  expect(mocked.download).toHaveBeenCalledWith(
    '/api/v1/providers/me/agreements/agreement-1/final',
    'signed-services-agreement.pdf'
  );
});
it('offers no contract replacement during an active signing round and no actions for self-review', async () => {
  g = { ...g, state: 'sent', documentStatus: 'sent' };
  mocked.get.mockResolvedValue({ agreements: [g], canPrepare: false, manageableDocumentIds: [] });
  show(true);
  expect(await screen.findByText('Awaiting signatures')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Prepare/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Open agreement/ })).not.toBeInTheDocument();
});
