-- Platform teaching authority, not external professional accreditation. No automatic grants.
CREATE TABLE public.professional_subjects (
 id text NOT NULL, version text NOT NULL, title text NOT NULL,
 course_id text NOT NULL, course_version text NOT NULL, active boolean NOT NULL DEFAULT true,
 PRIMARY KEY(id,version), UNIQUE(course_id,course_version)
);
INSERT INTO public.professional_subjects(id,version,title,course_id,course_version)
 VALUES('fraud-risk-awareness','2026-10-30','Fraud Risk Awareness Workshop','fraud-risk-awareness','2026-10-30');
CREATE TABLE public.provider_professional_scopes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 application_id uuid NOT NULL REFERENCES public.provider_applications(id) ON DELETE RESTRICT,
 subject_id text NOT NULL, subject_version text NOT NULL,
 requested_actions text[] NOT NULL, approved_actions text[] NOT NULL DEFAULT '{}',
 evidence text NOT NULL CHECK(length(evidence) BETWEEN 20 AND 4000),
 status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','approved','declined','suspended','revoked')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 application_revision integer,
 valid_from timestamptz, valid_until timestamptz,
 review_reason text, qualification_check text, demonstration_check text,
 reviewed_by uuid, reviewed_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(subject_id,subject_version) REFERENCES public.professional_subjects(id,version) ON DELETE RESTRICT,
 UNIQUE(application_id,subject_id,subject_version),
 CHECK(requested_actions <@ ARRAY['deliver','assess','issue_completion']::text[] AND cardinality(requested_actions) BETWEEN 1 AND 3 AND 'deliver'=ANY(requested_actions) AND array_position(requested_actions,NULL) IS NULL),
 CHECK(approved_actions <@ requested_actions AND array_position(approved_actions,NULL) IS NULL),
 CHECK(NOT ('issue_completion'=ANY(approved_actions)) OR ('deliver'=ANY(approved_actions) AND 'assess'=ANY(approved_actions))),
 CHECK(status<>'approved' OR ('deliver'=ANY(approved_actions) AND application_revision IS NOT NULL AND valid_from IS NOT NULL AND valid_until IS NOT NULL AND valid_until>valid_from AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_reason IS NOT NULL AND qualification_check IS NOT NULL AND demonstration_check IS NOT NULL AND length(review_reason)>=10 AND length(qualification_check)>=10 AND length(demonstration_check)>=10))
);
CREATE TABLE public.professional_audit_heads (
 application_id uuid PRIMARY KEY REFERENCES public.provider_applications(id) ON DELETE RESTRICT,
 seq bigint NOT NULL DEFAULT 0, hash text NOT NULL DEFAULT repeat('0',64)
);
CREATE TABLE public.professional_audit (
 application_id uuid NOT NULL REFERENCES public.professional_audit_heads(application_id) ON DELETE RESTRICT,
 seq bigint NOT NULL, occurred_at timestamptz NOT NULL, event text NOT NULL,
 actor_id uuid NOT NULL, details jsonb NOT NULL, previous_hash text NOT NULL, hash text NOT NULL, canonical text NOT NULL,
 PRIMARY KEY(application_id,seq)
);
CREATE FUNCTION public.professional_audit_append() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE h public.professional_audit_heads;
BEGIN
 SELECT * INTO STRICT h FROM public.professional_audit_heads WHERE application_id=NEW.application_id FOR UPDATE;
 NEW.seq:=h.seq+1; NEW.previous_hash:=h.hash; NEW.occurred_at:=clock_timestamp();
 NEW.canonical:=jsonb_build_array(NEW.application_id::text,NEW.seq,NEW.occurred_at,NEW.event,NEW.actor_id::text,NEW.details,NEW.previous_hash)::text;
 NEW.hash:=encode(sha256(convert_to(NEW.canonical,'UTF8')),'hex');
 UPDATE public.professional_audit_heads SET seq=NEW.seq,hash=NEW.hash WHERE application_id=NEW.application_id;
 RETURN NEW;
END $$;
CREATE TRIGGER professional_audit_chain BEFORE INSERT ON public.professional_audit FOR EACH ROW EXECUTE FUNCTION public.professional_audit_append();
CREATE TRIGGER professional_audit_immutable BEFORE UPDATE OR DELETE ON public.professional_audit FOR EACH ROW EXECUTE FUNCTION public.esign_no_change();
CREATE TRIGGER professional_audit_no_truncate BEFORE TRUNCATE ON public.professional_audit FOR EACH STATEMENT EXECUTE FUNCTION public.esign_no_change();
CREATE TRIGGER professional_heads_no_delete BEFORE DELETE ON public.professional_audit_heads FOR EACH ROW EXECUTE FUNCTION public.esign_no_change();
CREATE TRIGGER professional_heads_no_truncate BEFORE TRUNCATE ON public.professional_audit_heads FOR EACH STATEMENT EXECUTE FUNCTION public.esign_no_change();
CREATE FUNCTION public.professional_scope_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.id,NEW.application_id,NEW.subject_id,NEW.subject_version,NEW.created_at)
 IS DISTINCT FROM (OLD.id,OLD.application_id,OLD.subject_id,OLD.subject_version,OLD.created_at)
 OR NEW.revision<>OLD.revision+1 OR OLD.status='revoked' THEN RAISE EXCEPTION 'Invalid retained scope revision'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER professional_scope_revision BEFORE UPDATE ON public.provider_professional_scopes FOR EACH ROW EXECUTE FUNCTION public.professional_scope_guard();
CREATE TRIGGER professional_scope_no_delete BEFORE DELETE ON public.provider_professional_scopes FOR EACH ROW EXECUTE FUNCTION public.esign_no_change();
CREATE TRIGGER professional_scope_no_truncate BEFORE TRUNCATE ON public.provider_professional_scopes FOR EACH STATEMENT EXECUTE FUNCTION public.esign_no_change();
ALTER TABLE public.provider_assignments ADD COLUMN professional_scope_id uuid REFERENCES public.provider_professional_scopes(id) ON DELETE RESTRICT,
 ADD COLUMN professional_scope_revision integer,
 ADD CONSTRAINT professional_assignment_binding CHECK((professional_scope_id IS NULL AND professional_scope_revision IS NULL) OR (service='training' AND professional_scope_id IS NOT NULL AND professional_scope_revision>0));
CREATE FUNCTION public.professional_assignment_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.professional_scope_id,NEW.professional_scope_revision) IS DISTINCT FROM (OLD.professional_scope_id,OLD.professional_scope_revision) THEN RAISE EXCEPTION 'Assignment scope binding is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER professional_assignment_frozen BEFORE UPDATE ON public.provider_assignments FOR EACH ROW EXECUTE FUNCTION public.professional_assignment_guard();
-- No FK into legacy sessions/users: legacy retention must not cascade into this evidence.
CREATE TABLE public.provider_session_authority (
 session_id uuid PRIMARY KEY,
 scope_id uuid NOT NULL REFERENCES public.provider_professional_scopes(id) ON DELETE RESTRICT,
 scope_revision integer NOT NULL,
 assignment_id uuid NOT NULL REFERENCES public.provider_assignments(id) ON DELETE RESTRICT,
 trainer_id uuid NOT NULL, snapshot jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER professional_session_immutable BEFORE UPDATE OR DELETE ON public.provider_session_authority FOR EACH ROW EXECUTE FUNCTION public.esign_no_change();
CREATE TRIGGER professional_session_no_truncate BEFORE TRUNCATE ON public.provider_session_authority FOR EACH STATEMENT EXECUTE FUNCTION public.esign_no_change();
CREATE TABLE public.professional_completion_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 session_id uuid NOT NULL REFERENCES public.provider_session_authority(session_id) ON DELETE RESTRICT,
 learner_id uuid NOT NULL, revision integer NOT NULL CHECK(revision>0),
 decision text NOT NULL CHECK(decision IN ('approved','rejected')),
 reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 2000),
 progress_hash text NOT NULL, snapshot jsonb NOT NULL,
 reviewed_by uuid NOT NULL, reviewed_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(session_id,learner_id,revision)
);
CREATE TRIGGER professional_completion_immutable BEFORE UPDATE OR DELETE ON public.professional_completion_reviews FOR EACH ROW EXECUTE FUNCTION public.esign_no_change();
CREATE TRIGGER professional_completion_no_truncate BEFORE TRUNCATE ON public.professional_completion_reviews FOR EACH STATEMENT EXECUTE FUNCTION public.esign_no_change();
ALTER TABLE public.workshop_progress ADD COLUMN provider_session_id uuid;
CREATE FUNCTION public.professional_progress_context() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.provider_session_id IS NOT NULL AND NEW.provider_session_id IS DISTINCT FROM OLD.provider_session_id THEN RAISE EXCEPTION 'Professional progress provenance is immutable'; END IF;
 IF NEW.session_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.provider_session_authority WHERE session_id=NEW.session_id) THEN
  IF NEW.provider_session_id IS NOT NULL AND NEW.provider_session_id<>NEW.session_id THEN RAISE EXCEPTION 'Professional progress session mismatch'; END IF;
  NEW.provider_session_id:=NEW.session_id;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER professional_progress_provenance BEFORE INSERT OR UPDATE ON public.workshop_progress FOR EACH ROW EXECUTE FUNCTION public.professional_progress_context();
