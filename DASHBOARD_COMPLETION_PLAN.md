# Dashboard Completion Implementation Plan

**Status:** Web dashboard at ~40% completion, ready for final push  
**Timeline:** 3-4 weeks to production  
**Priority:** Critical path fixes first (security, lint, tests)

---

## Phase 1: Immediate Fixes (Days 1-3)
### Goal: Make dashboard production-ready for initial deployment

#### 1.1 Fix Security Vulnerabilities (30 mins)
```bash
cd apps/fra-web-dashboard
pnpm audit fix
pnpm run build  # Verify build still works
```

**Specific issues to fix:**
- React Router XSS vulnerability (GHSA-2w69-qvjg-hvjx) - HIGH
  - Upgrade `@remix-run/router` to >=1.23.2
  - Test open redirect scenarios after update

#### 1.2 Fix ESLint Errors (1-2 hours)
**Error 1: src/components/ui/command.tsx:24**
- Remove unused `CommandDialogProps` type if not exported
- Or add `cli:commands` to export list if needed
- Root cause: Type alias defined but potentially unused

**Error 2: src/components/ui/textarea.tsx:5**
- Check if `TextareaProps` is properly exported
- Ensure all type exports are referenced in code

**Error 3: tailwind.config.ts:113**
- Remove any `require()` statements
- Use ES6 `import` syntax exclusively
- Check for deprecated tailwind patterns

**Command:**
```bash
pnpm run lint  # See all issues  
pnpm run lint --fix  # Auto-fix where possible
```

#### 1.3 Fix 14 React Hook Warnings (2-3 hours)
**Affected files:**
- `src/hooks/useSession.ts` (2 warnings)
- `src/hooks/useWorkshopProgress.ts` (missing deps)
- `src/pages/ActionPlan.tsx` (missing deps)
- `src/pages/Certificate.tsx` (missing deps)
- `src/pages/Workshop.tsx` (missing deps)

**Solution pattern:**
```typescript
// Before (with warning)
useEffect(() => {
  fetchData();
}, []); // Missing dependency

// After (fixed)
useEffect(() => {
  fetchData();
}, [fetchData]); // Include all dependencies
```

#### 1.4 Update Browserslist (15 mins)
```bash
npx update-browserslist-db@latest
```

---

## Phase 2: Integration (Days 4-7)
### Goal: Integrate @stopfra/ui-core design system

#### 2.1 Import Colors & Spacing Tokens
**File: src/styles/globals.css (or App.css)**
```typescript
// Import @stopfra/ui-core tokens
import { 
  colors, 
  spacing, 
  typography, 
  borders 
} from '@stopfra/ui-core/dist/tokens';

// Apply to CSS variables
const cssVariables = `
  :root {
    --primary: ${colors.primary};
    --primary-foreground: ${colors.primaryForeground};
    --success: ${colors.success};
    --spacing-unit: ${spacing.unit}px;
  }
`;
```

#### 2.2 Use UI Core Component Types
**File: src/components/Button.tsx (example)**
```typescript
import { type ButtonType } from '@stopfra/ui-core';
import { cn } from '@/lib/utils';

export function Button({ variant = 'primary', size = 'md', ...props }: ButtonType) {
  return (
    <button
      className={cn(
        // Use tokens from @stopfra/ui-core
        buttonVariants[variant],
        buttonSizes[size],
        ...
      )}
      {...props}
    />
  );
}
```

#### 2.3 Update Tailwind Config
**File: tailwind.config.ts**
```typescript
import { colors, spacing } from '@stopfra/ui-core/dist/tokens';

export default {
  theme: {
    extend: {
      colors: colors,  // Pull in standardized colors
      spacing: spacing,  // Pull in standardized spacing
    }
  }
} satisfies Config;
```

---

## Phase 3: Missing Features (Weeks 2-3)
### Goal: Implement core fraud risk assessment and employer dashboard

#### 3.1 Build Fraud Risk Assessment Module (5-7 days)
**Status:** Currently missing - backend API endpoints exist, UI not built

**Step 1: Create Assessment Data Structure**
```typescript
// src/types/assessment.ts
import { AssessmentType } from '@stopfra/types';

export interface AssessmentModule {
  id: string;
  title: string;
  description: string;
  category: 'governance' | 'people' | 'process' | 'systems' | 'culture';
  questions: AssessmentQuestion[];
  weighting: number;
}

export interface AssessmentQuestion {
  id: string;
  text: string;
  type: 'frequency' | 'currency' | 'scale' | 'yesno';
  weight: number;
  responseOptions?: string[];
}
```

**Step 2: Create Assessment Hook**
```typescript
// src/hooks/useAssessment.ts
import { useState, useCallback } from 'react';
import { api } from '@/lib/api';
import type { AssessmentType } from '@stopfra/types';

export function useAssessment(organisationId?: string) {
  const [assessment, setAssessment] = useState<AssessmentType | null>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startAssessment = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.post('/api/v1/assessment/create', {
        organisationId,
      });
      setAssessment(data);
    } catch (err) {
      setError((err as Error).message);
    }
    setIsLoading(false);
  }, [organisationId]);

  const updateAnswer = useCallback(async (questionId: string, value: any) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  }, []);

  const submitAssessment = useCallback(async () => {
    if (!assessment) return;
    try {
      const result = await api.patch(`/api/v1/assessment/${assessment.id}`, {
        answers,
      });
      setRiskScore(result.riskScore);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [assessment, answers]);

  return {
    assessment,
    answers,
    riskScore,
    isLoading,
    error,
    startAssessment,
    updateAnswer,
    submitAssessment,
  };
}
```

**Step 3: Build Assessment Pages**
- Create `src/pages/Assessment.tsx` - Main assessment flow
- Create `src/pages/AssessmentResults.tsx` - Results & risk dashboard
- Create `src/components/AssessmentModule.tsx` - Individual module component
- Create `src/components/QuestionRenderer.tsx` - Renders different question types

**Step 4: Connect to Backend**
```typescript
// Backend already has endpoints ready:
POST   /api/v1/assessment/create      - Create new assessment
PATCH  /api/v1/assessment/:id         - Update answers
GET    /api/v1/assessment/:id         - Get assessment with results
```

#### 3.2 Build Employer Dashboard (3-5 days)
**Status:** Partially built - EmployerDashboard.tsx exists but incomplete

**Current state in EmployerDashboard.tsx:**
- ✅ Charting libraries imported (Recharts)
- ✅ Table components available
- ✅ Data fetching started

**What's missing:**
1. Complete analytics charts
2. Employee list with filtering/search
3. Risk heat maps
4. Assessment export/reporting

**Implementation:**
```typescript
// src/pages/EmployerDashboard.tsx - Complete this

const [assessments, setAssessments] = useState([]);
const [filter, setFilter] = useState('all'); // 'all' | 'high-risk' | 'pending'
const [searchTerm, setSearchTerm] = useState('');

// Fetch employee assessments
useEffect(() => {
  const fetchAssessments = async () => {
    const data = await api.get('/api/v1/analytics/dashboard');
    setAssessments(data.assessments);
  };
  fetchAssessments();
}, []);

// Filter and search
const filtered = assessments.filter(a => 
  a.status === filter && 
  a.employeeName.includes(searchTerm)
);

// Render chart with risk distribution
// Render table with employee statuses
// Add export button for compliance reports
```

#### 3.3 Build Budget Guide Feature (3-5 days)
**Status:** Backend endpoints exist, UI not built

**Structure:**
```
src/pages/BudgetGuide.tsx - Main page
src/components/RiskAppetiteForm.tsx - Set risk appetite
src/components/MitigationCard.tsx - Display mitigation strategies
src/hooks/useBudgetGuide.ts - Data management
```

**Implementation:**
```typescript
// src/hooks/useBudgetGuide.ts
export function useBudgetGuide() {
  const fetchProgress = api.get('/api/v1/budget-guide/progress');
  const updateRiskAppetite = (appetite: RiskAppetite) => 
    api.patch('/api/v1/budget-guide/risk-appetite', appetite);
  const saveMitigation = (strategy: MitigationStrategy) =>
    api.post('/api/v1/budget-guide/mitigation', strategy);
  // ... returns progress, mitigations, etc.
}
```

---

## Phase 4: Testing & Optimization (Weeks 3-4)
### Goal: Achieve 80%+ test coverage and optimize performance

#### 4.1 Add Unit Tests (3-5 days)
```bash
# Create test files alongside components
src/components/__tests__/AssessmentModule.test.tsx
src/hooks/__tests__/useAssessment.test.ts
src/pages/__tests__/Assessment.test.tsx
```

**Test example:**
```typescript
// src/components/__tests__/AssessmentModule.test.tsx
import { render, screen } from '@testing-library/react';
import { AssessmentModule } from '../AssessmentModule';

describe('AssessmentModule', () => {
  it('renders module questions', () => {
    const module = { questions: [...] };
    render(<AssessmentModule module={module} />);
    expect(screen.getByText('Question 1')).toBeInTheDocument();
  });

  it('handles answer submission', async () => {
    // ...
  });
});
```

#### 4.2 Add E2E Tests with Playwright (2-3 days)
```bash
# Create E2E tests
e2e/assessment-flow.spec.ts
e2e/employer-dashboard.spec.ts
```

#### 4.3 Performance Optimization (1-2 days)
- Implement code splitting for large pages
- Add lazy loading for assessment modules
- Optimize bundle size (current: 844KB → target: <500KB)
- Use React.lazy() for route-based code splitting

---

## Testing Checklist Before Production

- [ ] All ESLint errors fixed
- [ ] All security vulnerabilities patched
- [ ] Unit tests: >=80% coverage
- [ ] E2E tests: Happy path + error flows
- [ ] Accessibility audit (WCAG AA)
  - [ ] Keyboard navigation works
  - [ ] Screen reader compatible
  - [ ] Color contrast verified
  - [ ] Focus indicators visible
- [ ] Cross-browser testing
  - [ ] Chrome/Edge latest
  - [ ] Firefox latest
  - [ ] Safari latest
  - [ ] Mobile browsers (iOS Safari, Chrome Mobile)
- [ ] Performance testing
  - [ ] Lighthouse score >80
  - [ ] First Contentful Paint <2s
  - [ ] Largest Contentful Paint <4s
- [ ] Security review
  - [ ] XSS prevention verified
  - [ ] CSRF tokens present
  - [ ] Input validation working
  - [ ] Authentication flows tested

---

## Backend Endpoints Ready to Use

### Assessment Endpoints
```
POST   /api/v1/assessment/create
PATCH  /api/v1/assessment/:id
GET    /api/v1/assessment/:id
GET    /api/v1/assessment/org/:orgId/list
```

### Analytics Endpoints
```
GET    /api/v1/analytics/dashboard
GET    /api/v1/analytics/assessments
GET    /api/v1/analytics/employees
GET    /api/v1/analytics/risk-summary
GET    /api/v1/analytics/heat-map
```

### Budget Guide Endpoints
```
GET    /api/v1/budget-guide/progress
PATCH  /api/v1/budget-guide/risk-appetite
POST   /api/v1/budget-guide/mitigation
```

---

## Quick Reference: Package Scripts

```bash
# Development
pnpm run dev              # Start dev server

# Build & Deploy
pnpm run build            # Production build
pnpm run preview          # Preview build

# Code Quality
pnpm run lint             # Check linting
pnpm run lint --fix       # Auto-fix issues
pnpm audit fix            # Fix vulnerabilities

# Testing
pnpm run test             # Run all tests
pnpm run test:ui          # Interactive test UI
pnpm run test:coverage    # Coverage report
pnpm exec playwright test # E2E tests
```

---

## Success Criteria

✅ **Before Handoff:**
- [ ] Build passes without warnings
- [ ] 0 ESLint errors
- [ ] 0 security vulnerabilities
- [ ] >=80% test coverage
- [ ] All 3 new features (Assessment, Employer Dashboard, Budget Guide) working
- [ ] WCAG AA compliance verified
- [ ] Performance: Lighthouse >80
- [ ] Deployment to staging successful

---

## Resources

- Backend API docs: `/docs/BACKEND_API_QUICK_REFERENCE.md`
- Architecture guide: `/docs/ARCHITECTURE.md`
- UI tokens reference: `/packages/ui-core/README.md`
- Type definitions: `/packages/types/README.md`
