import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { createLogger } from '@/lib/logger';

const logger = createLogger('useEntitlements');

export type EntitlementFeature = 'assessment' | 'training' | 'certificates' | 'dashboard' | 'compliance';

export interface Entitlements {
  packageId: 'pkg_basic' | 'pkg_training' | 'pkg_full' | null;
  packageName: string | null;
  tier: number;
  expiresAt: string | null;
  features: Record<EntitlementFeature, boolean>;
  keypassAllowance: number;
  assessments: { allowed: boolean; limit: number | null; used: number; reason?: string };
}

export function useEntitlements() {
  const { user } = useAuth();
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setEntitlements(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    api
      .get<Entitlements>('/api/v1/entitlements')
      .then((data) => { if (!cancelled) setEntitlements(data); })
      .catch((err: unknown) => logger.error('Failed to load entitlements', err))
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [user]);

  return { entitlements, isLoading };
}
