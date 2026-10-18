import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { HealthCheckCard } from '@/components/HealthCheckCard';
import { describeAllowance } from '@/lib/assessmentAllowance';
import type { Entitlements } from '@/hooks/useEntitlements';
import type { AssessmentRecord } from '@/types/assessment';

const mockGet = vi.fn();
const mockDownload = vi.fn();
vi.mock('@/lib/api', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
    download: (...args: unknown[]) => mockDownload(...args),
  },
}));

function entitlements(packageName: string, assessments: Entitlements['assessments'], assessment = true): Entitlements {
  return {
    packageId: null, packageName, tier: 1, expiresAt: null, keypassAllowance: 1,
    features: { assessment, training: false, certificates: false, dashboard: false, compliance: false },
    assessments,
  };
}

function record(status: AssessmentRecord['status'], over: Partial<AssessmentRecord> = {}): AssessmentRecord {
  return {
    id: 'a-1', organisationId: 'o-1', createdByUserId: 'u-1', title: 'Health check', status, answers: {},
    createdAt: '2026-10-01T09:00:00.000Z', updatedAt: '2026-10-02T09:00:00.000Z', ...over,
  };
}

function renderCard(ent: Entitlements | null) {
  return render(<MemoryRouter><HealthCheckCard entitlements={ent} /></MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('describeAllowance', () => {
  it('describes each package', () => {
    expect(describeAllowance({ allowed: true, limit: 1, used: 0 })).toBe('1 assessment included');
    expect(describeAllowance({ allowed: false, limit: 1, used: 1 })).toBe('Your included assessment has been used');
    expect(describeAllowance({ allowed: true, limit: 4, used: 1 })).toBe('3 of 4 assessments left this year');
    expect(describeAllowance({ allowed: true, limit: null, used: 0 })).toBe('Unlimited assessments');
  });
});

describe('HealthCheckCard', () => {
  it('without a package, says the health check is in every package', () => {
    renderCard(entitlements('', { allowed: false, limit: 0, used: 0 }, false));
    expect(screen.getByText('Included in every package, from Starter upwards.')).toBeInTheDocument();
    expect(screen.getByText('See packages')).toBeInTheDocument();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('Starter, not started: offers to start the health check', async () => {
    mockGet.mockResolvedValue([]);
    renderCard(entitlements('Starter', { allowed: true, limit: 1, used: 0 }));

    expect(await screen.findByText('Start your health check')).toBeInTheDocument();
    expect(screen.getByText('Included in Starter')).toBeInTheDocument();
    expect(screen.getByText(/1 assessment included/)).toBeInTheDocument();
  });

  it('Starter, used: shows results and report but no new assessment', async () => {
    mockGet.mockResolvedValue([record('completed')]);
    renderCard(entitlements('Starter', {
      allowed: false, limit: 1, used: 1, reason: 'Starter includes a single assessment — upgrade to Professional for quarterly reassessment',
    }));

    expect(await screen.findByText('View results')).toBeInTheDocument();
    expect(screen.getByText('Download PDF report')).toBeInTheDocument();
    expect(screen.queryByText('Start a new assessment')).not.toBeInTheDocument();
    expect(screen.getByText(/upgrade to Professional for quarterly reassessment/)).toBeInTheDocument();
  });

  it('Professional: includes the Starter health check, with reassessments', async () => {
    mockGet.mockResolvedValue([record('submitted')]);
    renderCard(entitlements('Professional', { allowed: true, limit: 4, used: 1 }));

    expect(await screen.findByText('Start a new assessment')).toBeInTheDocument();
    expect(screen.getByText('View results').closest('a')).toHaveAttribute('href', '/assessment/a-1/results');
    expect(screen.getByText(/3 of 4 assessments left this year/)).toBeInTheDocument();
  });

  it('an assessment in progress is continued rather than restarted', async () => {
    mockGet.mockResolvedValue([record('in_progress')]);
    renderCard(entitlements('Professional', { allowed: true, limit: 4, used: 1 }));

    expect(await screen.findByText('Continue health check')).toBeInTheDocument();
    expect(screen.queryByText('Start a new assessment')).not.toBeInTheDocument();
  });

  it('downloads the PDF report of the latest finished assessment', async () => {
    mockGet.mockResolvedValue([record('completed', { id: 'a-9' })]);
    mockDownload.mockResolvedValue(undefined);
    renderCard(entitlements('Enterprise', { allowed: true, limit: null, used: 0 }));

    await userEvent.click(await screen.findByText('Download PDF report'));
    await waitFor(() => expect(mockDownload).toHaveBeenCalledWith('/api/v1/assessments/a-9/export-pdf', 'fraud-risk-assessment-report.pdf'));
  });
});
