import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ReassessmentBanner } from '@/components/ReassessmentBanner';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

const mockedGet = vi.mocked(api.get);
const renderBanner = () => render(<MemoryRouter><ReassessmentBanner /></MemoryRouter>);

describe('ReassessmentBanner', () => {
  it('shows the due date when the reassessment is due soon', async () => {
    mockedGet.mockResolvedValue({ status: 'due_soon', dueAt: '2026-10-14T09:00:00Z', daysUntilDue: 10 });
    renderBanner();
    expect(await screen.findByText('Your quarterly reassessment is due soon')).toBeInTheDocument();
    expect(screen.getByText(/due on 14 October 2026, in 10 days/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start reassessment' })).toHaveAttribute('href', '/assessment');
  });

  it('flags an overdue reassessment', async () => {
    mockedGet.mockResolvedValue({ status: 'overdue', dueAt: '2026-09-01T09:00:00Z', daysUntilDue: -33 });
    renderBanner();
    expect(await screen.findByText('Your quarterly reassessment is overdue')).toBeInTheDocument();
    expect(screen.getByText(/was due on 1 September 2026/)).toBeInTheDocument();
  });

  it('stays hidden when nothing is due or reassessment is not in the package', async () => {
    mockedGet.mockResolvedValue({ status: 'ok', dueAt: '2026-12-01T09:00:00Z', daysUntilDue: 58 });
    const { container } = renderBanner();
    await vi.waitFor(() => expect(mockedGet).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
