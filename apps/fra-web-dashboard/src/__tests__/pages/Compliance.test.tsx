import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Compliance from '@/pages/Compliance';
import { api } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn(), download: vi.fn() },
  ApiError: class ApiError extends Error {
    code: string;
    constructor(code: string, message: string) { super(message); this.code = code; }
  },
}));
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));
vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedApi = vi.mocked(api);

// The page reads ?tab= so the dashboard can link straight to gaps, incidents or training
function renderCompliance(route = '/compliance') {
  return render(<MemoryRouter initialEntries={[route]}><Compliance /></MemoryRouter>);
}

const report = {
  generatedAt: '2026-09-29T10:00:00Z',
  eccta2023: {
    score: 50,
    requirements: [
      { id: 'eccta-1', name: 'Top-level commitment', status: 'met', evidence: '1 senior manager(s) recorded, all reviewed in the last 12 months.' },
      { id: 'eccta-5', name: 'Communication (including training)', status: 'not_met', evidence: 'No staff have completed fraud awareness training.', recommendation: 'Run the staff fraud awareness workshop and issue certificates.' },
    ],
  },
  govs013: { score: 75, requirements: [{ id: 'govs-1', name: 'Accountable individual and governance', status: 'met', evidence: 'Recorded.' }] },
  metrics: {
    employees: 10, employeesAssessed: 6, assessmentCoverage: 60, riskLevels: { high: 2, medium: 3, low: 1, not_scored: 0 },
    trainingCompleted: 0, trainingCoverage: 0, latestAssessmentAt: null, registerRisks: 4, openHighRisks: 2,
    highRisksWithoutOwnerOrPlan: 1, openIncidents: 1, openSeriousIncidents: 1, seniorManagers: 1, seniorManagersReviewedInYear: 1,
    keypassesIssued: 10, keypassesUsed: 6, auditEvents: 40,
  },
  topRiskAreas: [{ area: 'Procurement', employeesFlagged: 4, highestPriority: 'high', averageResidual: 16, titles: ['Supplier fraud'] }],
  disclaimer: 'Self-assessment indicators … do not replace legal advice.',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedApi.get.mockImplementation(async (path: string) => {
    if (path.startsWith('/api/v1/compliance/report')) return report;
    if (path.startsWith('/api/v1/analytics/employees')) return [{ userId: 'u1', userName: 'Priya Shah' }];
    if (path.startsWith('/api/v1/compliance/incidents')) return [];
    if (path.startsWith('/api/v1/compliance/gap-analysis')) return {
      gaps: [{ framework: 'ECCTA 2023', requirementId: 'eccta-5', requirement: 'Communication (including training)', status: 'not_met', priority: 'CRITICAL', evidence: 'No staff trained.', recommendation: 'Run the workshop.' }],
    };
    return [];
  });
});

describe('Compliance page', () => {
  it('shows framework scores with evidence and next steps', async () => {
    renderCompliance();
    expect(await screen.findByLabelText('ECCTA 2023 score 50%')).toBeInTheDocument();
    expect(screen.getByLabelText('GovS 013 score 75%')).toBeInTheDocument();
    expect(screen.getByText('No staff have completed fraud awareness training.')).toBeInTheDocument();
    expect(screen.getByText('Run the staff fraud awareness workshop and issue certificates.')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument(); // staff assessed
    expect(screen.getByText('Supplier fraud')).toBeInTheDocument();
    expect(screen.getByText(/do not replace legal advice/)).toBeInTheDocument();
  });

  it('lists gaps by priority', async () => {
    renderCompliance();
    await userEvent.click(await screen.findByRole('tab', { name: 'Gaps' }));
    expect(await screen.findByText('CRITICAL')).toBeInTheDocument();
    expect(screen.getByText('Run the workshop.')).toBeInTheDocument();
  });

  it('opens the tab named in ?tab= so dashboard links land on the right section', async () => {
    renderCompliance('/compliance?tab=gaps');
    expect(await screen.findByText('CRITICAL')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Gaps' })).toHaveAttribute('aria-selected', 'true');
  });

  it('requires a description before recording an incident', async () => {
    renderCompliance();
    await userEvent.click(await screen.findByRole('tab', { name: 'Incidents' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Record incident' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Describe what happened');
    expect(mockedApi.post).not.toHaveBeenCalled();
  });

  it('records an incident and refreshes the report', async () => {
    mockedApi.post.mockResolvedValue({});
    renderCompliance();
    await userEvent.click(await screen.findByRole('tab', { name: 'Incidents' }));
    await userEvent.type(await screen.findByLabelText('What happened'), 'Duplicate invoice paid');
    await userEvent.click(screen.getByRole('button', { name: 'Record incident' }));
    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/api/v1/compliance/incidents', {
      type: 'fraud_incident', severity: 'medium', description: 'Duplicate invoice paid',
    }));
    await waitFor(() => expect(mockedApi.get.mock.calls.filter(([p]) => p === '/api/v1/compliance/report')).toHaveLength(2));
  });

  it('downloads a dataset export', async () => {
    renderCompliance();
    await userEvent.click(await screen.findByRole('tab', { name: 'Exports' }));
    const panel = await screen.findByRole('tabpanel');
    await userEvent.click(within(panel).getByRole('button', { name: 'Download Risk register CSV' }));
    expect(mockedApi.download).toHaveBeenCalledWith('/api/v1/compliance/export?format=csv&dataset=risk_register', 'compliance-risk_register.csv');
  });
});
