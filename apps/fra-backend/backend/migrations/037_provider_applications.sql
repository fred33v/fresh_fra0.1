-- Source account and organisation IDs are preserved without cascading deletion.
CREATE TABLE public.provider_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL,
  organisation_id uuid NOT NULL,
  applicant_name text NOT NULL,
  applicant_email text NOT NULL,
  company_name text NOT NULL CHECK (length(company_name) BETWEEN 2 AND 160),
  service_interest text NOT NULL CHECK (service_interest IN ('sales', 'training', 'both')),
  training_experience text CHECK (length(training_experience) BETWEEN 10 AND 4000),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'declined')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (applicant_id, organisation_id),
  CHECK (service_interest = 'sales' OR training_experience IS NOT NULL)
);
