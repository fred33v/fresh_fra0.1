# MASTER AGENT - Stop FRA Project Orchestration

> **Project:** Stop FRA (Fraud Risk Assessment Platform)
> **Version:** 2.0 | **Date:** January 2026
> **Compliance:** GovS-013, ECCTA 2023, Failure-to-Prevent Fraud

---

## Tag Legend

| Tag | Meaning | Usage |
|-----|---------|-------|
| `[RED]` | **Critical/Blocking** | Must complete before proceeding. Security-sensitive. Production-critical. |
| `[BLUE]` | **Enhancement/Parallel** | Can proceed in parallel. Quality improvements. Non-blocking features. |

---

# ROLES

## 1. System Architect `[RED]`

**Responsibility:** Overall system design, integration patterns, and technical decisions.

| Task | Priority | Status |
|------|----------|--------|
| Define API contracts between frontend/backend | `[RED]` | Complete |
| Design database schema (PostgreSQL) | `[RED]` | Complete |
| Establish security architecture | `[RED]` | Complete |
| Plan scalability strategy | `[BLUE]` | Pending |
| Document integration patterns | `[BLUE]` | Complete |

**Files Owned:**
- `/reports/BACKEND_ARCHITECTURE_STRATEGY.md`
- `/reports/FRONTEND_ARCHITECTURE_STRATEGY.md`
- `/reports/TECHNICAL_REPORT.md`
- `/backend/src/db/schema.ts`

---

## 2. Backend Engineer `[RED]`

**Responsibility:** API development, database operations, business logic.

| Task | Priority | Status |
|------|----------|--------|
| Implement authentication (JWT) | `[RED]` | Complete |
| Build assessment CRUD endpoints | `[RED]` | Complete |
| Implement risk scoring engine | `[RED]` | Complete |
| Create key-pass system | `[RED]` | Complete |
| Integrate Stripe payments | `[RED]` | Pending |
| Build compliance reporting | `[BLUE]` | Complete |
| Implement audit logging | `[BLUE]` | Complete |

**Files Owned:**
- `/backend/src/controllers/`
- `/backend/src/services/`
- `/backend/src/routes/`
- `/backend/src/middleware/`

---

## 3. Frontend Engineer `[RED]`

**Responsibility:** Mobile app UI/UX, state management, user flows.

| Task | Priority | Status |
|------|----------|--------|
| Build authentication screens | `[RED]` | Complete |
| Implement 13 assessment modules | `[RED]` | Complete |
| Create dashboard (Package 3) | `[RED]` | Complete |
| Build signature capture | `[RED]` | Complete |
| Implement offline persistence | `[BLUE]` | Pending |
| Add push notifications | `[BLUE]` | Pending |
| Polish UI/animations | `[BLUE]` | Pending |

**Files Owned:**
- `/mobile-app/app/`
- `/mobile-app/components/`
- `/mobile-app/contexts/`
- `/mobile-app/services/`

---

## 4. QA & Testing Agent `[BLUE]`

**Responsibility:** Test coverage, quality assurance, validation.

| Task | Priority | Status |
|------|----------|--------|
| Unit tests for risk scoring | `[RED]` | Complete |
| Integration tests for auth flow | `[RED]` | Pending |
| E2E tests for assessment flow | `[BLUE]` | Pending |
| Security penetration testing | `[RED]` | Pending |
| Performance testing | `[BLUE]` | Pending |
| Accessibility audit (WCAG 2.1) | `[BLUE]` | Pending |

**Files Owned:**
- `/__tests__/`
- `/__mocks__/`
- `/mobile-app/__tests__/`
- `/reports/TESTING_ARCHITECTURE_STRATEGY.md`

---

## 5. DevOps Agent `[BLUE]`

**Responsibility:** CI/CD, deployment, infrastructure, monitoring.

| Task | Priority | Status |
|------|----------|--------|
| Set up GitHub Actions CI | `[RED]` | Complete |
| Configure staging deployment | `[BLUE]` | Complete |
| Configure production deployment | `[RED]` | Pending |
| Set up database migrations | `[RED]` | Complete |
| Implement monitoring/alerting | `[BLUE]` | Pending |
| Configure error tracking (Sentry) | `[BLUE]` | Pending |

**Files Owned:**
- `/.github/workflows/`
- `/backend/drizzle/`
- `/reports/CI_CD_SETUP_COMPLETE.md`
- `/reports/DEPLOYMENT_READINESS_REPORT.md`

---

## 6. Documentation Agent `[BLUE]`

**Responsibility:** Technical documentation, user guides, API docs.

| Task | Priority | Status |
|------|----------|--------|
| Maintain CLAUDE.MD | `[RED]` | Complete |
| API documentation (OpenAPI) | `[BLUE]` | Pending |
| User guide | `[BLUE]` | Pending |
| Admin guide | `[BLUE]` | Pending |
| Developer onboarding guide | `[BLUE]` | Pending |

**Files Owned:**
- `/reports/CLAUDE.MD`
- `/mobile-app/docs/`
- `/reports/QUICK_START.md`

---

# WORKFLOW

## Phase 1: Foundation `[RED]` - COMPLETE

```
┌─────────────────────────────────────────────────────────────────┐
│  [RED] CRITICAL PATH                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Database Schema ──► 2. Auth System ──► 3. Core API         │
│         │                     │                  │              │
│         ▼                     ▼                  ▼              │
│  ┌──────────┐          ┌──────────┐       ┌──────────┐         │
│  │PostgreSQL│          │   JWT    │       │Assessment│         │
│  │  Schema  │          │  Auth    │       │   CRUD   │         │
│  └──────────┘          └──────────┘       └──────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Phase 2: Features `[RED]` + `[BLUE]` - IN PROGRESS

```
┌─────────────────────────────────────────────────────────────────┐
│  PARALLEL DEVELOPMENT TRACKS                                    │
├────────────────────────────┬────────────────────────────────────┤
│  [RED] CRITICAL            │  [BLUE] ENHANCEMENT                │
├────────────────────────────┼────────────────────────────────────┤
│                            │                                    │
│  Payment Integration       │  Offline Persistence               │
│         │                  │         │                          │
│         ▼                  │         ▼                          │
│  Key-Pass System           │  Push Notifications                │
│         │                  │         │                          │
│         ▼                  │         ▼                          │
│  Risk Scoring Engine       │  Dashboard Analytics               │
│         │                  │         │                          │
│         ▼                  │         ▼                          │
│  Security Hardening        │  UI Polish & Animations            │
│                            │                                    │
└────────────────────────────┴────────────────────────────────────┘
```

## Phase 3: Quality & Deployment `[RED]`

```
┌─────────────────────────────────────────────────────────────────┐
│  DEPLOYMENT PIPELINE                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [RED] Security Audit ──► [RED] Performance Test                │
│              │                        │                         │
│              ▼                        ▼                         │
│     ┌────────────────┐      ┌────────────────┐                 │
│     │ Penetration    │      │   Load Test    │                 │
│     │   Testing      │      │   (1000 users) │                 │
│     └────────────────┘      └────────────────┘                 │
│              │                        │                         │
│              └──────────┬─────────────┘                         │
│                         ▼                                       │
│              [RED] Production Deploy                            │
│                         │                                       │
│                         ▼                                       │
│              ┌────────────────┐                                 │
│              │  App Store +   │                                 │
│              │  Google Play   │                                 │
│              └────────────────┘                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

# TOOLS

## Development Tools

| Tool | Purpose | Tag |
|------|---------|-----|
| **Bun** | Package manager & runtime | `[RED]` |
| **TypeScript** | Type safety | `[RED]` |
| **Expo/React Native** | Mobile development | `[RED]` |
| **PostgreSQL** | Primary database | `[RED]` |
| **Drizzle ORM** | Database operations | `[RED]` |
| **Jest** | Testing framework | `[BLUE]` |
| **ESLint** | Code linting | `[BLUE]` |

## Infrastructure Tools

| Tool | Purpose | Tag |
|------|---------|-----|
| **GitHub Actions** | CI/CD pipeline | `[RED]` |
| **Docker** | Containerization | `[BLUE]` |
| **AWS S3** | File storage (signatures) | `[RED]` |
| **Redis** | Session caching | `[BLUE]` |
| **Sentry** | Error tracking | `[BLUE]` |

## Integration Tools

| Tool | Purpose | Tag |
|------|---------|-----|
| **Stripe** | Payment processing | `[RED]` |
| **n8n** | Workflow automation | `[RED]` |
| **SendGrid/SES** | Email notifications | `[BLUE]` |
| **Expo Push** | Push notifications | `[BLUE]` |

## AI/Automation Tools

| Tool | Purpose | Tag |
|------|---------|-----|
| **Claude Agent SDK** | AI work team | `[RED]` |
| **n8n Workflow** | Report generation | `[RED]` |
| **Risk Scoring Engine** | Automated scoring | `[RED]` |

---

# FOLDER STRUCTURE

```
jan_26/
├── master_agent.md              # THIS FILE - Project orchestration
│
├── mobile-app/                  # [RED] React Native/Expo mobile app
│   ├── app/                     # Expo Router screens (30 screens)
│   ├── components/              # Reusable UI components
│   ├── contexts/                # React Context providers
│   ├── services/                # API service layer
│   ├── types/                   # TypeScript definitions
│   └── __tests__/               # Frontend tests
│
├── backend/                     # [RED] Node.js/Express API
│   ├── src/
│   │   ├── controllers/         # Request handlers
│   │   ├── services/            # Business logic
│   │   ├── routes/              # API routes
│   │   ├── middleware/          # Auth, rate limiting
│   │   ├── db/                  # Database schema & migrations
│   │   └── jobs/                # Background jobs
│   └── drizzle/                 # Migration files
│
├── src/                         # [BLUE] Additional route definitions
│   └── routes/
│
├── workflows/                   # [RED] n8n automation
│   └── FRA_n8n_workflow_v2.json
│
├── docs/                        # Reference documentation
│   ├── reference/               # Government standards, templates
│   ├── training/                # Training materials
│   └── guides/                  # Best practice guides
│
├── reports/                     # [BLUE] Technical reports & status
│   ├── CLAUDE.MD                # Project documentation
│   ├── *_ARCHITECTURE_*.md      # Architecture strategies
│   ├── *_COMPLETE.md            # Phase completion reports
│   └── TECHNICAL_REPORT.md      # Overall technical report
│
├── __tests__/                   # [BLUE] Integration tests
├── __mocks__/                   # Test mocks
│
├── .github/                     # [RED] CI/CD workflows
│   ├── workflows/               # GitHub Actions
│   └── ISSUE_TEMPLATE/          # Issue templates
│
└── .claude/                     # Claude AI agent configurations
    └── agents/                  # Specialized agent definitions
```

---

# EXECUTION COMMANDS

## Development

```bash
# Mobile App
cd mobile-app && bun install && bun run start-web

# Backend
cd backend && bun install && bun run dev

# Run Tests
bun run test
```

## Deployment

```bash
# iOS Build
cd mobile-app && eas build --platform ios

# Android Build
cd mobile-app && eas build --platform android

# Backend Deploy
cd backend && bun run build && bun run start
```

---

# PRIORITY MATRIX

## Immediate `[RED]` - Must Complete

1. **Stripe Payment Integration** - Revenue enablement
2. **Production Security Audit** - Compliance requirement
3. **E2E Testing** - Quality gate for release
4. **Production Deployment Pipeline** - Go-live blocker

## Next Sprint `[BLUE]` - Enhancement

1. Offline data persistence
2. Push notification integration
3. Dashboard analytics improvements
4. UI/UX polish and animations

## Backlog `[BLUE]` - Future

1. Employee dashboard (Package 2/3)
2. Advanced reporting features
3. Multi-language support
4. White-label customization

---

# COMPLIANCE CHECKLIST

| Requirement | Standard | Status | Tag |
|-------------|----------|--------|-----|
| Fraud risk assessment framework | GovS-013 | Complete | `[RED]` |
| Risk scoring methodology | GovS-013 | Complete | `[RED]` |
| Audit trail logging | ECCTA 2023 | Complete | `[RED]` |
| Data retention (6 years) | ECCTA 2023 | Complete | `[RED]` |
| Reasonable procedures defense | FtP Fraud | In Progress | `[RED]` |
| GDPR data handling | GDPR | Complete | `[RED]` |
| Accessibility (WCAG 2.1) | Public Sector | Pending | `[BLUE]` |

---

# AGENT COMMUNICATION PROTOCOL

## Task Assignment Format

```markdown
## Task: [Task Name]
**Assigned To:** [Agent Role]
**Priority:** [RED] or [BLUE]
**Dependencies:** [List of blocking tasks]
**Deliverables:** [Expected outputs]
**Deadline:** [If applicable]
```

## Status Update Format

```markdown
## Status Update: [Task Name]
**Agent:** [Agent Role]
**Status:** Not Started | In Progress | Blocked | Complete
**Progress:** [X]%
**Blockers:** [Any blocking issues]
**Next Steps:** [Planned actions]
```

## Escalation Protocol

1. `[BLUE]` tasks blocked > 2 days → Escalate to System Architect
2. `[RED]` tasks blocked > 4 hours → Immediate team notification
3. Security issues → Immediate escalation to all agents

---

# VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | Jan 2026 | Consolidated repository, master agent orchestration |
| 1.5 | Dec 2025 | Backend complete, CI/CD setup |
| 1.0 | Nov 2025 | Initial pilot release |

---

**Last Updated:** January 17, 2026
**Maintained By:** Master Agent Orchestration System
**Next Review:** January 24, 2026
