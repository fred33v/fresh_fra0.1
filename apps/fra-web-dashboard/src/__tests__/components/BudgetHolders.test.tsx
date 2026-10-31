import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BudgetHolders } from '@/components/enterprise/BudgetHolders';
import { BudgetHolderCard } from '@/components/BudgetHolderCard';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), put: vi.fn(), download: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(api);
beforeEach(() => vi.clearAllMocks());

const progress = (over = {}) => ({
  required: false, status: 'not_started', completedParts: [], requiredPartsDone: 0, scenarioScore: null, scenarioPassed: false, pledgeName: null, pledgedAt: null,
  conflictDeclared: null, conflictDetails: null, completedAt: null, renewalDueAt: null, previousCompletedAt: null, ...over,
});

const team = {
  summary: { required: 1, completed: 1, renewalDue: 0, conflictsDeclared: 1, totalParts: 10 },
  people: [
    { userId: 'u1', name: 'Bea Budget', email: 'bea@example.com', role: 'employee', ...progress({
      required: true, status: 'completed', completedParts: Array(10).fill('x'), requiredPartsDone: 10, scenarioScore: 86, pledgedAt: '2026-10-31T10:00:00Z',
      renewalDueAt: '2027-10-31T10:00:00Z', conflictDeclared: true, conflictDetails: 'Brother owns Acme Cleaning',
    }) },
    { userId: 'u2', name: 'Sam Staff', email: 'sam@example.com', role: 'employee', ...progress() },
  ],
};

function mockGets(settings: unknown = { approvalLimits: null, contacts: {} }) {
  mockedApi.get.mockImplementation(async (path: string) => (path.includes('/settings') ? settings : team) as never);
}

describe('BudgetHolders (employer)', () => {
  it('shows who must complete it, their score, signature and declared conflicts', async () => {
    mockGets();
    render(<BudgetHolders />);
    const row = (await screen.findByText('Bea Budget')).closest('tr')!;
    expect(within(row).getByText('Completed')).toBeInTheDocument();
    expect(within(row).getByText('86%')).toBeInTheDocument();
    expect(within(row).getByText('Brother owns Acme Cleaning')).toBeInTheDocument();
    expect(within(row).getByRole('switch')).toBeChecked();
    expect(screen.getByText('Conflicts declared')).toBeInTheDocument();
  });

  it('switches on a budget holder', async () => {
    mockGets();
    mockedApi.put.mockResolvedValue({});
    render(<BudgetHolders />);
    await userEvent.click(await screen.findByRole('switch', { name: 'Sam Staff must complete the programme' }));
    await waitFor(() => expect(mockedApi.put).toHaveBeenCalledWith('/api/v1/budget-holder/team/u2', { required: true }));
  });

  it('starts the limits from the example and saves the organisation\'s own', async () => {
    mockGets();
    mockedApi.put.mockResolvedValue({});
    render(<BudgetHolders />);
    expect(await screen.findByText(/example until you save it/)).toBeInTheDocument();
    const cell = screen.getByLabelText('Purchases, Up to £1k');
    await userEvent.clear(cell);
    await userEvent.type(cell, 'Office manager');
    await userEvent.type(screen.getAllByLabelText('Email or phone')[0], 'fraud@acme.example');
    await userEvent.click(screen.getByRole('button', { name: /Save limits and contacts/ }));
    await waitFor(() => expect(mockedApi.put).toHaveBeenCalled());
    const [path, body] = mockedApi.put.mock.calls[0] as [string, { approvalLimits: { rows: { approvers: string[] }[] }; contacts: Record<string, unknown> }];
    expect(path).toBe('/api/v1/budget-holder/settings');
    expect(body.approvalLimits.rows[0].approvers[0]).toBe('Office manager');
    expect(body.contacts.fraudRiskOwner).toEqual({ name: '', contact: 'fraud@acme.example' });
  });
});

describe('BudgetHolderCard (staff dashboard)', () => {
  it('says when the employer requires it', async () => {
    mockedApi.get.mockResolvedValue(progress({ required: true, status: 'in_progress', completedParts: ['legal', 'basics'], requiredPartsDone: 2 }));
    render(<MemoryRouter><BudgetHolderCard /></MemoryRouter>);
    expect(await screen.findByText('Required by your employer')).toBeInTheDocument();
    expect(screen.getByText('2 of 10 parts done')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue the programme' })).toHaveAttribute('href', '/budget-holder');
  });

  it('shows nothing when the programme is not available', async () => {
    mockedApi.get.mockRejectedValue(new Error('Enterprise package or higher required'));
    const { container } = render(<MemoryRouter><BudgetHolderCard /></MemoryRouter>);
    await waitFor(() => expect(mockedApi.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
