import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import * as WebBrowser from 'expo-web-browser';
import type { AssessmentData, AssessmentStatus, PackageType, PaymentStatus, FeedbackData, RiskRegisterItem, RiskPriority } from '@/types/assessment';
import { apiService } from '@/services/api.service';
import { API_CONFIG } from '@/constants/api';
import { debounce } from '@/utils/debounce';
import { createLogger } from '@/utils/logger';
import { generateId, isLocalOnlyAssessmentId, createEmptyAssessment, calculateRiskScore, migrateRiskAppetite, buildActionPlan, toRemotePatch } from '@/utils/assessment';

const STORAGE_KEY = 'fra_assessment_draft';
const SYNC_QUEUE_KEY = 'fra_sync_queue';
const SYNC_DEBOUNCE_MS = 5000; // 5 seconds

interface SyncStatus {
  state: 'synced' | 'syncing' | 'pending' | 'error';
  lastSync: Date | null;
  errorMessage?: string;
}

/** The server's error code carried on a failed sync, if any. */
const syncErrorCode = (error: unknown): string | undefined =>
  (error as { code?: string } | null)?.code;

interface SyncQueueItem {
  id: string;
  timestamp: string;
  data: Partial<AssessmentData>;
  retryCount: number;
}

/** Where the payment hand-off page sends buyers back to the app (see the web app's CheckoutComplete page). */
const PAYMENT_RETURN_URL = 'fra-mobile://payment-complete';
const PAYMENT_CHECKS = 5;
const PAYMENT_CHECK_MS = 2000;

export const [AssessmentProvider, useAssessment] = createContextHook(() => {
  const logger = createLogger('Assessment');
  const [assessment, setAssessment] = useState<AssessmentData>(createEmptyAssessment());
  // Latest assessment for async sync code, whose closures would otherwise hold a stale copy
  const assessmentRef = useRef(assessment);
  useEffect(() => {
    assessmentRef.current = assessment;
  }, [assessment]);
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
      const remoteId = response.data.id;
      // Only swap the id into the LATEST state: answers or a payment recorded while this
      // request was in flight must not be overwritten by the copy we started from
      const next = { ...assessmentRef.current, id: remoteId };
      assessmentRef.current = next;
      setAssessment((prev) => {
        const updated = { ...prev, id: remoteId };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch((err: unknown) => logger.error('Failed to persist assessment:', err));
        return updated;
      });
      return next;
    }

    // Keep the server's code so callers can tell a refusal from a network failure
    throw Object.assign(new Error(response.error?.message || 'Failed to create assessment'), { code: response.error?.code });
  };

  /**
   * After a failed sync, show why. PACKAGE_REQUIRED is expected before payment (the draft
   * stays on this device and syncs once a package is bought); ASSESSMENT_LIMIT_REACHED is
   * shown to the user instead of being hidden behind "pending".
   */
  const noteSyncFailure = (error: unknown) => {
    if (syncErrorCode(error) === 'ASSESSMENT_LIMIT_REACHED') {
      setSyncStatus((prev) => ({
        state: 'error',
        lastSync: prev.lastSync,
        errorMessage: `${(error as Error).message}. Your answers are saved on this device.`,
      }));
      return;
    }
    setSyncStatus((prev) => ({ state: 'pending', lastSync: prev.lastSync }));
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

      let target = await ensureRemoteAssessment(assessmentRef.current);

      // The API accepts { title?, answers, status? }; send the whole current assessment as
      // answers (last write wins), so queued partial updates can never be rejected or lost
      const patch = () => apiService.patch(
        API_CONFIG.ENDPOINTS.ASSESSMENTS.UPDATE(target.id),
        toRemotePatch({ ...target, ...data }),
        { requiresAuth: true }
      );
      let response = await patch();

      // The server no longer has this assessment (deleted, or a different environment):
      // give the local copy a fresh local id so it is created again, then retry once
      if (!response.success && response.error?.code === 'NOT_FOUND') {
        logger.warn('Remote assessment missing; creating it again', { id: target.id });
        const local = { ...assessmentRef.current, id: generateId() };
        assessmentRef.current = local;
        target = await ensureRemoteAssessment(local);
        response = await patch();
      }

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
      const code = syncErrorCode(error);
      if (code === 'PACKAGE_REQUIRED') {
        logger.info('Assessment kept on this device until a package is bought');
      } else if (code === 'ASSESSMENT_LIMIT_REACHED') {
        logger.warn('Assessment not synced: package limit reached', { error: String(error) });
      } else {
        logger.error('Sync to backend failed:', error);
      }
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
        noteSyncFailure(error);
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
            riskAppetite: migrateRiskAppetite({ ...defaults.riskAppetite, ...parsed.riskAppetite }),
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
            // Retention follows the current policy, not whatever an older draft stored
            documentControl: { ...defaults.documentControl, ...parsed.documentControl, retentionPeriod: defaults.documentControl.retentionPeriod },
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
      ensureRemoteAssessment(newAssessment).catch(async (error: unknown) => {
        await addToSyncQueue(newAssessment);
        noteSyncFailure(error);
      });
    }
  }, [saveDraft]);

  const submitAssessment = useCallback(() => {
    const riskRegister = calculateRiskScore(assessment);
    updateAssessment({
      status: 'submitted' as AssessmentStatus,
      riskRegister,
      // The plan is derived from the same risks, so the report and PDF always match them
      actionPlan: buildActionPlan(riskRegister),
    });

    if (apiService.isAuthenticated() && isOnlineRef.current) {
      ensureRemoteAssessment(assessmentRef.current)
        .then((target) =>
          apiService.post(
            API_CONFIG.ENDPOINTS.ASSESSMENTS.SUBMIT(target.id),
            {},
            { requiresAuth: true }
          )
        )
        .catch(async (error: unknown) => {
          await addToSyncQueue({ status: 'submitted' as AssessmentStatus, riskRegister });
          noteSyncFailure(error);
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

  // Reads the latest payment inside the update, so a package chosen straight after
  // startNewAssessment does not bring back the previous assessment's payment
  const selectPackage = useCallback((packageType: PackageType, price: number) => {
    setAssessment((prev) => {
      const payment = { ...prev.payment, packageType, price };
      const updated = { ...prev, payment, updatedAt: new Date().toISOString() };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch((err: unknown) => logger.error('Failed to persist assessment:', err));
      debouncedSync({ payment });
      return updated;
    });
  }, [debouncedSync]);

  /**
   * Choose a package and return the next screen: payment once the assessment has been
   * submitted, otherwise the assessment itself (a fresh one if the last was already paid for).
   */
  const choosePackage = useCallback((packageType: PackageType, price: number): '/payment' | '/organisation' => {
    const status = assessmentRef.current.status;
    if (status === 'paid' || status === 'signed') startNewAssessment();
    selectPackage(packageType, price);
    return status === 'submitted' ? '/payment' : '/organisation';
  }, [startNewAssessment, selectPackage]);

  /**
   * Pays on Stripe's hosted page in the in-app browser: card details never pass through the app.
   * The server then checks with Stripe before the package is switched on.
   */
  const processPayment = useCallback(async () => {
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

    const paymentError = (code: string, message: string) => Object.assign(new Error(message), { code });

    try {
      const purchase = await apiService.post<{ purchaseId: string; checkoutUrl: string | null; paymentIntentId?: string }>(
        API_CONFIG.ENDPOINTS.PURCHASES.CREATE,
        { packageId, client: 'mobile' },
        { requiresAuth: true }
      );

      if (!purchase.success || !purchase.data?.purchaseId) {
        throw paymentError(purchase.error?.code ?? 'PURCHASE_FAILED', purchase.error?.message || 'Failed to create purchase');
      }

      let attempts = 1;
      if (purchase.data.checkoutUrl) {
        // Returns when Stripe hands back to fra-mobile://payment-complete, or the buyer closes the browser
        const result = await WebBrowser.openAuthSessionAsync(purchase.data.checkoutUrl, PAYMENT_RETURN_URL);
        if (result.type === 'success' && result.url.includes('cancelled=1')) {
          throw paymentError('PAYMENT_CANCELLED', 'Payment was cancelled');
        }
        // Stripe can return the buyer a moment before the payment settles
        attempts = PAYMENT_CHECKS;
      }

      let confirmed = await apiService.post<{ status: string }>(
        API_CONFIG.ENDPOINTS.PURCHASES.CONFIRM(purchase.data.purchaseId),
        { paymentIntentId: purchase.data.paymentIntentId },
        { requiresAuth: true }
      );
      for (let i = 1; i < attempts && !confirmed.success && confirmed.error?.code === 'PAYMENT_PENDING'; i++) {
        await new Promise((resolve) => setTimeout(resolve, PAYMENT_CHECK_MS));
        confirmed = await apiService.post<{ status: string }>(
          API_CONFIG.ENDPOINTS.PURCHASES.CONFIRM(purchase.data.purchaseId), {}, { requiresAuth: true });
      }

      if (!confirmed.success) {
        throw paymentError(confirmed.error?.code ?? 'CONFIRM_FAILED', confirmed.error?.message || 'Failed to confirm purchase');
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
    choosePackage,
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
