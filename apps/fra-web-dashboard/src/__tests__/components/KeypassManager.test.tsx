import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { KeypassManager } from '@/components/enterprise/KeypassManager';
import { SubscriptionCard } from '@/components/enterprise/SubscriptionCard';
import { api } from '@/lib/api';
import type { Entitlements } from '@/hooks/useEntitlements';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(api);

function mockKeypasses(quota: Record<string, unknown>) {
  mockedApi.get.mockImplementation(async (path: string) => {
    if (path.endsWith('/quota')) return quota;
    return [
      { code: 'AVAIL1234', status: 'available', createdAt: '2026-09-01T00:00:00Z', expiresAt: '2026-10-01T00:00:00Z' },
      { code: 'USED5678', status: 'used', createdAt: '2026-09-01T00:00:00Z', expiresAt: '2026-10-01T00:00:00Z', usedAt: '2026-09-05T00:00:00Z', usedByUserId: 'u1' },
    ];
  });
}

beforeEach(() => vi.clearAllMocks());

describe('KeypassManager', () => {
  it('shows allowance, counts and who redeemed each key-pass', async () => {
    mockKeypasses({ allowance: -1, unlimited: true, used: 2, remaining: null });
    render(<KeypassManager organisationId="org-1" userNames={{ u1: 'Priya Shah' }} />);
    expect(await screen.findByText('Unlimited')).toBeInTheDocument();
    const row = (await screen.findByText('USED5678')).closest('tr')!;
    expect(within(row).getByText('Priya Shah')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: /^Revoke key-pass/ })).not.toBeInTheDocument();
    expect(within(screen.getByText('AVAIL1234').closest('tr')!).getByRole('button', { name: 'Revoke key-pass AVAIL1234' })).toBeInTheDocument();
  });

  it('blocks requests beyond the remaining allowance', async () => {
    mockKeypasses({ allowance: 50, used: 48, remaining: 2 });
    render(<KeypassManager organisationId="org-1" />);
    await screen.findByText('AVAIL1234');
    await userEvent.click(screen.getByRole('button', { name: /create key-passes/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('allows 2 more key-passes');
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it('creates key-passes and shows the new codes', async () => {
    mockKeypasses({ allowance: -1, unlimited: true, used: 0, remaining: null });
    mockedApi.post.mockResolvedValue({ codes: ['NEWCODE01', 'NEWCODE02'], expiresAt: '2026-10-29T00:00:00Z' });
    render(<KeypassManager organisationId="org-1" />);
    await screen.findByText('AVAIL1234');
    const qty = screen.getByLabelText('How many');
    await userEvent.clear(qty);
    await userEvent.type(qty, '2');
    await userEvent.click(screen.getByRole('button', { name: /create key-passes/i }));
    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/api/v1/keypasses/generate', { quantity: 2, expiresInDays: 30 }));
    expect(await screen.findByText(/NEWCODE01\s+NEWCODE02/)).toBeInTheDocument();
  });
});

describe('KeypassManager join links', () => {
  it('copies the join link for an available key-pass, and offers none for a redeemed one', async () => {
    const user = userEvent.setup();
    mockKeypasses({ allowance: -1, unlimited: true, used: 2, remaining: null });
    render(<KeypassManager organisationId="org-1" />);

    const usedRow = (await screen.findByText('USED5678')).closest('tr')!;
    expect(within(usedRow).queryByRole('button', { name: /Copy join link/ })).not.toBeInTheDocument();

    const availRow = screen.getByText('AVAIL1234').closest('tr')!;
    await user.click(within(availRow).getByRole('button', { name: 'Copy join link for key-pass AVAIL1234' }));
    expect(await navigator.clipboard.readText()).toBe(`${window.location.origin}/join?code=AVAIL1234`);
  });

  it('copies one join link per new key-pass', async () => {
    const user = userEvent.setup();
    mockKeypasses({ allowance: -1, unlimited: true, used: 0, remaining: null });
    mockedApi.post.mockResolvedValue({ codes: ['NEWCODE01', 'NEWCODE02'], expiresAt: '2026-10-29T00:00:00Z' });
    render(<KeypassManager organisationId="org-1" />);
    await screen.findByText('AVAIL1234');
    await user.click(screen.getByRole('button', { name: /create key-passes/i }));
    await user.click(await screen.findByRole('button', { name: 'Copy join links' }));

    expect(await navigator.clipboard.readText()).toBe(
      [`${window.location.origin}/join?code=NEWCODE01`, `${window.location.origin}/join?code=NEWCODE02`].join('\n'),
    );
  });

  it('tells employers where employees use their code', async () => {
    mockKeypasses({ allowance: -1, unlimited: true, used: 0, remaining: null });
    render(<KeypassManager organisationId="org-1" />);
    await screen.findByText('AVAIL1234');
    expect(screen.getByText(new RegExp(`${window.location.origin}/join`))).toBeInTheDocument();
  });
});

describe('SubscriptionCard', () => {
  const base = { packageId: 'pkg_full', packageName: 'Enterprise', tier: 3 } as Entitlements;

  it('shows the renewal date without a prompt when far off', () => {
    const expiresAt = new Date(Date.now() + 200 * 86400000).toISOString();
    render(<MemoryRouter><SubscriptionCard entitlements={{ ...base, expiresAt }} /></MemoryRouter>);
    expect(screen.getByText('Enterprise package')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Renew now' })).not.toBeInTheDocument();
  });

  it('prompts renewal in the last 30 days', () => {
    const expiresAt = new Date(Date.now() + 10 * 86400000).toISOString();
    render(<MemoryRouter><SubscriptionCard entitlements={{ ...base, expiresAt }} /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Renew now' })).toHaveAttribute('href', '/checkout?package=Enterprise');
  });
});
