-- Evidence an applicant attaches to a provider application (identity, registration, qualification, insurance,
-- training demonstration). Stored in PostgreSQL with the same bounds as service-delivery evidence: PDF, PNG or JPEG
-- confirmed by file signature, 8 bytes to 512 KiB, SHA-256 enforced by the database. Documents and each reviewer
-- decision are retained: nothing here is deleted, truncated or edited after the fact, and the foreign key is RESTRICT.
CREATE TABLE public.provider_application_documents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 application_id uuid NOT NULL REFERENCES public.provider_applications(id) ON DELETE RESTRICT,
 application_revision integer NOT NULL CHECK(application_revision >= 0),
 kind text NOT NULL CHECK(kind IN ('identity','company_registration','qualification','insurance','training_demonstration','other')),
 filename text NOT NULL CHECK(length(filename) BETWEEN 1 AND 160),
 mime_type text NOT NULL CHECK(mime_type IN ('application/pdf','image/png','image/jpeg')),
 content bytea NOT NULL CHECK(octet_length(content) BETWEEN 8 AND 524288),
 sha256 text NOT NULL CHECK(sha256 = encode(sha256(content),'hex')),
 uploaded_by uuid NOT NULL,
 uploaded_at timestamptz NOT NULL DEFAULT now(),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','rejected')),
 decided_by uuid,
 decided_at timestamptz,
 decision_reason text CHECK(decision_reason IS NULL OR length(decision_reason) BETWEEN 10 AND 500),
 CHECK(
  (status = 'pending' AND decided_by IS NULL AND decided_at IS NULL AND decision_reason IS NULL) OR
  (status = 'verified' AND decided_by IS NOT NULL AND decided_at IS NOT NULL) OR
  (status = 'rejected' AND decided_by IS NOT NULL AND decided_at IS NOT NULL AND decision_reason IS NOT NULL)
 )
);
CREATE INDEX provider_application_documents_application
 ON public.provider_application_documents(application_id, uploaded_at DESC, id);

CREATE FUNCTION public.guard_provider_application_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.id, NEW.application_id, NEW.application_revision, NEW.kind, NEW.filename, NEW.mime_type,
     NEW.content, NEW.sha256, NEW.uploaded_by, NEW.uploaded_at)
    IS DISTINCT FROM
    (OLD.id, OLD.application_id, OLD.application_revision, OLD.kind, OLD.filename, OLD.mime_type,
     OLD.content, OLD.sha256, OLD.uploaded_by, OLD.uploaded_at) THEN
  RAISE EXCEPTION 'Application evidence cannot be changed after upload';
 END IF;
 IF OLD.status <> 'pending' THEN
  RAISE EXCEPTION 'A decided document cannot be decided again';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER provider_application_document_guard BEFORE UPDATE ON public.provider_application_documents
 FOR EACH ROW EXECUTE FUNCTION public.guard_provider_application_document();

CREATE FUNCTION public.retain_provider_application_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Application evidence is retained and cannot be deleted or truncated'; END $$;
CREATE TRIGGER provider_application_document_retained BEFORE DELETE ON public.provider_application_documents
 FOR EACH ROW EXECUTE FUNCTION public.retain_provider_application_document();
CREATE TRIGGER provider_application_document_no_truncate BEFORE TRUNCATE ON public.provider_application_documents
 FOR EACH STATEMENT EXECUTE FUNCTION public.retain_provider_application_document();
