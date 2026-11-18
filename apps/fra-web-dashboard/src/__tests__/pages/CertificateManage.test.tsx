import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CertificateManage from '@/pages/CertificateManage';
const post = vi.fn(),
  confirm = vi.fn();
vi.mock('@/lib/api', () => ({ api: { post: (...args: unknown[]) => post(...args) } }));
vi.mock('@/hooks/useConfirm', () => ({ useConfirm: () => confirm }));
vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
async function fill() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Certificate number'), 'FRA-AAAA-BBBB-CCCC');
  await user.type(screen.getByLabelText('Reason for revocation'), 'Issued in error');
  return user;
}
describe('Certificate administration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    confirm.mockResolvedValue(true);
  });
  it('confirms revocation, submits a private reason and shows the result', async () => {
    post.mockResolvedValue({ changed: true, certificateNumber: 'FRA-AAAA-BBBB-CCCC' });
    render(<CertificateManage />);
    const user = await fill();
    await user.click(screen.getByRole('button', { name: 'Revoke certificate' }));
    expect(await screen.findByRole('status')).toHaveTextContent('has been revoked');
    expect(post).toHaveBeenCalledWith('/api/v1/certificates/FRA-AAAA-BBBB-CCCC/revoke', {
      reason: 'Issued in error',
    });
    expect(screen.getByLabelText('Reason for revocation')).toHaveValue('');
  });
  it('does not mutate when confirmation is declined', async () => {
    confirm.mockResolvedValue(false);
    render(<CertificateManage />);
    const user = await fill();
    await user.click(screen.getByRole('button', { name: 'Revoke certificate' }));
    expect(post).not.toHaveBeenCalled();
  });
  it('shows a safe refusal instead of a successful revocation', async () => {
    post.mockRejectedValue(new Error('Certificate not found'));
    render(<CertificateManage />);
    const user = await fill();
    await user.click(screen.getByRole('button', { name: 'Revoke certificate' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Certificate not found');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
