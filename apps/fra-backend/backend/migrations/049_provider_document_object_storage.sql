-- Evidence documents can now live in S3 as well as in the row. A document is in exactly one place, which is
-- recorded on the row, and the database still enforces what it can: the size bounds for each place, a well-formed
-- SHA-256, and, for a file kept in the row, that the hash matches the bytes. For a file kept in S3 the hash is
-- checked by the application when it is written and again every time it is read.
--
-- Existing rows keep their bytes in the database. A file is never moved between places, so nothing is rewritten.
ALTER TABLE public.provider_application_documents
 ADD COLUMN storage text NOT NULL DEFAULT 'database' CHECK(storage IN ('database','s3')),
 ADD COLUMN storage_key text,
 ADD COLUMN size_bytes integer,
 ADD COLUMN scan_status text NOT NULL DEFAULT 'not_scanned' CHECK(scan_status IN ('not_scanned','clean')),
 ADD COLUMN scanned_at timestamptz,
 ADD COLUMN scan_engine text;

-- Fill in the size of every existing row. The guard trigger refuses any UPDATE of a stored document, so it is switched
-- off for this one statement and back on straight after; the migration runs in a single transaction.
ALTER TABLE public.provider_application_documents DISABLE TRIGGER provider_application_document_guard;
UPDATE public.provider_application_documents SET size_bytes = octet_length(content);
ALTER TABLE public.provider_application_documents ENABLE TRIGGER provider_application_document_guard;
ALTER TABLE public.provider_application_documents ALTER COLUMN size_bytes SET NOT NULL;

ALTER TABLE public.provider_application_documents ALTER COLUMN content DROP NOT NULL;
ALTER TABLE public.provider_application_documents
 DROP CONSTRAINT provider_application_documents_check,
 DROP CONSTRAINT provider_application_documents_content_check;

ALTER TABLE public.provider_application_documents
 ADD CONSTRAINT provider_application_documents_location CHECK(
  (storage = 'database' AND content IS NOT NULL AND storage_key IS NULL
    AND size_bytes = octet_length(content) AND size_bytes BETWEEN 8 AND 524288
    AND sha256 = encode(sha256(content), 'hex'))
  OR
  (storage = 's3' AND content IS NULL AND storage_key IS NOT NULL AND length(storage_key) BETWEEN 1 AND 300
    AND size_bytes BETWEEN 8 AND 10485760 AND sha256 ~ '^[0-9a-f]{64}$')
 ),
 ADD CONSTRAINT provider_application_documents_scan CHECK(
  (scan_status = 'not_scanned' AND scanned_at IS NULL AND scan_engine IS NULL)
  OR (scan_status = 'clean' AND scanned_at IS NOT NULL AND scan_engine IS NOT NULL)
 );
CREATE UNIQUE INDEX provider_application_documents_storage_key
 ON public.provider_application_documents(storage_key) WHERE storage_key IS NOT NULL;

-- Same guard as before, now covering where the file is kept and how it was scanned.
CREATE OR REPLACE FUNCTION public.guard_provider_application_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF (NEW.id, NEW.application_id, NEW.application_revision, NEW.kind, NEW.filename, NEW.mime_type,
     NEW.content, NEW.sha256, NEW.uploaded_by, NEW.uploaded_at,
     NEW.storage, NEW.storage_key, NEW.size_bytes, NEW.scan_status, NEW.scanned_at, NEW.scan_engine)
    IS DISTINCT FROM
    (OLD.id, OLD.application_id, OLD.application_revision, OLD.kind, OLD.filename, OLD.mime_type,
     OLD.content, OLD.sha256, OLD.uploaded_by, OLD.uploaded_at,
     OLD.storage, OLD.storage_key, OLD.size_bytes, OLD.scan_status, OLD.scanned_at, OLD.scan_engine) THEN
  RAISE EXCEPTION 'Application evidence cannot be changed after upload';
 END IF;
 IF OLD.status <> 'pending' THEN
  RAISE EXCEPTION 'A decided document cannot be decided again';
 END IF;
 RETURN NEW;
END $$;
