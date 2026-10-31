import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { NextActions } from '@/components/NextActions';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), patch: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(api);
beforeEach(() => vi.clearAllMocks());

const item = (id: string, title: string, timeframe: string, completed = false) => ({ id, title, description: '', priority: 'high', timeframe, completed });
const plan = {
  id: 'p1', user_id: 'u1', session_id: null, commitments: [], generated_at: '2026-10-01T00:00:00Z',
  action_items: [
    item('n1', 'Ninety day item', '90 Days'),
    item('i1', 'Done already', 'Immediate', true),
    item('t1', 'Thirty day item', '30 Days'),
    item('i2', 'Immediate item', 'Immediate'),
    item('t2', 'Second thirty day item', '30 Days'),
  ],
};
const renderIt = (props = {}) => render(<MemoryRouter><NextActions {...props} /></MemoryRouter>);

describe('NextActions', () => {
  it('shows the three most urgent open actions and the progress', async () => {
    mockedApi.get.mockResolvedValue(plan);
    renderIt({ showEmployerNote: true });
    const labels = (await screen.findAllByRole('checkbox')).map((c) => document.querySelector(`label[for="${c.id}"]`)?.textContent);
    expect(labels).toEqual(['Immediate item', 'Thirty day item', 'Second thirty day item']);
    expect(screen.getByText('1 of 5 done')).toBeInTheDocument();
    expect(screen.getByText(/Your employer sees your training progress/)).toBeInTheDocument();
  });

  it('ticks an action off and saves the plan', async () => {
    mockedApi.get.mockResolvedValue(plan);
    mockedApi.patch.mockResolvedValue({});
    renderIt();
    await userEvent.click(await screen.findByLabelText('Immediate item'));
    await waitFor(() => expect(mockedApi.patch).toHaveBeenCalled());
    const [path, body] = mockedApi.patch.mock.calls[0] as [string, { actionItems: Array<{ id: string; completed: boolean }> }];
    expect(path).toBe('/api/v1/workshop/action-plans/p1');
    expect(body.actionItems.find((i) => i.id === 'i2')?.completed).toBe(true);
    expect(screen.getByText('2 of 5 done')).toBeInTheDocument();
  });

  it('sends someone without a plan to their action plan', async () => {
    mockedApi.get.mockResolvedValue(null);
    renderIt();
    expect(await screen.findByRole('link', { name: 'Open my action plan' })).toHaveAttribute('href', '/action-plan');
  });
});
