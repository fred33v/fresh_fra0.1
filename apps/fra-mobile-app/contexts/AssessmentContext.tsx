import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import type { AssessmentData, AssessmentStatus, PackageType, PaymentStatus, FeedbackData, RiskRegisterItem, RiskPriority } from '@/types/assessment';
import { apiService } from '@/services/api.service';
import { API_CONFIG } from '@/constants/api';
import { debounce } from '@/utils/debounce';
import { createLogger } from '@/utils/logger';
import { generateId, isLocalOnlyAssessmentId, createEmptyAssessment, calculateRiskScore } from '@/utils/assessment';

const STORAGE_KEY = 'fra_assessment_draft';
const SYNC_QUEUE_KEY = 'fra_sync_queue';
const SYNC_DEBOUNCE_MS = 5000; // 5 seconds

interface SyncStatus {
  state: 'synced' | 'syncing' | 'pending' | 'error';
  lastSync: Date | null;
  errorMessage?: string;
}

interface SyncQueueItem {
  id: string;
  timestamp: string;
  data: Partial<AssessmentData>;
  retryCount: number;
}

export const [AssessmentProvider, useAssessment] = createContextHook(() => {
  const logger = createLogger('Assessment');
  const [assessment, setAssessment] = useState<AssessmentData>(createEmptyAssessment());
  const [isLoading, setIsLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: 'synced',
    lastSync: null,
  });
  const [isOnline, setIsOnline] = useState(true);
  const isOnlineRef = useRef(true);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const syncQueueRef = useRef<SyncQueueItem[]>([]);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processSyncQueueRef = useRef<() => Promise<void>>(async () => {});

  const ensureRemoteAssessment = async (current: AssessmentData): Promise<AssessmentData> => {
    if (!apiService.isAuthenticated() || !isOnline) {
      return current;
    }

    if (!isLocalOnlyAssessmentId(current.id)) {
      return current;
    }

    const response = await apiService.post<{ id: string }>(
      API_CONFIG.ENDPOINTS.ASSESSMENTS.CREATE,
      { title: 'Fraud Risk Assessment', answers: current as unknown as Record<string, unknown> },
      { requiresAuth: true }
    );

    if (response.success && response.data?.id) {
      const now = new Date().toISOString();
      const next = { ...current, id: response.data.id, updatedAt: now };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setAssessment(next);
      return next;
    }

    throw new Error(response.error?.message || 'Failed to create assessment');
  };

  // Network detection — stable listener, no re-subscription
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const wasOffline = !isOnlineRef.current;
      const isNowOnline = state.isConnected === true;

      isOnlineRef.current = isNowOnline;
      setIsOnline(isNowOnline);

      // If we just came back online, process sync queue
      if (wasOffline && isNowOnline) {
        logger.info('Network restored, processing sync queue');
        processSyncQueueRef.current();
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    loadDraft();
    loadSyncQueue();
    return () => {
      debouncedSync.cancel();
    };
  }, []);

  // Load sync queue from storage
  const loadSyncQueue = async () => {
    try {
      const stored = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      if (stored) {
        const queue = JSON.parse(stored) as SyncQueueItem[];
        setSyncQueue(queue);
        if (queue.length > 0) {
          logger.info(`Loaded ${queue.length} pending sync items`);
        }
      }
    } catch (error: unknown) {
      logger.error('Failed to load sync queue:', error);
    }
  };

  // Save sync queue to storage
  const saveSyncQueue = async (queue: SyncQueueItem[]) => {
    try {
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
      setSyncQueue(queue);
    } catch (error: unknown) {
      logger.error('Failed to save sync queue:', error);
    }
  };

  // Add item to sync queue
  const addToSyncQueue = async (data: Partial<AssessmentData>) => {
    const queueItem: SyncQueueItem = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      data,
      retryCount: 0,
    };

    const newQueue = [...syncQueueRef.current, queueItem];
    await saveSyncQueue(newQueue);
    logger.info('Added to sync queue:', queueItem.id);
  };

  // Process sync queue
  const processSyncQueue = async () => {
    const queue = syncQueueRef.current;
    if (queue.length === 0 || !isOnlineRef.current || !apiService.isAuthenticated()) {
      return;
    }

    logger.info(`Processing ${queue.length} queued sync items`);
    const remainingQueue: SyncQueueItem[] = [];

    for (const item of queue) {
      try {
        await syncToBackendImmediate(item.data);
        logger.info('Successfully synced queued item:', item.id);
      } catch (error: unknown) {
        logger.error('Failed to sync queued item:', { id: item.id, error });

        // Retry logic: max 3 retries
        if (item.retryCount < 3) {
          remainingQueue.push({ ...item, retryCount: item.retryCount + 1 });
        } else {
          logger.warn('Max retries reached for item:', item.id);
        }
      }
    }

    await saveSyncQueue(remainingQueue);
  };

  // Keep refs in sync via useEffect so they update after state commits
  useEffect(() => {
    syncQueueRef.current = syncQueue;
  }, [syncQueue]);
  useEffect(() => {
    processSyncQueueRef.current = processSyncQueue;
  });

  // Sync to backend (immediate, no debounce)
  const syncToBackendImmediate = async (data: Partial<AssessmentData>) => {
    if (!apiService.isAuthenticated()) {
      logger.debug('Not authenticated, skipping sync');
      return;
    }

    try {
      setSyncStatus({ state: 'syncing', lastSync: syncStatus.lastSync });

      const target = await ensureRemoteAssessment(assessment);

      const response = await apiService.patch(
        API_CONFIG.ENDPOINTS.ASSESSMENTS.UPDATE(target.id),
        data as unknown as Record<string, unknown>,
        { requiresAuth: true }
      );

      if (response.success) {
        setSyncStatus({
          state: 'synced',
          lastSync: new Date(),
          errorMessage: undefined,
        });
        logger.info('Successfully synced to backend');
      } else {
        throw new Error(response.error?.message || 'Sync failed');
      }
    } catch (error: unknown) {
      logger.error('Sync to backend failed:', error);
      setSyncStatus({
        state: 'error',
        lastSync: syncStatus.lastSync,
        errorMessage: error instanceof Error ? error.message : 'Failed to sync',
      });
      throw error;
    }
  };

  // Debounced sync function
  const debouncedSync = useCallback(
    debounce(async (data: Partial<AssessmentData>) => {
      if (!isOnlineRef.current) {
        logger.info('Offline, adding to sync queue');
        await addToSyncQueue(data);
        setSyncStatus((prev) => ({ state: 'pending', lastSync: prev.lastSync }));
        return;
      }

      if (!apiService.isAuthenticated()) {
        logger.debug('Not authenticated, skipping sync');
        return;
      }

      try {
        await syncToBackendImmediate(data);
      } catch (error: unknown) {
        // Add to queue for retry
        await addToSyncQueue(data);
        setSyncStatus((prev) => ({ state: 'pending', lastSync: prev.lastSync }));
      }
    }, SYNC_DEBOUNCE_MS),
    []
  );

  const loadDraft = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored && stored !== 'undefined' && stored !== 'null' && stored.trim().length > 0) {
        if (!stored.startsWith('{') && !stored.startsWith('[')) {
          logger.warn('Invalid JSON format detected, clearing storage');
          await AsyncStorage.removeItem(STORAGE_KEY);
          setAssessment(createEmptyAssessment());
          return;
        }
        try {
          const parsed = JSON.parse(stored) as Partial<AssessmentData>;
          // Merge with defaults to ensure all fields exist (handles schema migrations)
          const defaults = createEmptyAssessment();
          const merged: AssessmentData = {
            ...defaults,
            ...parsed,
            organisation: { ...defaults.organisation, ...parsed.organisation },
            riskAppetite: { ...defaults.riskAppetite, ...parsed.riskAppetite },
            fraudTriangle: { ...defaults.fraudTriangle, ...parsed.fraudTriangle },
            procurement: { ...defaults.procurement, ...parsed.procurement },
            cashBanking: { ...defaults.cashBanking, ...parsed.cashBanking },
            payrollHR: { ...defaults.payrollHR, ...parsed.payrollHR },
            revenue: { ...defaults.revenue, ...parsed.revenue },
            itSystems: { ...defaults.itSystems, ...parsed.itSystems },
            peopleCulture: { ...defaults.peopleCulture, ...parsed.peopleCulture },
            controlsTechnology: { ...defaults.controlsTechnology, ...parsed.controlsTechnology },
            riskRegister: parsed.riskRegister ?? defaults.riskRegister,
            paymentsModule: { ...defaults.paymentsModule, ...parsed.paymentsModule, kpis: { ...defaults.paymentsModule.kpis, ...parsed.paymentsModule?.kpis } },
            trainingAwareness: { ...defaults.trainingAwareness, ...parsed.trainingAwareness },
            monitoringEvaluation: { ...defaults.monitoringEvaluation, ...parsed.monitoringEvaluation },
            complianceMapping: { ...defaults.complianceMapping, ...parsed.complianceMapping },
            fraudResponsePlan: { ...defaults.fraudResponsePlan, ...parsed.fraudResponsePlan },
            actionPlan: { ...defaults.actionPlan, ...parsed.actionPlan },
            documentControl: { ...defaults.documentControl, ...parsed.documentControl },
            payment: { ...defaults.payment, ...parsed.payment },
          };
          setAssessment(merged);
          logger.info('Loaded draft assessment:', merged.id);
        } catch (parseError) {
          logger.error('Failed to parse assessment data:', { parseError, storedPreview: stored.substring(0, 100) });
          await AsyncStorage.removeItem(STORAGE_KEY);
          setAssessment(createEmptyAssessment());
        }
      }
    } catch (error: unknown) {
      logger.error('Failed to load draft:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveDraft = useCallback(async (data: AssessmentData) => {
    try {
      const updated = { ...data, updatedAt: new Date().toISOString() };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setAssessment(updated);
      logger.debug('Saved draft assessment');
    } catch (error: unknown) {
      logger.error('Failed to save draft:', error);
    }
  }, []);

  const updateAssessment = useCallback((updates: Partial<AssessmentData>) => {
    setAssessment((prev) => {
      const updated = { ...prev, ...updates, updatedAt: new Date().toISOString() };

      // Save to AsyncStorage immediately (offline-first)
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch((err: unknown) => logger.error('Failed to persist assessment:', err));

      // Trigger debounced sync to backend
      debouncedSync(updates);

      return updated;
    });
  }, [debouncedSync]);

  const startNewAssessment = useCallback(() => {
    const newAssessment = createEmptyAssessment();
    setAssessment(newAssessment);
    saveDraft(newAssessment);

    if (apiService.isAuthenticated() && isOnlineRef.current) {
      ensureRemoteAssessment(newAssessment).catch(async () => {
        await addToSyncQueue(newAssessment);
        setSyncStatus((prev) => ({ state: 'pending', lastSync: prev.lastSync }));
      });
    }
  }, [saveDraft]);

  const submitAssessment = useCallback(() => {
    const riskRegister = calculateRiskScore(assessment);
    updateAssessment({
      status: 'submitted' as AssessmentStatus,
      riskRegister,
    });

    if (apiService.isAuthenticated() && isOnlineRef.current) {
      ensureRemoteAssessment(assessment)
        .then((target) =>
          apiService.post(
            API_CONFIG.ENDPOINTS.ASSESSMENTS.SUBMIT(target.id),
            {},
            { requiresAuth: true }
          )
        )
        .catch(async () => {
          await addToSyncQueue({ status: 'submitted' as AssessmentStatus, riskRegister });
          setSyncStatus((prev) => ({ state: 'pending', lastSync: prev.lastSync }));
        });
    } else {
      addToSyncQueue({ status: 'submitted' as AssessmentStatus, riskRegister }).catch((err: unknown) => logger.error('Failed to add submit to sync queue:', err));
      setSyncStatus((prev) => ({ state: 'pending', lastSync: prev.lastSync }));
    }
  }, [assessment, updateAssessment]);

  const validateAssessment = useCallback(() => {
    if (!assessment.signature) {
      return { valid: false, message: 'Assessment requires employer signature for validation' };
    }
    if (assessment.status !== 'signed') {
      return { valid: false, message: 'Assessment must be signed by an authorized signatory' };
    }
    return { valid: true, message: 'Assessment is validated' };
  }, [assessment]);

  const selectPackage = useCallback((packageType: PackageType, price: number) => {
    updateAssessment({
      payment: {
        ...assessment.payment,
        packageType,
        price,
      },
    });
  }, [assessment.payment, updateAssessment]);

  const processPayment = useCallback(async (cardDetails: { number: string; expiry: string; cvc: string; name: string }) => {
    logger.info('Processing payment with card ending:', cardDetails.number.slice(-4));
    const packageType = assessment.payment.packageType;
    if (!packageType) {
      throw new Error('No package selected');
    }

    const packageId =
      packageType === 'health-check'
        ? 'pkg_basic'
        : packageType === 'with-awareness'
          ? 'pkg_training'
          : 'pkg_full';

    try {
      const purchase = await apiService.post<{ purchaseId: string; paymentIntentId: string }>(
        API_CONFIG.ENDPOINTS.PURCHASES.CREATE,
        { packageId },
        { requiresAuth: true }
      );

      if (!purchase.success || !purchase.data?.purchaseId) {
        throw new Error(purchase.error?.message || 'Failed to create purchase');
      }

      const confirmed = await apiService.post<{ status: string }>(
        API_CONFIG.ENDPOINTS.PURCHASES.CONFIRM(purchase.data.purchaseId),
        { paymentIntentId: purchase.data.paymentIntentId },
        { requiresAuth: true }
      );

      if (!confirmed.success) {
        throw new Error(confirmed.error?.message || 'Failed to confirm purchase');
      }

      const transactionId = purchase.data.purchaseId as string;
      updateAssessment({
        status: 'paid' as AssessmentStatus,
        payment: {
          ...assessment.payment,
          transactionId,
          status: 'success' as PaymentStatus,
          date: new Date().toISOString(),
        },
      });

      return { success: true, transactionId };
    } catch (error: unknown) {
      updateAssessment({
        payment: {
          ...assessment.payment,
          status: 'failed' as PaymentStatus,
        },
      });
      throw error;
    }
  }, [assessment.payment, updateAssessment]);

  const submitFeedback = useCallback((feedbackData: Omit<FeedbackData, 'id' | 'assessmentId' | 'date'>) => {
    const feedback: FeedbackData = {
      id: generateId(),
      assessmentId: assessment.id,
      date: new Date().toISOString(),
      ...feedbackData,
    };
    updateAssessment({ feedback });
    logger.info('Feedback submitted:', feedback);
  }, [assessment.id, updateAssessment]);

  return {
    assessment,
    isLoading,
    updateAssessment,
    startNewAssessment,
    submitAssessment,
    selectPackage,
    processPayment,
    submitFeedback,
    saveDraft,
    validateAssessment,
    // Sync-related
    syncStatus,
    isOnline,
    syncQueue,
    processSyncQueue,
  };
});
