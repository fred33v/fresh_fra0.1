# Stop FRA Platform Architecture

## Overview

The Stop FRA platform uses a **hybrid backend architecture** with intentional separation between web and mobile backends.

## Backend Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND APPS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────────────────────┐    │
│  │ fra-web-dashboard│    │ Mobile Apps                     │    │
│  │ (Vite + React)  │    │ - fra-mobile-app                │    │
│  │                 │    │ - fra-training-app              │    │
│  │                 │    │ - fra-budget-guide              │    │
│  └────────┬────────┘    └────────────────┬────────────────┘    │
│           │                              │                      │
└───────────┼──────────────────────────────┼──────────────────────┘
            │                              │
            ▼                              ▼
┌─────────────────────┐        ┌─────────────────────┐
│     SUPABASE        │        │    FRA-BACKEND      │
│  (Web Dashboard)    │        │   (Mobile Apps)     │
├─────────────────────┤        ├─────────────────────┤
│ • Auth              │        │ • Hono API          │
│ • PostgreSQL        │        │ • PostgreSQL        │
│ • Real-time         │        │ • Drizzle ORM       │
│ • Storage           │        │ • JWT Auth          │
│ • Edge Functions    │        │ • Stripe            │
└─────────────────────┘        │ • S3 Storage        │
                               │ • Redis Cache       │
                               └─────────────────────┘
```

## Why Separate Backends?

### fra-web-dashboard + Supabase

| Benefit | Description |
|---------|-------------|
| **Rapid Development** | Supabase provides auth, database, and real-time out of the box |
| **Facilitator Features** | Real-time polling, Q&A during live workshops |
| **Admin Dashboard** | Quick iteration on admin/facilitator features |
| **Serverless** | No infrastructure to manage |

**Use Cases:**
- Live workshop facilitation
- Real-time participant polling
- Certificate generation
- Admin analytics dashboard

### Mobile Apps + fra-backend

| Benefit | Description |
|---------|-------------|
| **Offline Support** | Custom sync logic for offline assessments |
| **Key-Pass System** | Complex business logic for employer/employee model |
| **Payment Processing** | Stripe integration for package purchases |
| **Report Generation** | n8n workflow integration |
| **Compliance** | Full audit logging and data retention |

**Use Cases:**
- Employer registration and package purchase
- Employee key-pass assessments
- Fraud risk scoring engine
- PDF report generation
- GovS-013 compliance tracking

## Data Synchronization

For shared data (e.g., organisations, users), consider:

1. **Event-Driven Sync** - Webhooks between systems
2. **Scheduled Sync** - Nightly batch synchronization
3. **Read Replicas** - Supabase reads from fra-backend PostgreSQL

### Shared Data Model

```
┌──────────────────┐
│  @stopfra/types  │  ← Shared TypeScript types
└────────┬─────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
Supabase   fra-backend
 Schema      Schema
```

Both backends should implement compatible schemas for:
- `users` - User accounts
- `organisations` - Company profiles
- `assessments` - Assessment records (sync on completion)

## Technology Stack Summary

### Web Dashboard (fra-web-dashboard)

```
Build:      Vite 5
Framework:  React 18
Routing:    React Router DOM 6
Styling:    Tailwind CSS 3
Components: shadcn/ui (Radix)
State:      React Query
Backend:    Supabase
Charts:     Recharts
Animation:  Framer Motion
Forms:      React Hook Form + Zod
```

### Mobile Apps

```
Runtime:    Expo 54
Framework:  React Native 0.81 + React 19
Routing:    Expo Router 6
Styling:    StyleSheet
Icons:      Lucide React Native
State:      Zustand + React Query
Charts:     Victory Native
```

### Backend API (fra-backend)

```
Runtime:    Node.js 20+ / Bun
Framework:  Hono
Database:   PostgreSQL + Drizzle ORM
Auth:       JWT (jsonwebtoken)
Payments:   Stripe
Storage:    AWS S3
Cache:      Redis (ioredis)
Validation: Zod
Logging:    Pino
```

## Environment Configuration

### Web Dashboard (.env)

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

### Mobile Apps (.env)

```env
API_URL=https://api.stopfra.com
```

### Backend (.env)

```env
DATABASE_URL=postgresql://...
JWT_SECRET=...
STRIPE_SECRET_KEY=sk_...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=...
REDIS_URL=redis://...
```

## Future Considerations

1. **API Gateway** - Unified entry point for all clients
2. **GraphQL Federation** - Combine Supabase and fra-backend
3. **Shared Auth** - Single sign-on across platforms
4. **Data Lake** - Centralized analytics and reporting

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| Jan 2026 | Keep separate backends | Different use cases, faster iteration |
| Jan 2026 | Shared types package | Type safety across all apps |
| Jan 2026 | Bun workspaces | Unified dependency management |

---

**Last Updated:** January 2026
