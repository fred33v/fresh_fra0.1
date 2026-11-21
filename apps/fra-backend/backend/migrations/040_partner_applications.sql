-- Preserve application versions and review decisions; no cascades into legacy retention tables.
CREATE TABLE public.partner_applications (
 id uuid PRIMARY KEY,
 user_id uuid NOT NULL UNIQUE,
 organisation_id uuid NOT NULL,
 contact_email text NOT NULL CHECK(length(contact_email) <= 254),
 profile jsonb NOT NULL CHECK(jsonb_typeof(profile) = 'object'),
 status text NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','under_review','approved','rejected','suspended')),
 version integer NOT NULL DEFAULT 1 CHECK(version > 0),
 commission_basis_points integer NOT NULL DEFAULT 1700 CHECK(commission_basis_points = 1700),
 terms_version text NOT NULL CHECK(terms_version = 'provider-programme-2026-11'),
 acknowledged_at timestamptz NOT NULL,
 submitted_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 reviewed_by uuid,
 reviewed_at timestamptz,
 review_message text,
 CHECK(status = 'submitted' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND length(review_message) >= 3))
);
CREATE INDEX partner_application_queue ON public.partner_applications(status,updated_at DESC,id);
CREATE TABLE public.partner_application_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 application_id uuid NOT NULL REFERENCES public.partner_applications(id) ON DELETE RESTRICT,
 version integer NOT NULL,
 actor_id uuid NOT NULL,
 actor_role text NOT NULL,
 event text NOT NULL,
 snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(application_id,version)
);
CREATE FUNCTION public.provider_evidence_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Provider application evidence cannot be deleted, updated or truncated'; END $$;
CREATE TRIGGER provider_events_immutable BEFORE UPDATE OR DELETE ON public.partner_application_events FOR EACH ROW EXECUTE FUNCTION public.provider_evidence_immutable();
CREATE TRIGGER provider_events_no_truncate BEFORE TRUNCATE ON public.partner_application_events FOR EACH STATEMENT EXECUTE FUNCTION public.provider_evidence_immutable();
CREATE TRIGGER partner_applications_no_delete BEFORE DELETE ON public.partner_applications FOR EACH ROW EXECUTE FUNCTION public.provider_evidence_immutable();
CREATE TRIGGER partner_applications_no_truncate BEFORE TRUNCATE ON public.partner_applications FOR EACH STATEMENT EXECUTE FUNCTION public.provider_evidence_immutable();
CREATE FUNCTION public.partner_application_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.id,NEW.user_id,NEW.organisation_id,NEW.submitted_at,NEW.commission_basis_points,NEW.terms_version)
   IS DISTINCT FROM (OLD.id,OLD.user_id,OLD.organisation_id,OLD.submitted_at,OLD.commission_basis_points,OLD.terms_version)
   OR NEW.version <> OLD.version+1 THEN RAISE EXCEPTION 'Invalid provider application revision'; END IF;
 IF NOT (
   (OLD.status IN ('submitted','rejected') AND NEW.status='submitted') OR
   (OLD.status='submitted' AND NEW.status IN ('under_review','approved','rejected')) OR
   (OLD.status='under_review' AND NEW.status IN ('approved','rejected')) OR
   (OLD.status='approved' AND NEW.status='suspended') OR
   (OLD.status='suspended' AND NEW.status IN ('under_review','approved','rejected'))
 ) THEN RAISE EXCEPTION 'Invalid provider application transition'; END IF;
 IF NEW.status <> 'submitted' AND (NEW.profile,NEW.contact_email,NEW.acknowledged_at)
   IS DISTINCT FROM (OLD.profile,OLD.contact_email,OLD.acknowledged_at) THEN
   RAISE EXCEPTION 'A review cannot change applicant details'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER partner_application_revision BEFORE UPDATE ON public.partner_applications FOR EACH ROW EXECUTE FUNCTION public.partner_application_revision();
