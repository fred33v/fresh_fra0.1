# Start FRA - Fraud Risk Assessment Platform

## Unified Project Repository

This repository consolidates all fraud risk assessment and prevention projects into a single organized structure.

---

## Directory Structure

```
start_fra/
├── README.md                          # This file
├── AI_AGENT_WORKFLOW_GUIDE.md         # Best practices for AI agents
│
├── .claude/
│   └── agents/                        # Shared AI agent definitions
│       ├── system-architect.md
│       ├── frontend-engineer.md
│       ├── backend-architect.md
│       ├── qa-testing-agent.md
│       ├── devops-agent.md
│       └── documentation-agent.md
│
├── apps/                              # Application codebases
│   ├── fra_desk/                      # Fraud Prevention Dashboard (React Native/Expo)
│   ├── risk_awe_gov/                  # Risk Aware Training Platform (React/Vite)
│   ├── stop_fra_repo_clas/            # Stop FRA Main Repository
│   ├── rork-fraud-risk-workshop/      # Fraud Risk Workshop App
│   ├── jan_26/                        # January 26 Release Version
│   ├── stop_fra/                      # Stop FRA Development
│   └── fraud-risk-app-main/           # Fraud Risk App Main
│
├── docs/
│   └── markdown/                      # Markdown documentation
│       ├── Compliance guides
│       ├── Technical specifications
│       ├── Agent definitions
│       └── Project reports
│
└── reference/
    └── pdf_documents/                 # Reference PDF documents
        ├── GovS-013 Standards
        ├── ECCTA 2023 Guidance
        ├── Fraud Risk Management Guides
        └── Training Materials
```

---

## Applications Overview

| App | Type | Framework | Purpose |
|-----|------|-----------|---------|
| `fra_desk` | Mobile | React Native/Expo | Fraud Prevention Dashboard |
| `risk_awe_gov` | Web | React/Vite | Risk Awareness Training |
| `stop_fra_repo_clas` | Mobile | React Native/Expo | Main FRA Platform |
| `rork-fraud-risk-workshop` | Mobile | React Native/Expo | Workshop Training App |
| `jan_26` | Mobile | React Native/Expo | Release Version |
| `stop_fra` | Mobile | React Native/Expo | Development Version |
| `fraud-risk-app-main` | Mobile | React Native/Expo | Production App |

---

## Quick Start

### 1. Choose Your App

```bash
cd apps/<app-name>
```

### 2. Install Dependencies

```bash
bun install
# or
npm install
```

### 3. Start Development Server

**For React Native/Expo apps:**
```bash
bun run start        # Start Expo dev server
bun run start-web    # Start web preview
```

**For React/Vite web apps:**
```bash
bun run dev          # Start Vite dev server
```

---

## AI Agent Workflow

Each app includes AI agents for development assistance. See `AI_AGENT_WORKFLOW_GUIDE.md` for best practices.

### Available Agents

| Agent | Purpose |
|-------|---------|
| `system-architect` | Architecture design & planning |
| `frontend-engineer` | UI/UX implementation |
| `backend-architect` | API & database development |
| `qa-testing-agent` | Testing & quality assurance |
| `devops-agent` | CI/CD & deployment |
| `documentation-agent` | Technical documentation |

### Workflow Pattern

```
PLAN → BUILD → TEST → DOCUMENT → DEPLOY
  │       │       │        │         │
  ↓       ↓       ↓        ↓         ↓
system  frontend  qa    documentation devops
architect backend  testing   agent      agent
```

---

## Compliance Standards

This platform addresses:

- **GovS-013** - UK Government Functional Standard for Counter-Fraud
- **ECCTA 2023** - Economic Crime and Corporate Transparency Act
- **GDPR** - Data protection compliance
- **WCAG 2.1 AA** - Accessibility standards

---

## Technology Stack

### Mobile Apps (React Native/Expo)
- React Native 0.74+
- Expo SDK 51+
- Expo Router (file-based routing)
- TypeScript
- React Query
- Lucide Icons

### Web Apps (React/Vite)
- React 18
- Vite
- TypeScript
- Tailwind CSS
- shadcn/ui
- Supabase

### Backend Services
- PostgreSQL
- Supabase (Auth, Database, Real-time)
- n8n (Workflow automation)
- Stripe (Payments)

---

## Development Commands

### Common Commands

```bash
# Install dependencies
bun install

# Start development
bun run start       # Expo
bun run dev         # Vite

# Build for production
bun run build

# Run tests
bun test

# Lint code
bun run lint

# Type check
bun run typecheck
```

### Expo/EAS Commands

```bash
# Build for platforms
eas build --platform ios
eas build --platform android

# Submit to stores
eas submit --platform ios
eas submit --platform android

# OTA updates
eas update --branch production
```

---

## Documentation

| Document | Location |
|----------|----------|
| AI Workflow Guide | `./AI_AGENT_WORKFLOW_GUIDE.md` |
| Markdown Docs | `./docs/markdown/` |
| PDF References | `./reference/pdf_documents/` |
| App-specific docs | `./apps/<app>/docs/` |

---

## Contributing

1. Choose the appropriate app directory
2. Create a feature branch
3. Follow the AI Agent Workflow Guide
4. Submit a pull request

---

## License

[TBD]

---

**Last Updated:** January 2026
**Maintained By:** FRA Development Team
