import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CounterFraudRecords } from '@/components/enterprise/CounterFraudRecords';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), download: vi.fn() },
}));
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(api);

const unreportedLoss = {
  id: 'l1', kind: 'loss', createdAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T10:00:00Z',
  data: { category: 'fraud', lossType: 'detected', description: 'Duplicate supplier invoice', identifiedAt: '2026-08-01', amountGbp: 12500, recoveredGbp: 4000 },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.get.mockImplementation(async (path: string) => (path.includes('kind=loss') ? [unreportedLoss] : []));
  mockedApi.post.mockResolvedValue({});
  mockedApi.patch.mockResolvedValue({});
});

describe('CounterFraudRecords', () => {
  it('opens on the counter fraud strategy and asks for the required fields', async () => {
    const user = userEvent.setup();
    render(<CounterFraudRecords onChange={vi.fn()} />);

    expect(screen.getByText('Counter fraud strategy')).toBeInTheDocument();
    expect(screen.getByText(/Component 2 of GovS 013/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add strategy' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter title');
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it('saves a strategy with only the fields that were filled in', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CounterFraudRecords onChange={onChange} />);

    await user.type(screen.getByLabelText('Title'), 'Counter fraud strategy 2026–29');
    await user.type(screen.getByLabelText('Period starts'), '2026-04-01');
    await user.type(screen.getByLabelText('Period ends'), '2029-03-31');
    await user.click(screen.getByRole('button', { name: 'Add strategy' }));

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/api/v1/compliance/records', {
      kind: 'strategy',
      data: { title: 'Counter fraud strategy 2026–29', periodStart: '2026-04-01', periodEnd: '2029-03-31', status: 'draft' },
    }));
    expect(onChange).toHaveBeenCalled();
  });

  it('lists losses with amounts and marks one as reported', async () => {
    const user = userEvent.setup();
    render(<CounterFraudRecords onChange={vi.fn()} />);

    await user.click(screen.getByRole('tab', { name: 'Losses' }));
    expect(await screen.findByText('Duplicate supplier invoice')).toBeInTheDocument();
    expect(screen.getByText('£12,500')).toBeInTheDocument();
    expect(screen.getByText('Not reported')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reported today' }));
    const today = new Date().toISOString().slice(0, 10);
    await waitFor(() => expect(mockedApi.patch).toHaveBeenCalledWith('/api/v1/compliance/records/l1', { data: { reportedToCentreAt: today } }));
  });

  it('downloads a register as CSV', async () => {
    const user = userEvent.setup();
    render(<CounterFraudRecords onChange={vi.fn()} />);
    await user.click(screen.getByRole('tab', { name: 'Conflicts of interest' }));
    await user.click(await screen.findByRole('button', { name: /CSV/ }));
    expect(mockedApi.download).toHaveBeenCalledWith('/api/v1/compliance/records?kind=conflict_of_interest&format=csv', 'conflict-of-interest-register.csv');
  });
});
