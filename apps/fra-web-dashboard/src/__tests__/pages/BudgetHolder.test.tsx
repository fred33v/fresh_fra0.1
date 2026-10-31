import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { budgetHolderScenarios } from '@stopfra/shared/data';
import BudgetHolder from '@/pages/BudgetHolder';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { name: 'Bea Budget' } }) }));
vi.mock('@/components/layout/Layout', () => ({ Layout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

const mockedApi = vi.mocked(api);
beforeEach(() => vi.clearAllMocks());

const me = (over = {}) => ({
  required: true, status: 'in_progress', completedParts: [] as string[], requiredPartsDone: 0, scenarioScore: null, scenarioPassed: false, pledgeName: null, pledgedAt: null,
  conflictDeclared: null, conflictDetails: null, completedAt: null, renewalDueAt: null, previousCompletedAt: null,
  settings: { approvalLimits: null, contacts: { fraudRiskOwner: { name: 'Fran Owner', contact: 'fran@example.com' } } },
  speakUpToken: 'tok123', ...over,
});
const open = (part: string) => render(<MemoryRouter initialEntries={[`/budget-holder?part=${part}`]}><BudgetHolder /></MemoryRouter>);

describe('Budget holder programme', () => {
  it('opens on the first part and records it as read', async () => {
    mockedApi.get.mockResolvedValue(me());
    mockedApi.post.mockResolvedValue({ ...me(), completedParts: ['legal'] });
    render(<MemoryRouter initialEntries={['/budget-holder']}><BudgetHolder /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Legal and ethical duties' })).toBeInTheDocument();
    expect(screen.getByText('Required by your employer')).toBeInTheDocument();
    expect(screen.getByText(/unlimited fine/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'I have read this, next part' }));
    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/api/v1/budget-holder/me/parts', { partId: 'legal' }));
    expect(await screen.findByRole('heading', { name: 'Fraud basics' })).toBeInTheDocument();
  });

  it('shows the example limits until the employer sets its own, and the golden rules', async () => {
    mockedApi.get.mockResolvedValue(me());
    open('authority');
    expect(await screen.findByText(/Example: your employer has not set its own limits yet/)).toBeInTheDocument();
    expect(screen.getByText('Never split a purchase to keep it under a limit.')).toBeInTheDocument();
  });

  it('lists the organisation\'s contacts and its speak-up link', async () => {
    mockedApi.get.mockResolvedValue(me());
    open('reporting');
    expect(await screen.findByText('Fran Owner, fran@example.com')).toBeInTheDocument();
    expect(screen.getAllByText('Not set by your employer yet')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Report a concern in confidence' })).toHaveAttribute('href', '/speak-up/tok123');
  });

  it('gives feedback on each scenario and submits every answer', async () => {
    mockedApi.get.mockResolvedValue(me());
    mockedApi.post.mockResolvedValue({ ...me(), scenarioScore: 100, scenarioPassed: true, completedParts: ['scenarios'], attempt: { score: 100, passed: true } });
    open('scenarios');
    const submit = await screen.findByRole('button', { name: 'Submit my answers' });
    expect(submit).toBeDisabled();
    for (const s of budgetHolderScenarios) {
      await userEvent.click(screen.getByLabelText(s.options[s.correct]));
    }
    expect(screen.getAllByText(/^Right\./)).toHaveLength(budgetHolderScenarios.length);
    await userEvent.click(submit);
    await waitFor(() => expect(mockedApi.post).toHaveBeenCalled());
    const [path, body] = mockedApi.post.mock.calls[0] as [string, { answers: Record<string, number> }];
    expect(path).toBe('/api/v1/budget-holder/me/scenarios');
    expect(Object.keys(body.answers)).toHaveLength(budgetHolderScenarios.length);
    expect(await screen.findByText('Passed with 100%.')).toBeInTheDocument();
  });

  it('asks for the other parts before the commitment can be signed', async () => {
    mockedApi.get.mockResolvedValue(me({ completedParts: ['legal'] }));
    open('commitment');
    expect(await screen.findByText(/Finish these parts first/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign my commitment' })).toBeDisabled();
  });

  it('signs with a declared conflict of interest', async () => {
    const all = ['legal', 'basics', 'myths', 'red-flags', 'scenarios', 'checklists', 'authority', 'reporting', 'whistleblowing'];
    mockedApi.get.mockResolvedValue(me({ completedParts: all }));
    mockedApi.post.mockResolvedValue(me({ completedParts: [...all, 'commitment'], status: 'completed', pledgeName: 'Bea Budget', pledgedAt: '2026-10-31T10:00:00Z', conflictDeclared: true, conflictDetails: 'My sister runs Acme' }));
    open('commitment');
    const sign = await screen.findByRole('button', { name: 'Sign my commitment' });
    await userEvent.click(screen.getByLabelText('Yes, I declare an interest'));
    await userEvent.type(screen.getByLabelText('Who or what, and your link with them'), 'My sister runs Acme');
    for (const box of screen.getAllByRole('checkbox')) await userEvent.click(box);
    expect(sign).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Type your full name'), 'Bea Budget');
    await userEvent.click(sign);
    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/api/v1/budget-holder/me/commitment', {
      name: 'Bea Budget', conflictDeclared: true, conflictDetails: 'My sister runs Acme',
    }));
    expect(await screen.findByText(/Signed by Bea Budget/)).toBeInTheDocument();
  });
});
