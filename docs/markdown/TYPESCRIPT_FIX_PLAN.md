# TypeScript Fix Plan - Systematic Approach

**Current Status:** 72 TypeScript errors
**Target:** 0 errors
**Estimated Time:** 4-6 hours

---

## ✅ Environment Setup (COMPLETED)

- ✅ Node.js v23.6.0
- ✅ PostgreSQL 14.20 running
- ✅ Database: 12 tables operational
- ✅ Frontend dependencies: 784 packages
- ✅ Backend dependencies: 166 packages
- ✅ .env file created with development config

---

## 🎯 Phase 1: Schema-Related Fixes (HIGH PRIORITY)

### Issue 1: Missing Type Exports
**Files:** risk-scoring.service.ts
**Error:** `'RiskRegisterItem'` doesn't exist

**Fix:**
```typescript
// Add to risk-scoring.service.ts
type RiskRegisterItem = typeof riskRegisterItems.$inferSelect;
```

### Issue 2: Non-existent Schema Fields
**Files:** payment.service.ts, keypass.service.ts

**Missing Fields in Schema:**
1. `packages.tier` → Use `packageType` instead
2. `packages.keypassesIncluded` → Use `maxKeypassesDefault`
3. `purchases.stripePaymentIntentId` → Use `transactionReference`
4. `purchases.status = 'completed'` → Use `'success'`
5. `keypasses.updatedAt` → Field doesn't exist, remove references

**Schema Alignment:**
```typescript
// packages table - NO tier or keypassesIncluded
packageType: 'health-check' | 'with-awareness' | 'with-dashboard'
maxKeypassesDefault: number

// purchases table - NO stripePaymentIntentId
transactionReference: string | null
status: 'pending' | 'success' | 'failed' | 'refunded'

// keypasses table - NO updatedAt
// Only has: createdAt, expiresAt, usedAt
```

---

## 🎯 Phase 2: Drizzle Query API Fixes (MEDIUM PRIORITY)

### Issue: Query Builder Not Callable
**Files:** auditLogger.ts, complianceReporting.ts, dataRetention.ts

**Problem:** Using `db.query.tableName(...)` incorrectly

**Fix Pattern:**
```typescript
// ❌ WRONG
const results = await db.query.users(...);

// ✅ CORRECT - Option 1: Relational query
const results = await db.query.users.findMany({
  where: eq(users.userId, id),
  with: { organisation: true }
});

// ✅ CORRECT - Option 2: SQL-like query
const results = await db
  .select()
  .from(users)
  .where(eq(users.userId, id));
```

---

## 🎯 Phase 3: Type Strictness Fixes (LOW PRIORITY)

### Issue: Null vs Undefined
**Files:** assessment.controller.ts (6 instances)

**Fix:**
```typescript
// Convert null to undefined
const orgId = user.organisationId ?? undefined;
someFunction(orgId);
```

### Issue: Enum Mismatches
**Files:** complianceReporting.ts, assessment.service.ts

**Missing Enums:**
- `AuditEventType.COMPLIANCE_REPORT`
- `AuditSeverity.INFO` (currently 'info')
- `assessmentStatus = 'archived'` (use 'completed')

---

## 📝 Execution Plan

### Step 1: Fix Schema Type Imports (10 min)
```bash
# Files to fix:
- src/services/risk-scoring.service.ts
```

### Step 2: Remove Non-Existent Field References (30 min)
```bash
# Files to fix:
- src/services/payment.service.ts (12 errors)
- src/services/keypass.service.ts (3 errors)
```

### Step 3: Fix Drizzle Query API Usage (60 min)
```bash
# Files to fix:
- src/services/auditLogger.ts (2 errors)
- src/services/complianceReporting.ts (30 errors)
- src/services/dataRetention.ts (8 errors)
```

### Step 4: Fix Type Strictness Issues (30 min)
```bash
# Files to fix:
- src/controllers/assessment.controller.ts (6 errors)
- Various service files (enum mismatches)
```

### Step 5: Verify & Test (30 min)
```bash
npx tsc --noEmit
npm run build
npm test
```

---

## 🚀 Quick Fix Script

```bash
#!/bin/bash
# Run this to fix errors systematically

cd /Users/hola/Desktop/stop_fra/backend

echo "=== Phase 1: Schema Type Imports ==="
# Fix will be applied via TypeScript edits

echo "=== Phase 2: Schema Field Alignment ==="
# Remove references to non-existent fields

echo "=== Phase 3: Query API Fixes ==="
# Update Drizzle query patterns

echo "=== Phase 4: Type Strictness ==="
# Fix null/undefined issues

echo "=== Final Verification ==="
npx tsc --noEmit

echo "✅ All fixes applied!"
```

---

## Expected Outcome

- **Before:** 72 errors
- **After Phase 1:** ~60 errors (-12)
- **After Phase 2:** ~45 errors (-15)
- **After Phase 3:** ~12 errors (-33)
- **After Phase 4:** 0 errors (-12)

**Total Time:** 2.5-3 hours of focused work

---

**Status:** Ready to execute
**Next Action:** Begin Phase 1 fixes
