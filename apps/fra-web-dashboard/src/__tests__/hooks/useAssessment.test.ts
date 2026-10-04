import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAssessment } from '@/hooks/useAssessment';
import { ApiError } from '@/lib/api';
import { toast } from 'sonner';

// ── Mocks ────────────────────────────────────────────────────

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api')>('@/lib/api');
  return {
    ApiError: actual.ApiError,
    api: {
      get: (...args: unknown[]) => mockGet(...args),
      post: (...args: unknown[]) => mockPost(...args),
      patch: (...args: unknown[]) => mockPatch(...args),
    },
  };
});

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: { userId: 'user-1', organisationId: 'org-1' },
    profile: { id: 'user-1' },
  })),
}));

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const modules = [
  {
    id: 'procurement',
    title: 'Procurement',
    description: '',
    category: 'process',
    questions: [{ id: 'procurement.recentFraud', text: 'Recent fraud?', type: 'yesno' }],
  },
];

function assessment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a-1',
    organisationId: 'org-1',
    createdByUserId: 'user-1',
    title: 'Fraud Risk Assessment',
    status: 'draft',
    answers: {},
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function mockGets(existing: unknown[]) {
  mockGet.mockImplementation((path: string) => {
    if (path === '/api/v1/assessments/modules') return Promise.resolve(modules);
    if (path.startsWith('/api/v1/assessments?')) return Promise.resolve(existing);
    if (path === '/api/v1/assessments/a-1/results') {
      return Promise.resolve({ assessmentId: 'a-1', overallScore: 42, riskLevel: 'Low', modules: [], topRisks: [] });
    }
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
}

describe('useAssessment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new assessment via POST /api/v1/assessments when none is open', async () => {
    mockGets([assessment({ id: 'old', status: 'submitted' })]);
    mockPost.mockResolvedValue(assessment());

    const { result } = renderHook(() => useAssessment());
    await act(() => result.current.startAssessment());

    expect(mockPost).toHaveBeenCalledWith('/api/v1/assessments', {});
    expect(result.current.assessment?.id).toBe('a-1');
    expect(result.current.modules).toEqual(modules);
  });

  it('resumes the user\'s open assessment instead of creating another', async () => {
    mockGets([
      assessment({ id: 'someone-else', createdByUserId: 'user-2' }),
      assessment({ answers: { 'procurement.recentFraud': 'no' } }),
    ]);

    const { result } = renderHook(() => useAssessment());
    await act(() => result.current.startAssessment());

    expect(mockPost).not.toHaveBeenCalled();
    expect(result.current.assessment?.id).toBe('a-1');
    expect(result.current.answers).toEqual({ 'procurement.recentFraud': 'no' });
  });

  it.each([
    ['PACKAGE_REQUIRED', 'A paid package is required to start an assessment'],
    ['ASSESSMENT_LIMIT_REACHED', 'Starter includes a single assessment — upgrade to Professional for quarterly reassessment'],
  ])('surfaces the backend %s message', async (code, message) => {
    mockGets([]);
    mockPost.mockRejectedValue(new ApiError(code, message));

    const { result } = renderHook(() => useAssessment());
    await act(() => result.current.startAssessment());

    expect(result.current.assessment).toBeNull();
    expect(result.current.errorCode).toBe(code);
    expect(result.current.error).toBe(message);
    expect(toast.error).toHaveBeenCalledWith(message);
  });

  it('keeps every answer from quick changes and saves them in one request after a pause', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      mockGets([assessment()]);
      mockPatch.mockResolvedValue(assessment());

      const { result } = renderHook(() => useAssessment());
      await act(() => result.current.startAssessment());
      act(() => {
        result.current.updateAnswer('procurement.recentFraud', 'yes');
        result.current.updateAnswer('procurement.monthlySpend', 2);
        result.current.updateAnswer('procurement.monthlySpend', 25);
      });
      expect(mockPatch).not.toHaveBeenCalled();
      expect(result.current.answers).toEqual({ 'procurement.recentFraud': 'yes', 'procurement.monthlySpend': 25 });

      await act(async () => { vi.advanceTimersByTime(1000); });
      expect(mockPatch).toHaveBeenCalledTimes(1);
      expect(mockPatch).toHaveBeenCalledWith('/api/v1/assessments/a-1', {
        answers: { 'procurement.recentFraud': 'yes', 'procurement.monthlySpend': 25 },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('saves answers, submits and loads results from the plural routes', async () => {
    mockGets([assessment()]);
    mockPatch.mockResolvedValue(assessment());
    mockPost.mockResolvedValue(assessment({ status: 'submitted' }));

    const { result } = renderHook(() => useAssessment());
    await act(() => result.current.startAssessment());
    await act(() => result.current.updateAnswer('procurement.recentFraud', 'yes'));

    let returned: unknown;
    await act(async () => { returned = await result.current.submitAssessment(); });

    expect(mockPatch).toHaveBeenLastCalledWith('/api/v1/assessments/a-1', { answers: { 'procurement.recentFraud': 'yes' } });
    expect(mockPost).toHaveBeenCalledWith('/api/v1/assessments/a-1/submit');
    expect(returned).toMatchObject({ assessmentId: 'a-1', overallScore: 42 });
    expect(result.current.riskScore).toBe(42);
  });
});
