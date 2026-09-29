import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RiskRegister from '@/pages/RiskRegister';
import { api } from '@/lib/api';
import { scoreRisk } from '@/lib/risk-scoring';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), download: vi.fn() },
  ApiError: class ApiError extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
  },
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(api);

const emptyHeatMap = () => Array.from({ length: 5 }, () => Array(5).fill(0));

const risk = {
  id: 'r1', title: 'Supplier invoice fraud', riskArea: 'procurement', impact: 5, likelihood: 4,
  controlEffectiveness: 'reasonably_strong', inherentScore: 20, residualScore: 16, priority: 'HIGH',
  status: 'open', ownerUserId: 'u1', dueDate: '2026-12-31',
};

function mockLoad(risks: unknown[] = [risk]) {
  const heatMap = emptyHeatMap();
  if (risks.length) heatMap[4][3] = 1;
  mockedApi.get.mockImplementation(async (path: string) => {
    if (path.includes('/summary')) return { total: risks.length, byPriority: { HIGH: risks.length, MEDIUM: 0, LOW: 0 }, overdue: 0, unowned: 0, heatMap };
    if (path.includes('/analytics/employees')) return [{ userId: 'u1', userName: 'Priya Shah' }];
    return risks;
  });
}

beforeEach(() => vi.clearAllMocks());

describe('scoreRisk', () => {
  it('matches the backend methodology', () => {
    expect(scoreRisk(5, 4, 'reasonably_strong')).toEqual({ inherentScore: 20, residualScore: 16, priority: 'HIGH' });
    expect(scoreRisk(5, 4, 'very_strong')).toEqual({ inherentScore: 20, residualScore: 12, priority: 'MEDIUM' });
    expect(scoreRisk(1, 5, 'none').priority).toBe('LOW');
  });
});

describe('RiskRegister page', () => {
  it('lists risks with scores, priority and owner name', async () => {
    mockLoad();
    render(<RiskRegister />);
    const row = (await screen.findByText('Supplier invoice fraud')).closest('tr')!;
    expect(within(row).getByText('20')).toBeInTheDocument();
    expect(within(row).getByText('16')).toBeInTheDocument();
    expect(within(row).getByText('HIGH')).toBeInTheDocument();
    await waitFor(() => expect(within(row).getByText('Priya Shah')).toBeInTheDocument());
    expect(screen.getByLabelText('Impact 5, likelihood 4: 1 risks')).toHaveTextContent('1');
  });

  it('shows an empty state', async () => {
    mockLoad([]);
    render(<RiskRegister />);
    expect(await screen.findByText(/No risks recorded yet/)).toBeInTheDocument();
  });

  it('requires a title before saving', async () => {
    mockLoad([]);
    render(<RiskRegister />);
    await userEvent.click(await screen.findByRole('button', { name: /add risk/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add risk' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Enter a title');
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it('creates a risk', async () => {
    mockLoad([]);
    mockedApi.post.mockResolvedValue({});
    render(<RiskRegister />);
    await userEvent.click(await screen.findByRole('button', { name: /add risk/i }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Title'), 'Payroll ghost employees');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add risk' }));
    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/api/v1/risk-register', expect.objectContaining({
      title: 'Payroll ghost employees', impact: 3, likelihood: 3, controlEffectiveness: 'some_gaps', ownerUserId: null,
    })));
  });

  it('exports CSV', async () => {
    mockLoad();
    render(<RiskRegister />);
    await userEvent.click(await screen.findByRole('button', { name: /export csv/i }));
    expect(mockedApi.download).toHaveBeenCalledWith('/api/v1/risk-register?format=csv', 'risk-register.csv');
  });
});
