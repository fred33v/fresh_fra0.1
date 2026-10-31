import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportFromAssessment } from '@/components/enterprise/ImportFromAssessment';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(api);
beforeEach(() => vi.clearAllMocks());

const suggestions = [
  { title: 'Procurement fraud', riskArea: 'procurement', description: '', priority: 'high', raisedBy: 3, assessedAt: '2026-10-31T10:00:00Z' },
  { title: 'Payroll fraud', riskArea: 'payroll_hr', description: '', priority: 'medium', raisedBy: 1, assessedAt: '2026-10-31T10:00:00Z' },
];

describe('ImportFromAssessment', () => {
  it('lists what the assessment found and adds the ones picked', async () => {
    mockedApi.get.mockResolvedValueOnce(suggestions).mockResolvedValueOnce([]);
    mockedApi.post.mockResolvedValue([{}]);
    const onImported = vi.fn();
    render(<ImportFromAssessment onImported={onImported} />);
    expect(await screen.findByText(/found 2 high or medium risks/)).toBeInTheDocument();
    expect(screen.getByText(/raised by 3 people/)).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/Payroll fraud/));
    await userEvent.click(screen.getByRole('button', { name: 'Add 1 to the register' }));
    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/api/v1/risk-register/from-assessment', { titles: ['Procurement fraud'] }));
    await waitFor(() => expect(onImported).toHaveBeenCalled());
  });

  it('shows nothing when everything is already in the register', async () => {
    mockedApi.get.mockResolvedValue([]);
    const { container } = render(<ImportFromAssessment onImported={vi.fn()} />);
    await waitFor(() => expect(mockedApi.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
