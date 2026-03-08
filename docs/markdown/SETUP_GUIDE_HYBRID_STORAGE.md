# Stop FRA Platform: Complete Setup Guide
## Hybrid AsyncStorage + API Sync Approach

**Last Updated**: December 27, 2025
**Version**: 2.0 (Hybrid Storage)

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Phase 1: Immediate Setup (Week 1)](#phase-1-immediate-setup)
3. [Phase 2: Hybrid Storage Implementation (Week 2)](#phase-2-hybrid-storage)
4. [Phase 3: API Integration (Week 3)](#phase-3-api-integration)
5. [Phase 4: Backend Enhancement (Week 4)](#phase-4-backend-enhancement)
6. [Phase 5: Testing (Week 5)](#phase-5-testing)
7. [Phase 6: Production Deployment (Week 6-8)](#phase-6-production-deployment)

---

## 🏗️ Architecture Overview

### Hybrid Storage Strategy

```
┌─────────────────────────────────────────────────────────┐
│                    Mobile App (React Native)             │
├─────────────────────────────────────────────────────────┤
│  User Input → AssessmentContext                         │
│      ↓                                                   │
│  1. Save to AsyncStorage (INSTANT) ✅                    │
│      ↓                                                   │
│  2. Queue for API Sync (BACKGROUND) ⏳                   │
│      ↓                                                   │
│  3. Sync when online + authenticated 🔄                  │
└─────────────────────────────────────────────────────────┘
           ↓ (Background sync)
┌─────────────────────────────────────────────────────────┐
│              Backend API (Hono + PostgreSQL)             │
├─────────────────────────────────────────────────────────┤
│  • Store assessment data                                 │
│  • Calculate risk scores                                 │
│  • Generate reports                                      │
│  • Provide dashboard data                                │
└─────────────────────────────────────────────────────────┘
```

### Key Benefits

- ⚡ **Instant saves** - No network latency
- 📴 **Offline-first** - Works without internet
- 🔄 **Auto-sync** - Background synchronization
- 💾 **Data safety** - Local + cloud backup
- 📊 **Dashboard ready** - Employer visibility

---

## Phase 1: Immediate Setup (Week 1)

### Step 1: Repository Setup

```bash
# Navigate to project root
cd /Users/hola/Desktop/stop_fra

# Already initialized and pushed to GitHub ✅
git remote -v
# origin  https://github.com/deric7223r-tech/stop_fra.git

# Current status
git status
```

**Status**: ✅ **COMPLETE** - Repository already on GitHub

### Step 2: Install Dependencies

```bash
# Frontend dependencies
cd fraud-risk-app-main
npm install --legacy-peer-deps

# Ensure critical packages
npm install @react-native-async-storage/async-storage
npm install @react-native-community/netinfo
npm install @tanstack/react-query

# Backend dependencies
cd ../backend
npm install

# Development tools
npm install -D @types/node tsx
```

**Status**: ✅ **COMPLETE** - All dependencies installed

### Step 3: Fix TypeScript Errors

All TypeScript errors have been fixed:

```bash
cd fraud-risk-app-main
npx tsc --noEmit  # 0 errors ✅
```

**Fixed Issues**:
- ✅ procurement-refactored.tsx - Type cast for q3
- ✅ riskScoringEngine.test.ts - Complete test data
- ✅ confirmation.tsx - organisationId property
- ✅ index.tsx - Optional chaining for keyPassCode
- ✅ signature.tsx - userId instead of id
- ✅ AuthContext.tsx - Added keyPassCode to UserData
- ✅ api.service.ts - Fixed HeadersInit indexing

**Status**: ✅ **COMPLETE** - 0 TypeScript errors

### Step 4: Database Setup

```bash
# Check PostgreSQL status
brew services list | grep postgresql
# postgresql@14 started ✅

# Verify database exists
psql -U hola -d stopfra_dev -c "\dt"
# 12 tables created ✅

# Run migrations (if needed)
cd backend
npm run db:migrate
```

**Database Tables**:
- ✅ users
- ✅ organisations
- ✅ assessments
- ✅ assessment_answers
- ✅ risk_register_items
- ✅ packages
- ✅ purchases
- ✅ keypasses
- ✅ employee_assessments
- ✅ signatures
- ✅ feedback
- ✅ audit_logs

**Status**: ✅ **COMPLETE** - Database fully operational

### Step 5: Start Services

```bash
# Terminal 1: Backend
cd backend
npm run dev
# ✅ Running on http://localhost:3000

# Terminal 2: Frontend
cd fraud-risk-app-main
npm start -- --web
# ✅ Running on http://localhost:8081
```

**Status**: ✅ **COMPLETE** - Both servers running

---

## Phase 2: Hybrid Storage Implementation (Week 2)

### Step 6: Enhanced AssessmentContext

**File**: `fraud-risk-app-main/contexts/AssessmentContext.tsx`

#### Current Implementation Status

The AssessmentContext already has:
- ✅ AsyncStorage for local persistence
- ✅ Auto-save on every update
- ✅ Load draft on app start
- ❌ **Missing**: Backend sync
- ❌ **Missing**: Offline queue
- ❌ **Missing**: Sync status tracking

#### Implementation Plan

**Add Sync State**:

```typescript
interface SyncStatus {
  state: 'synced' | 'syncing' | 'pending' | 'error';
  lastSync: Date | null;
  errorMessage?: string;
}

const [syncStatus, setSyncStatus] = useState<SyncStatus>({
  state: 'synced',
  lastSync: null
});
```

**Enhanced updateAssessment**:

```typescript
const updateAssessment = useCallback(async (updates: Partial<AssessmentData>) => {
  setAssessment((prev) => {
    const updated = { ...prev, ...updates, updatedAt: new Date().toISOString() };

    // 1. IMMEDIATE: Save to AsyncStorage
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated)).catch(console.error);

    // 2. BACKGROUND: Queue for sync if authenticated
    if (isAuthenticated && isOnline) {
      setSyncStatus({ state: 'pending', lastSync: syncStatus.lastSync });
      debouncedSync(updated);
    }

    return updated;
  });
}, [isAuthenticated, isOnline, syncStatus]);
```

**Add Sync Methods**:

```typescript
const syncToBackend = useCallback(async (assessment: AssessmentData) => {
  if (!apiService.isAuthenticated()) return;

  setSyncStatus({ state: 'syncing', lastSync: new Date() });

  try {
    await apiService.patch(
      `/api/v1/assessments/${assessment.id}`,
      assessment,
      { requiresAuth: true }
    );

    setSyncStatus({ state: 'synced', lastSync: new Date() });
  } catch (error) {
    console.error('Sync failed:', error);
    setSyncStatus({
      state: 'error',
      lastSync: new Date(),
      errorMessage: error.message
    });
  }
}, []);

// Debounced version (wait 5s after last change)
const debouncedSync = useMemo(
  () => debounce(syncToBackend, 5000),
  [syncToBackend]
);
```

### Step 7: Add Network Detection

```typescript
import NetInfo from '@react-native-community/netinfo';

const [isOnline, setIsOnline] = useState(true);

useEffect(() => {
  const unsubscribe = NetInfo.addEventListener(state => {
    setIsOnline(state.isConnected ?? false);

    // When back online, sync pending changes
    if (state.isConnected && syncStatus.state === 'pending') {
      syncToBackend(assessment);
    }
  });

  return unsubscribe;
}, [assessment, syncStatus]);
```

### Step 8: Create SyncStatus UI Component

**File**: `fraud-risk-app-main/components/SyncStatus.tsx`

```typescript
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Cloud, CloudOff, RefreshCw, AlertCircle } from 'lucide-react-native';
import { useAssessment } from '@/contexts/AssessmentContext';
import colors from '@/constants/colors';

export const SyncStatus = () => {
  const { syncStatus } = useAssessment();

  if (syncStatus.state === 'synced') return null;

  const icons = {
    syncing: <RefreshCw size={16} color={colors.govBlue} />,
    pending: <Cloud size={16} color={colors.govYellow} />,
    error: <CloudOff size={16} color={colors.govRed} />,
  };

  const messages = {
    syncing: 'Syncing to cloud...',
    pending: 'Changes pending sync',
    error: 'Offline - changes saved locally',
  };

  return (
    <View style={[styles.container, styles[syncStatus.state]]}>
      {icons[syncStatus.state]}
      <Text style={styles.text}>{messages[syncStatus.state]}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  syncing: {
    backgroundColor: colors.govBlue + '20',
  },
  pending: {
    backgroundColor: colors.govYellow + '20',
  },
  error: {
    backgroundColor: colors.govRed + '20',
  },
  text: {
    fontSize: 14,
    color: colors.govGrey1,
  },
});
```

---

## Phase 3: API Integration (Week 3)

### Step 9: Verify API Service

**File**: `fraud-risk-app-main/services/api.service.ts`

**Current Status**: ✅ **FULLY IMPLEMENTED**

The API service already has:
- ✅ Centralized service with singleton pattern
- ✅ JWT token management
- ✅ Automatic token refresh on 401
- ✅ Timeout handling (30s)
- ✅ Proper error handling
- ✅ TypeScript support with generics

**Configuration**: `fraud-risk-app-main/constants/api.ts`

```typescript
BASE_URL: 'http://localhost:3000' (dev)
TIMEOUT: 30000ms
Endpoints: auth, assessments, keypasses, packages, purchases
```

### Step 10: Add Assessment-Specific API Methods

Enhance the API service with assessment-specific methods:

```typescript
// Add to api.service.ts or create assessment.service.ts

class AssessmentService {
  async syncAssessment(assessment: AssessmentData): Promise<ApiResponse> {
    return apiService.patch(
      `/api/v1/assessments/${assessment.id}/sync`,
      assessment,
      { requiresAuth: true }
    );
  }

  async checkSyncStatus(assessmentId: string, lastSynced: string): Promise<ApiResponse> {
    return apiService.get(
      `/api/v1/assessments/${assessmentId}/sync-status?lastSynced=${lastSynced}`,
      { requiresAuth: true }
    );
  }

  async submitAssessment(assessmentId: string): Promise<ApiResponse> {
    return apiService.post(
      `/api/v1/assessments/${assessmentId}/submit`,
      {},
      { requiresAuth: true }
    );
  }
}

export const assessmentService = new AssessmentService();
```

### Step 11: Implement Offline Queue

**File**: `fraud-risk-app-main/utils/syncQueue.ts`

```typescript
interface QueueItem {
  id: string;
  assessment: AssessmentData;
  timestamp: number;
  retryCount: number;
}

class SyncQueue {
  private queue: QueueItem[] = [];
  private isProcessing = false;
  private maxRetries = 3;

  async add(assessment: AssessmentData) {
    // Remove existing entry for same assessment
    this.queue = this.queue.filter(item => item.id !== assessment.id);

    // Add new entry
    this.queue.push({
      id: assessment.id,
      assessment,
      timestamp: Date.now(),
      retryCount: 0,
    });

    // Save to AsyncStorage
    await this.saveQueue();

    // Start processing if not already running
    if (!this.isProcessing) {
      this.process();
    }
  }

  private async process() {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue[0];

      try {
        await assessmentService.syncAssessment(item.assessment);
        this.queue.shift(); // Remove successfully synced item
        await this.saveQueue();
      } catch (error) {
        item.retryCount++;

        if (item.retryCount >= this.maxRetries) {
          console.error('Max retries reached, removing from queue:', item.id);
          this.queue.shift();
          await this.saveQueue();
        } else {
          console.warn(`Sync failed (attempt ${item.retryCount}), will retry:`, error);
          break; // Stop processing, will retry later
        }
      }
    }

    this.isProcessing = false;

    // If items remain, schedule retry
    if (this.queue.length > 0) {
      setTimeout(() => this.process(), 30000); // Retry in 30 seconds
    }
  }

  private async saveQueue() {
    await AsyncStorage.setItem('@StopFRA:syncQueue', JSON.stringify(this.queue));
  }

  async loadQueue() {
    const stored = await AsyncStorage.getItem('@StopFRA:syncQueue');
    if (stored) {
      this.queue = JSON.parse(stored);
    }
  }

  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      items: this.queue.map(item => ({
        id: item.id,
        timestamp: item.timestamp,
        retryCount: item.retryCount,
      })),
    };
  }
}

export const syncQueue = new SyncQueue();
```

---

## Phase 4: Backend Enhancement (Week 4)

### Step 12: Add Sync Endpoints

**File**: `backend/src/routes/assessment.routes.ts`

Add new endpoints for efficient syncing:

```typescript
// Sync endpoint (partial updates)
app.patch('/:id/sync', authMiddleware, async (c) => {
  const assessmentId = c.req.param('id');
  const updates = await c.req.json();
  const user = c.get('user');

  try {
    // Get existing assessment
    const existing = await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, assessmentId))
      .limit(1);

    if (!existing[0]) {
      return c.json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Assessment not found' }
      }, 404);
    }

    // Verify ownership
    if (existing[0].userId !== user.userId) {
      return c.json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Access denied' }
      }, 403);
    }

    // Merge updates intelligently
    const merged = {
      ...existing[0],
      ...updates,
      updatedAt: new Date().toISOString(),
      version: (existing[0].version || 0) + 1,
    };

    // Update database
    await db
      .update(assessments)
      .set(merged)
      .where(eq(assessments.id, assessmentId));

    // Log sync event
    await AuditLogger.log({
      eventType: 'assessment_synced',
      userId: user.userId,
      organisationId: user.organisationId,
      severity: 'info',
      details: {
        assessmentId,
        version: merged.version,
      },
    });

    return c.json({ success: true, data: merged });
  } catch (error: any) {
    console.error('[SYNC] Error:', error);
    return c.json({
      success: false,
      error: { code: 'SYNC_FAILED', message: error.message }
    }, 500);
  }
});

// Check sync status
app.get('/:id/sync-status', authMiddleware, async (c) => {
  const assessmentId = c.req.param('id');
  const clientUpdatedAt = c.req.query('lastSynced');

  const assessment = await db
    .select()
    .from(assessments)
    .where(eq(assessments.id, assessmentId))
    .limit(1);

  if (!assessment[0]) {
    return c.json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Assessment not found' }
    }, 404);
  }

  const serverUpdated = new Date(assessment[0].updatedAt);
  const clientUpdated = clientUpdatedAt ? new Date(clientUpdatedAt) : new Date(0);

  return c.json({
    success: true,
    data: {
      needsSync: serverUpdated > clientUpdated,
      serverUpdatedAt: assessment[0].updatedAt,
      serverVersion: assessment[0].version || 0,
    }
  });
});
```

---

## Phase 5: Testing (Week 5)

### Step 13: Test Scenarios

Create comprehensive test suite:

```typescript
// __tests__/hybridStorage.test.ts

describe('Hybrid Storage System', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  describe('Local Storage', () => {
    test('saves to AsyncStorage immediately', async () => {
      const { result } = renderHook(() => useAssessment());

      await act(async () => {
        await result.current.updateAssessment({
          riskAppetite: { tolerance: 'low' }
        });
      });

      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed.riskAppetite.tolerance).toBe('low');
    });
  });

  describe('Offline Behavior', () => {
    test('queues sync when offline', async () => {
      // Mock network offline
      jest.spyOn(NetInfo, 'fetch').mockResolvedValue({
        isConnected: false,
      } as any);

      const { result } = renderHook(() => useAssessment());

      await act(async () => {
        await result.current.updateAssessment({
          riskAppetite: { tolerance: 'medium' }
        });
      });

      expect(result.current.syncStatus.state).toBe('pending');
    });
  });

  describe('Online Sync', () => {
    test('syncs when online and authenticated', async () => {
      const mockApi = jest.spyOn(apiService, 'patch').mockResolvedValue({
        success: true,
        data: {}
      });

      const { result } = renderHook(() => useAssessment());

      await act(async () => {
        await result.current.syncToBackend();
      });

      expect(mockApi).toHaveBeenCalled();
      expect(result.current.syncStatus.state).toBe('synced');
    });
  });
});
```

### Step 14: E2E Testing

```typescript
// e2e/assessmentFlow.e2e.ts

describe('Complete Assessment Flow', () => {
  test('completes assessment offline then syncs', async () => {
    // 1. Start offline
    await device.disableNetwork();

    // 2. Complete assessment
    await element(by.id('risk-appetite-low')).tap();
    await element(by.id('next-button')).tap();

    await element(by.id('fraud-triangle-moderate')).tap();
    await element(by.id('next-button')).tap();

    // 3. Verify saved locally
    await expect(element(by.text('Changes pending sync'))).toBeVisible();

    // 4. Go online
    await device.enableNetwork();

    // 5. Wait for sync
    await waitFor(element(by.text('Synced')))
      .toBeVisible()
      .withTimeout(10000);

    // 6. Submit
    await element(by.id('submit-button')).tap();

    // 7. Verify success
    await expect(element(by.text('Assessment Submitted')))
      .toBeVisible();
  });
});
```

---

## Phase 6: Production Deployment (Week 6-8)

### Step 15: Environment Configuration

```typescript
// config/environment.ts

export const config = {
  development: {
    apiUrl: 'http://localhost:3000',
    syncDebounce: 2000,
    maxRetries: 2,
    retryDelay: 5000,
  },
  staging: {
    apiUrl: 'https://staging-api.stopfra.com',
    syncDebounce: 5000,
    maxRetries: 3,
    retryDelay: 10000,
  },
  production: {
    apiUrl: 'https://api.stopfra.com',
    syncDebounce: 10000,
    maxRetries: 5,
    retryDelay: 30000,
    enableAnalytics: true,
  },
};

export const getConfig = () => {
  const env = __DEV__ ? 'development' : 'production';
  return config[env];
};
```

### Step 16: Monitoring & Analytics

```typescript
// utils/analytics.ts

export const trackSyncEvent = async (event: {
  type: 'sync_start' | 'sync_success' | 'sync_failure';
  duration?: number;
  dataSize?: number;
  retryCount?: number;
}) => {
  if (!getConfig().enableAnalytics) return;

  await analytics.logEvent('assessment_sync', {
    ...event,
    timestamp: new Date().toISOString(),
    networkType: await getNetworkType(),
    platform: Platform.OS,
  });
};
```

---

## 📊 Summary & Status

### Current Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Repository | ✅ Complete | Pushed to GitHub |
| Dependencies | ✅ Complete | All installed |
| TypeScript | ✅ Complete | 0 errors |
| Database | ✅ Complete | PostgreSQL + 12 tables |
| Backend API | ✅ Running | Port 3000 |
| Frontend | ✅ Running | Port 8081 |
| API Service | ✅ Complete | Fully implemented |
| AsyncStorage | ✅ Working | Local persistence |
| Backend Sync | ❌ TODO | Needs implementation |
| Offline Queue | ❌ TODO | Needs implementation |
| Sync UI | ❌ TODO | Needs implementation |
| Tests | ❌ TODO | Needs implementation |

### Next Immediate Steps

1. **Enhance AssessmentContext** (2-3 hours)
   - Add sync status tracking
   - Implement syncToBackend method
   - Add debounced sync

2. **Add SyncStatus UI** (1 hour)
   - Create SyncStatus component
   - Integrate with AssessmentScreen

3. **Implement Offline Queue** (2-3 hours)
   - Create SyncQueue utility
   - Add network detection
   - Handle retry logic

4. **Backend Sync Endpoints** (2-3 hours)
   - Add `/assessments/:id/sync` endpoint
   - Add `/assessments/:id/sync-status` endpoint
   - Implement conflict resolution

5. **Testing** (4-6 hours)
   - Unit tests for hybrid storage
   - Integration tests
   - E2E flow tests

### Production Readiness Checklist

- ✅ Repository setup
- ✅ Database configured
- ✅ API service implemented
- ✅ Type safety complete
- ❌ Hybrid sync implementation
- ❌ Offline queue system
- ❌ Comprehensive testing
- ❌ Performance optimization
- ❌ Production environment config
- ❌ Monitoring & analytics

---

## 🚀 Quick Start (Today)

```bash
# 1. Verify everything is running
cd backend && npm run dev &
cd fraud-risk-app-main && npm start -- --web &

# 2. Open browser
open http://localhost:8081

# 3. Test current functionality
# - Sign up flow ✅
# - Assessment flow (offline) ✅
# - Backend API ✅

# 4. Next: Implement hybrid sync
# Focus on AssessmentContext enhancement
```

**Total Estimated Time to Full Production**: 6-8 weeks

This guide provides a complete roadmap from current state to production-ready hybrid storage implementation. The foundation is solid, and the remaining work is clearly defined with realistic timelines.
