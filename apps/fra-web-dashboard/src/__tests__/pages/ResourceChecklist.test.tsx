import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ResourceChecklist from '@/pages/ResourceChecklist';
import { useAuth } from '@/hooks/useAuth';
import { useEntitlements } from '@/hooks/useEntitlements';
import { api } from '@/lib/api';

vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useEntitlements');
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
vi.mock('@/lib/logger', () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/layout/Layout', () => ({ Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));

const mockedApi = vi.mocked(api);

function setup(training: boolean) {
  vi.mocked(useAuth).mockReturnValue({
    user: { id: 'u1', email: 'dana@example.com', name: 'Dana Boss', role: 'employer' },
    profile: { organization_name: 'Exemple Ltd', full_name: 'Dana Boss' },
  } as never);
  vi.mocked(useEntitlements).mockReturnValue({ isLoading: false, entitlements: { features: { training } } } as never);
}

const renderPage = (kind: 'checklist' | 'roadmap') =>
  render(<MemoryRouter><ResourceChecklist kind={kind} /></MemoryRouter>);

// The shared test setup stubs localStorage with no-ops; this page needs one that keeps values
beforeEach(() => {
  vi.clearAllMocks();
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('ResourceChecklist', () => {
  it('fills in the checklist on the web, prefilled and kept on this device', async () => {
    setup(false);
    const { unmount } = renderPage('checklist');
    expect(screen.getByRole('heading', { level: 1, name: 'Fraud Risk Self-Assessment Checklist' })).toBeInTheDocument();
    expect(screen.getByLabelText('Organisation')).toHaveValue('Exemple Ltd');
    expect(screen.getByLabelText('Completed by')).toHaveValue('Dana Boss');
    expect(screen.getByText('0 of 27 ticked')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText(/A named board member or senior manager is accountable/));
    expect(screen.getByText('1 of 27 ticked')).toBeInTheDocument();
    unmount();

    renderPage('checklist');
    expect(screen.getByText('1 of 27 ticked')).toBeInTheDocument();
  });

  it('offers the action plan only to packages that include it', () => {
    setup(false);
    renderPage('checklist');
    expect(screen.queryByRole('button', { name: /action plan/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument();
  });

  it('adds the unticked items to an existing action plan without duplicating them', async () => {
    setup(true);
    mockedApi.get.mockResolvedValue({ id: '11111111-1111-1111-1111-111111111111', action_items: [
      { id: 'checklist-c1', title: 'already there', description: '', priority: 'high', timeframe: '', completed: false },
    ] });
    mockedApi.patch.mockResolvedValue({});
    renderPage('checklist');
    await userEvent.click(screen.getByRole('button', { name: 'Add the unticked items to my action plan' }));
    await waitFor(() => expect(mockedApi.patch).toHaveBeenCalled());
    const [path, body] = mockedApi.patch.mock.calls[0] as [string, { actionItems: { id: string }[] }];
    expect(path).toBe('/api/v1/workshop/action-plans/11111111-1111-1111-1111-111111111111');
    expect(body.actionItems).toHaveLength(27);
    expect(body.actionItems.filter((i) => i.id === 'checklist-c1')).toHaveLength(1);
  });

  it('shows the roadmap with suggested owners and creates a plan when there is none', async () => {
    setup(true);
    mockedApi.get.mockResolvedValue(null);
    mockedApi.post.mockResolvedValue({});
    renderPage('roadmap');
    expect(screen.getByRole('heading', { name: 'Days 1–30: Mobilise and assess' })).toBeInTheDocument();
    expect(screen.getAllByText('Suggested owner: Board / Chair').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Add the remaining actions to my action plan' }));
    await waitFor(() => expect(mockedApi.post).toHaveBeenCalled());
    const [, body] = mockedApi.post.mock.calls[0] as [string, { actionItems: { timeframe: string }[] }];
    expect(body.actionItems).toHaveLength(15);
    // Grouped the way the action plan page shows them
    expect(body.actionItems[0].timeframe).toBe('30 Days');
    expect(body.actionItems[14].timeframe).toBe('90 Days');
  });
});
