import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SpeakUp from '@/pages/SpeakUp';
import { anonymousApi, api } from '@/lib/api';

// jsdom lacks the browser APIs Radix radio groups and selects use
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.scrollIntoView ??= () => {};

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
  anonymousApi: { get: vi.fn(), post: vi.fn() },
  ApiError: class ApiError extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
  },
}));

const anon = vi.mocked(anonymousApi);
const DESCRIPTION = 'A supplier is invoicing twice for the same deliveries every month.';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/speak-up/status" element={<SpeakUp mode="follow" />} />
        <Route path="/speak-up/:token" element={<SpeakUp mode="report" />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  anon.get.mockResolvedValue({
    organisationName: 'Acme Health Trust', intro: 'Reports go to the audit committee chair.',
    categories: ['fraud', 'bribery'], relationships: ['employee', 'public'],
  });
});

describe('Speak-up report page', () => {
  it('sends an anonymous report without the signed-in client and shows the reference and key once', async () => {
    const user = userEvent.setup();
    anon.post.mockResolvedValue({ reference: 'SU-ABCD2345', accessKey: 'KEYKEYKEYKEYKEYKEYKE', message: 'Keep them safe.' });
    renderAt('/speak-up/intake-token-1234567890');

    expect(await screen.findByText('Report a concern to Acme Health Trust')).toBeInTheDocument();
    expect(screen.getByText('Reports go to the audit committee chair.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('What happened?'), DESCRIPTION);
    await user.click(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() => expect(anon.post).toHaveBeenCalledWith('/api/v1/speak-up/intake-token-1234567890/reports', {
      category: 'fraud', relationship: 'employee', description: DESCRIPTION, anonymous: true,
      occurredWhen: undefined, location: undefined, peopleInvolved: undefined, amountGbp: undefined,
    }));
    expect(api.post).not.toHaveBeenCalled();
    expect(await screen.findByText('SU-ABCD2345')).toBeInTheDocument();
    expect(screen.getByText('KEYKEYKEYKEYKEYKEYKE')).toBeInTheDocument();
  });

  it('asks a named reporter how to reply', async () => {
    const user = userEvent.setup();
    renderAt('/speak-up/intake-token-1234567890');
    await user.type(await screen.findByLabelText('What happened?'), DESCRIPTION);
    await user.click(screen.getByLabelText('Yes, they can contact me'));
    await user.type(screen.getByLabelText('Name'), 'Sam Lee');
    await user.click(screen.getByRole('button', { name: 'Send report' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Give an email or phone number');
    expect(anon.post).not.toHaveBeenCalled();
  });

  it('explains when the link does not work', async () => {
    anon.get.mockRejectedValue(new Error('not found'));
    renderAt('/speak-up/old-token-123456789012');
    expect(await screen.findByText(/This reporting link is not available/)).toBeInTheDocument();
  });
});

describe('Follow your report page', () => {
  it('shows the status and conversation, and sends a reply', async () => {
    const user = userEvent.setup();
    const status = {
      reference: 'SU-ABCD2345', status: 'Being reviewed', receivedAt: '2026-10-01T09:00:00Z', updatedAt: '2026-10-02T09:00:00Z',
      messages: [{ author: 'handler', body: 'Which supplier is it?', createdAt: '2026-10-02T09:00:00Z' }],
    };
    anon.post.mockResolvedValue(status);
    renderAt('/speak-up/status');

    await user.type(screen.getByLabelText('Case reference'), 'SU-ABCD2345');
    await user.type(screen.getByLabelText('Access key'), 'KEYKEYKEYKEYKEYKEYKE');
    await user.click(screen.getByRole('button', { name: 'Show my report' }));
    expect(await screen.findByText('SU-ABCD2345: Being reviewed')).toBeInTheDocument();
    expect(screen.getByText('Which supplier is it?')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Add information or reply'), 'Acme Supplies Ltd');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(anon.post).toHaveBeenLastCalledWith('/api/v1/speak-up/messages', {
      reference: 'SU-ABCD2345', accessKey: 'KEYKEYKEYKEYKEYKEYKE', message: 'Acme Supplies Ltd',
    }));
  });
});
