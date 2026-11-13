-- Assessment-specific plans, preserving the separate training tables from 009.
-- Source IDs intentionally have no cascading FK: source retention cannot erase a saved plan.
CREATE TABLE IF NOT EXISTS public.budget_plans (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 assessment_id uuid NOT NULL UNIQUE,
 organisation_id uuid NOT NULL,
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 risk_appetite jsonb,
 completed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS budget_plans_org_idx ON public.budget_plans(organisation_id);
CREATE TABLE IF NOT EXISTS public.budget_plan_mitigations (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 plan_id uuid NOT NULL REFERENCES public.budget_plans(id) ON DELETE RESTRICT,
 risk_level text NOT NULL CHECK(risk_level IN ('low','medium','high','critical')),
 category text NOT NULL CHECK(category IN ('prevention','detection','response','culture')),
 description text NOT NULL,
 budget_cents integer NOT NULL CHECK(budget_cents>=0 AND budget_cents<=1000000000),
 timeline text NOT NULL CHECK(timeline IN ('1-3 months','3-6 months','6-12 months','12+ months')),
 status text NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','in_progress','completed')),
 archived_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS budget_plan_mitigations_active_idx ON public.budget_plan_mitigations(plan_id,created_at) WHERE archived_at IS NULL;
