import { MemoryRouter } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ServiceDeliveries from '@/components/delivery/ServiceDeliveries';
import { api } from '@/lib/api';
vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), upload: vi.fn(), download: vi.fn() },
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { userId: 'account', organisationId: 'organisation' } }),
}));
const summary = {
  id: 'delivery',
  title: 'Customer course',
  status: 'in_progress',
  revision: 1,
  providerName: 'Trainer Ltd',
};
const detail = {
  delivery: {
    id: 'delivery',
    title: 'Customer course',
    status: 'in_progress',
    revision: 1,
    starts_at: '2026-11-21T10:00:00Z',
    ends_at: '2026-11-21T12:00:00Z',
    reason: 'Delivery assigned for customer',
    evidence_summary: null,
  },
  permissions: { provider: true, customer: false, reviewer: false },
  attendance: [],
  learners: [{ id: 'learner', name: 'Learner Fixture', completedAt: '2026-11-21T12:00:00Z' }],
  files: [],
};
function page(props: Parameters<typeof ServiceDeliveries>[0] = {}) {
  return render(
    <MemoryRouter>
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
          })
        }
      >
        <ServiceDeliveries {...props} />
      </QueryClientProvider>
    </MemoryRouter>
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.get).mockImplementation(async (path) =>
    path.includes('/records?')
      ? [summary]
      : path.endsWith('/history')
        ? { verified: true, events: [] }
        : detail
  );
  vi.mocked(api.post).mockResolvedValue({ revision: 2 });
  vi.mocked(api.upload).mockResolvedValue({ id: 'file' });
});
async function open() {
  fireEvent.click(screen.getByRole('button', { name: 'Open deliveries' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Review delivery Customer course' }));
  await screen.findByText('Attendance and learner completion');
}
it('distinguishes enrolment and learner completion from explicitly recorded attendance', async () => {
  page();
  expect(api.get).not.toHaveBeenCalled();
  await open();
  expect(screen.getByText(/Attendance not recorded/)).toBeInTheDocument();
  expect(screen.getByText(/Course completion recorded/)).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Accept delivered service' })
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Decision or attendance reason'), {
    target: { value: 'Trainer checked the actual attendance' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Record attendance' }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/api/v1/service-delivery/delivery/attendance', {
      revision: 1,
      learnerId: 'learner',
      status: 'present',
      reason: 'Trainer checked the actual attendance',
    })
  );
});
it('uploads an authenticated multipart evidence file with the current revision', async () => {
  page();
  await open();
  const file = new File(['%PDF-1.7\nsynthetic evidence'], 'proof.pdf', { type: 'application/pdf' });
  fireEvent.change(screen.getByLabelText('Evidence file (PDF, PNG or JPEG, up to 512 KiB)'), {
    target: { files: [file] },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Upload retained evidence' }));
  await waitFor(() => expect(api.upload).toHaveBeenCalled());
  const [path, form] = vi.mocked(api.upload).mock.calls[0];
  expect(path).toBe('/api/v1/service-delivery/delivery/files');
  expect(form.get('revision')).toBe('1');
  expect(form.get('file')).toBe(file);
});
it('allows the designated customer to decide the exact submitted revision and surface refusals', async () => {
  vi.mocked(api.get).mockImplementation(async (path) =>
    path.includes('/records?')
      ? [summary]
      : {
          ...detail,
          delivery: {
            ...detail.delivery,
            status: 'submitted',
            revision: 5,
            evidence_summary: 'Service completed with retained proof',
          },
          permissions: { provider: false, customer: true, reviewer: false },
        }
  );
  vi.mocked(api.post).mockRejectedValue(new Error('Delivery changed; refresh before deciding'));
  page();
  await open();
  expect(screen.queryByRole('button', { name: 'Record attendance' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Decision or attendance reason'), {
    target: { value: 'Customer reviewed and accepts the evidence' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Accept delivered service' }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/api/v1/service-delivery/delivery/action', {
      revision: 5,
      action: 'accept',
      reason: 'Customer reviewed and accepts the evidence',
    })
  );
  await screen.findByText('Delivery changed; refresh before deciding');
});
it('gives the independent operator rework/cancellation controls without customer acceptance', async () => {
  vi.mocked(api.get).mockImplementation(async (path) =>
    path.includes('/records?')
      ? [summary]
      : {
          ...detail,
          delivery: { ...detail.delivery, status: 'disputed', revision: 9 },
          permissions: { provider: false, customer: false, reviewer: true },
        }
  );
  page({ review: true });
  await open();
  expect(
    screen.queryByRole('button', { name: 'Accept delivered service' })
  ).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Decision or attendance reason'), {
    target: { value: 'Independent review requests corrected work' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Resolve dispute: request rework' }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/api/v1/service-delivery/delivery/action', {
      revision: 9,
      action: 'resolve_rework',
      reason: 'Independent review requests corrected work',
    })
  );
});
it('requires operator-selected class and verified customer contact before creating a delivery', async () => {
  vi.mocked(api.get).mockImplementation(async (path) =>
    path.includes('/records?')
      ? []
      : path.includes('/options?')
        ? {
            sessions: [
              {
                assignmentId: 'assignment',
                sessionId: 'session',
                reference: 'TR-1',
                title: 'Class',
              },
            ],
            contacts: path.includes('customerOrganisationId=customer-org')
              ? [{ id: 'contact', name: 'Customer Manager' }]
              : [],
          }
        : detail
  );
  vi.mocked(api.post).mockResolvedValue({ id: 'delivery' });
  page({ review: true, applicationId: 'application' });
  fireEvent.click(screen.getByRole('button', { name: 'Open deliveries' }));
  await screen.findByText('Assign a customer delivery');
  fireEvent.change(screen.getByLabelText('Customer organisation reference'), {
    target: { value: 'customer-org' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Find verified customer contacts' }));
  await screen.findByRole('option', { name: 'Customer Manager' });
  fireEvent.change(screen.getByLabelText('Delivery title'), {
    target: { value: 'Customer course' },
  });
  fireEvent.change(screen.getByLabelText('Scheduled start'), {
    target: { value: '2026-11-21T10:00' },
  });
  fireEvent.change(screen.getByLabelText('Scheduled end'), {
    target: { value: '2026-11-21T12:00' },
  });
  fireEvent.change(screen.getByLabelText('Customer assignment reason'), {
    target: { value: 'Agreed customer training delivery' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create customer delivery' }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      '/api/v1/service-delivery/records',
      expect.objectContaining({
        applicationId: 'application',
        assignmentId: 'assignment',
        sessionId: 'session',
        customerUserId: 'contact',
        customerOrganisationId: 'customer-org',
        title: 'Customer course',
        reason: 'Agreed customer training delivery',
      })
    )
  );
});
