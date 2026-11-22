-- Retained snapshots supplement #86's existing review/assignment/finance audit.
CREATE TABLE public.provider_application_revisions (
 application_id uuid NOT NULL REFERENCES public.provider_applications(id) ON DELETE RESTRICT,
 revision integer NOT NULL CHECK(revision >= 0),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 actor_id uuid NOT NULL,
 event text NOT NULL CHECK(event IN ('application.submitted','application.baseline','application.amended','application.legacy_import')),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(application_id,revision)
);
CREATE TRIGGER provider_revisions_retained BEFORE UPDATE OR DELETE ON public.provider_application_revisions
 FOR EACH ROW EXECUTE FUNCTION public.esign_no_change();
CREATE TRIGGER provider_revisions_no_truncate BEFORE TRUNCATE ON public.provider_application_revisions
 FOR EACH STATEMENT EXECUTE FUNCTION public.esign_no_change();
CREATE FUNCTION public.guard_provider_candidate_amendment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.id,NEW.applicant_id,NEW.organisation_id,NEW.submitted_at)
 IS DISTINCT FROM (OLD.id,OLD.applicant_id,OLD.organisation_id,OLD.submitted_at) THEN
  RAISE EXCEPTION 'Provider identity is retained';
 END IF;
 IF (NEW.applicant_name,NEW.applicant_email,NEW.company_name,NEW.service_interest,NEW.training_experience,NEW.candidate_profile)
 IS DISTINCT FROM (OLD.applicant_name,OLD.applicant_email,OLD.company_name,OLD.service_interest,OLD.training_experience,OLD.candidate_profile) THEN
  IF OLD.status NOT IN ('submitted','declined') OR NEW.status <> 'submitted' OR NEW.revision <> OLD.revision+1 THEN
   RAISE EXCEPTION 'Only pending or declined candidates can submit a revision';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER provider_candidate_amendment_guard BEFORE UPDATE ON public.provider_applications
 FOR EACH ROW EXECUTE FUNCTION public.guard_provider_candidate_amendment();
