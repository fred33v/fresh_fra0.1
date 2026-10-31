-- Enterprise budget holder programme (the Budget Guide on the web).
-- One row per person: whether the employer requires it of them, and their progress,
-- signed commitment and conflict of interest declaration. Separate from the mobile
-- app's budget_guide_* tables (009), which keep working unchanged.
CREATE TABLE IF NOT EXISTS public.budget_holder_members (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  required BOOLEAN NOT NULL DEFAULT false,
  required_at TIMESTAMPTZ,
  completed_parts TEXT[] NOT NULL DEFAULT '{}',
  scenario_answers JSONB NOT NULL DEFAULT '{}',
  scenario_score INTEGER,
  scenario_passed_at TIMESTAMPTZ,
  pledge_name TEXT,
  pledged_at TIMESTAMPTZ,
  conflict_declared BOOLEAN,
  conflict_details TEXT,
  completed_at TIMESTAMPTZ,
  previous_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_budget_holder_members_org ON public.budget_holder_members(organisation_id);

-- The employer's own approval limits and report contacts, shown to budget holders.
CREATE TABLE IF NOT EXISTS public.budget_holder_settings (
  organisation_id UUID PRIMARY KEY REFERENCES public.organisations(id) ON DELETE CASCADE,
  approval_limits JSONB,
  contacts JSONB NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The Enterprise offer lists the programme (kept in step with the web catalogue)
UPDATE public.packages SET
  features = '["Everything in Professional","Unlimited employee key-passes","Real-time monitoring dashboard","Risk register and action tracking","Budget holder programme with signed commitments and conflict of interest declarations","API access","Priority support","Compliance reports"]'::jsonb
WHERE id = 'pkg_full';
