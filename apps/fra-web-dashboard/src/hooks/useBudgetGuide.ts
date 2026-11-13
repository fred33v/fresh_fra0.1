import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { api } from '@/lib/api';
import { useAuth } from './useAuth';
import { createLogger } from '@/lib/logger';
import { toast } from 'sonner';
import type { BudgetPlanningPlan, BudgetPlanningMitigationInput } from '@stopfra/types';
const logger = createLogger('useBudgetGuide');
export function useBudgetGuide(assessmentId?: string) {
  const { user } = useAuth();
  const identity = `${user?.userId ?? ''}:${assessmentId ?? ''}`;
  const active = useRef(identity);
  active.current = identity;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [stored, setStored] = useState<{ identity: string; plan: BudgetPlanningPlan | null }>({
    identity,
    plan: null,
  });
  const current = useRef(stored);
  current.current = stored;
  const [isLoading, setLoading] = useState(false),
    [isSaving, setSaving] = useState(false),
    [error, setError] = useState<string | null>(null);
  const busy = useRef(false),
    sequence = useRef(0);
  const valid = useCallback((key: string) => mounted.current && active.current === key, []);
  const plan = stored.identity === identity ? stored.plan : null;
  const data = useMemo(
    () => ({
      progress: plan,
      riskAppetite: plan?.riskAppetite ?? null,
      mitigations: plan?.mitigations ?? [],
    }),
    [plan]
  );
  const fetchProgress = useCallback(async () => {
    const key = identity;
    if (!user?.userId || !assessmentId) return;
    if (busy.current) return;
    const seq = ++sequence.current;
    setLoading(true);
    setError(null);
    try {
      let next = await api.get<BudgetPlanningPlan | null>(
        `/api/v1/budget-guide/plans/${assessmentId}`
      );
      if (!valid(key) || seq !== sequence.current) return;
      if (!next)
        next = await api.post<BudgetPlanningPlan>(`/api/v1/budget-guide/plans/${assessmentId}`, {});
      if (valid(key) && seq === sequence.current) {
        const state = { identity: key, plan: next };
        current.current = state;
        setStored(state);
      }
    } catch (err) {
      if (valid(key) && seq === sequence.current) {
        const message = err instanceof Error ? err.message : 'Could not load budget plan';
        setError(message);
        logger.error('Budget load failed', err);
      }
    } finally {
      if (valid(key) && seq === sequence.current) setLoading(false);
    }
  }, [identity, user?.userId, assessmentId, valid]);
  const mutate = useCallback(
    async (
      path: string,
      method: 'post' | 'patch' | 'delete',
      payload: Record<string, unknown> = {}
    ) => {
      const key = identity;
      const saved = current.current.identity === key ? current.current.plan : null;
      if (!saved || !assessmentId) throw new Error('Load the saved plan before editing');
      if (busy.current) throw new Error('Wait for the current save to finish');
      busy.current = true;
      ++sequence.current;
      setSaving(true);
      setLoading(false);
      setError(null);
      const base = `/api/v1/budget-guide/plans/${assessmentId}${path}`;
      try {
        const next =
          method === 'delete'
            ? await api.delete<BudgetPlanningPlan>(`${base}?expectedVersion=${saved.version}`)
            : await api[method]<BudgetPlanningPlan>(base, {
                ...payload,
                expectedVersion: saved.version,
              });
        if (!valid(key)) throw new Error('The active account or assessment changed');
        const state = { identity: key, plan: next };
        current.current = state;
        setStored(state);
        return next;
      } catch (err) {
        if (valid(key)) {
          const message = err instanceof Error ? err.message : 'Could not save the budget plan';
          setError(message);
          logger.error('Budget save failed', err);
          toast.error(message);
        }
        throw err;
      } finally {
        busy.current = false;
        if (valid(key)) setSaving(false);
      }
    },
    [identity, assessmentId, valid]
  );
  const setRiskAppetite = useCallback(
    async (input: { level: 'low' | 'medium' | 'high'; justification: string }) => {
      await mutate('/risk-appetite', 'patch', input);
      toast.success('Risk appetite saved');
    },
    [mutate]
  );
  const addMitigation = useCallback(
    async (input: BudgetPlanningMitigationInput) => {
      await mutate('/mitigations', 'post', input);
      toast.success('Strategy saved');
    },
    [mutate]
  );
  const updateMitigation = useCallback(
    async (id: string, input: Partial<BudgetPlanningMitigationInput>) => {
      await mutate(`/mitigations/${id}`, 'patch', input);
      toast.success('Strategy updated');
    },
    [mutate]
  );
  const removeMitigation = useCallback(
    async (id: string) => {
      await mutate(`/mitigations/${id}`, 'delete');
      toast.success('Strategy removed');
    },
    [mutate]
  );
  const completePlan = useCallback(async () => {
    await mutate('/complete', 'post');
    toast.success('Budget plan completed');
  }, [mutate]);
  const downloadReport = useCallback(async () => {
    if (!assessmentId) throw new Error('Select an assessment');
    try {
      await api.download(
        `/api/v1/budget-guide/plans/${assessmentId}/report`,
        'budget-implementation-plan.html'
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not download report';
      setError(message);
      toast.error(message);
      throw err;
    }
  }, [assessmentId]);
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

    isSaving,
    // Actions
    fetchProgress,
    setRiskAppetite,
    addMitigation,
    updateMitigation,
    removeMitigation,
    completePlan,
    downloadReport,
    calculateRecommendedAllocation,
    calculateActualAllocation,
    getProgressPercentage,
  };
}

export type UseBudgetGuide = ReturnType<typeof useBudgetGuide>;
