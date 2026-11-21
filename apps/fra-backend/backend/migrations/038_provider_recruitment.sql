-- Extend recruitment without replacing existing applications or signing evidence.
ALTER TABLE public.provider_applications DROP CONSTRAINT provider_applications_status_check;
ALTER TABLE public.provider_applications ADD CONSTRAINT provider_applications_status_check
 CHECK(status IN ('submitted','approved','declined','suspended'));
ALTER TABLE public.provider_applications
 ADD COLUMN revision integer NOT NULL DEFAULT 0,
 ADD COLUMN review_reason text,
 ADD COLUMN qualification_evidence text,
 ADD COLUMN agreement_document_id uuid REFERENCES public.esign_documents(id) ON DELETE RESTRICT,
 ADD COLUMN provider_code text UNIQUE,
 ADD COLUMN reviewed_by uuid,
 ADD COLUMN reviewed_at timestamptz;
ALTER TABLE public.provider_applications ADD CONSTRAINT provider_approved_evidence CHECK (
 status <> 'approved' OR (agreement_document_id IS NOT NULL AND provider_code IS NOT NULL AND reviewed_by IS NOT NULL
 AND (service_interest = 'sales' OR qualification_evidence IS NOT NULL)));
CREATE TABLE public.provider_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 application_id uuid NOT NULL REFERENCES public.provider_applications(id) ON DELETE RESTRICT,
 package_id text NOT NULL REFERENCES public.packages(id) ON DELETE RESTRICT,
 reference text NOT NULL CHECK(length(reference) BETWEEN 2 AND 160),
 service text NOT NULL CHECK(service IN ('sales','training')),
 status text NOT NULL DEFAULT 'offered' CHECK(status IN ('offered','accepted','refused','cancelled','completed')),
 assigned_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz,
 UNIQUE(application_id, reference)
);
CREATE TABLE public.provider_recruitment_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 application_id uuid NOT NULL REFERENCES public.provider_applications(id) ON DELETE RESTRICT,
 actor_id uuid NOT NULL, event text NOT NULL, details jsonb NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX provider_review_queue ON public.provider_applications(status,submitted_at);
CREATE INDEX provider_assignments_application ON public.provider_assignments(application_id,created_at);
CREATE TRIGGER provider_audit_retained BEFORE UPDATE OR DELETE ON public.provider_recruitment_audit
 FOR EACH ROW EXECUTE FUNCTION public.esign_no_change();
CREATE TRIGGER provider_audit_no_truncate BEFORE TRUNCATE ON public.provider_recruitment_audit
 FOR EACH STATEMENT EXECUTE FUNCTION public.esign_no_change();
