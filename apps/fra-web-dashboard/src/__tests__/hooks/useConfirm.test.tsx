import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ConfirmProvider, useConfirm } from '@/hooks/useConfirm';

function Harness() {
  const confirm = useConfirm();
  const [result, setResult] = useState('none');
  return (
    <button onClick={async () => setResult(String(await confirm({
      title: 'Delete "Supplier fraud"?', description: 'This cannot be undone.', confirmLabel: 'Delete', destructive: true,
    })))}>
      Delete risk ({result})
    </button>
  );
}

const renderWithProvider = () => render(<ConfirmProvider><Harness /></ConfirmProvider>);

describe('useConfirm', () => {
  it('asks in an in-page dialog and resolves true when confirmed', async () => {
    const user = userEvent.setup();
    const native = vi.spyOn(window, 'confirm');
    renderWithProvider();

    await user.click(screen.getByRole('button', { name: /Delete risk/ }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete "Supplier fraud"?' });
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete risk (true)' })).toBeInTheDocument());
    expect(native).not.toHaveBeenCalled();
  });

  it('resolves false when cancelled or dismissed with Escape', async () => {
    const user = userEvent.setup();
    renderWithProvider();

    await user.click(screen.getByRole('button', { name: /Delete risk/ }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete risk (false)' })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /Delete risk/ }));
    await screen.findByRole('alertdialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Delete risk (false)' })).toBeInTheDocument();
  });
});
