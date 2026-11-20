-- Retained links and explicit administrative readiness; no FK into legacy user retention.
CREATE TABLE public.provider_agreements (
 id uuid PRIMARY KEY,
 sequence bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
 application_id uuid NOT NULL REFERENCES public.provider_applications(id) ON DELETE RESTRICT,
 application_version integer NOT NULL CHECK(application_version > 0),
 document_id uuid NOT NULL UNIQUE REFERENCES public.esign_documents(id) ON DELETE RESTRICT,
 source_sha256 text NOT NULL CHECK(source_sha256 ~ '^[a-f0-9]{64}$'),
 terms jsonb NOT NULL CHECK(jsonb_typeof(terms)='object'),
 application_snapshot jsonb NOT NULL CHECK(jsonb_typeof(application_snapshot)='object'),
 created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX provider_agreements_application ON public.provider_agreements(application_id, sequence DESC);
CREATE TABLE public.provider_engagement_readiness (
 id uuid PRIMARY KEY,
 agreement_id uuid NOT NULL UNIQUE REFERENCES public.provider_agreements(id) ON DELETE RESTRICT,
 application_version integer NOT NULL CHECK(application_version > 0),
 final_sha256 text NOT NULL CHECK(final_sha256 ~ '^[a-f0-9]{64}$'),
 final_version text NOT NULL,
 review_note text NOT NULL CHECK(length(review_note) BETWEEN 10 AND 2000),
 reviewed_by uuid NOT NULL, reviewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER provider_agreement_immutable BEFORE UPDATE OR DELETE ON public.provider_agreements FOR EACH ROW EXECUTE FUNCTION public.esign_no_change();
CREATE TRIGGER provider_agreement_no_truncate BEFORE TRUNCATE ON public.provider_agreements FOR EACH STATEMENT EXECUTE FUNCTION public.esign_no_change();
CREATE TRIGGER provider_readiness_immutable BEFORE UPDATE OR DELETE ON public.provider_engagement_readiness FOR EACH ROW EXECUTE FUNCTION public.esign_no_change();
CREATE TRIGGER provider_readiness_no_truncate BEFORE TRUNCATE ON public.provider_engagement_readiness FOR EACH STATEMENT EXECUTE FUNCTION public.esign_no_change();
-- Linked draft sources and the two agreed signer identities cannot be replaced through generic signing tools.
CREATE FUNCTION public.provider_agreement_freeze_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.provider_agreements WHERE document_id=OLD.id) AND
 (NEW.original_pdf,NEW.original_sha256,NEW.source_pdf,NEW.source_sha256,NEW.pages,NEW.title,NEW.organisation_id,NEW.created_by)
 IS DISTINCT FROM
 (OLD.original_pdf,OLD.original_sha256,OLD.source_pdf,OLD.source_sha256,OLD.pages,OLD.title,OLD.organisation_id,OLD.created_by)
 THEN RAISE EXCEPTION 'Linked agreement source is immutable; create a retained replacement'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER provider_agreement_document_frozen BEFORE UPDATE ON public.esign_documents FOR EACH ROW EXECUTE FUNCTION public.provider_agreement_freeze_document();
CREATE FUNCTION public.provider_agreement_freeze_signer() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM public.provider_agreements WHERE document_id=COALESCE(NEW.document_id,OLD.document_id)) THEN
  IF TG_OP IN ('INSERT','DELETE') THEN RAISE EXCEPTION 'Linked agreement signer identity is immutable'; END IF;
  IF (NEW.document_id,NEW.email,NEW.name) IS DISTINCT FROM (OLD.document_id,OLD.email,OLD.name) THEN
   RAISE EXCEPTION 'Linked agreement signer identity is immutable';
  END IF;
 END IF;
 RETURN COALESCE(NEW,OLD);
END $$;
CREATE TRIGGER provider_agreement_signers_frozen BEFORE INSERT OR UPDATE OR DELETE ON public.esign_signers FOR EACH ROW EXECUTE FUNCTION public.provider_agreement_freeze_signer();
