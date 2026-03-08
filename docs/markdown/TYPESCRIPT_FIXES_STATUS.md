# TypeScript Fixes Status Report

**Date:** December 27, 2025
**Initial Errors:** 59
**Current Errors:** 72 (increased due to revealing cascading issues)
**Fixed Issues:** 15 critical errors

---

## ✅ Completed Fixes

### 1. Database Schema Import Mismatches (FIXED)

**Problem:** Services were importing non-existent type exports from schema.
```typescript
// ❌ BEFORE (Incorrect)
import { Assessment, Keypass, Package } from '../db/schema';
```

**Solution:** Use Drizzle's `$inferSelect` to infer types from table definitions.
```typescript
// ✅ AFTER (Correct)
import { assessments, keypasses, packages } from '../db/schema';
type Assessment = typeof assessments.$inferSelect;
type Keypass = typeof keypasses.$inferSelect;
type Package = typeof packages.$inferSelect;
```

**Files Fixed:**
- ✅ `src/services/assessment.service.ts`
- ✅ `src/services/keypass.service.ts`
- ✅ `src/services/payment.service.ts`

---

### 2. Field Name Mismatches (FIXED)

**Problem:** Service used `assessedBy` but schema has `createdByUserId`.

**Solution:** Updated to match schema field names.
```typescript
// ❌ BEFORE
assessedBy: input.assessedBy,

// ✅ AFTER
createdByUserId: input.createdByUserId,
```

**Files Fixed:**
- ✅ `src/services/assessment.service.ts` - Interface and implementation
- ✅ `src/controllers/assessment.controller.ts` - Controller usage

---

### 3. JWT Token Signing Types (FIXED)

**Problem:** `expiresIn` type inference issue with jsonwebtoken library.

**Solution:** Explicitly type the expiry constants as strings.
```typescript
// ❌ BEFORE
private readonly ACCESS_TOKEN_EXPIRY = process.env.JWT_EXPIRES_IN || '24h';

// ✅ AFTER
private readonly ACCESS_TOKEN_EXPIRY: string = process.env.JWT_EXPIRES_IN || '24h';
```

**Files Fixed:**
- ✅ `src/services/auth.service.ts`

---

## ⚠️ Remaining Issues (72 errors)

### Category 1: Drizzle ORM Query Builder Issues (~40 errors)

**Files Affected:**
- `src/services/auditLogger.ts` (2 errors)
- `src/services/complianceReporting.ts` (~30 errors)
- `src/services/dataRetention.ts` (~8 errors)

**Issue:** Drizzle query builder type mismatches with relational queries.

**Example Error:**
```
Type '{ readonly users: RelationalQueryBuilder<...> }' has no call signatures.
```

**Root Cause:** Incorrect usage of Drizzle's query API. Using `db.query.tableName()` instead of `db.select()`.

**Recommended Fix:**
```typescript
// ❌ INCORRECT
const users = await db.query.users(...);

// ✅ CORRECT
const users = await db.select().from(users).where(...);
```

---

### Category 2: Schema Field Mismatches (~15 errors)

**Files Affected:**
- `src/services/assessment.service.ts` (6 errors)
- `src/services/keypass.service.ts` (5 errors)
- `src/services/payment.service.ts` (4 errors)

**Issues:**
1. **Non-existent fields used in queries:**
   - `moduleKey` → should be `section`
   - `answerGroupId` → doesn't exist in schema
   - `tier` (in packages table) → doesn't exist
   - `purchasedBy` → should be separate user reference
   - `usedByEmail` → not in keypasses schema
   - `keypassId` → foreign key issue in employee_assessments

2. **Status enum mismatches:**
   - `'archived'` status used but not in `assessmentStatusEnum`
   - Should add to enum or use `'completed'`

**Recommended Fixes:**
1. Review schema.ts and update all field references
2. Add missing enum values or use existing ones
3. Remove references to non-existent fields

---

### Category 3: Null vs Undefined Type Mismatches (~10 errors)

**Files Affected:**
- `src/controllers/assessment.controller.ts` (6 errors)

**Issue:** Functions expect `string | undefined` but receive `string | null`.

**Example:**
```typescript
// Schema returns: string | null
const organisationId = user.organisationId;

// Function expects: string | undefined
someFunction(organisationId); // ❌ Type error
```

**Recommended Fix:**
```typescript
// Option 1: Nullish coalescing
someFunction(organisationId ?? undefined);

// Option 2: Update function signatures to accept null
function someFunction(id: string | null | undefined) { }
```

---

### Category 4: Compliance & Audit Logging (~5 errors)

**Files Affected:**
- `src/routes/compliance.ts` (1 error)
- `src/services/complianceReporting.ts` (2 errors)
- `src/services/auditLogger.ts` (2 errors)

**Issues:**
1. **Missing AuditEventType:**
   - `COMPLIANCE_REPORT` not defined in enum
   - Should add to AuditEventType enum

2. **Severity type mismatch:**
   - `'info'` used but `AuditSeverity` doesn't include it
   - Should use existing severity or update enum

3. **queryLogs method missing:**
   - `AuditLogger.queryLogs()` doesn't exist
   - Needs implementation or different approach

---

### Category 5: Risk Register Type Issues (~2 errors)

**Files Affected:**
- `src/services/assessment.service.ts` (2 errors)

**Issue:** Type inference problem when inserting risk register items.

**Example Error:**
```
Argument of type 'Omit<RiskRegisterItem, "createdAt" | "updatedAt" | "riskItemId">[]'
is not assignable to parameter type '{ assessmentId: string; ... }'
```

**Root Cause:** Using `Omit` creates a mapped type that Drizzle doesn't recognize.

**Recommended Fix:**
```typescript
// Map to plain objects matching insert type
const items = risks.map(risk => ({
  assessmentId: risk.assessmentId,
  riskIdCode: risk.riskIdCode,
  title: risk.title,
  // ... explicitly map all required fields
}));

await db.insert(riskRegisterItems).values(items);
```

---

## 📊 Error Breakdown by Severity

| Severity | Count | Description |
|----------|-------|-------------|
| 🔴 Critical | 15 | Prevents compilation (FIXED) |
| 🟠 High | 25 | Schema mismatches, will cause runtime errors |
| 🟡 Medium | 30 | Query builder issues, can be worked around |
| 🟢 Low | 17 | Type strictness, won't affect runtime |

---

## 🛠️ Recommended Fix Priority

### Phase 1: High Priority (1-2 days)
1. Fix schema field mismatches in assessment.service.ts
2. Fix null vs undefined issues in controllers
3. Add missing enum values (COMPLIANCE_REPORT, 'info', 'archived')
4. Fix keypass service schema issues

### Phase 2: Medium Priority (2-3 days)
5. Refactor Drizzle query builder usage in complianceReporting.ts
6. Fix audit logger query issues
7. Fix dataRetention.ts query builder issues
8. Implement missing AuditLogger methods

### Phase 3: Low Priority (1-2 days)
9. Fix risk register type mapping
10. Review and update all type assertions
11. Add proper TypeScript strict mode compliance

---

## 📝 Notes

### Why Error Count Increased

The initial 59 errors were surface-level issues. Fixing import mismatches revealed deeper problems:
- Cascading type errors from incorrect base types
- Hidden field mismatch issues
- Query builder API misuse

This is expected behavior when fixing TypeScript errors - resolving one issue often exposes related problems.

### Impact on Runtime

**Good News:** Many of these errors won't cause runtime failures because:
- JavaScript is dynamically typed at runtime
- Drizzle ORM does runtime validation
- Database constraints catch invalid data

**However:** Type errors indicate potential bugs that should be fixed before production.

---

## 🎯 Testing Strategy

After fixes, verify with:

```bash
# 1. Type check
npx tsc --noEmit

# 2. Build
npm run build

# 3. Run tests (when implemented)
npm test

# 4. Manual API testing
# - Create assessment
# - Update assessment answers
# - Generate risk register
# - Allocate keypasses
# - Process purchase
```

---

## 📚 Resources

- **Drizzle ORM Docs:** https://orm.drizzle.team/docs/overview
- **Drizzle Query API:** https://orm.drizzle.team/docs/rqb
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/handbook/intro.html

---

**Status:** Partial fixes completed, 72 errors remaining
**Next Action:** Continue with Phase 1 fixes (schema field mismatches)
**Estimated Completion:** 5-7 days for all fixes
