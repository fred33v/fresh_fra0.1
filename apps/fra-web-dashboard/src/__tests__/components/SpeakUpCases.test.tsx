import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SpeakUpCases } from '@/components/enterprise/SpeakUpCases';
import { api } from '@/lib/api';

// jsdom lacks the browser APIs Radix radio groups and selects use
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.scrollIntoView ??= () => {};

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn(), download: vi.fn() },
}));
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(api);

const summary = {
  id: 'c1', reference: 'SU-ABCD2345', category: 'procurement', relationship: 'employee', anonymous: true,
  status: 'new', receivedAt: '2026-09-20T09:00:00Z', overdueForTriage: true,
};
const detail = {
  ...summary, description: 'A supplier is invoicing twice for the same deliveries.', messages: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.get.mockImplementation(async (path: string) => {
    if (path.endsWith('/intake')) return { enabled: true, token: 'tok-1234567890abcdefghij', intro: null };
    if (path.endsWith('/reports')) return [summary];
    if (path.endsWith('/reports/c1')) return detail;
    return [];
  });
  mockedApi.patch.mockResolvedValue({ ...detail, status: 'triage', acknowledgedAt: '2026-10-04T09:00:00Z' });
});

describe('SpeakUpCases', () => {
  it('lists cases, flags overdue reviews and shows the public link', async () => {
    render(<SpeakUpCases employees={[{ userId: 'u1', userName: 'Priya Shah' }]} onChange={vi.fn()} />);
    const row = (await screen.findByText('SU-ABCD2345')).closest('tr')!;
    expect(within(row).getByText('Anonymous')).toBeInTheDocument();
    expect(within(row).getByText('Review overdue')).toBeInTheDocument();
    expect(await screen.findByText(`${window.location.origin}/speak-up/tok-1234567890abcdefghij`)).toBeInTheDocument();
  });

  it('opens a case and moves it to triage', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SpeakUpCases employees={[]} onChange={onChange} />);

    await user.click(await screen.findByRole('button', { name: 'Open case SU-ABCD2345' }));
    expect(await screen.findByText('A supplier is invoicing twice for the same deliveries.')).toBeInTheDocument();

    await user.click(screen.getByRole('combobox', { name: 'Status' }));
    await user.click(await screen.findByRole('option', { name: 'Triage' }));
    await waitFor(() => expect(mockedApi.patch).toHaveBeenCalledWith('/api/v1/compliance/speak-up/reports/c1', { status: 'triage' }));
    expect(onChange).toHaveBeenCalled();
  });

  it('turns a case into an incident at the chosen severity', async () => {
    const user = userEvent.setup();
    mockedApi.post.mockResolvedValue({ ...detail, incidentId: 'i1' });
    render(<SpeakUpCases employees={[]} onChange={vi.fn()} />);

    await user.click(await screen.findByRole('button', { name: 'Open case SU-ABCD2345' }));
    await user.click(await screen.findByRole('combobox', { name: 'Incident severity' }));
    await user.click(await screen.findByRole('option', { name: 'High' }));
    await user.click(screen.getByRole('button', { name: 'Create incident' }));

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/api/v1/compliance/speak-up/reports/c1/incident', { severity: 'high' }));
    expect(await screen.findByText('Linked to an incident')).toBeInTheDocument();
  });

  it('switches the speak-up link off', async () => {
    const user = userEvent.setup();
    mockedApi.put.mockResolvedValue({ enabled: false, token: 'tok-1234567890abcdefghij', intro: null });
    render(<SpeakUpCases employees={[]} onChange={vi.fn()} />);
    await user.click(await screen.findByRole('switch'));
    expect(mockedApi.put).toHaveBeenCalledWith('/api/v1/compliance/speak-up/intake', { enabled: false });
  });
});
