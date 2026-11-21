import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import RelationshipIdentifiers, {
  EmployeeIdentifierRegistry,
} from '@/components/providers/RelationshipIdentifiers';
import { api } from '@/lib/api';
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { userId: 'reviewer', organisationId: 'operator' } }),
}));
function page(component: React.ReactNode) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      {component}
    </QueryClientProvider>
  );
}
const identifier = {
  id: 'identifier',
  code: 'PRV-reference',
  kind: 'provider_code',
  status: 'active',
  revision: 2,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.get).mockResolvedValue([identifier]);
  vi.mocked(api.post).mockResolvedValue({});
});
it('shows the owner references without administrative controls', async () => {
  page(<RelationshipIdentifiers />);
  expect(api.get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Manage identifiers' }));
  await screen.findByText('PRV-reference');
  expect(screen.queryByLabelText('Identifier status')).not.toBeInTheDocument();
  expect(api.get).toHaveBeenCalledWith('/api/v1/relationship-identifiers/me');
});
it('sends a reason and expected revision for manual suspension and verifies history separately', async () => {
  vi.mocked(api.get).mockImplementation(async (path) =>
    path.endsWith('/events')
      ? {
          events: [
            {
              revision: 1,
              occurred_at: '2026-11-21T10:00:00Z',
              snapshot: {
                status: 'active',
                reason: 'Reference originally issued',
                actor_id: 'admin',
              },
            },
          ],
        }
      : [identifier]
  );
  page(<RelationshipIdentifiers applicationId="application" />);
  fireEvent.click(screen.getByRole('button', { name: 'Manage identifiers' }));
  await screen.findByLabelText('Identifier status');
  fireEvent.change(screen.getByLabelText('Identifier decision reason'), {
    target: { value: 'Reference suspended for review' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Record identifier decision' }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/api/v1/relationship-identifiers/identifier/status', {
      revision: 2,
      status: 'suspended',
      reason: 'Reference suspended for review',
    })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Verify identifier history' }));
  await screen.findByText(/Reference originally issued/);
});
it('never offers reactivation of a revoked identifier', async () => {
  vi.mocked(api.get).mockResolvedValue([{ ...identifier, status: 'revoked' }]);
  page(<RelationshipIdentifiers applicationId="application" />);
  fireEvent.click(screen.getByRole('button', { name: 'Manage identifiers' }));
  await screen.findByText(/Revoked permanently/);
  expect(screen.queryByLabelText('Identifier status')).not.toBeInTheDocument();
});
it('requires explicit employment verification and a signed dossier reference', async () => {
  page(<EmployeeIdentifierRegistry />);
  const button = screen.getByRole('button', { name: 'Issue employee identifier' });
  expect(button).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Employee account UUID'), {
    target: { value: 'employee' },
  });
  fireEvent.change(screen.getByLabelText('Employee organisation UUID'), {
    target: { value: 'organisation' },
  });
  fireEvent.change(screen.getByLabelText('Signed employment agreement UUID'), {
    target: { value: 'agreement' },
  });
  fireEvent.change(screen.getByLabelText('Employment verification record'), {
    target: { value: 'Employment and signed agreement verified' },
  });
  fireEvent.click(
    screen.getByLabelText('I verified this employment relationship and its signed agreement.')
  );
  fireEvent.click(button);
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/api/v1/relationship-identifiers/employees', {
      userId: 'employee',
      organisationId: 'organisation',
      agreementDocumentId: 'agreement',
      reason: 'Employment and signed agreement verified',
      employmentVerified: true,
    })
  );
});
