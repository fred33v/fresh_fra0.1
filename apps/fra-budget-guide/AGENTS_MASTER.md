# AGENTS MASTER - Stop FRA AI Work Team

> **Location:** `/Users/fredric/Desktop/budg_fra/.claude/agents/`
> **Total Agents:** 10
> **Last Updated:** January 2026

---

## Tag Legend

| Tag | Color | Meaning |
|-----|-------|---------|
| `[RED]` | Critical | Core functionality, security-sensitive, blocking |
| `[BLUE]` | Enhancement | Quality improvements, parallel work, non-blocking |

---

## Agent Registry

### Core Development Agents

| # | Agent | File | Color | Primary Use |
|---|-------|------|-------|-------------|
| 1 | System Architect | `system-architect.md` | `[RED]` | System design, architecture decisions |
| 2 | Backend Architect | `backend-architect.md` | `[BLUE]` | API design, database, server-side |
| 3 | Frontend Engineer | `frontend-engineer.md` | `[RED]` | React Native, UI/UX, mobile |
| 4 | DevOps Agent | `devops-agent.md` | `[BLUE]` | CI/CD, deployment, infrastructure |
| 5 | QA Testing Agent | `qa-testing-agent.md` | `[BLUE]` | Testing, quality assurance |
| 6 | Documentation Agent | `documentation-agent.md` | `[BLUE]` | Technical writing, API docs |

### FRA Specialized Agents

| # | Agent | File | Color | Primary Use |
|---|-------|------|-------|-------------|
| 7 | Compliance Agent | `compliance-agent.md` | `[RED]` | GovS-013, ECCTA, GDPR compliance |
| 8 | Risk Scoring Agent | `risk-scoring-agent.md` | `[BLUE]` | Risk calculations, scoring methodology |
| 9 | Workflow Automation Agent | `workflow-automation-agent.md` | `[BLUE]` | n8n workflows, integrations |
| 10 | Security Auditor Agent | `security-auditor-agent.md` | `[RED]` | Security reviews, vulnerability assessment |

---

## Agent Capabilities Matrix

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                    CAPABILITY                           │
                    ├────────┬────────┬────────┬────────┬────────┬───────────┤
                    │ Design │  Code  │ Review │  Test  │ Deploy │ Compliance│
┌───────────────────┼────────┼────────┼────────┼────────┼────────┼───────────┤
│ System Architect  │   ██   │   ░    │   ██   │   ░    │   ▒    │    ▒      │
├───────────────────┼────────┼────────┼────────┼────────┼────────┼───────────┤
│ Backend Architect │   ██   │   ██   │   ██   │   ▒    │   ░    │    ░      │
├───────────────────┼────────┼────────┼────────┼────────┼────────┼───────────┤
│ Frontend Engineer │   ▒    │   ██   │   ▒    │   ▒    │   ░    │    ░      │
├───────────────────┼────────┼────────┼────────┼────────┼────────┼───────────┤
│ DevOps Agent      │   ▒    │   ▒    │   ▒    │   ▒    │   ██   │    ░      │
├───────────────────┼────────┼────────┼────────┼────────┼────────┼───────────┤
│ QA Testing Agent  │   ░    │   ▒    │   ██   │   ██   │   ░    │    ▒      │
├───────────────────┼────────┼────────┼────────┼────────┼────────┼───────────┤
│ Documentation     │   ░    │   ░    │   ▒    │   ░    │   ░    │    ▒      │
├───────────────────┼────────┼────────┼────────┼────────┼────────┼───────────┤
│ Compliance Agent  │   ▒    │   ░    │   ██   │   ▒    │   ░    │    ██     │
├───────────────────┼────────┼────────┼────────┼────────┼────────┼───────────┤
│ Risk Scoring      │   ▒    │   ▒    │   ▒    │   ▒    │   ░    │    ██     │
├───────────────────┼────────┼────────┼────────┼────────┼────────┼───────────┤
│ Workflow Auto     │   ▒    │   ██   │   ▒    │   ▒    │   ▒    │    ░      │
├───────────────────┼────────┼────────┼────────┼────────┼────────┼───────────┤
│ Security Auditor  │   ▒    │   ▒    │   ██   │   ██   │   ▒    │    ██     │
└───────────────────┴────────┴────────┴────────┴────────┴────────┴───────────┘

██ = Primary    ▒ = Secondary    ░ = Minimal
```

---

## Agent Selection Guide

### By Task Type

| Task | Primary Agent | Secondary Agent |
|------|---------------|-----------------|
| Design new feature | System Architect | Backend/Frontend |
| Implement API endpoint | Backend Architect | Security Auditor |
| Build UI component | Frontend Engineer | QA Testing |
| Set up CI/CD | DevOps Agent | Security Auditor |
| Write tests | QA Testing Agent | Backend/Frontend |
| Create documentation | Documentation Agent | - |
| Compliance check | Compliance Agent | Security Auditor |
| Calculate risk scores | Risk Scoring Agent | Compliance Agent |
| Build n8n workflow | Workflow Automation | Backend Architect |
| Security review | Security Auditor | Compliance Agent |

### By Project Phase

| Phase | Primary Agents | Secondary Agents |
|-------|----------------|------------------|
| **Planning** | System Architect, Compliance | Documentation |
| **Development** | Backend, Frontend, Workflow | DevOps |
| **Testing** | QA Testing, Security Auditor | Compliance |
| **Deployment** | DevOps, Security Auditor | Documentation |
| **Maintenance** | All as needed | - |

---

## Agent Workflows

### Feature Development Flow

```
┌──────────────────┐
│ 1. Requirements  │ ← Compliance Agent (regulatory check)
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 2. Architecture  │ ← System Architect [RED]
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 3. API Design    │ ← Backend Architect [BLUE]
└────────┬─────────┘
         ▼
┌──────────────────────────────────────────┐
│ 4. Implementation (Parallel)              │
│   ├── Backend Architect → API code       │
│   ├── Frontend Engineer → UI code [RED]  │
│   └── Workflow Auto → n8n integration    │
└────────┬─────────────────────────────────┘
         ▼
┌──────────────────┐
│ 5. Testing       │ ← QA Testing Agent [BLUE]
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 6. Security      │ ← Security Auditor [RED]
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 7. Documentation │ ← Documentation Agent [BLUE]
└────────┬─────────┘
         ▼
┌──────────────────┐
│ 8. Deployment    │ ← DevOps Agent [BLUE]
└──────────────────┘
```

### Security Review Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY REVIEW                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Code Submitted]                                           │
│        │                                                    │
│        ▼                                                    │
│  ┌─────────────────┐                                       │
│  │ Security Auditor│ ← OWASP Top 10 Review [RED]           │
│  └────────┬────────┘                                       │
│           │                                                 │
│     ┌─────┴─────┐                                          │
│     ▼           ▼                                          │
│  [PASS]      [FAIL]                                        │
│     │           │                                          │
│     │           ▼                                          │
│     │    ┌─────────────┐                                   │
│     │    │ Remediation │ ← Backend/Frontend fix            │
│     │    └──────┬──────┘                                   │
│     │           │                                          │
│     │           ▼                                          │
│     │    [Re-Review] ──────────────────────┐               │
│     │                                      │               │
│     ▼                                      │               │
│  ┌─────────────────┐                       │               │
│  │ Compliance Agent│ ← Regulatory Check    │               │
│  └────────┬────────┘                       │               │
│           │                                │               │
│           ▼                                │               │
│      [APPROVED] ◄──────────────────────────┘               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Compliance Verification Flow

```
┌─────────────────────────────────────────────────────────────┐
│                 COMPLIANCE VERIFICATION                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────┐   ┌───────────────┐   ┌───────────────┐ │
│  │   GovS-013    │   │  ECCTA 2023   │   │     GDPR      │ │
│  │    Check      │   │    Check      │   │    Check      │ │
│  └───────┬───────┘   └───────┬───────┘   └───────┬───────┘ │
│          │                   │                   │          │
│          └───────────────────┼───────────────────┘          │
│                              ▼                              │
│                    ┌─────────────────┐                      │
│                    │ Compliance Agent│ [RED]                │
│                    │   Aggregation   │                      │
│                    └────────┬────────┘                      │
│                             │                               │
│                    ┌────────┴────────┐                      │
│                    ▼                 ▼                      │
│              [COMPLIANT]      [GAPS FOUND]                  │
│                    │                 │                      │
│                    │                 ▼                      │
│                    │          ┌─────────────┐               │
│                    │          │ Remediation │               │
│                    │          │    Plan     │               │
│                    │          └──────┬──────┘               │
│                    │                 │                      │
│                    ▼                 ▼                      │
│              [CERTIFICATION READY]                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Agent Communication Protocol

### Task Assignment

```markdown
@agent-name

## Task: [Brief Title]

**Priority:** [RED] or [BLUE]
**Context:** [Background information]
**Requirements:**
1. [Requirement 1]
2. [Requirement 2]

**Expected Output:**
- [Deliverable 1]
- [Deliverable 2]

**Dependencies:** [Other agents/tasks this depends on]
```

### Status Updates

```markdown
## Status: [Task Title]

**Agent:** [agent-name]
**Progress:** [X]%
**Status:** In Progress | Blocked | Complete

**Completed:**
- [x] Item 1
- [x] Item 2

**Remaining:**
- [ ] Item 3

**Blockers:** [If any]
**Next Steps:** [Planned actions]
```

### Handoff Protocol

```markdown
## Handoff: [From Agent] → [To Agent]

**Task:** [What's being handed off]
**Status:** [Current state]

**Completed Work:**
- [Summary of completed items]

**Files Modified:**
- `/path/to/file1.ts`
- `/path/to/file2.ts`

**Notes for Next Agent:**
- [Important context]
- [Decisions made]
- [Open questions]

**Acceptance Criteria:**
- [What the receiving agent should verify]
```

---

## Quick Reference

### Invoke Agent (Claude Code)

```
Use the [agent-name] agent to [task description].
```

### Agent Files Location

```
/Users/fredric/Desktop/budg_fra/.claude/agents/
├── system-architect.md        # System design
├── backend-architect.md       # API/Database
├── frontend-engineer.md       # React Native/UI
├── devops-agent.md           # CI/CD/Deploy
├── qa-testing-agent.md       # Testing/QA
├── documentation-agent.md    # Tech writing
├── compliance-agent.md       # Regulatory [NEW]
├── risk-scoring-agent.md     # Risk calc [NEW]
├── workflow-automation-agent.md # n8n [NEW]
└── security-auditor-agent.md # Security [NEW]
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | Jan 2026 | Added 4 FRA-specialized agents |
| 1.0 | Dec 2025 | Initial 6 core agents |

---

**Maintained By:** Stop FRA Development Team
**Next Review:** February 2026
