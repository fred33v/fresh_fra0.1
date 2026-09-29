import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Integrations from '@/pages/Integrations';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(api);

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.get.mockImplementation(async (path: string) => {
    if (path.includes('api-keys')) return [{ id: 'k1', name: 'GRC sync', keyPrefix: 'sfra_abcdef1', createdAt: '2026-09-01T00:00:00Z' }];
    return [{ id: 'w1', url: 'https://siem.example.com/hook', events: ['risk.created'], isActive: true, createdAt: '2026-09-01T00:00:00Z' }];
  });
});

describe('Integrations page', () => {
  it('lists existing keys and webhook endpoints without secrets', async () => {
    render(<Integrations />);
    expect(await screen.findByText('GRC sync')).toBeInTheDocument();
    expect(screen.getByText('sfra_abcdef1…')).toBeInTheDocument();
    expect(await screen.findByText('https://siem.example.com/hook')).toBeInTheDocument();
  });

  it('shows a new API key once after creation', async () => {
    mockedApi.post.mockResolvedValue({ id: 'k2', name: 'BI', keyPrefix: 'sfra_1234567', createdAt: '', key: 'sfra_' + 'a'.repeat(64) });
    render(<Integrations />);
    await userEvent.type(await screen.findByLabelText('Key name'), 'BI');
    await userEvent.click(screen.getByRole('button', { name: 'Create key' }));
    expect(await screen.findByDisplayValue('sfra_' + 'a'.repeat(64))).toBeInTheDocument();
    expect(screen.getByText(/will not be shown again/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'I have saved it' }));
    expect(screen.queryByDisplayValue('sfra_' + 'a'.repeat(64))).not.toBeInTheDocument();
  });

  it('asks for a key name', async () => {
    render(<Integrations />);
    await userEvent.click(await screen.findByRole('button', { name: 'Create key' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name');
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it('validates the webhook URL before sending', async () => {
    render(<Integrations />);
    await userEvent.type(await screen.findByLabelText('Endpoint URL'), 'siem.example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Add endpoint' }));
    expect(screen.getByRole('alert')).toHaveTextContent('starting with https://');
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it('registers a webhook with the selected events and reveals the signing secret', async () => {
    mockedApi.post.mockResolvedValue({ id: 'w2', url: 'https://x.example.com', events: [], isActive: true, createdAt: '', secret: 'whsec_test' });
    render(<Integrations />);
    await userEvent.type(await screen.findByLabelText('Endpoint URL'), 'https://x.example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Add endpoint' }));
    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/api/v1/webhook-endpoints', {
      url: 'https://x.example.com', events: ['assessment.submitted', 'risk.high_priority'],
    }));
    expect(await screen.findByDisplayValue('whsec_test')).toBeInTheDocument();
  });
});
