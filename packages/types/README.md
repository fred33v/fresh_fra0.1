# @stopfra/types

Shared TypeScript type definitions for the Stop FRA fraud risk assessment platform.

## Installation

```bash
npm install @stopfra/types
# or
yarn add @stopfra/types
# or
pnpm add @stopfra/types
```

## Features

- 📋 **Assessment Types** - Complete fraud risk assessment data structures with 13 modules
- 👥 **User & Organization Types** - User roles, organizations, key-passes, authentication
- 💳 **Payment Types** - Purchase records, payment intents, packages
- 🎓 **Workshop Types** - Live training sessions, participants, real-time events (SSE)
- 📚 **Budget Guide Types** - Self-guided risk assessment workflow, action plans
- 📊 **Risk Scoring Types** - Risk levels, control strength, risk registers
- 🔐 **Auth Types** - Login credentials, JWT payloads, auth responses

## Type Exports

### Core Assessment

```typescript
import {
  Assessment,
  AssessmentStatus,
  AssessmentModule,
  RiskLevel,
  ControlStrength,
  RiskRegisterItem,
  AssessmentProgress,
} from '@stopfra/types/assessment';
```

### Authentication

```typescript
import {
  User,
  UserRole,
  Organisation,
  OrgSector,
  OrgSize,
  KeyPass,
  LoginCredentials,
  AuthResponse,
  SignupRequest,
  PasswordResetRequest,
} from '@stopfra/types/auth';
```

### Payments & Packages

```typescript
import {
  Package,
  Purchase,
  PaymentIntent,
} from '@stopfra/types/api';
```

### Workshop (Real-time Training)

```typescript
import {
  WorkshopSession,
  SessionParticipant,
  WorkshopSSEEvent,
  SessionCode,
} from '@stopfra/types/workshop';
```

### Budget Guide (Guided Risk Assessment)

```typescript
import {
  BudgetGuideProgress,
  BudgetGuideRiskAppetite,
  BudgetGuideMitigationStrategy,
} from '@stopfra/types/budget-guide';
```

### API Responses

```typescript
import {
  ApiResponse,
  ApiError,
  ApiMeta,
  PaginationParams,
  ApiRequestOptions,
} from '@stopfra/types/api';
```

## Module Types Reference

### 13 Assessment Modules

| Module | Type | Key Fields |
|--------|------|-----------|
| 1 | Risk Appetite | risk tolerance (1-5 scale) |
| 2 | Fraud Triangle | pressure, opportunity, rationalization |
| 3 | People & Culture | fraud awareness frequency, whistleblowing |
| 4 | Controls & Technology | segregation of duties, access controls |
| 5 | Procurement | supplier due diligence, spend tracking (£) |
| 6 | Payroll & HR | employee count, changes detection |
| 7 | Revenue | monthly volume (£), unpaid invoices % |
| 8 | Cash & Banking | daily cash volume (£), bank accounts |
| 9 | IT Systems | cybersecurity maturity, incidents |
| 10 | Monitoring & Evaluation | incident detection, internal audit |
| 11 | Fraud Response | response plan, communication protocol |
| 12 | Training & Awareness | completion %, staff count |
| 13 | Compliance Mapping | GovS-013, ECCTA-2023, FTP alignment |

## Common Patterns

### Risk Scoring

```typescript
import { type Assessment, RiskLevel, ControlStrength } from '@stopfra/types';

// Assessments have overall risk levels
const assessment: Assessment = {
  id: 'a-123',
  organisationId: 'org-123',
  userId: 'user-123',
  packageId: 1,
  status: 'completed',
  overallRiskLevel: 'MEDIUM', // HIGH | MEDIUM | LOW
  overallRiskScore: 12,
  startedAt: '2026-03-08T00:00:00Z',
  completedAt: '2026-03-08T02:00:00Z',
  createdAt: '2026-03-08T00:00:00Z',
  updatedAt: '2026-03-08T02:00:00Z',
};
```

### Module Completion Tracking

```typescript
import { type AssessmentProgress } from '@stopfra/types';

const progress: AssessmentProgress = {
  assessmentId: 'a-123',
  completedModules: ['risk-appetite', 'fraud-triangle', 'procurement'],
  currentModule: 'payroll-hr',
  percentComplete: 31, // 4 of 13 modules
};
```

### Workshop Sessions (Package 2+)

```typescript
import { type WorkshopSession, type WorkshopSSEEvent } from '@stopfra/types/workshop';

// Facilitator creates a session
const session: WorkshopSession = {
  id: 'ws-123',
  sessionCode: 'ABC123', // Share with participants
  title: 'Fraud Awareness Training',
  organisationId: 'org-123',
  facilitatorId: 'user-456',
  currentSlide: 2,
  totalSlides: 7,
  isActive: true,
  startedAt: '2026-03-08T10:00:00Z',
  participantCount: 12,
  createdAt: '2026-03-08T09:00:00Z',
  updatedAt: '2026-03-08T10:15:00Z',
};

// Real-time updates streamed via SSE
const event: WorkshopSSEEvent = {
  event: 'slide_changed',
  timestamp: '2026-03-08T10:15:00Z',
  data: { slide: 3, title: 'Types of Fraud Risks' },
};
```

### Budget Guide (Package 2+)

```typescript
import {
  type BudgetGuideProgress,
  type BudgetGuideRiskAppetite,
  type BudgetGuideMitigationStrategy,
} from '@stopfra/types/budget-guide';

// User progresses through screens
const progress: BudgetGuideProgress = {
  id: 'bgp-123',
  userId: 'user-123',
  organisationId: 'org-123',
  currentScreen: 5,
  totalScreens: 10,
  completionPercentage: 50,
  isCompleted: false,
  startedAt: '2026-03-08T00:00:00Z',
  lastActivityAt: '2026-03-08T01:00:00Z',
};

// Risk appetite assessment
const appetite: BudgetGuideRiskAppetite = {
  id: 'bgra-123',
  userId: 'user-123',
  progressId: 'bgp-123',
  overallRiskTolerance: 3, // 1-5 scale
  fraudImpactTolerance: 2,
  reputationRiskTolerance: 4,
  financialLossTolerance: 3,
  riskProfile: 'moderate', // conservative | moderate | aggressive
  assessedAt: '2026-03-08T00:00:00Z',
};

// Action plan with timelines
const strategy: BudgetGuideMitigationStrategy = {
  id: 'bgms-123',
  userId: 'user-123',
  progressId: 'bgp-123',
  immediateActions: [
    'Review vendor controls',
    'Implement segregation of duties',
  ],
  thirtyDayActions: [
    'Deploy monitoring system',
    'Train staff on fraud awareness',
  ],
  ninetyDayActions: [
    'Complete security audit',
    'Establish fraud response team',
  ],
  ownerName: 'John Doe',
  ownerEmail: 'john@company.com',
  createdAt: '2026-03-08T00:00:00Z',
  updatedAt: '2026-03-08T00:00:00Z',
};
```

## Development

```bash
# Install dependencies
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint

# Type check
pnpm typecheck

# Watch mode
pnpm dev
```

## Type Safety

All types are compiled to support both TypeScript and JavaScript projects:
- Full type definitions in TypeScript
- JSDoc comments for IDE autocomplete in JavaScript
- Strict null checking enabled
- No implicit any

## Package Structure

```
packages/types/
├── src/
│   ├── index.ts           # Main export
│   ├── assessment.ts      # Assessment types (13 modules)
│   ├── auth.ts           # User & auth types
│   ├── api.ts            # API & payment types
│   ├── workshop.ts       # Workshop session types
│   ├── budget-guide.ts   # Budget guide types
│   └── __tests__/        # Type tests
├── dist/                 # Compiled JavaScript & declarations
├── tsconfig.json
├── vitest.config.ts
├── package.json
└── README.md
```

## Related Packages

- [@stopfra/shared](../shared) - Utility functions, logger, API service
- [@stopfra/ui-core](../ui-core) - UI design tokens and accessibility

## License

MIT

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.
