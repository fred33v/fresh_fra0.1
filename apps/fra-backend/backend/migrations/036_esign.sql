-- Internal electronic-signature workflow. No FK cascade into retained evidence.
CREATE TABLE public.esign_documents (
 id uuid PRIMARY KEY, organisation_id uuid NOT NULL, created_by uuid NOT NULL,
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
 original_pdf bytea NOT NULL, original_sha256 text NOT NULL CHECK(original_sha256 ~ '^[a-f0-9]{64}$'),
 source_pdf bytea NOT NULL, source_sha256 text NOT NULL CHECK(source_sha256 ~ '^[a-f0-9]{64}$'),
 pages jsonb NOT NULL, status text NOT NULL DEFAULT 'draft'
   CHECK(status IN ('draft','sent','declined','completed')),
 expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), sent_at timestamptz,
 final_key text, final_version text, final_sha256 text,
 audit_head text NOT NULL DEFAULT repeat('0',64), audit_seq bigint NOT NULL DEFAULT 0,
 CHECK(source_sha256=encode(sha256(source_pdf),'hex')),
 CHECK(original_sha256=encode(sha256(original_pdf),'hex')),
 CHECK(status <> 'completed' OR (final_key IS NOT NULL AND final_version IS NOT NULL AND final_sha256 ~ '^[a-f0-9]{64}$'))
);
CREATE INDEX esign_org ON public.esign_documents(organisation_id,created_at);
CREATE TABLE public.esign_signers (
 id uuid PRIMARY KEY, document_id uuid NOT NULL REFERENCES public.esign_documents(id) ON DELETE RESTRICT,
 email text NOT NULL CHECK(length(email) <= 254), name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
 token_hash text UNIQUE, token_expires_at timestamptz,
 otp_hash text, otp_expires_at timestamptz, otp_sent_at timestamptz, otp_attempts integer NOT NULL DEFAULT 0, otp_sends integer NOT NULL DEFAULT 0,
 session_hash text UNIQUE, session_expires_at timestamptz,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','signed','declined')),
 consent_text text, consent_at timestamptz, signature_text text, signed_at timestamptz,
 invitation_sent_at timestamptz,
 CHECK(status <> 'signed' OR (consent_text IS NOT NULL AND consent_at IS NOT NULL AND signature_text IS NOT NULL AND signed_at IS NOT NULL)),
 UNIQUE(document_id,email), UNIQUE(document_id,id)
);
CREATE TABLE public.esign_fields (
 id uuid PRIMARY KEY, document_id uuid NOT NULL REFERENCES public.esign_documents(id) ON DELETE RESTRICT,
 signer_id uuid NOT NULL, page integer NOT NULL CHECK(page >= 0),
 x double precision NOT NULL CHECK(x >= 0 AND x < 14400), y double precision NOT NULL CHECK(y >= 0 AND y < 14400),
 width double precision NOT NULL CHECK(width >= 40 AND width < 14400),
 height double precision NOT NULL CHECK(height >= 20 AND height < 14400),
 kind text NOT NULL CHECK(kind IN ('signature','name','date')),
 FOREIGN KEY(document_id,signer_id) REFERENCES public.esign_signers(document_id,id) ON DELETE RESTRICT
);
CREATE TABLE public.esign_audit (
 document_id uuid NOT NULL REFERENCES public.esign_documents(id) ON DELETE RESTRICT,
 seq bigint NOT NULL, occurred_at timestamptz NOT NULL, event text NOT NULL,
 actor text NOT NULL, details jsonb NOT NULL, previous_hash text NOT NULL, hash text NOT NULL,
 canonical text NOT NULL, PRIMARY KEY(document_id,seq)
);
CREATE FUNCTION public.esign_no_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Retained e-sign evidence cannot be updated, deleted or truncated'; END $$;
CREATE TRIGGER esign_audit_immutable BEFORE UPDATE OR DELETE ON public.esign_audit FOR EACH ROW EXECUTE FUNCTION public.esign_no_change();
CREATE TRIGGER esign_audit_no_truncate BEFORE TRUNCATE ON public.esign_audit FOR EACH STATEMENT EXECUTE FUNCTION public.esign_no_change();
CREATE FUNCTION public.esign_append() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d public.esign_documents;
BEGIN
 SELECT * INTO STRICT d FROM public.esign_documents WHERE id=NEW.document_id FOR UPDATE;
 NEW.seq := d.audit_seq+1; NEW.previous_hash := d.audit_head; NEW.occurred_at := clock_timestamp();
 NEW.canonical := jsonb_build_array(NEW.document_id::text,NEW.seq,NEW.occurred_at,NEW.event,NEW.actor,NEW.details,NEW.previous_hash)::text;
 NEW.hash := encode(sha256(convert_to(NEW.canonical,'UTF8')),'hex');
 UPDATE public.esign_documents SET audit_seq=NEW.seq,audit_head=NEW.hash WHERE id=NEW.document_id;
 RETURN NEW;
END $$;
CREATE TRIGGER esign_audit_chain BEFORE INSERT ON public.esign_audit FOR EACH ROW EXECUTE FUNCTION public.esign_append();
CREATE FUNCTION public.esign_freeze_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status <> OLD.status AND NOT ((OLD.status='draft' AND NEW.status='sent') OR (OLD.status='sent' AND NEW.status IN ('declined','completed'))) THEN RAISE EXCEPTION 'Invalid e-sign state transition'; END IF;
 IF OLD.status <> 'draft' AND (NEW.original_pdf,NEW.original_sha256,NEW.source_pdf,NEW.source_sha256,NEW.pages,NEW.title,NEW.organisation_id,NEW.created_by,NEW.expires_at)
   IS DISTINCT FROM (OLD.original_pdf,OLD.original_sha256,OLD.source_pdf,OLD.source_sha256,OLD.pages,OLD.title,OLD.organisation_id,OLD.created_by,OLD.expires_at) THEN
   RAISE EXCEPTION 'Sent document content is immutable';
 END IF;
 IF OLD.status='completed' AND (NEW.final_key,NEW.final_version,NEW.final_sha256) IS DISTINCT FROM (OLD.final_key,OLD.final_version,OLD.final_sha256) THEN RAISE EXCEPTION 'Final object reference is immutable'; END IF;
 IF OLD.status IN ('completed','declined') AND NEW.status <> OLD.status THEN RAISE EXCEPTION 'Terminal document'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER esign_document_frozen BEFORE UPDATE ON public.esign_documents FOR EACH ROW EXECUTE FUNCTION public.esign_freeze_document();
CREATE FUNCTION public.esign_freeze_participant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE state text;
BEGIN
 SELECT status INTO state FROM public.esign_documents WHERE id=COALESCE(NEW.document_id,OLD.document_id) FOR UPDATE;
 IF state <> 'draft' THEN
   IF TG_TABLE_NAME='esign_fields' OR TG_OP='INSERT' OR TG_OP='DELETE' THEN RAISE EXCEPTION 'Sent signing layout is immutable'; END IF;
   IF (NEW.document_id,NEW.email,NEW.name) IS DISTINCT FROM (OLD.document_id,OLD.email,OLD.name) THEN RAISE EXCEPTION 'Sent signer identity is immutable'; END IF;
   IF OLD.status <> 'pending' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'Signer decision is immutable'; END IF;
 END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER esign_signer_frozen BEFORE INSERT OR UPDATE OR DELETE ON public.esign_signers FOR EACH ROW EXECUTE FUNCTION public.esign_freeze_participant();
CREATE TRIGGER esign_field_frozen BEFORE INSERT OR UPDATE OR DELETE ON public.esign_fields FOR EACH ROW EXECUTE FUNCTION public.esign_freeze_participant();
CREATE TRIGGER esign_document_retained BEFORE DELETE ON public.esign_documents FOR EACH ROW EXECUTE FUNCTION public.esign_no_change();
CREATE TRIGGER esign_document_no_truncate BEFORE TRUNCATE ON public.esign_documents FOR EACH STATEMENT EXECUTE FUNCTION public.esign_no_change();
CREATE TRIGGER esign_signer_no_truncate BEFORE TRUNCATE ON public.esign_signers FOR EACH STATEMENT EXECUTE FUNCTION public.esign_no_change();
CREATE TRIGGER esign_fields_no_truncate BEFORE TRUNCATE ON public.esign_fields FOR EACH STATEMENT EXECUTE FUNCTION public.esign_no_change();
CREATE TABLE public.esign_artifacts (
 document_id uuid PRIMARY KEY REFERENCES public.esign_documents(id) ON DELETE RESTRICT,
 manifest_key text NOT NULL, manifest_version text NOT NULL, manifest_sha256 text NOT NULL
);
CREATE TRIGGER esign_artifact_immutable BEFORE UPDATE OR DELETE ON public.esign_artifacts FOR EACH ROW EXECUTE FUNCTION public.esign_no_change();
CREATE TRIGGER esign_artifact_no_truncate BEFORE TRUNCATE ON public.esign_artifacts FOR EACH STATEMENT EXECUTE FUNCTION public.esign_no_change();
