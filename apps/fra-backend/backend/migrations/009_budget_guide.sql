-- 009_budget_guide.sql: Budget guide progress, pledges, and analytics
-- All tables use IF NOT EXISTS for idempotent re-runs.

-- Budget guide progress tracking (one per user)
CREATE TABLE IF NOT EXISTS public.budget_guide_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  selected_roles text[] NOT NULL DEFAULT '{}',
  completed_screens text[] NOT NULL DEFAULT '{}',
  watch_items jsonb NOT NULL DEFAULT '[]',
  contact_details jsonb NOT NULL DEFAULT '{}',
  current_screen text NOT NULL DEFAULT 'index',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS budget_guide_progress_user_id_idx
  ON public.budget_guide_progress(user_id);

-- Budget guide pledges (signed commitments)
CREATE TABLE IF NOT EXISTS public.budget_guide_pledges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  signature text NOT NULL,
  pledged_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS budget_guide_pledges_user_id_idx
  ON public.budget_guide_pledges(user_id);

-- Budget guide analytics (per-user completion data)
CREATE TABLE IF NOT EXISTS public.budget_guide_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  organisation_id uuid REFERENCES public.organisations(id) ON DELETE SET NULL,
  quiz_scores jsonb NOT NULL DEFAULT '{}',
  time_spent_seconds integer NOT NULL DEFAULT 0,
  screens_visited text[] NOT NULL DEFAULT '{}',
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS budget_guide_analytics_user_id_idx
  ON public.budget_guide_analytics(user_id);
CREATE INDEX IF NOT EXISTS budget_guide_analytics_org_id_idx
  ON public.budget_guide_analytics(organisation_id);
