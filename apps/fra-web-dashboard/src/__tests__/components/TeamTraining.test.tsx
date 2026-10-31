import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TeamTraining } from '@/components/enterprise/TeamTraining';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), download: vi.fn() } }));
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(api);
beforeEach(() => vi.clearAllMocks());

const person = (over: Record<string, unknown> = {}) => ({
  userId: 'u1', name: 'Sam Staff', email: 'sam@example.org', joinedAt: '2026-10-01T00:00:00Z', emailConfirmed: true,
  training: { status: 'in_progress', modulesDone: 3, totalModules: 7, quizAverage: 50, completedAt: null, lastActivityAt: null },
  certificate: null, actionPlan: { done: 2, total: 9 }, ...over,
});

describe('TeamTraining', () => {
  it("lists each person's training, certificate and action plan", async () => {
    mockedApi.get.mockResolvedValue({
      summary: { people: 2, trained: 1, certificates: 1, pendingInvitations: 1 },
      people: [
        person(),
        person({
          userId: 'u2', name: 'Alex Done', email: 'alex@example.org', emailConfirmed: false,
          training: { status: 'completed', modulesDone: 7, totalModules: 7, quizAverage: 100, completedAt: '2026-10-20T00:00:00Z', lastActivityAt: null },
          certificate: { number: 'FRA-2026-0001', issuedAt: '2026-10-20T00:00:00Z' }, actionPlan: null,
        }),
      ],
      invitations: [{ code: 'C1', email: 'new@example.org', invitedAt: '2026-10-30T00:00:00Z', expiresAt: '2026-11-29T00:00:00Z', expired: false }],
    });
    render(<TeamTraining />);
    const sam = (await screen.findByText('Sam Staff')).closest('tr')!;
    expect(within(sam).getByText('In progress')).toBeInTheDocument();
    expect(within(sam).getByText('3/7')).toBeInTheDocument();
    expect(within(sam).getByText('2 of 9 done')).toBeInTheDocument();
    const alex = screen.getByText('Alex Done').closest('tr')!;
    expect(within(alex).getByText('FRA-2026-0001')).toBeInTheDocument();
    expect(within(alex).getByText(/email not confirmed yet/)).toBeInTheDocument();
    expect(screen.getByText('new@example.org')).toBeInTheDocument();
  });

  it('exports the record as CSV', async () => {
    mockedApi.get.mockResolvedValue({ summary: { people: 1, trained: 0, certificates: 0, pendingInvitations: 0 }, people: [person()], invitations: [] });
    render(<TeamTraining />);
    await screen.findByText('Sam Staff');
    await userEvent.click(screen.getByRole('button', { name: /export csv/i }));
    expect(mockedApi.download).toHaveBeenCalledWith('/api/v1/team/training?format=csv', 'team-training.csv');
  });

  it('points to the invitations when nobody has joined', async () => {
    mockedApi.get.mockResolvedValue({ summary: { people: 0, trained: 0, certificates: 0, pendingInvitations: 0 }, people: [], invitations: [] });
    const onInvite = vi.fn();
    render(<TeamTraining onInvite={onInvite} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Invite your team' }));
    expect(onInvite).toHaveBeenCalled();
  });
});
