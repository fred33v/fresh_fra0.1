import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyActions } from '@/components/MyActions';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(api);

const action = {
  id: 'r1', title: 'Supplier bank detail changes', riskArea: 'cash_banking', priority: 'HIGH',
  actionPlan: 'Call the supplier back on a known number', dueDate: '2020-01-01', status: 'open', reviewPending: false,
};

beforeEach(() => vi.clearAllMocks());

describe('MyActions', () => {
  it('lists the actions given to me, with what to do and the reporting link', async () => {
    mockedApi.get.mockResolvedValue({ risks: [action], speakUpToken: 'tok123' });
    render(<MyActions />);
    expect(await screen.findByText('Supplier bank detail changes')).toBeInTheDocument();
    expect(screen.getByText('Cash and banking')).toBeInTheDocument();
    expect(screen.getByText(/Call the supplier back/)).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Report a concern' })).toHaveAttribute('href', `${window.location.origin}/speak-up/tok123`);
  });

  it('marks an action done with a note', async () => {
    mockedApi.get.mockResolvedValue({ risks: [action], speakUpToken: null });
    mockedApi.post.mockResolvedValue({});
    render(<MyActions />);
    await userEvent.click(await screen.findByRole('button', { name: 'Give an update' }));
    await userEvent.type(screen.getByLabelText(/What has been done/), 'Done since 1 Nov');
    await userEvent.click(screen.getByRole('button', { name: /mark as done/i }));
    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/api/v1/my-actions/r1/progress', { status: 'done', note: 'Done since 1 Nov' }));
  });

  it('shows that a done action waits for the employer', async () => {
    mockedApi.get.mockResolvedValue({ risks: [{ ...action, status: 'mitigated', reviewPending: true }], speakUpToken: null });
    render(<MyActions />);
    expect(await screen.findByText('Waiting for confirmation')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Give an update' })).not.toBeInTheDocument();
    expect(screen.getByText(/has not opened its confidential reporting channel/)).toBeInTheDocument();
  });

  it('stays out of the way of a manager with nothing assigned', async () => {
    mockedApi.get.mockResolvedValue({ risks: [], speakUpToken: 'tok' });
    const { container } = render(<MyActions onlyIfAssigned />);
    await waitFor(() => expect(mockedApi.get).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
