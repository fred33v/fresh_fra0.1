import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { EnterpriseOverview, type OverviewEmployee } from '@/components/enterprise/EnterpriseOverview';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn() },
  ApiError: class ApiError extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
  },
}));
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

const mockedApi = vi.mocked(api);

const report = {
  generatedAt: '2026-09-29T10:00:00Z',
  eccta2023: {
    score: 50,
    requirements: [
      { id: 'eccta-1', name: 'Top-level commitment', status: 'met', evidence: '1 senior manager recorded.' },
      { id: 'eccta-5', name: 'Communication (including training)', status: 'not_met', evidence: 'No staff trained.', recommendation: 'Run the staff fraud awareness workshop and issue certificates.' },
    ],
  },
  govs013: { score: 75, requirements: [] },
  metrics: {
    employees: 3, assessmentCoverage: 67, trainingCoverage: 0,
    latestAssessmentAt: new Date().toISOString(), openSeriousIncidents: 1, openIncidents: 1,
  },
  topRiskAreas: [{ area: 'Procurement', employeesFlagged: 2, highestPriority: 'high' }],
};

const summary = {
  total: 3,
  byPriority: { HIGH: 2, MEDIUM: 1, LOW: 0 },
  overdue: 1,
  unowned: 2,
  heatMap: [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0], [0, 0, 1, 0, 0], [0, 0, 0, 0, 0], [0, 0, 0, 1, 1]],
};

const gaps = {
  gaps: [{ framework: 'ECCTA 2023', requirementId: 'eccta-5', requirement: 'Communication (including training)', priority: 'CRITICAL', recommendation: 'Run the workshop.' }],
};

const employees: OverviewEmployee[] = [
  { userId: 'a', department: 'Finance', status: 'completed', riskLevel: 'high' },
  { userId: 'b', department: 'Finance', status: 'not-started', riskLevel: null },
  { userId: 'c', department: 'Operations', status: 'completed', riskLevel: 'low' },
];

function mockApi(overrides: Record<string, () => Promise<unknown>> = {}) {
  mockedApi.get.mockImplementation(async (path: string) => {
    for (const [prefix, fn] of Object.entries(overrides)) if (path.startsWith(prefix)) return fn();
    if (path.startsWith('/api/v1/compliance/report')) return report;
    if (path.startsWith('/api/v1/risk-register/summary')) return summary;
    if (path.startsWith('/api/v1/compliance/gap-analysis')) return gaps;
    if (path.startsWith('/api/v1/api-keys')) return [{ id: 'k1', lastUsedAt: '2026-09-28T10:00:00Z' }, { id: 'k2', revokedAt: '2026-09-01T00:00:00Z' }];
    if (path.startsWith('/api/v1/webhook-endpoints')) return [{ id: 'w1', isActive: true, lastDeliveryStatus: 500 }];
    return [];
  });
}

function renderOverview(onShowEmployees = vi.fn()) {
  render(
    <MemoryRouter>
      <EnterpriseOverview employees={employees} refreshSignal={0} onShowEmployees={onShowEmployees} />
    </MemoryRouter>,
  );
  return onShowEmployees;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApi();
});

describe('EnterpriseOverview', () => {
  it('shows the headline compliance and risk position', async () => {
    renderOverview();

    expect(await screen.findByRole('link', { name: /ECCTA 2023 readiness/ })).toHaveTextContent('50%1 of 2 principles met');
    expect(screen.getByRole('link', { name: /GovS 013 alignment/ })).toHaveTextContent('75%');
    expect(screen.getByRole('link', { name: /Open high risks/ })).toHaveTextContent('21 overdue · 2 without an owner');
    expect(screen.getByRole('link', { name: /Staff coverage/ })).toHaveTextContent('67%assessed · 0% trained');
  });

  it('lists what needs attention, most severe first, linking to where it is fixed', async () => {
    renderOverview();

    const list = (await screen.findByText('Needs attention')).closest('div')!.parentElement!;
    const items = within(list).getAllByRole('listitem').map((li) => li.textContent);
    expect(items[0]).toMatch(/1 risk action is past the due date/);
    expect(items.join(' ')).toMatch(/1 serious incident is still open/);
    expect(items.join(' ')).toMatch(/ECCTA 2023: Communication \(including training\) is not met/);
    expect(items.at(-1)).toMatch(/0% of staff have completed fraud awareness training/);
    expect(within(list).getByRole('link', { name: 'Review incidents' })).toHaveAttribute('href', '/compliance?tab=incidents');
  });

  it('drills into high-risk employees and departments', async () => {
    const onShow = renderOverview();
    const user = userEvent.setup();

    await user.click(await screen.findByRole('button', { name: 'Show employees' }));
    expect(onShow).toHaveBeenCalledWith({ risk: 'high' });

    await user.click(screen.getByRole('button', { name: 'Finance' }));
    expect(onShow).toHaveBeenCalledWith({ department: 'Finance' });
  });

  it('ranks departments by high-risk staff and shows assessment completion', async () => {
    renderOverview();

    const rows = within((await screen.findByText('Department scorecard')).closest('div')!.parentElement!).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Finance250%1');
    expect(rows[2]).toHaveTextContent('Operations1100%0');
  });

  it('summarises integrations, flagging failed webhook deliveries', async () => {
    renderOverview();

    expect(await screen.findByText('Active API keys')).toBeInTheDocument();
    expect(screen.getByText('In use')).toBeInTheDocument();
    expect(screen.getByText('Last delivery failed')).toBeInTheDocument();
  });

  it('keeps the rest of the overview when one source fails', async () => {
    mockApi({ '/api/v1/risk-register/summary': () => Promise.reject(new Error('down')) });
    renderOverview();

    expect(await screen.findByText(/Some sections couldn't be updated/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ECCTA 2023 readiness/ })).toHaveTextContent('50%');
    expect(screen.getByText('Risk register unavailable')).toBeInTheDocument();
    expect(screen.getAllByText("This section couldn't load.").length).toBeGreaterThan(0);
  });
});
