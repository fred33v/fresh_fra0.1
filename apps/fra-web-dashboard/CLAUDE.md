# Risk Aware - AI Work Team Workspace

## Project Overview

**Risk Aware** is a fraud risk awareness training platform designed for UK government agencies and public sector organizations. The application delivers interactive workshops covering fraud prevention, regulatory compliance, and organizational risk management.

### Target Audience
- Trustees and Board Members
- Executive Leadership
- Budget-Holders and Finance Teams
- Public, Charity, and Private Sector Organizations

### Core Domain: Fraud Risk & Compliance

The platform addresses:
- **Economic Crime and Corporate Transparency Act 2023** - "Failure to prevent fraud" offence
- Internal fraud (expense, payroll, procurement, asset misappropriation)
- External fraud (invoice fraud, CEO fraud, vendor impersonation, cyber fraud)
- Financial statement fraud and grant/funding fraud
- Cyber-enabled fraud (phishing, BEC, ransomware)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Build | Vite |
| Framework | React 18 |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Components | shadcn/ui (Radix primitives) |
| Backend | Hono API (JWT Auth, Neon PostgreSQL, SSE Real-time) |
| State | React Query (@tanstack/react-query) |
| Routing | React Router v6 |
| Charts | Recharts |
| Animation | Framer Motion |
| Forms | React Hook Form + Zod |

---

## Project Structure

```
src/
├── components/          # React components
│   └── ui/             # shadcn/ui components
├── data/               # Static workshop content
│   └── workshopContent.ts
├── hooks/              # Custom React hooks
│   ├── useAuth.tsx     # Authentication context
│   ├── useSession.ts   # Workshop session management
│   └── useWorkshopProgress.ts
├── lib/                # Utility functions & API client
│   └── api.ts          # Backend API client (fetch + SSE)
├── pages/              # Route components
│   ├── Index.tsx       # Landing page
│   ├── Auth.tsx        # Login/Register
│   ├── Dashboard.tsx   # User dashboard
│   ├── Workshop.tsx    # Main workshop experience
│   ├── Resources.tsx   # Educational materials
│   ├── Certificate.tsx # Completion certificates
│   └── ActionPlan.tsx  # Personal action planning
└── types/              # TypeScript definitions
    └── workshop.ts     # Domain types
```

---

## Key Domain Types

```typescript
// User roles
type AppRole = 'admin' | 'facilitator' | 'participant';
type OrgSector = 'public' | 'charity' | 'private';

// Core entities
- Profile: User profile with organization details
- WorkshopSession: Facilitator-led workshop instances
- WorkshopProgress: User progress tracking
- ActionPlan: Post-workshop commitments
- Certificate: Completion certificates
- Poll/PollResponse: Interactive polling
- Question: Q&A during sessions
```

---

## Development Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server (Vite)
npm run build      # Production build
npm run lint       # ESLint check
npm run preview    # Preview production build
```

---

## Environment Configuration

Requires `.env` file with backend API URL:
```
VITE_API_URL=http://localhost:3000
```

---

## AI Team Guidelines

### When Working on This Project

1. **Regulatory Accuracy**: Content relates to UK fraud legislation. Verify regulatory references are current and accurate.

2. **Accessibility**: Government platforms must meet WCAG 2.1 AA standards. Ensure UI changes maintain accessibility.

3. **Security First**: This handles sensitive organizational data. Never introduce vulnerabilities (XSS, injection, etc.).

4. **British English**: Use UK spelling throughout (organisation, colour, defence, etc.).

5. **Professional Tone**: Content should be authoritative but approachable for senior stakeholders.

### Workshop Content Sections

1. Welcome & Introduction
2. Regulatory Landscape (ECCTA 2023)
3. Types of Fraud Risks
4. Defense Strategies
5. Organisational Impact
6. Case Study & Scenarios
7. Action Planning

### Testing Considerations

- Test across user roles (admin, facilitator, participant)
- Test across organization sectors (public, charity, private)
- Verify real-time features (polling, Q&A) work correctly
- Ensure certificate generation is accurate

---

## Related Documentation

- [Hono Framework](https://hono.dev)
- [shadcn/ui](https://ui.shadcn.com)
- [React Query](https://tanstack.com/query)
- [Economic Crime Act 2023](https://www.legislation.gov.uk/ukpga/2023/56)
