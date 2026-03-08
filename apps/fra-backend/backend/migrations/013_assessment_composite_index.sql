-- Composite index for analytics queries filtering by organisation and status

CREATE INDEX IF NOT EXISTS assessments_org_status_idx
  ON public.assessments (organisation_id, status);
