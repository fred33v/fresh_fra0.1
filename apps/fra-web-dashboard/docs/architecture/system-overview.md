# System Architecture Overview

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client (Browser)                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    React Application                      │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │   │
│  │  │  Pages   │  │Components│  │  Hooks   │  │  State  │ │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Supabase                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │     Auth     │  │   Database   │  │      Real-time       │  │
│  │              │  │  (Postgres)  │  │   (Subscriptions)    │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐                            │
│  │   Storage    │  │  Edge Funcs  │                            │
│  │   (Files)    │  │  (Optional)  │                            │
│  └──────────────┘  └──────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Authentication Flow

```
User → Auth Page → Supabase Auth → JWT Token → AuthContext → Protected Routes
```

### Workshop Flow

```
1. User joins session (via code or self-paced)
2. Progress tracked in WorkshopProgress table
3. Real-time sync for facilitated sessions
4. Quiz scores and scenario choices recorded
5. Action plan generated on completion
6. Certificate issued
```

## Key Components

### Frontend Layers

| Layer | Purpose | Location |
|-------|---------|----------|
| Pages | Route-level components | `/src/pages/` |
| Components | Reusable UI elements | `/src/components/` |
| Hooks | Shared logic & state | `/src/hooks/` |
| Types | TypeScript definitions | `/src/types/` |

### State Management

- **Auth State**: React Context (`useAuth`)
- **Server State**: React Query (data fetching/caching)
- **UI State**: Local component state
- **Real-time**: Supabase subscriptions

### Database Schema (Conceptual)

```
profiles
  ├── id (uuid)
  ├── user_id (uuid, FK → auth.users)
  ├── full_name
  ├── organization_name
  ├── sector (public/charity/private)
  └── job_title

workshop_sessions
  ├── id (uuid)
  ├── title
  ├── session_code (unique)
  ├── facilitator_id (FK → profiles)
  ├── is_active
  └── current_slide

workshop_progress
  ├── id (uuid)
  ├── user_id (FK → auth.users)
  ├── session_id (FK → workshop_sessions, nullable)
  ├── current_section
  ├── completed_sections (jsonb)
  ├── quiz_scores (jsonb)
  └── scenario_choices (jsonb)

action_plans
  ├── id (uuid)
  ├── user_id (FK → auth.users)
  ├── action_items (jsonb)
  └── commitments (jsonb)

certificates
  ├── id (uuid)
  ├── user_id (FK → auth.users)
  ├── certificate_number (unique)
  └── issued_at
```

## Security Model

### Row Level Security (RLS)

- Users can only read/write their own data
- Facilitators can read participant data for their sessions
- Admins have full access

### Authentication

- Email/password via Supabase Auth
- JWT tokens for API access
- Automatic token refresh

## Performance Considerations

- React Query caching reduces API calls
- Optimistic updates for better UX
- Code splitting via React Router lazy loading
- Image optimization for workshop content
