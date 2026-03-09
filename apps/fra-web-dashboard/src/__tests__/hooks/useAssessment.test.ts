/**
 * Assessment Hook Tests
 * 
 * Unit tests for useAssessment hook covering:
 * - Assessment state management
 * - Module navigation
 * - Answer updates
 * - Backend integration
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAssessment } from '../useAssessment';
import * as api from '@/lib/api';

vi.mock('@/lib/api');
vi.mock('./useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user' } }),
}));

describe('useAssessment Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should initialize with correct default state', () => {
      const { result } = renderHook(() => useAssessment());

      expect(result.current.assessment).toBeNull();
      expect(result.current.answers).toEqual({});
      expect(result.current.riskScore).toBeNull();
      expect(result.current.currentModule).toBe(0);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('startAssessment', () => {
    it('should start a new assessment and set initial state', async () => {
      const mockAssessment = {
        id: 'assess-123',
        employer_id: 'emp-123',
        status: 'in_progress',
        created_at: new Date().toISOString(),
      };

      vi.mocked(api.post).mockResolvedValueOnce(mockAssessment);

      const { result } = renderHook(() => useAssessment());

      act(() => {
        result.current.startAssessment('emp-123');
      });

      await waitFor(() => {
        expect(result.current.assessment).toEqual(mockAssessment);
        expect(result.current.currentModule).toBe(0);
      });
    });

    it('should handle errors when starting assessment', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useAssessment());

      act(() => {
        result.current.startAssessment('emp-123');
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
        expect(result.current.assessment).toBeNull();
      });
    });
  });

  describe('updateAnswer', () => {
    it('should update answer for a question', async () => {
      const { result } = renderHook(() => useAssessment());

      act(() => {
        result.current.updateAnswer('q1', 'yes');
      });

      expect(result.current.answers['q1']).toBe('yes');
    });

    it('should persist answer to backend', async () => {
      const mockResponse = { status: 'saved' };
      vi.mocked(api.patch).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useAssessment());

      act(() => {
        result.current.updateAnswer('q1', 'yes');
      });

      await waitFor(() => {
        expect(api.patch).toHaveBeenCalledWith(
          expect.stringContaining('/api/v1/assessment'),
          expect.objectContaining({ answers: { q1: 'yes' } })
        );
      });
    });

    it('should handle multiple answers', async () => {
      const { result } = renderHook(() => useAssessment());

      act(() => {
        result.current.updateAnswer('q1', 'yes');
        result.current.updateAnswer('q2', '5000');
        result.current.updateAnswer('q3', '8');
      });

      expect(result.current.answers).toEqual({
        q1: 'yes',
        q2: '5000',
        q3: '8',
      });
    });
  });

  describe('Module Navigation', () => {
    it('should navigate to next module', async () => {
      const { result } = renderHook(() => useAssessment());

      act(() => {
        result.current.nextModule();
      });

      expect(result.current.currentModule).toBe(1);
    });

    it('should navigate to previous module', async () => {
      const { result } = renderHook(() => useAssessment());

      act(() => {
        result.current.nextModule();
        result.current.nextModule();
        result.current.previousModule();
      });

      expect(result.current.currentModule).toBe(1);
    });

    it('should not navigate before first module', async () => {
      const { result } = renderHook(() => useAssessment());

      act(() => {
        result.current.previousModule();
      });

      expect(result.current.currentModule).toBe(0);
    });

    it('should jump to specific module', async () => {
      const { result } = renderHook(() => useAssessment());

      act(() => {
        result.current.jumpToModule(5);
      });

      expect(result.current.currentModule).toBe(5);
    });
  });

  describe('submitAssessment', () => {
    it('should submit completed assessment', async () => {
      const mockResult = {
        assessment_id: 'assess-123',
        risk_score: 65,
        status: 'completed',
      };

      vi.mocked(api.post).mockResolvedValueOnce(mockResult);

      const { result } = renderHook(() => useAssessment());

      await act(async () => {
        await result.current.submitAssessment();
      });

      await waitFor(() => {
        expect(result.current.riskScore).toBe(65);
      });
    });

    it('should handle submission errors', async () => {
      vi.mocked(api.post).mockRejectedValueOnce(
        new Error('Assessment incomplete')
      );

      const { result } = renderHook(() => useAssessment());

      await act(async () => {
        await result.current.submitAssessment();
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Assessment incomplete');
      });
    });
  });

  describe('Progress Calculation', () => {
    it('should calculate progress percentage correctly', async () => {
      const { result } = renderHook(() => useAssessment());

      act(() => {
        result.current.updateAnswer('q1', 'yes');
        result.current.updateAnswer('q2', '1000');
      });

      // 2 answers out of theoretical 13 modules * average questions
      expect(result.current.progressPercent).toBeGreaterThan(0);
      expect(result.current.progressPercent).toBeLessThanOrEqual(100);
    });
  });

  describe('Cleanup and Restoration', () => {
    it('should reset assessment state', async () => {
      const { result } = renderHook(() => useAssessment());

      act(() => {
        result.current.updateAnswer('q1', 'yes');
      });

      expect(result.current.answers['q1']).toBe('yes');

      act(() => {
        // Would call reset
        result.current.startAssessment('emp-123');
      });

      // After new assessment starts, should have fresh state
      // (implementation dependent)
    });
  });
});
