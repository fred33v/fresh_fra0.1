import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProfessionalScopes from '@/components/professional/ProfessionalScopes';
import ProfessionalTraining from '@/pages/ProfessionalTraining';
import { api } from '@/lib/api';
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { userId: 'trainer', organisationId: 'org' } }),
}));
vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
const scope = {
  id: 'scope',
  applicationId: 'application',
  subjectId: 'fraud-risk-awareness',
  subjectVersion: '2026-10-30',
  requestedActions: ['deliver', 'assess', 'issue_completion'],
  actions: ['deliver'],
  evidence: 'Qualifications and demonstration evidence',
  status: 'approved',
  revision: 2,
  effective: true,
  validFrom: null,
  validUntil: null,
  reason: null,
};
function page(children: React.ReactNode) {
  return render(
    <MemoryRouter>
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
          })
        }
      >
        {children}
      </QueryClientProvider>
    </MemoryRouter>
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.get).mockResolvedValue([]);
  vi.mocked(api.post).mockResolvedValue({});
});
it('requires an explicit candidate request and transmits the real subject/version and revision', async () => {
  vi.mocked(api.get).mockImplementation(async (path) =>
    path.endsWith('/subjects')
      ? [
          {
            id: 'fraud-risk-awareness',
            version: '2026-10-30',
            title: 'Fraud Risk Awareness Workshop',
          },
        ]
      : []
  );
  page(<ProfessionalScopes />);
  expect(api.get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Manage professional scopes' }));
  await screen.findByRole('option', { name: /Fraud Risk Awareness Workshop/ });
  fireEvent.change(screen.getByLabelText('Qualifications, experience and demonstration evidence'), {
    target: { value: 'Reviewed examples of professional course delivery' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Submit subject scope request' }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/api/v1/professional/me/scopes', {
      subjectId: 'fraud-risk-awareness',
      subjectVersion: '2026-10-30',
      revision: 0,
      actions: ['deliver'],
      evidence: 'Reviewed examples of professional course delivery',
    })
  );
});
it('keeps approval disabled until the reviewer confirms evidence and shows server refusal', async () => {
  vi.mocked(api.get).mockImplementation(async (path) =>
    path.endsWith('/subjects')
      ? []
      : [{ ...scope, status: 'requested', actions: [], effective: false }]
  );
  vi.mocked(api.post).mockRejectedValue(
    new Error('You cannot approve your own professional authority')
  );
  page(<ProfessionalScopes applicationId="application" />);
  fireEvent.click(screen.getByRole('button', { name: 'Manage professional scopes' }));
  const save = await screen.findByRole('button', { name: 'Record subject decision' });
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Subject review reason (visible to candidate)'), {
    target: { value: 'Evidence reviewed carefully' },
  });
  fireEvent.change(screen.getByLabelText('Authority valid from'), {
    target: { value: '2026-11-21T10:00' },
  });
  fireEvent.change(screen.getByLabelText('Authority valid until'), {
    target: { value: '2027-11-21T10:00' },
  });
  fireEvent.change(screen.getByLabelText('Qualification verification record (reviewers only)'), {
    target: { value: 'Original evidence checked' },
  });
  fireEvent.change(screen.getByLabelText('Training demonstration verification (reviewers only)'), {
    target: { value: 'Recording of demonstration checked' },
  });
  fireEvent.click(screen.getByLabelText('Deliver training'));
  fireEvent.click(screen.getByLabelText(/I verified the evidence/));
  fireEvent.click(save);
  await screen.findByRole('alert');
  expect(
    screen.getByText('You cannot approve your own professional authority')
  ).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith(
    '/api/v1/professional/scopes/scope/review',
    expect.objectContaining({ revision: 2, checksConfirmed: true })
  );
});
it('hides assessment and issuance when a current session has delivery authority only', async () => {
  vi.mocked(api.get).mockImplementation(async (path) =>
    path.endsWith('/me/scopes')
      ? [scope]
      : path.endsWith('/me/sessions')
        ? [
            {
              id: 'session',
              scopeId: 'scope',
              scopeRevision: 2,
              title: 'Authorised class',
              code: 'JOIN1234',
              snapshot: { subjectTitle: 'Fraud Risk Awareness', subjectVersion: '2026-10-30' },
            },
          ]
        : path.endsWith('/participants')
          ? [
              {
                id: 'learner',
                name: 'Learner Fixture',
                completedAt: '2026-11-21',
                assessmentRevision: 1,
                decision: 'approved',
              },
            ]
          : []
  );
  page(<ProfessionalTraining />);
  fireEvent.click(await screen.findByRole('button', { name: 'View attendance & completion' }));
  await screen.findByText('Learner Fixture');
  expect(
    screen.queryByRole('button', { name: 'Record completion assessment' })
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Issue learner completion certificate' })
  ).not.toBeInTheDocument();
});
it('creates a class using the accepted assignment binding, not a client-selected curriculum', async () => {
  vi.mocked(api.get).mockImplementation(async (path) =>
    path.endsWith('/me/scopes')
      ? [scope]
      : path.endsWith('/assignments')
        ? [
            {
              id: 'assignment',
              reference: 'TR-1',
              service: 'training',
              status: 'accepted',
              scopeId: 'scope',
              scopeRevision: 2,
            },
          ]
        : []
  );
  vi.mocked(api.post).mockResolvedValue({ id: 'session' });
  page(<ProfessionalTraining />);
  await screen.findByRole('option', { name: 'TR-1' });
  fireEvent.change(screen.getByLabelText('Class title'), {
    target: { value: 'Agreed course session' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create scoped training session' }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/api/v1/professional/sessions', {
      scopeId: 'scope',
      scopeRevision: 2,
      assignmentId: 'assignment',
      title: 'Agreed course session',
    })
  );
});
it('submits a reasoned completion assessment and separately issues using its current revision', async () => {
  vi.mocked(api.get).mockImplementation(async (path) =>
    path.endsWith('/me/scopes')
      ? [{ ...scope, actions: ['deliver', 'assess', 'issue_completion'] }]
      : path.endsWith('/me/sessions')
        ? [
            {
              id: 'session',
              scopeId: 'scope',
              scopeRevision: 2,
              title: 'Authorised class',
              code: 'JOIN1234',
              snapshot: { subjectTitle: 'Fraud Risk Awareness', subjectVersion: '2026-10-30' },
            },
          ]
        : path.endsWith('/participants')
          ? [
              {
                id: 'learner',
                name: 'Learner Fixture',
                completedAt: '2026-11-21',
                assessmentRevision: 2,
                decision: 'approved',
                quizPercent: 100,
                missing: { sections: [], quizzes: [] },
              },
            ]
          : []
  );
  vi.mocked(api.post).mockResolvedValue({
    created: true,
    row: { certificate_number: 'FRA-TEST-1234' },
  });
  page(<ProfessionalTraining />);
  fireEvent.click(await screen.findByRole('button', { name: 'View attendance & completion' }));
  await screen.findByText(/Server quiz result: 100%/);
  fireEvent.change(screen.getByLabelText('Assessment reason'), {
    target: { value: 'Verified the learner exercises and completed course' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Record completion assessment' }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/api/v1/professional/sessions/session/assessments', {
      learnerId: 'learner',
      revision: 2,
      decision: 'approved',
      reason: 'Verified the learner exercises and completed course',
    })
  );
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Issue learner completion certificate' })
    ).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Issue learner completion certificate' }));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith('/api/v1/professional/sessions/session/certificates', {
      learnerId: 'learner',
      assessmentRevision: 2,
    })
  );
});
