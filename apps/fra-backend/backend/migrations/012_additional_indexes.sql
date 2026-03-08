-- Additional indexes for common query patterns

CREATE INDEX IF NOT EXISTS users_organisation_id_idx
  ON public.users (organisation_id);

CREATE INDEX IF NOT EXISTS purchases_status_idx
  ON public.purchases (status);
