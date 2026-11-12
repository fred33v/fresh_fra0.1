/**
 * useBudgetGuide Hook
 * 
 * Manages the budget guide workflow:
 * - Track risk appetite setting
 * - Save mitigation strategies
 * - Monitor progress through budget allocation
 * - Generate recommendations based on risks
 * 
 * Backend endpoints used:
 * - GET /api/v1/budget-guide/progress
 * - PATCH /api/v1/budget-guide/risk-appetite
 * - POST /api/v1/budget-guide/mitigation
 */

import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from './useAuth';
import { createLogger } from '@/lib/logger';
import { toast } from 'sonner';
// Dashboard planning drafts are distinct from the shared training-course models.
// Persistence endpoints for these drafts are tracked as a separate Phase 1 gap.
interface RiskAppetite {
  id: string;
  level: 'low' | 'medium' | 'high';
  justification: string;
  updated_at: string;
}
interface MitigationStrategy {
  id: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  category: 'prevention' | 'detection' | 'response' | 'culture';
  description: string;
  budget: number;
  timeline: string;
  status: 'planned' | 'in_progress' | 'completed';
}
interface BudgetGuideProgress {
  id: string;
  user_id: string;
  completed_screens: string[];
  completed_at: string | null;
}

const logger = createLogger('useBudgetGuide');

interface BudgetGuideData {
  progress: BudgetGuideProgress | null;
  riskAppetite: RiskAppetite | null;
  mitigations: MitigationStrategy[];
}

export function useBudgetGuide() {
  const { user } = useAuth();
  const [data, setData] = useState<BudgetGuideData>({
    progress: null,
    riskAppetite: null,
    mitigations: [],
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch budget guide progress
   */
  const fetchProgress = useCallback(async () => {
    if (!user) return;

    setIsLoading(true);
    setError(null);

    try {
      const progress = await api.get<BudgetGuideProgress>(
        '/api/v1/budget-guide/progress'
      );
      setData((prev) => ({
        ...prev,
        progress,
      }));
    } catch (err: unknown) {
      const errorMsg = (err instanceof Error ? err.message : 'Failed to fetch progress');
      logger.error('Error fetching progress', err);
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  /**
   * Set or update risk appetite
   */
  const setRiskAppetite = useCallback(
    async (appetite: RiskAppetite) => {
      if (!user) return;

      try {
        const updated = await api.patch<RiskAppetite>(
          '/api/v1/budget-guide/risk-appetite',
          appetite
        );
        setData((prev) => ({
          ...prev,
          riskAppetite: updated,
        }));
        toast.success('Risk appetite updated');
      } catch (err: unknown) {
        const errorMsg = (err instanceof Error ? err.message : 'Failed to update risk appetite');
        logger.error('Error setting risk appetite', err);
        setError(errorMsg);
        toast.error(errorMsg);
      }
    },
    [user]
  );

  /**
   * Add or update mitigation strategy
   */
  const addMitigation = useCallback(
    async (strategy: MitigationStrategy) => {
      if (!user) return;

      try {
        const created = await api.post<MitigationStrategy>(
          '/api/v1/budget-guide/mitigation',
          strategy
        );
        setData((prev) => ({
          ...prev,
          mitigations: [...prev.mitigations, created],
        }));
        toast.success('Mitigation strategy added');
      } catch (err: unknown) {
        const errorMsg = (err instanceof Error ? err.message : 'Failed to add mitigation');
        logger.error('Error adding mitigation', err);
        setError(errorMsg);
        toast.error(errorMsg);
      }
    },
    [user]
  );

  /**
   * Update existing mitigation strategy
   */
  const updateMitigation = useCallback(
    async (id: string, strategy: Partial<MitigationStrategy>) => {
      if (!user) return;

      try {
        const updated = await api.patch<MitigationStrategy>(
          `/api/v1/budget-guide/mitigation/${id}`,
          strategy
        );
        setData((prev) => ({
          ...prev,
          mitigations: prev.mitigations.map((m) =>
            m.id === id ? updated : m
          ),
        }));
        toast.success('Mitigation strategy updated');
      } catch (err: unknown) {
        const errorMsg = (err instanceof Error ? err.message : 'Failed to update mitigation');
        logger.error('Error updating mitigation', err);
        setError(errorMsg);
        toast.error(errorMsg);
      }
    },
    [user]
  );

  /**
   * Calculate recommended allocation based on risk score
   */
  const calculateRecommendedAllocation = useCallback(
    (riskScore: number): Record<string, number> => {
      // Allocation recommendations based on risk level
      if (riskScore >= 80) {
        // Critical risk - priority to governance and detection
        return {
          prevention: 0.3,
          detection: 0.4,
          response: 0.2,
          culture: 0.1,
        };
      } else if (riskScore >= 60) {
        // High risk
        return {
          prevention: 0.4,
          detection: 0.3,
          response: 0.2,
          culture: 0.1,
        };
      } else if (riskScore >= 40) {
        // Medium risk
        return {
          prevention: 0.35,
          detection: 0.3,
          response: 0.2,
          culture: 0.15,
        };
      }
      // Low risk
      return {
        prevention: 0.3,
        detection: 0.25,
        response: 0.25,
        culture: 0.2,
      };
    },
    []
  );

  /**
   * Calculate actual allocation based on mitigations
   */
  const calculateActualAllocation = useCallback((): Record<string, number> => {
    const total = data.mitigations.reduce((sum, m) => sum + (m.budget || 0), 0);

    if (total === 0) {
      return {
        prevention: 0,
        detection: 0,
        response: 0,
        culture: 0,
      };
    }

    const allocation: Record<string, number> = {
      prevention: 0,
      detection: 0,
      response: 0,
      culture: 0,
    };

    data.mitigations.forEach((m) => {
      if (m.category && m.budget) {
        allocation[m.category] = (allocation[m.category] || 0) + m.budget;
      }
    });

    // Normalize to percentages
    Object.keys(allocation).forEach((key) => {
      allocation[key] = (allocation[key] / total) * 100;
    });

    return allocation;
  }, [data.mitigations]);

  /**
   * Get progress percentage
   */
  const getProgressPercentage = useCallback((): number => {
    if (!data.progress) return 0;

    const steps = [
      data.riskAppetite ? 1 : 0,
      data.mitigations.length > 0 ? 1 : 0,
      data.mitigations.some((m) => m.budget > 0) ? 1 : 0,
      data.progress.completed_at ? 1 : 0,
    ];

    return (steps.reduce((a, b) => a + b, 0) / steps.length) * 100;
  }, [data]);

  return {
    // State
    progress: data.progress,
    riskAppetite: data.riskAppetite,
    mitigations: data.mitigations,
    isLoading,
    error,

    // Actions
    fetchProgress,
    setRiskAppetite,
    addMitigation,
    updateMitigation,
    calculateRecommendedAllocation,
    calculateActualAllocation,
    getProgressPercentage,
  };
}

export type UseBudgetGuide = ReturnType<typeof useBudgetGuide>;
