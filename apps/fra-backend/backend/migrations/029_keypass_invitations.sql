-- A key-pass can be sent by email to one employee. It then only works for that address,
-- which proves the address belongs to the person who joins.
ALTER TABLE public.keypasses ADD COLUMN IF NOT EXISTS invited_email TEXT;
ALTER TABLE public.keypasses ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_keypasses_invited_email ON public.keypasses(organisation_id, invited_email) WHERE invited_email IS NOT NULL;
