import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Security from '@/pages/Security';
import { api } from '@/lib/api';
const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ signOut, user: { role: 'admin' } }) }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockResolvedValue({ enabled: false, required: true });
});
it('requires password setup and confirms an authenticator before signing out', async () => {
  vi.mocked(api.post)
    .mockResolvedValueOnce({ secret: 'TESTSETUPKEY' })
    .mockResolvedValueOnce({ enabled: true });
  render(<Security />);
  await screen.findByText(/Enter your current password/);
  fireEvent.change(screen.getByLabelText('Current password'), {
    target: { value: 'current-password' },
  });
  fireEvent.click(screen.getByText('Set up authenticator'));
  await screen.findByText('TESTSETUPKEY');
  expect(screen.getByLabelText('Current password')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Authenticator code'), { target: { value: '123456' } });
  fireEvent.click(screen.getByText('Confirm and sign in again'));
  await waitFor(() => expect(signOut).toHaveBeenCalled());
  expect(api.post).toHaveBeenLastCalledWith('/api/v1/security/mfa/confirm', { code: '123456' });
  expect(screen.queryByText('TESTSETUPKEY')).not.toBeInTheDocument();
});
it('shows finance role denial without claiming a role was granted', async () => {
  vi.mocked(api.get).mockResolvedValue({ enabled: true, required: true });
  vi.mocked(api.post).mockRejectedValue(
    new Error('Independent operator admin with recent MFA required')
  );
  render(<Security />);
  await screen.findByText('Finance role administration');
  fireEvent.change(screen.getByLabelText('User UUID'), { target: { value: 'target-user' } });
  fireEvent.change(screen.getByLabelText('Reason'), {
    target: { value: 'Independent grant request' },
  });
  fireEvent.click(screen.getByText('Grant finance role'));
  await screen.findByText('Independent operator admin with recent MFA required');
  expect(
    screen.queryByText('Finance role updated. Changes apply immediately.')
  ).not.toBeInTheDocument();
});
