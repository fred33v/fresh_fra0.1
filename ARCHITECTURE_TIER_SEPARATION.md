# START FRA Platform Architecture - Module Separation

**Date:** March 7, 2026  
**Clarity:** Workshop Sessions and Budget Guide are INCLUDED in Package 2 and Package 3

---

## Platform Structure

```
START FRA BACKEND PLATFORM
│
├── TIER 1: CORE FRAUD ASSESSMENT PRODUCT (Packaged Products)
│   │
│   ├── Package 1: BASIC (£799)
│   │   ├── Fraud Risk Assessment
│   │   ├── 1 Key-pass Allowance
│   │   ├── Basic Risk Report
│   │   ├── PDF Export
│   │   ├── ❌ NO Workshop Sessions Access
│   │   └── ❌ NO Budget Guide Access
│   │
│   ├── Package 2: TRAINING (£1799)
│   │   ├── Everything in Basic +
│   │   ├── 10 Employee Key-passes
│   │   ├── Training Module Access (Basic)
│   │   ├── Compliance Certificate
│   │   ├── ✅ WORKSHOP SESSIONS ACCESS
│   │   └── ✅ BUDGET GUIDE ACCESS
│   │
│   └── Package 3: FULL (£4999)
│       ├── Everything in Training +
│       ├── 50 Employee Key-passes
│       ├── Priority Support
│       ├── Custom Action Plans
│       ├── Annual Review
│       ├── ✅ WORKSHOP SESSIONS ACCESS
│       └── ✅ BUDGET GUIDE ACCESS
│
├── TIER 2: INDEPENDENT SERVICE MODULES (Standalone)
│   │
│   ├── Workshop Sessions
│   │   ├── Real-time training delivery
│   │   ├── Facilitator-led sessions
│   │   ├── Live participant interaction
│   │   ├── SSE streaming for updates
│   │   └── Session codes for joining
│   │
│   ├── Budget Guide
│   │   ├── Self-guided risk assessment
│   │   ├── Multi-screen workflow
│   │   ├── Progress tracking
│   │   ├── Role selection
│   │   └── Risk appetite assessment
│   │
│   └── Storage (S3)
│       ├── File uploads/downloads
│       ├── Presigned URLs
│       └── Secure file handling
│
└── TIER 3: INFRASTRUCTURE (Cross-cutting)
    ├── Authentication (JWT tokens)
    ├── Authorization (Role-based)
    ├── Audit Logging (6-year retention)
    ├── Rate Limiting
    ├── Security Headers
    └── Error Handling
```

---

## API Routing Structure

### Core Platform Routes (`/api/v1`)

**Package-Related Endpoints:**
```
POST   /auth/signup              → Create user + organization
POST   /auth/login               → Authenticate
GET    /packages                 → List Packages 1, 2, 3
POST   /purchases                → Purchase a package
POST   /assessments              → Create risk assessment
PATCH  /assessments/:id          → Update assessment answers
POST   /assessments/:id/submit   → Submit for analysis
POST   /keypasses/generate       → Generate key-passes
POST   /reports/generate         → Generate risk report
```

### Independent Service Routes (`/api/v1`) - INCLUDED in Package 2 & 3

**Workshop Sessions (Package 2+ feature):**
```
POST   /workshop/sessions        → Create training session
GET    /workshop/sessions/:code  → Join by code
GET    /workshop/sessions/:id/sse → Subscribe to live updates
POST   /workshop/sessions/:id/slide-changed/next → Progress slides
```

**Budget Guide (Package 2+ feature):**
```
GET    /budget-guide/progress    → Track progress
PATCH  /budget-guide/progress    → Update progress
POST   /budget-guide/risk-appetite → Risk assessment
```

---

## Feature Matrix: What's Available Where?

| Feature | Package 1 | Package 2 | Package 3 | Status |
|---------|-----------|-----------|-----------|--------|
| Risk Assessment | ✅ | ✅ | ✅ | All packages |
| Risk Report | ✅ | ✅ | ✅ | All packages |
| PDF Export | ✅ | ✅ | ✅ | All packages |
| Key-passes | 1 | 10 | 50 | Tier-based |
| **Workshop Sessions** | ❌ | ✅ INCLUDED | ✅ INCLUDED | Pkg 2+ feature |
| **Budget Guide** | ❌ | ✅ INCLUDED | ✅ INCLUDED | Pkg 2+ feature |
| Live Participant SSE | ❌ | ✅ INCLUDED | ✅ INCLUDED | Pkg 2+ feature |
| Priority Support | ❌ | ❌ | ✅ INCLUDED | Pkg 3 feature |
| Custom Action Plan | ❌ | ❌ | ✅ INCLUDED | Pkg 3 feature |
| Annual Review | ❌ | ❌ | ✅ INCLUDED | Pkg 3 feature |

---

## User Journeys by Product

### Package 1 User Flow (Basic - £799)
```
1. Sign up (Auth)
2. Purchase Package 1 (Payments)
3. Receive 1 key-pass (Key-passes)
4. Create assessment (Assessments)
5. Complete assessment
6. Generate basic risk report (Reports)
7. Export as PDF
8. ❌ NO access to Workshop Sessions
9. ❌ NO access to Budget Guide
10. Can upgrade to Package 2 or 3 for full features
```

### Package 2 User Flow (Training - £1799)
```
1. Sign up (Auth)
2. Purchase Package 2 (Payments)
3. Receive 10 key-passes (Key-passes)
4. Share key-passes with employees
5. Employees create assessments (Assessments)
6. ✅ Conduct Live Workshop Sessions (NOW INCLUDED in Package 2)
7. ✅ Employees use Budget Guide (NOW INCLUDED in Package 2)
8. Generate compliance certificate (Reports)
9. Can upgrade to Package 3 for priority support
```

### Package 3 User Flow (Full - £4999)
```
1. Sign up (Auth)
2. Purchase Package 3 (Payments)
3. Receive 50 key-passes (Key-passes)
4. ✅ Conduct Live Workshop Sessions (NOW INCLUDED in Package 3)
5. ✅ Have Employees use Budget Guide (NOW INCLUDED in Package 3)
6. Generate full risk report with action plans (Reports)
7. Request annual review support (Support - external)
```

### Workshop Sessions Feature (Included in Package 2 & 3)
```
1. Facilitator creates session (Workshop)
2. Gets session code (e.g., "ABC123")
3. Shares code with participants
4. Participants join via code
5. Facilitator presents slides
6. Real-time SSE updates to all participants
7. Session completes
(Included in Package 2 [£1799] and Package 3 [£4999])
```

### Budget Guide Feature (Included in Package 2 & 3)
```
1. Employee starts Budget Guide
2. Progresses through risk assessment screens (Budget Guide)
3. Tracks progress and selections
4. Assesses risk appetite
5. Completes self-guided workflow
(Included in Package 2 [£1799] and Package 3 [£4999])
```

---

## Database Schema Organization

### Core Platform Schema
```
Tier 1: Users & Orgs
├── users
├── organisations
└── organisations:password_reset_tokens

Tier 1: Assessments
├── assessments
└── assessment_answers

Tier 1: Key-passes
├── keypasses
└── keypass_usage

Tier 1: Payments
├── packages
├── purchases
└── payment_intents

Tier 1: Analytics
└── (computed from assessments + keypasses + purchases)

Infrastructure
├── audit_logs (all events)
└── refresh_tokens (Redis, not in DB)
```

### Independent Services Schema
```
Tier 2: Workshop
├── workshop_profiles
├── workshop_roles
├── workshop_sessions
└── session_participants

Tier 2: Budget Guide
├── budget_guide_progress
├── budget_guide_risk_appetite
└── budget_guide_mitigation_strategy

Tier 2: Storage
└── (AWS S3, not in database)
```

---

## Deployment Independence

### Core Platform (Tier 1) Can Run Standalone
- Provides: Assessment, reporting, key-pass management, payment processing
- Requires: PostgreSQL, Redis
- Does NOT require: Workshop, Budget Guide modules

### Workshop (Tier 2) Can Run Standalone
- Provides: Training session management, real-time streaming
- Requires: PostgreSQL, Redis, SSE support
- Does NOT require: Payment, assessment, key-pass modules

### Budget Guide (Tier 2) Can Run Standalone
- Provides: Guided self-assessment workflow
- Requires: PostgreSQL
- Does NOT require: Payment, workshop, key-pass modules

---

## Pricing & Packaging

### Payment Tiers (Tied to Core Platform)
```
Package 1 (Basic)
├── Price: £799
├── Key-passes: 0
├── Report Type: None
└── Support: None - upgrade required

Package 2 (Training)
├── Price: £1799
├── Key-passes: 10
├── Report Type: Risk Report + Certificate
└── Support: Email support + Training module access

Package 3 (Full)
├── Price: £4999
├── Key-passes: 50
├── Report Type: Risk Report + Action Plan
└── Support: Priority support + Annual review
```

### Independent Services (Not Packaged)
```
Workshop Sessions
├── Price: Included with Package 2+
├── Cost for Package 1: Additional fee (TBD)
└── Standalone: Must be purchased separately

Budget Guide
├── Price: Free for all users
├── Availability: All packages
└── Note: Supplementary self-assessment tool
```

---

## API Endpoint Count Breakdown

| Component | Endpoints | Package Specific | Independent |
|-----------|-----------|-----------------|-------------|
| Auth | 8 | — | Infrastructure |
| Assessments | 6 | ✅ Core | — |
| Key-passes | 11 | ✅ Core | — |
| Payments | 8 | ✅ Core | — |
| Analytics | 6 | ✅ Core | — |
| Workshop | 12+ | — | ✅ Standalone |
| Budget Guide | 6+ | — | ✅ Standalone |
| Storage (S3) | 3+ | — | ✅ Standalone |
| **TOTAL** | **60+** | **39** | **21+** |

---

## Key Points for Development Teams

✅ **Workshop Sessions (Tier 2)**
- Completely independent from frauda assessment packages
- Can be updated/deployed separately
- Does not affect Package 1, 2, 3 functionality
- Requires own database tables (workshops, participants, roles)
- Uses own API routes (/api/v1/workshop)

✅ **Budget Guide (Tier 2)**
- Completely independent from fraud assessment packages
- Can be updated/deployed separately
- Does not affect Package 1, 2, 3 functionality
- Requires own database tables (budget_guide_progress, risk_appetite, etc.)
- Uses own API routes (/api/v1/budget-guide)
- Free/available to all users

✅ **Core Packages (Tier 1)**
- Tightly coupled: Auth → Assessments → Key-passes → Payments
- Share common user & organization context
- Separate from Workshop & Budget Guide
- Package-2+ includes Workshop access
- Package-2+ includes Budget Guide access

---

## Summary

| Aspect | Core Packages (1-3) | Workshop | Budget Guide |
|--------|-------------------|----------|--------------|
| **Pricing** | ✅ Paid/Free tiers | Included in Pkg-2+ | Free |
| **Database** | Shared (assessments, key-passes) | Isolated | Isolated |
| **API Routes** | /api/v1/auth, /assessments, etc. | /api/v1/workshop | /api/v1/budget-guide |
| **Deployment** | Core product | Optional add-on | Optional add-on |
| **Can disable?** | No | Yes | Yes |
| **Independent?** | No (core) | Yes | Yes |
| **Tied to Package?** | Yes | No | No |

---

**Document Purpose:** Clarify that Workshop Sessions and Budget Guide are TIER 2 INDEPENDENT services, NOT part of Package 1  
**Clarity Level:** High - All separation points clearly marked  
**Audience:** Backend team, frontend team, DevOps, Product managers
