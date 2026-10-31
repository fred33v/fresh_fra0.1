-- Enterprise: the employee who owns a risk reports progress on it, and the employer reviews it.
-- Additive and nullable, so older code keeps working against this schema.
ALTER TABLE public.risk_register ADD COLUMN IF NOT EXISTS owner_note TEXT;
ALTER TABLE public.risk_register ADD COLUMN IF NOT EXISTS owner_updated_at TIMESTAMPTZ;
ALTER TABLE public.risk_register ADD COLUMN IF NOT EXISTS review_pending BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_risk_register_owner ON public.risk_register(owner_user_id);
