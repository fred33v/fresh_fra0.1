-- Administrative references are not credentials, payroll eligibility or professional authority.
CREATE TABLE public.relationship_identifiers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 code text NOT NULL UNIQUE,
 kind text NOT NULL CHECK(kind IN ('employee','supplier','provider_code')),
 user_id uuid NOT NULL, organisation_id uuid NOT NULL,
 application_id uuid REFERENCES public.provider_applications(id) ON DELETE RESTRICT,
 agreement_document_id uuid REFERENCES public.esign_documents(id) ON DELETE RESTRICT,
 status text NOT NULL CHECK(status IN ('active','suspended','revoked')),
 suspension_source text CHECK(suspension_source IN ('manual','application')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 2000),
 actor_id uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(application_id,kind),
 CHECK((kind='employee' AND application_id IS NULL AND agreement_document_id IS NOT NULL AND code ~ '^EMP-[a-f0-9]{32}$') OR
       (kind='supplier' AND application_id IS NOT NULL AND code ~ '^SUP-[a-f0-9]{32}$') OR
       (kind='provider_code' AND application_id IS NOT NULL AND code ~ '^PRV-[a-f0-9]{32}$')),
 CHECK((status='suspended' AND suspension_source IS NOT NULL) OR (status<>'suspended' AND suspension_source IS NULL))
);
CREATE UNIQUE INDEX relationship_employee_identity ON public.relationship_identifiers(user_id,organisation_id) WHERE kind='employee';
CREATE INDEX relationship_identifier_owner ON public.relationship_identifiers(user_id,organisation_id);
CREATE TABLE public.relationship_identifier_events (
 identifier_id uuid NOT NULL REFERENCES public.relationship_identifiers(id) ON DELETE RESTRICT,
 revision integer NOT NULL, snapshot jsonb NOT NULL, occurred_at timestamptz NOT NULL,
 previous_hash text NOT NULL, hash text NOT NULL, canonical text NOT NULL,
 PRIMARY KEY(identifier_id,revision)
);
CREATE FUNCTION public.relationship_identifier_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.id,NEW.code,NEW.kind,NEW.user_id,NEW.organisation_id,NEW.application_id,NEW.agreement_document_id,NEW.created_at)
 IS DISTINCT FROM (OLD.id,OLD.code,OLD.kind,OLD.user_id,OLD.organisation_id,OLD.application_id,OLD.agreement_document_id,OLD.created_at)
 OR NEW.revision<>OLD.revision+1 OR OLD.status='revoked' OR NEW.status=OLD.status THEN
 RAISE EXCEPTION 'Invalid identifier transition or immutable identity'; END IF;
 NEW.updated_at:=clock_timestamp(); RETURN NEW;
END $$;
CREATE TRIGGER identifier_update_guard BEFORE UPDATE ON public.relationship_identifiers FOR EACH ROW EXECUTE FUNCTION public.relationship_identifier_guard();
CREATE TRIGGER identifier_no_delete BEFORE DELETE ON public.relationship_identifiers FOR EACH ROW EXECUTE FUNCTION public.esign_no_change();
CREATE TRIGGER identifier_no_truncate BEFORE TRUNCATE ON public.relationship_identifiers FOR EACH STATEMENT EXECUTE FUNCTION public.esign_no_change();
CREATE FUNCTION public.relationship_identifier_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous text; moment timestamptz:=clock_timestamp(); payload text;
BEGIN
 SELECT hash INTO previous FROM public.relationship_identifier_events WHERE identifier_id=NEW.id ORDER BY revision DESC LIMIT 1;
 previous:=COALESCE(previous,repeat('0',64));
 payload:=jsonb_build_array(NEW.id::text,NEW.revision,to_jsonb(NEW),moment,previous)::text;
 INSERT INTO public.relationship_identifier_events VALUES(NEW.id,NEW.revision,to_jsonb(NEW),moment,previous,encode(sha256(convert_to(payload,'UTF8')),'hex'),payload);
 RETURN NEW;
END $$;
CREATE TRIGGER identifier_record_event AFTER INSERT OR UPDATE ON public.relationship_identifiers FOR EACH ROW EXECUTE FUNCTION public.relationship_identifier_event();
CREATE TRIGGER identifier_events_no_change BEFORE UPDATE OR DELETE ON public.relationship_identifier_events FOR EACH ROW EXECUTE FUNCTION public.esign_no_change();
CREATE TRIGGER identifier_events_no_truncate BEFORE TRUNCATE ON public.relationship_identifier_events FOR EACH STATEMENT EXECUTE FUNCTION public.esign_no_change();
-- Preserve PRV references exactly; no inference of employee status from independent applications.
INSERT INTO public.relationship_identifiers(code,kind,user_id,organisation_id,application_id,agreement_document_id,status,suspension_source,reason)
 SELECT provider_code,'provider_code',applicant_id,organisation_id,id,agreement_document_id,
 CASE WHEN status='approved' THEN 'active' ELSE 'suspended' END,CASE WHEN status='approved' THEN NULL ELSE 'application' END,
 'Migration 043: preserved existing provider reference' FROM public.provider_applications WHERE provider_code IS NOT NULL;
INSERT INTO public.relationship_identifiers(code,kind,user_id,organisation_id,application_id,agreement_document_id,status,suspension_source,reason)
 SELECT 'SUP-'||replace(gen_random_uuid()::text,'-',''),'supplier',applicant_id,organisation_id,id,agreement_document_id,
 CASE WHEN status='approved' THEN 'active' ELSE 'suspended' END,CASE WHEN status='approved' THEN NULL ELSE 'application' END,
 'Migration 043: supplier reference for existing provider relationship' FROM public.provider_applications WHERE provider_code IS NOT NULL;
CREATE FUNCTION public.relationship_application_sync() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.provider_code IS NOT NULL AND NEW.provider_code IS DISTINCT FROM OLD.provider_code THEN
 RAISE EXCEPTION 'Retained provider reference cannot be reassigned'; END IF;
 IF NEW.provider_code IS NULL THEN RETURN NEW; END IF;
 IF NEW.status='approved' THEN
  INSERT INTO public.relationship_identifiers(code,kind,user_id,organisation_id,application_id,agreement_document_id,status,reason,actor_id)
  VALUES(NEW.provider_code,'provider_code',NEW.applicant_id,NEW.organisation_id,NEW.id,NEW.agreement_document_id,'active','Provider approval: reference issued',NEW.reviewed_by),
  ('SUP-'||replace(gen_random_uuid()::text,'-',''),'supplier',NEW.applicant_id,NEW.organisation_id,NEW.id,NEW.agreement_document_id,'active','Provider approval: supplier reference issued',NEW.reviewed_by)
  ON CONFLICT(application_id,kind) DO NOTHING;
  UPDATE public.relationship_identifiers SET status='active',suspension_source=NULL,revision=revision+1,reason='Provider reapproval: application suspension lifted',actor_id=NEW.reviewed_by
  WHERE application_id=NEW.id AND status='suspended' AND suspension_source='application';
 ELSE
  UPDATE public.relationship_identifiers SET status='suspended',suspension_source='application',revision=revision+1,reason=COALESCE(NEW.review_reason,'Provider application is not approved'),actor_id=NEW.reviewed_by
  WHERE application_id=NEW.id AND status='active';
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER identifier_application_sync AFTER INSERT OR UPDATE ON public.provider_applications FOR EACH ROW EXECUTE FUNCTION public.relationship_application_sync();
