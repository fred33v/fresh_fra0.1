import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import EmployerDashboard from '@/pages/EmployerDashboard';
import { useAuth } from '@/hooks/useAuth';
import { api, ApiError } from '@/lib/api';

// ── Mocks ──────────────────────────────────────────────────

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('@/hooks/useAuth');

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn() },
  ApiError: class ApiError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
      this.name = 'ApiError';
    }
  },
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  }),
}));

vi.mock('@/components/layout/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

// Mock Recharts — renders nothing but doesn't break
vi.mock('recharts', () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
}));

vi.mock('@/components/ui/chart', () => ({
  ChartContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
  ChartLegend: () => null,
  ChartLegendContent: () => null,
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedApi = vi.mocked(api);

// ── Helpers ────────────────────────────────────────────────

function makeUser(overrides?: Record<string, unknown>) {
  return {
    userId: 'u-1',
    email: 'employer@example.com',
    name: 'Eve Employer',
    role: 'employer',
    organisationId: 'org-1',
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeEmployee(overrides?: Partial<{
  userId: string;
  userName: string;
  email: string;
  role: string;
  department: string | null;
  status: 'completed' | 'in-progress' | 'not-started';
  startedAt: string | null;
  completedAt: string | null;
  assessmentCount: number;
  latestAssessmentStatus: string | null;
  riskLevel: 'high' | 'medium' | 'low' | null;
}>) {
  return {
    userId: 'emp-1',
    userName: 'Alice Smith',
    email: 'alice@example.com',
    role: 'employee',
    department: 'Finance',
    status: 'completed' as const,
    startedAt: '2025-05-01T00:00:00Z',
    completedAt: '2025-06-01T00:00:00Z',
    assessmentCount: 2,
    latestAssessmentStatus: 'submitted',
    riskLevel: 'low' as const,
    ...overrides,
  };
}

function makeEmployeeDetail(overrides?: Record<string, unknown>) {
  return {
    userId: 'emp-1',
    userName: 'Alice Smith',
    email: 'alice@example.com',
    assessments: [
      {
        id: 'assess-1-full-id',
        title: 'Fraud Risk Assessment',
        status: 'submitted',
        answers: { q1: 'a', q2: 'b', q3: 'c' },
        createdAt: '2025-05-01T00:00:00Z',
        submittedAt: '2025-05-15T00:00:00Z',
      },
    ],
    keypasses: [
      { code: 'KP-001', status: 'used', usedAt: '2025-05-01T00:00:00Z' },
    ],
    ...overrides,
  };
}

function setupAuth(overrides?: Record<string, unknown>) {
  mockedUseAuth.mockReturnValue({
    user: makeUser(),
    profile: null,
    roles: ['employer'] as never[],
    isLoading: false,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    hasRole: vi.fn(),
    refreshProfile: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useAuth>);
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <EmployerDashboard />
    </MemoryRouter>,
  );
}

// ── Tests ──────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();
  setupAuth();
  mockedApi.get.mockResolvedValue([]);
});

describe('EmployerDashboard', () => {
  // ── Auth guard ──────────────────────────────────

  describe('auth guard', () => {
    it('renders null when user is null', () => {
      setupAuth({ user: null });

      const { container } = renderDashboard();

      expect(container.querySelector('[data-testid="layout"]')).toBeNull();
    });

    it('shows access restricted for non-employer users', async () => {
      setupAuth({ user: makeUser({ role: 'employee' }) });

      renderDashboard();

      expect(screen.getByText('Access Restricted')).toBeInTheDocument();
      expect(screen.getByText(/only available for employer and admin/)).toBeInTheDocument();
    });

    it('Go to Dashboard button navigates to /dashboard', async () => {
      setupAuth({ user: makeUser({ role: 'employee' }) });

      const user = userEvent.setup();
      renderDashboard();

      await user.click(screen.getByText('Go to Dashboard'));

      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    it('renders dashboard for employer role', async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Organisation Dashboard')).toBeInTheDocument();
      });
    });

    it('renders dashboard for admin role', async () => {
      setupAuth({ user: makeUser({ role: 'admin' }) });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Organisation Dashboard')).toBeInTheDocument();
      });
    });
  });

  // ── Loading state ─────────────────────────────

  describe('loading state', () => {
    it('shows skeleton cards while fetching', () => {
      mockedApi.get.mockReturnValue(new Promise(() => {}));

      renderDashboard();

      // Skeleton elements appear during loading
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });

  // ── Error states ──────────────────────────────

  describe('error states', () => {
    it('shows generic error when fetch fails', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network error'));

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('shows package upgrade message for PACKAGE_REQUIRED error', async () => {
      mockedApi.get.mockRejectedValueOnce(new ApiError('Upgrade needed', 'PACKAGE_REQUIRED'));

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText(/requires the Full package/)).toBeInTheDocument();
      });
    });

    it('retries fetch when Try Again is clicked', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('Network'));

      const user = userEvent.setup();
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Try Again')).toBeInTheDocument();
      });

      mockedApi.get.mockResolvedValueOnce([makeEmployee()]);
      await user.click(screen.getByText('Try Again'));

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });
    });
  });

  // ── Summary stats ──────────────────────────────

  describe('summary stats', () => {
    const employees = [
      makeEmployee({ userId: 'e1', userName: 'Alice', status: 'completed', riskLevel: 'high' }),
      makeEmployee({ userId: 'e2', userName: 'Bob', status: 'completed', riskLevel: 'low' }),
      makeEmployee({ userId: 'e3', userName: 'Carol', status: 'in-progress', riskLevel: null }),
      makeEmployee({ userId: 'e4', userName: 'Dave', status: 'not-started', riskLevel: null }),
    ];

    beforeEach(() => {
      mockedApi.get.mockResolvedValue(employees);
    });

    it('shows total employee count', async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Total Employees')).toBeInTheDocument();
      });
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('shows completion rate percentage', async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('50%')).toBeInTheDocument();
      });
      expect(screen.getByText('2 of 4 completed')).toBeInTheDocument();
    });

    it('shows in-progress count', async () => {
      renderDashboard();

      // "In Progress" appears in summary card AND as a status badge
      await waitFor(() => {
        expect(screen.getAllByText('In Progress').length).toBeGreaterThanOrEqual(1);
      });
      expect(screen.getByText('Currently training')).toBeInTheDocument();
    });

    it('shows high risk count', async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('High Risk')).toBeInTheDocument();
      });
      expect(screen.getByText('Require attention')).toBeInTheDocument();
    });

    it('shows "No high-risk employees" when none exist', async () => {
      mockedApi.get.mockResolvedValue([
        makeEmployee({ userId: 'e1', riskLevel: 'low' }),
      ]);

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('No high-risk employees')).toBeInTheDocument();
      });
    });
  });

  // ── Employee table ─────────────────────────────

  describe('employee table', () => {
    const employees = [
      makeEmployee({ userId: 'e1', userName: 'Alice Smith', email: 'alice@test.com', department: 'Finance', status: 'completed', riskLevel: 'low', completedAt: '2025-06-15T00:00:00Z' }),
      makeEmployee({ userId: 'e2', userName: 'Bob Jones', email: 'bob@test.com', department: 'IT', status: 'in-progress', riskLevel: 'high', completedAt: null }),
    ];

    beforeEach(() => {
      mockedApi.get.mockResolvedValue(employees);
    });

    it('shows employee names and emails', async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });
      expect(screen.getByText('alice@test.com')).toBeInTheDocument();
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
      expect(screen.getByText('bob@test.com')).toBeInTheDocument();
    });

    it('shows departments', async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Finance')).toBeInTheDocument();
      });
      expect(screen.getByText('IT')).toBeInTheDocument();
    });

    it('shows status badges', async () => {
      renderDashboard();

      // "Completed" appears in both table column header and as a status badge
      await waitFor(() => {
        expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(2);
      });
      // "In Progress" appears in summary card title and as a status badge
      expect(screen.getAllByText('In Progress').length).toBeGreaterThanOrEqual(1);
    });

    it('shows risk level badges', async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Low')).toBeInTheDocument();
      });
      expect(screen.getByText('High')).toBeInTheDocument();
    });

    it('formats completed date in en-GB locale', async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('15 Jun 2025')).toBeInTheDocument();
      });
    });

    it('shows filtered count', async () => {
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Employees (2)')).toBeInTheDocument();
      });
    });
  });

  // ── Empty states ───────────────────────────────

  describe('empty states', () => {
    it('shows "No employees found" when list is empty', async () => {
      mockedApi.get.mockResolvedValue([]);

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText(/No employees found/)).toBeInTheDocument();
      });
    });

    it('shows "No employees match" when filters exclude all', async () => {
      mockedApi.get.mockResolvedValue([
        makeEmployee({ status: 'completed' }),
      ]);

      const user = userEvent.setup();
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });

      // Type a search that matches nothing
      await user.type(screen.getByPlaceholderText('Search by name or email...'), 'nonexistent');

      expect(screen.getByText('No employees match your filters.')).toBeInTheDocument();
    });
  });

  // ── Search ─────────────────────────────────────

  describe('search', () => {
    beforeEach(() => {
      mockedApi.get.mockResolvedValue([
        makeEmployee({ userId: 'e1', userName: 'Alice Smith', email: 'alice@test.com' }),
        makeEmployee({ userId: 'e2', userName: 'Bob Jones', email: 'bob@test.com' }),
      ]);
    });

    it('filters employees by name', async () => {
      const user = userEvent.setup();
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText('Search by name or email...'), 'bob');

      expect(screen.queryByText('Alice Smith')).not.toBeInTheDocument();
      expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    });

    it('filters employees by email', async () => {
      const user = userEvent.setup();
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText('Search by name or email...'), 'alice@');

      expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument();
    });

    it('shows updated count when filtered', async () => {
      const user = userEvent.setup();
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Employees (2)')).toBeInTheDocument();
      });

      await user.type(screen.getByPlaceholderText('Search by name or email...'), 'alice');

      expect(screen.getByText('Employees (1 of 2)')).toBeInTheDocument();
    });
  });

  // ── Employee detail expansion ──────────────────

  describe('employee detail expansion', () => {
    beforeEach(() => {
      mockedApi.get.mockImplementation(async (url: string) => {
        if (url === '/api/v1/analytics/employees') {
          return [makeEmployee({ userId: 'emp-1', status: 'completed' })];
        }
        if (url.includes('/analytics/employees/emp-1')) {
          return makeEmployeeDetail();
        }
        return [];
      });
    });

    it('shows assessment details when clicking completed employee row', async () => {
      const user = userEvent.setup();
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Alice Smith'));

      await waitFor(() => {
        expect(screen.getByText('Fraud Risk Assessment')).toBeInTheDocument();
      });
      expect(screen.getByText('submitted')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument(); // answer count
    });

    it('shows key-pass count', async () => {
      const user = userEvent.setup();
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Alice Smith'));

      await waitFor(() => {
        expect(screen.getByText('1 key-pass associated')).toBeInTheDocument();
      });
    });

    it('collapses on second click', async () => {
      const user = userEvent.setup();
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Alice Smith'));

      await waitFor(() => {
        expect(screen.getByText('Fraud Risk Assessment')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Alice Smith'));

      expect(screen.queryByText('Fraud Risk Assessment')).not.toBeInTheDocument();
    });

    it('shows error and retry when detail fetch fails', async () => {
      mockedApi.get.mockImplementation(async (url: string) => {
        if (url === '/api/v1/analytics/employees') {
          return [makeEmployee({ userId: 'emp-1', status: 'completed' })];
        }
        throw new Error('Server error');
      });

      const user = userEvent.setup();
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Alice Smith'));

      await waitFor(() => {
        expect(screen.getByText('Failed to load employee details. Please try again.')).toBeInTheDocument();
      });
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });

    it('does not expand non-completed employees', async () => {
      mockedApi.get.mockResolvedValue([
        makeEmployee({ userId: 'e1', userName: 'In-Progress User', status: 'in-progress' }),
      ]);

      const user = userEvent.setup();
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('In-Progress User')).toBeInTheDocument();
      });

      await user.click(screen.getByText('In-Progress User'));

      // No detail panel should appear (no API call made for detail)
      expect(mockedApi.get).toHaveBeenCalledTimes(1); // only initial fetch
    });
  });

  // ── CSV export ─────────────────────────────────

  describe('CSV export', () => {
    it('shows Export CSV button when employees exist', async () => {
      mockedApi.get.mockResolvedValue([makeEmployee()]);

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Export CSV')).toBeInTheDocument();
      });
    });

    it('does not show Export CSV button when no employees', async () => {
      mockedApi.get.mockResolvedValue([]);

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText(/No employees found/)).toBeInTheDocument();
      });
      expect(screen.queryByText('Export CSV')).not.toBeInTheDocument();
    });

    it('creates and downloads CSV on click', async () => {
      mockedApi.get.mockResolvedValue([
        makeEmployee({ userName: 'Alice "Ace" Smith', email: 'alice@test.com', department: 'Finance', status: 'completed', riskLevel: 'low', assessmentCount: 2, completedAt: '2025-06-15T00:00:00Z' }),
      ]);

      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      const clickSpy = vi.fn();
      const originalCreateElement = document.createElement.bind(document);
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'a') {
          return { href: '', download: '', click: clickSpy } as unknown as HTMLAnchorElement;
        }
        return originalCreateElement(tag);
      });

      const user = userEvent.setup();
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Export CSV')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Export CSV'));

      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalled();

      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
      vi.restoreAllMocks();
    });
  });

  // ── Refresh ────────────────────────────────────

  describe('refresh', () => {
    it('re-fetches data when Refresh button is clicked', async () => {
      mockedApi.get.mockResolvedValue([]);

      const user = userEvent.setup();
      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Organisation Dashboard')).toBeInTheDocument();
      });

      mockedApi.get.mockResolvedValue([makeEmployee()]);
      await user.click(screen.getByText('Refresh'));

      await waitFor(() => {
        expect(screen.getByText('Alice Smith')).toBeInTheDocument();
      });
    });
  });

  // ── Charts ─────────────────────────────────────

  describe('charts', () => {
    it('renders chart containers when employees exist', async () => {
      mockedApi.get.mockResolvedValue([makeEmployee()]);

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Status Breakdown')).toBeInTheDocument();
      });
      expect(screen.getByText('Risk Distribution')).toBeInTheDocument();
    });

    it('does not render charts when no employees', async () => {
      mockedApi.get.mockResolvedValue([]);

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText('Organisation Dashboard')).toBeInTheDocument();
      });
      expect(screen.queryByText('Status Breakdown')).not.toBeInTheDocument();
    });
  });
});
