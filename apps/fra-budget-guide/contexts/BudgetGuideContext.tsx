/**
 * BudgetGuideContext — Offline-first sync layer
 * Wraps AppContext data and syncs to backend when online.
 * Pattern follows fra-mobile-app/contexts/AssessmentContext.tsx
 */

import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiService } from '@/services/api.service';
import { API_CONFIG } from '@/constants/api';
import { useApp } from './AppContext';
import { createLogger } from '@/utils/logger';
const logger = createLogger('BudgetGuideContext');

const SYNC_QUEUE_KEY = 'budget_guide_sync_queue';
const SYNC_DEBOUNCE_MS = 5000;

type SyncState = 'synced' | 'syncing' | 'pending' | 'error';

interface SyncStatus {
  state: SyncState;
  lastSync: Date | null;
  errorMessage?: string;
}

interface SyncQueueItem {
  id: string;
  timestamp: string;
  type: 'progress' | 'pledge';
  data: Record<string, unknown>;
  retryCount: number;
}

function generateId(): string {
  return `bg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export const [BudgetGuideProvider, useBudgetGuide] = createContextHook(() => {
  const app = useApp();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: 'synced',
    lastSync: null,
  });
  const [isOnline, setIsOnline] = useState(true);
  const isOnlineRef = useRef(true);
  const [syncQueue, setSyncQueue] = useState<SyncQueueItem[]>([]);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processSyncQueueRef = useRef<() => Promise<void>>(async () => {});

  // Network monitoring — stable listener, no re-subscription
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const wasOffline = !isOnlineRef.current;
      const isNowOnline = state.isConnected === true;
      isOnlineRef.current = isNowOnline;
      setIsOnline(isNowOnline);

      if (wasOffline && isNowOnline) {
        processSyncQueueRef.current();
      }
    });

    return () => unsubscribe();
  }, []);

  // Load sync queue on mount
  useEffect(() => {
    loadSyncQueue();
  }, []);

  const loadSyncQueue = async () => {
    try {
      const stored = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      if (stored) {
        const queue = JSON.parse(stored) as SyncQueueItem[];
        setSyncQueue(queue);
      }
    } catch (error: unknown) {
      logger.error('Failed to load sync queue', error);
    }
  };

  const saveSyncQueue = async (queue: SyncQueueItem[]) => {
    try {
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
      setSyncQueue(queue);
    } catch (error: unknown) {
      logger.error('Failed to save sync queue', error);
    }
  };

  const addToSyncQueue = async (type: 'progress' | 'pledge', data: Record<string, unknown>) => {
    const item: SyncQueueItem = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      type,
      data,
      retryCount: 0,
    };

    const newQueue = [...syncQueue, item];
    await saveSyncQueue(newQueue);
    setSyncStatus((prev) => ({ state: 'pending', lastSync: prev.lastSync }));
  };

  const processSyncQueue = async () => {
    if (syncQueue.length === 0 || !isOnline || !apiService.isAuthenticated()) {
      return;
    }

    setSyncStatus((prev) => ({ state: 'syncing', lastSync: prev.lastSync }));
    const failedItems: SyncQueueItem[] = [];

    for (const item of syncQueue) {
      try {
        const endpoint =
          item.type === 'progress'
            ? API_CONFIG.ENDPOINTS.BUDGET_GUIDE.PROGRESS
            : API_CONFIG.ENDPOINTS.BUDGET_GUIDE.PLEDGE;

        const result = await apiService.patch(endpoint, item.data, { requiresAuth: true });

        if (!result.success) {
          if (item.retryCount < 3) {
            failedItems.push({ ...item, retryCount: item.retryCount + 1 });
          }
        }
      } catch {
        if (item.retryCount < 3) {
          failedItems.push({ ...item, retryCount: item.retryCount + 1 });
        }
      }
    }

    await saveSyncQueue(failedItems);

    if (failedItems.length === 0) {
      setSyncStatus({ state: 'synced', lastSync: new Date() });
    } else {
      setSyncStatus((prev) => ({
        state: 'error',
        lastSync: prev.lastSync,
        errorMessage: `${failedItems.length} items failed to sync`,
      }));
    }
  };

  // Keep ref in sync so the stable NetInfo listener always calls the latest version
  processSyncQueueRef.current = processSyncQueue;

  // Debounced sync: collect changes over SYNC_DEBOUNCE_MS then push
  const debouncedSyncProgress = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(async () => {
      if (!isOnline || !apiService.isAuthenticated()) {
        // Queue for later
        await addToSyncQueue('progress', {
          selectedRoles: app.selectedRoles,
          completedScreens: app.completedChannels.map((c) => c.channelId),
          watchItems: app.watchItems,
          contactDetails: app.contactDetails,
        });
        return;
      }

      setSyncStatus((prev) => ({ state: 'syncing', lastSync: prev.lastSync }));

      try {
        const result = await apiService.patch(
          API_CONFIG.ENDPOINTS.BUDGET_GUIDE.PROGRESS,
          {
            selectedRoles: app.selectedRoles,
            completedScreens: app.completedChannels.map((c) => c.channelId),
            watchItems: app.watchItems,
            contactDetails: app.contactDetails,
          },
          { requiresAuth: true }
        );

        if (result.success) {
          setSyncStatus({ state: 'synced', lastSync: new Date() });
        } else {
          setSyncStatus((prev) => ({
            state: 'error',
            lastSync: prev.lastSync,
            errorMessage: result.error?.message,
          }));
        }
      } catch {
        setSyncStatus((prev) => ({
          state: 'error',
          lastSync: prev.lastSync,
          errorMessage: 'Network error',
        }));
      }
    }, SYNC_DEBOUNCE_MS);
  }, [isOnline, app.selectedRoles, app.completedChannels, app.watchItems, app.contactDetails]);

  // Sync pledge immediately (important action)
  const syncPledge = async (signature: string) => {
    if (!isOnline || !apiService.isAuthenticated()) {
      await addToSyncQueue('pledge', { signature });
      return;
    }

    try {
      await apiService.post(
        API_CONFIG.ENDPOINTS.BUDGET_GUIDE.PLEDGE,
        { signature },
        { requiresAuth: true }
      );
    } catch {
      await addToSyncQueue('pledge', { signature });
    }
  };

  // Track analytics
  const syncAnalytics = async (data: {
    quizScores?: Record<string, number>;
    timeSpentSeconds?: number;
    screensVisited?: string[];
    completed?: boolean;
  }) => {
    if (!apiService.isAuthenticated()) return;

    try {
      await apiService.post(API_CONFIG.ENDPOINTS.BUDGET_GUIDE.ANALYTICS, data, {
        requiresAuth: true,
      });
    } catch {
      // Analytics failures are non-critical
    }
  };

  return {
    syncStatus,
    isOnline,
    syncQueue,
    debouncedSyncProgress,
    syncPledge,
    syncAnalytics,
    processSyncQueue,
  };
});
