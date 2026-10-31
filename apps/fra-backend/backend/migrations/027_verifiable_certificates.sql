-- Verifiable certificates: the training certificate records the quiz score, and every
-- submitted risk assessment gets its own certificate. Anyone can check a certificate
-- number on the public verification page.

ALTER TABLE public.certificates ADD COLUMN IF NOT EXISTS quiz_score integer;

CREATE TABLE IF NOT EXISTS public.assessment_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL UNIQUE REFERENCES public.assessments(id) ON DELETE CASCADE,
  organisation_id uuid NOT NULL,
  certificate_number text NOT NULL UNIQUE,
  issued_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assessment_certificates_org_idx ON public.assessment_certificates(organisation_id);

-- Assessments submitted before this migration get a certificate too, dated when they were submitted.
-- Numbers look like FRA-1A2B-3C4D-5E6F, the same as new ones.
INSERT INTO public.assessment_certificates (assessment_id, organisation_id, certificate_number, issued_at)
SELECT a.id, a.organisation_id,
       'FRA-' || upper(substr(h.v, 1, 4) || '-' || substr(h.v, 5, 4) || '-' || substr(h.v, 9, 4)),
       coalesce(a.submitted_at, a.updated_at)
  FROM public.assessments a
  CROSS JOIN LATERAL (SELECT md5(gen_random_uuid()::text || a.id::text) AS v) h
 WHERE a.status IN ('submitted', 'completed')
ON CONFLICT (assessment_id) DO NOTHING;
