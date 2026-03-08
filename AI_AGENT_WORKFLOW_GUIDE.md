# AI Agent Workflow Guide
## Best Practices for Conducting Complete Projects with AI Agents

---

## 1. Project Lifecycle with AI Agents

### Phase 1: Planning & Architecture
**Primary Agent:** `system-architect`

```
User Request → system-architect → Design Document → Review → Approve
```

**Best Practice:**
1. Start every feature with the system-architect agent
2. Get architecture approval before writing code
3. Document decisions in `/docs/architecture/`

**Example Prompt:**
```
"Design a real-time fraud alert system that:
- Monitors transactions in real-time
- Calculates risk scores using multiple factors
- Sends push notifications for high-risk events
- Works offline with sync when online"
```

---

### Phase 2: Implementation
**Primary Agents:** `frontend-engineer`, `backend-architect`

```
Design Doc → frontend-engineer (UI) ─┐
                                     ├→ Integration → Testing
Design Doc → backend-architect (API) ┘
```

**Best Practice:**
1. Split work: frontend and backend can run in parallel
2. Define API contracts first
3. Use TypeScript interfaces as the source of truth

**Parallel Workflow:**
```bash
# Terminal 1: Frontend work
"Implement the FraudAlertCard component following the design spec"

# Terminal 2: Backend work
"Create the API hooks for fetching and acknowledging fraud alerts"
```

---

### Phase 3: Testing & Quality
**Primary Agent:** `qa-testing-agent`

```
Implementation → qa-testing-agent → Tests → Fix Issues → Verify
```

**Best Practice:**
1. Write tests immediately after implementation
2. Aim for 80%+ coverage on critical paths
3. Include accessibility tests for all UI components

**Example Prompt:**
```
"Create comprehensive tests for the FraudAlertCard component including:
- Unit tests for all props and states
- Accessibility tests with axe-core
- Snapshot tests for visual regression
- Integration tests for the acknowledge flow"
```

---

### Phase 4: Documentation
**Primary Agent:** `documentation-agent`

```
Code Complete → documentation-agent → Docs → Review → Publish
```

**Best Practice:**
1. Document as you build, not after
2. Keep README.md updated with each feature
3. Include code examples in component docs

---

### Phase 5: Deployment
**Primary Agent:** `devops-agent`

```
Tests Pass → devops-agent → CI/CD → Preview → Production
```

**Best Practice:**
1. Always deploy to preview/staging first
2. Use feature branches with automatic preview builds
3. Require passing tests before merge

---

## 2. Agent Selection Matrix

| Task Type | Primary Agent | Support Agent |
|-----------|---------------|---------------|
| New feature design | system-architect | - |
| UI component | frontend-engineer | qa-testing-agent |
| API integration | backend-architect | qa-testing-agent |
| Database schema | backend-architect | system-architect |
| Bug fix (UI) | frontend-engineer | qa-testing-agent |
| Bug fix (logic) | backend-architect | qa-testing-agent |
| Performance issue | system-architect | frontend-engineer |
| Security review | backend-architect | qa-testing-agent |
| Setup CI/CD | devops-agent | - |
| Write docs | documentation-agent | - |
| Code review | qa-testing-agent | system-architect |

---

## 3. Effective Prompting Strategies

### Be Specific and Contextual
```
❌ Bad: "Add a button"

✅ Good: "Add a 'Flag as Fraud' button to the TransactionRow component that:
- Appears on hover/long-press
- Shows a confirmation dialog
- Calls the flagTransaction API
- Updates the local state optimistically
- Shows success/error feedback"
```

### Include Constraints
```
✅ "Implement the risk score gauge using:
- React Native's Animated API (no external libs)
- Colors from our theme constants
- Accessibility labels for screen readers
- Smooth animation under 300ms"
```

### Reference Existing Patterns
```
✅ "Create a TransactionFilter component following the same pattern as
AlertFilter in /components/AlertFilter.tsx. Use the same styling approach
and state management pattern."
```

### Ask for Alternatives
```
✅ "Propose 3 different approaches for implementing real-time updates:
1. WebSocket
2. Server-Sent Events
3. Polling

Compare them for our use case: 1000 concurrent users, updates every 5 seconds,
mobile network conditions."
```

---

## 4. Recommended Workflows

### Feature Development Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. PLAN                                                      │
│    └─ system-architect: Design feature architecture          │
├─────────────────────────────────────────────────────────────┤
│ 2. IMPLEMENT (Parallel)                                      │
│    ├─ frontend-engineer: Build UI components                 │
│    └─ backend-architect: Build API/data layer                │
├─────────────────────────────────────────────────────────────┤
│ 3. TEST                                                      │
│    └─ qa-testing-agent: Write and run tests                  │
├─────────────────────────────────────────────────────────────┤
│ 4. DOCUMENT                                                  │
│    └─ documentation-agent: Update docs                       │
├─────────────────────────────────────────────────────────────┤
│ 5. DEPLOY                                                    │
│    └─ devops-agent: Deploy to preview → production           │
└─────────────────────────────────────────────────────────────┘
```

### Bug Fix Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. REPRODUCE                                                 │
│    └─ qa-testing-agent: Write failing test                   │
├─────────────────────────────────────────────────────────────┤
│ 2. INVESTIGATE                                               │
│    └─ frontend/backend-architect: Analyze root cause         │
├─────────────────────────────────────────────────────────────┤
│ 3. FIX                                                       │
│    └─ frontend/backend-architect: Implement fix              │
├─────────────────────────────────────────────────────────────┤
│ 4. VERIFY                                                    │
│    └─ qa-testing-agent: Confirm test passes                  │
└─────────────────────────────────────────────────────────────┘
```

### Code Review Workflow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. ARCHITECTURE REVIEW                                       │
│    └─ system-architect: Review design decisions              │
├─────────────────────────────────────────────────────────────┤
│ 2. CODE QUALITY REVIEW                                       │
│    └─ qa-testing-agent: Review tests and coverage            │
├─────────────────────────────────────────────────────────────┤
│ 3. SECURITY REVIEW                                           │
│    └─ backend-architect: Check for vulnerabilities           │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Project Structure Best Practices

### Recommended Directory Structure

```
project/
├── .claude/
│   ├── agents/              # AI agent definitions
│   │   ├── system-architect.md
│   │   ├── frontend-engineer.md
│   │   ├── backend-architect.md
│   │   ├── qa-testing-agent.md
│   │   ├── devops-agent.md
│   │   └── documentation-agent.md
│   └── settings.json        # Claude Code settings
│
├── docs/
│   ├── architecture/        # Design documents
│   ├── api/                 # API documentation
│   ├── guides/              # User guides
│   └── decisions/           # ADRs (Architecture Decision Records)
│
├── src/                     # Source code
├── tests/                   # Test files
├── .github/workflows/       # CI/CD pipelines
└── CLAUDE.md               # Project context for AI
```

### CLAUDE.md Template

Create a `CLAUDE.md` file in each project root:

```markdown
# Project Name

## Overview
Brief description of the project.

## Tech Stack
- Framework: React Native + Expo
- Language: TypeScript
- State: React Query
- Testing: Jest + RTL

## Key Commands
- `bun install` - Install dependencies
- `bun run start` - Start dev server
- `bun test` - Run tests

## Architecture Notes
- Offline-first data strategy
- Real-time updates via WebSocket
- Secure storage for sensitive data

## Coding Standards
- TypeScript strict mode
- Functional components only
- Custom hooks for shared logic
- Tests required for new features

## Current Focus
- Implementing fraud alert system
- Improving dashboard performance
```

---

## 6. Multi-Agent Collaboration

### Sequential Collaboration
When tasks depend on each other:

```
1. system-architect: "Design the authentication flow"
   ↓ Output: auth-design.md

2. backend-architect: "Implement the auth API based on auth-design.md"
   ↓ Output: auth hooks and services

3. frontend-engineer: "Build login/logout UI using the auth hooks"
   ↓ Output: Auth components

4. qa-testing-agent: "Test the complete auth flow"
```

### Parallel Collaboration
When tasks are independent:

```
┌─ frontend-engineer: "Build TransactionList component"
│
├─ backend-architect: "Create useTransactions hook"
│
└─ documentation-agent: "Document Transaction data model"

All three can run simultaneously!
```

---

## 7. Quality Gates

### Before Merging Any Feature

| Check | Agent | Requirement |
|-------|-------|-------------|
| Architecture approved | system-architect | Design doc reviewed |
| Tests written | qa-testing-agent | 80%+ coverage |
| Tests passing | qa-testing-agent | All green |
| Docs updated | documentation-agent | README current |
| Security reviewed | backend-architect | No vulnerabilities |
| Performance checked | frontend-engineer | No regressions |

### Automated Quality Pipeline

```yaml
# .github/workflows/quality.yml
name: Quality Gates

on: [pull_request]

jobs:
  lint:
    - run: bun run lint

  typecheck:
    - run: bun run typecheck

  test:
    - run: bun test --coverage
    - verify: coverage > 80%

  build:
    - run: bun run build
    - verify: no errors
```

---

## 8. Common Patterns

### Pattern 1: Feature Flag Development

```
1. system-architect: Design feature with flag
2. backend-architect: Implement with feature flag
3. devops-agent: Configure flag in environments
4. qa-testing-agent: Test both flag states
5. Gradual rollout: 10% → 50% → 100%
```

### Pattern 2: Incremental Refactoring

```
1. qa-testing-agent: Write tests for existing code
2. system-architect: Design new architecture
3. frontend/backend: Refactor incrementally
4. qa-testing-agent: Verify tests still pass
5. Repeat until complete
```

### Pattern 3: Performance Optimization

```
1. qa-testing-agent: Establish performance baseline
2. system-architect: Identify bottlenecks
3. frontend-engineer: Implement optimizations
4. qa-testing-agent: Measure improvement
5. Document gains
```

---

## 9. Tips for Success

### Do's ✅

1. **Start with architecture** - Always use system-architect first for new features
2. **Write tests early** - Use qa-testing-agent alongside development
3. **Document continuously** - Keep docs updated with each change
4. **Review with agents** - Use multiple agents for code review
5. **Iterate quickly** - Small PRs, frequent deploys
6. **Maintain CLAUDE.md** - Keep project context current

### Don'ts ❌

1. **Don't skip planning** - Architecture issues are expensive to fix later
2. **Don't ignore tests** - Technical debt accumulates quickly
3. **Don't deploy without preview** - Always test in staging first
4. **Don't work in silos** - Use agents collaboratively
5. **Don't forget security** - Include backend-architect in reviews

---

## 10. Quick Reference Commands

```bash
# Planning a new feature
"@system-architect Design [feature description]"

# Implementing UI
"@frontend-engineer Implement [component] following [design doc]"

# Building API integration
"@backend-architect Create API hooks for [feature]"

# Writing tests
"@qa-testing-agent Write tests for [component/feature]"

# Setting up deployment
"@devops-agent Configure CI/CD for [environment]"

# Creating documentation
"@documentation-agent Document [feature/API/guide]"
```

---

## Summary

The most effective AI agent workflow follows this pattern:

```
PLAN → BUILD → TEST → DOCUMENT → DEPLOY → ITERATE
  ↑                                           |
  └───────────────────────────────────────────┘
```

**Key Success Factors:**
1. Always start with system-architect for new features
2. Run frontend and backend work in parallel when possible
3. Test immediately after implementation
4. Document as you build
5. Deploy frequently with confidence
6. Iterate based on feedback

This approach maximizes the value of AI agents while maintaining code quality and project velocity.
