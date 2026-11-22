-- Service evidence is independent of learner certificates and payment/commission state.
CREATE TABLE public.service_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 application_id uuid NOT NULL REFERENCES public.provider_applications(id) ON DELETE RESTRICT,
 assignment_id uuid NOT NULL REFERENCES public.provider_assignments(id) ON DELETE RESTRICT,
 session_id uuid NOT NULL REFERENCES public.provider_session_authority(session_id) ON DELETE RESTRICT,
 customer_user_id uuid NOT NULL, customer_organisation_id uuid NOT NULL,
 purchase_id uuid REFERENCES public.purchases(id) ON DELETE RESTRICT,
 title text NOT NULL CHECK(length(title) BETWEEN 2 AND 200),
 starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL CHECK(ends_at>starts_at),
 status text NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','submitted','accepted','refused','disputed','cancelled')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 evidence_summary text, submission_manifest jsonb CHECK(submission_manifest IS NULL OR jsonb_typeof(submission_manifest)='object'), reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 4000),
 actor_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX service_delivery_assignment ON public.service_deliveries(assignment_id,status);
CREATE INDEX service_delivery_customer ON public.service_deliveries(customer_user_id,customer_organisation_id,created_at);
CREATE INDEX service_delivery_provider ON public.service_deliveries(application_id,created_at);
CREATE FUNCTION public.service_delivery_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.id,NEW.application_id,NEW.assignment_id,NEW.session_id,NEW.customer_user_id,NEW.customer_organisation_id,NEW.purchase_id,NEW.title,NEW.starts_at,NEW.ends_at,NEW.created_at)
 IS DISTINCT FROM (OLD.id,OLD.application_id,OLD.assignment_id,OLD.session_id,OLD.customer_user_id,OLD.customer_organisation_id,OLD.purchase_id,OLD.title,OLD.starts_at,OLD.ends_at,OLD.created_at)
 OR NEW.revision<>OLD.revision+1 OR OLD.status='cancelled' THEN RAISE EXCEPTION 'Invalid delivery revision or immutable binding'; END IF;
 NEW.updated_at:=clock_timestamp(); RETURN NEW;
END $$;
CREATE TRIGGER delivery_update_guard BEFORE UPDATE ON public.service_deliveries FOR EACH ROW EXECUTE FUNCTION public.service_delivery_guard();
CREATE TRIGGER delivery_no_delete BEFORE DELETE ON public.service_deliveries FOR EACH ROW EXECUTE FUNCTION public.esign_no_change();
CREATE TRIGGER delivery_no_truncate BEFORE TRUNCATE ON public.service_deliveries FOR EACH STATEMENT EXECUTE FUNCTION public.esign_no_change();
CREATE TABLE public.service_delivery_events (
 delivery_id uuid NOT NULL REFERENCES public.service_deliveries(id) ON DELETE RESTRICT,
 revision integer NOT NULL,snapshot jsonb NOT NULL,occurred_at timestamptz NOT NULL,
 previous_hash text NOT NULL,hash text NOT NULL,canonical text NOT NULL,
 PRIMARY KEY(delivery_id,revision)
);
CREATE FUNCTION public.service_delivery_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous text; moment timestamptz:=clock_timestamp(); payload text;
BEGIN
 SELECT hash INTO previous FROM public.service_delivery_events WHERE delivery_id=NEW.id ORDER BY revision DESC LIMIT 1;
 previous:=COALESCE(previous,repeat('0',64));payload:=jsonb_build_array(NEW.id::text,NEW.revision,to_jsonb(NEW),moment,previous)::text;
 INSERT INTO public.service_delivery_events VALUES(NEW.id,NEW.revision,to_jsonb(NEW),moment,previous,encode(sha256(convert_to(payload,'UTF8')),'hex'),payload);
 RETURN NEW;
END $$;
CREATE TRIGGER delivery_audit AFTER INSERT OR UPDATE ON public.service_deliveries FOR EACH ROW EXECUTE FUNCTION public.service_delivery_event();
CREATE TRIGGER delivery_events_no_change BEFORE UPDATE OR DELETE ON public.service_delivery_events FOR EACH ROW EXECUTE FUNCTION public.esign_no_change();
CREATE TRIGGER delivery_events_no_truncate BEFORE TRUNCATE ON public.service_delivery_events FOR EACH STATEMENT EXECUTE FUNCTION public.esign_no_change();
CREATE TABLE public.service_delivery_files (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),delivery_id uuid NOT NULL REFERENCES public.service_deliveries(id) ON DELETE RESTRICT,
 filename text NOT NULL,mime_type text NOT NULL CHECK(mime_type IN ('application/pdf','image/png','image/jpeg')),
 content bytea NOT NULL CHECK(octet_length(content) BETWEEN 8 AND 524288),sha256 text NOT NULL CHECK(sha256=encode(sha256(content),'hex')),
 uploaded_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX service_delivery_files_parent ON public.service_delivery_files(delivery_id);
CREATE TRIGGER delivery_files_no_change BEFORE UPDATE OR DELETE ON public.service_delivery_files FOR EACH ROW EXECUTE FUNCTION public.esign_no_change();
CREATE TRIGGER delivery_files_no_truncate BEFORE TRUNCATE ON public.service_delivery_files FOR EACH STATEMENT EXECUTE FUNCTION public.esign_no_change();
CREATE TABLE public.service_attendance (
 delivery_id uuid NOT NULL REFERENCES public.service_deliveries(id) ON DELETE RESTRICT,
 learner_id uuid NOT NULL,revision integer NOT NULL CHECK(revision>0),learner_name text NOT NULL,
 status text NOT NULL CHECK(status IN ('present','absent','excused')),
 reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 2000),recorded_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(delivery_id,learner_id,revision)
);
CREATE TRIGGER service_attendance_no_change BEFORE UPDATE OR DELETE ON public.service_attendance FOR EACH ROW EXECUTE FUNCTION public.esign_no_change();
CREATE TRIGGER service_attendance_no_truncate BEFORE TRUNCATE ON public.service_attendance FOR EACH STATEMENT EXECUTE FUNCTION public.esign_no_change();
