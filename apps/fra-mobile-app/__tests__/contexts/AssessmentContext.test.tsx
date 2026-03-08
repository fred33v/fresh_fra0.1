/**
 * AssessmentContext - Integration Tests
 *
 * Tests offline-first draft persistence, sync queue management,
 * assessment lifecycle (create, update, validate, submit),
 * payment processing, and network-aware sync behaviour.
 */

import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AssessmentProvider, useAssessment } from '@/contexts/AssessmentContext';
import { apiService } from '@/services/api.service';
import { createEmptyAssessment } from '@/utils/assessment';

// ── Mocks ──────────────────────────────────────────────────

jest.mock('@/services/api.service', () => ({
  apiService: {
    post: jest.fn(),
    patch: jest.fn(),
    get: jest.fn(),
    isAuthenticated: jest.fn().mockReturnValue(false),
    setTokens: jest.fn(),
    clearTokens: jest.fn(),
  },
}));

jest.mock('@/constants/api', () => ({
  API_CONFIG: {
    BASE_URL: 'http://test.com',
    ENDPOINTS: {
      AUTH: {
        SIGNUP: '/api/v1/auth/signup',
        LOGIN: '/api/v1/auth/login',
        LOGOUT: '/api/v1/auth/logout',
        REFRESH: '/api/v1/auth/refresh',
        ME: '/api/v1/auth/me',
      },
      ASSESSMENTS: {
        CREATE: '/api/v1/assessments',
        GET: (id) => `/api/v1/assessments/${id}`,
        UPDATE: (id) => `/api/v1/assessments/${id}`,
        SUBMIT: (id) => `/api/v1/assessments/${id}/submit`,
        RISK_REGISTER: (id) => `/api/v1/assessments/${id}/risk-register`,
        BY_ORG: (orgId) => `/api/v1/assessments/organisation/${orgId}`,
      },
      PURCHASES: {
        CREATE: '/api/v1/purchases',
        CONFIRM: (id) => `/api/v1/purchases/${id}/confirm`,
        GET: (id) => `/api/v1/purchases/${id}`,
        BY_ORG: (orgId) => `/api/v1/purchases/organisation/${orgId}`,
      },
      PACKAGES: { LIST: '/api/v1/packages', RECOMMENDED: '/api/v1/packages/recommended' },
      KEYPASSES: {
        USE: '/api/v1/keypasses/use',
        ALLOCATE: '/api/v1/keypasses/allocate',
        BY_ORG: (orgId) => `/api/v1/keypasses/organisation/${orgId}`,
        STATS: (orgId) => `/api/v1/keypasses/organisation/${orgId}/stats`,
        REVOKE: '/api/v1/keypasses/revoke',
      },
      HEALTH: '/health',
    },
    TIMEOUT: 5000,
  },
}));

jest.mock('@/utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }),
}));

// ── Helpers ────────────────────────────────────────────────

function wrapper({ children }) {
  return <AssessmentProvider>{children}</AssessmentProvider>;
}

// ── Tests ──────────────────────────────────────────────────

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  (AsyncStorage.getItem).mockResolvedValue(null);
  (AsyncStorage.setItem).mockResolvedValue(undefined);
  (AsyncStorage.removeItem).mockResolvedValue(undefined);
  (apiService.isAuthenticated).mockReturnValue(false);
});

afterEach(() => {
  // Flush any pending debounced sync timers so Jest can exit cleanly
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

describe('AssessmentContext', () => {
  // ── Initial state ──────────────────────────────

  describe('initial state', () => {
    it('provides a default empty assessment', async () => {
      const { result } = renderHook(() => useAssessment(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.assessment).toBeDefined();
      expect(result.current.assessment.status).toBe('draft');
      expect(result.current.assessment.id).toMatch(/^fra-/);
    });

    it('starts with synced status and online', async () => {
      const { result } = renderHook(() => useAssessment(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.syncStatus.state).toBe('synced');
      expect(result.current.isOnline).toBe(true);
      expect(result.current.syncQueue).toEqual([]);
    });

    it('returns all expected functions', async () => {
      const { result } = renderHook(() => useAssessment(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.updateAssessment).toBe('function');
      expect(typeof result.current.startNewAssessment).toBe('function');
      expect(typeof result.current.submitAssessment).toBe('function');
      expect(typeof result.current.selectPackage).toBe('function');
      expect(typeof result.current.processPayment).toBe('function');
      expect(typeof result.current.submitFeedback).toBe('function');
      expect(typeof result.current.saveDraft).toBe('function');
      expect(typeof result.current.validateAssessment).toBe('function');
      expect(typeof result.current.processSyncQueue).toBe('function');
    });
  });

  // ── Draft loading ──────────────────────────────

  describe('loadDraft', () => {
    it('loads a stored draft from AsyncStorage on mount', async () => {
      const stored = createEmptyAssessment();
      stored.organisation.name = 'Test Org';
      (AsyncStorage.getItem).mockImplementation((key) => {
        if (key === 'fra_assessment_draft') return Promise.resolve(JSON.stringify(stored));
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useAssessment(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.assessment.organisation.name).toBe('Test Org');
    });

    it('handles invalid JSON gracefully by clearing storage', async () => {
      (AsyncStorage.getItem).mockImplementation((key) => {
        if (key === 'fra_assessment_draft') return Promise.resolve('not-valid-json');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useAssessment(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('fra_assessment_draft');
      expect(result.current.assessment.status).toBe('draft');
    });

    it('handles null/undefined stored values', async () => {
      (AsyncStorage.getItem).mockImplementation((key) => {
        if (key === 'fra_assessment_draft') return Promise.resolve('null');
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useAssessment(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.assessment.status).toBe('draft');
    });

    it('merges stored draft with defaults for schema migration', async () => {
      const partial = { id: 'fra-123', organisation: { name: 'Partial Org' } };
      (AsyncStorage.getItem).mockImplementation((key) => {
        if (key === 'fra_assessment_draft') return Promise.resolve(JSON.stringify(partial));
        return Promise.resolve(null);
      });

      const { result } = renderHook(() => useAssessment(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.assessment.organisation.name).toBe('Partial Org');
      expect(result.current.assessment.riskRegister).toEqual([]);
      expect(result.current.assessment.payment).toBeDefined();
      expect(result.current.assessment.payment.status).toBe('pending');
    });
  });

  // ── saveDraft ──────────────────────────────────

  describe('saveDraft', () => {
    it('persists assessment to AsyncStorage', async () => {
      const { result } = renderHook(() => useAssessment(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const data = {
        ...result.current.assessment,
        organisation: { ...result.current.assessment.organisation, name: 'Saved Org' },
      };

      await act(async () => {
        await result.current.saveDraft(data);
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'fra_assessment_draft',
        expect.stringContaining('Saved Org'),
      );
    });
  });

  // ── updateAssessment ───────────────────────────

  describe('updateAssessment', () => {
    it('updates assessment state with partial data', async () => {
      const { result } = renderHook(() => useAssessment(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.updateAssessment({ priorities: 'High priority items' });
      });

      expect(result.current.assessment.priorities).toBe('High priority items');
    });

    it('sets updatedAt timestamp on update', async () => {
      const { result } = renderHook(() => useAssessment(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const before = result.current.assessment.updatedAt;

      // Advance clock to get a different timestamp
      jest.advanceTimersByTime(50);

      act(() => {
        result.current.updateAssessment({ priorities: 'Updated' });
      });

      expect(result.current.assessment.updatedAt).not.toBe(before);
    });

    it('persists to AsyncStorage on update', async () => {
      const { result } = renderHook(() => useAssessment(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.updateAssessment({ priorities: 'Persisted' });
      });

      await waitFor(() => {
        const calls = (AsyncStorage.setItem).mock.calls;
        const draftCalls = calls.filter(
          (c) => c[0] === 'fra_assessment_draft' && c[1].includes('Persisted'),
        );
        expect(draftCalls.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  // ── startNewAssessment ─────────────────────────

  describe('startNewAssessment', () => {
    it('resets assessment to empty state', async () => {
      const { result } = renderHook(() => useAssessment(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.updateAssessment({ priorities: 'Existing data' });
      });

      expect(result.current.assessment.priorities).toBe('Existing data');

      act(() => {
        result.current.startNewAssessment();
      });

      expect(result.current.assessment.priorities).toBe('');
      expect(result.current.assessment.status).toBe('draft');
      expect(result.current.assessment.id).toMatch(/^fra-/);
    });
  });

  // ── validateAssessment ─────────────────────────

  describe('validateAssessment', () => {
    it('returns invalid when no signature', async () => {
      const { result } = renderHook(() => useAssessment(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const validation = result.current.validateAssessment();

      expect(validation.valid).toBe(false);
      expect(validation.message).toContain('signature');
    });

    it('returns invalid when status is not signed', async () => {
      const { result } = renderHook(() => useAssessment(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.updateAssessment({ signature: 'John Doe' });
      });

      const validation = result.current.validateAssessment();

      expect(validation.valid).toBe(false);
      expect(validation.message).toContain('signed');
    });

    it('returns valid when signature exists and status is signed', async () => {
      const { result } = renderHook(() => useAssessment(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.updateAssessment({ signature: 'John Doe', status: 'signed' });
      });

      const validation = result.current.validateAssessment();

      expect(validation.valid).toBe(true);
      expect(validation.message).toBe('Assessment is validated');
    });
  });

  // ── selectPackage ──────────────────────────────

  describe('selectPackage', () => {
    it('updates payment with package type and price', async () => {
      const { result } = renderHook(() => useAssessment(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.selectPackage('with-awareness', 1799);
      });

      expect(result.current.assessment.payment.packageType).toBe('with-awareness');
      expect(result.current.assessment.payment.price).toBe(1799);
    });
  });

  // ── submitAssessment ───────────────────────────

  describe('submitAssessment', () => {
    it('sets status to submitted and generates risk register', async () => {
      const { result } = renderHook(() => useAssessment(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.submitAssessment();
      });

      expect(result.current.assessment.status).toBe('submitted');
      expect(Array.isArray(result.current.assessment.riskRegister)).toBe(true);
      expect(result.current.assessment.riskRegister.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── processPayment ─────────────────────────────

  describe('processPayment', () => {
    it('throws when no package selected', async () => {
      const { result } = renderHook(() => useAssessment(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.processPayment({
            number: '4111111111111111',
            expiry: '12/26',
            cvc: '123',
            name: 'Test User',
          });
        }),
      ).rejects.toThrow('No package selected');
    });

    it('processes payment successfully via API', async () => {
      (apiService.isAuthenticated).mockReturnValue(true);
      (apiService.post)
        .mockResolvedValueOnce({
          success: true,
          data: { purchaseId: 'pur-123', paymentIntentId: 'pi-456' },
        })
        .mockResolvedValueOnce({
          success: true,
          data: { status: 'confirmed' },
        });

      const { result } = renderHook(() => useAssessment(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.selectPackage('health-check', 795);
      });

      let payResult;
      await act(async () => {
        payResult = await result.current.processPayment({
          number: '4111111111111111',
          expiry: '12/26',
          cvc: '123',
          name: 'Test User',
        });
      });

      expect(payResult?.success).toBe(true);
      expect(payResult?.transactionId).toBe('pur-123');
      expect(result.current.assessment.status).toBe('paid');
      expect(result.current.assessment.payment.status).toBe('success');
    });

    it('sets payment status to failed on API error', async () => {
      (apiService.isAuthenticated).mockReturnValue(true);
      (apiService.post).mockResolvedValueOnce({
        success: false,
        error: { message: 'Payment declined' },
      });

      const { result } = renderHook(() => useAssessment(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.selectPackage('health-check', 795);
      });

      let caughtError;
      await act(async () => {
        try {
          await result.current.processPayment({
            number: '4111111111111111',
            expiry: '12/26',
            cvc: '123',
            name: 'Test',
          });
        } catch (e) {
          caughtError = e;
        }
      });

      expect(caughtError).toBeDefined();
      expect(result.current.assessment.payment.status).toBe('failed');
    });
  });

  // ── submitFeedback ─────────────────────────────

  describe('submitFeedback', () => {
    it('attaches feedback with generated id and timestamp', async () => {
      const { result } = renderHook(() => useAssessment(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.submitFeedback({
          rating: 5,
          comments: 'Great assessment',
          wouldRecommend: true,
        });
      });

      expect(result.current.assessment.feedback).toBeDefined();
      expect(result.current.assessment.feedback?.rating).toBe(5);
      expect(result.current.assessment.feedback?.comments).toBe('Great assessment');
      expect(result.current.assessment.feedback?.id).toMatch(/^fra-/);
      expect(result.current.assessment.feedback?.assessmentId).toBe(result.current.assessment.id);
    });
  });
});
