-- Preserve issued evidence independently of mutable profiles and source-row retention.
-- No source foreign keys: deleting a user/assessment must not silently erase verification.
CREATE TABLE IF NOT EXISTS public.certificate_records (
  certificate_number text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('training', 'assessment')),
  source_id uuid NOT NULL,
  user_id uuid,
  organisation_id uuid,
  assessment_id uuid UNIQUE,
  session_id uuid,
  training_key text UNIQUE,
  snapshot jsonb NOT NULL CHECK ((
    jsonb_typeof(snapshot) = 'object'
    AND snapshot ?& ARRAY['kind','certificateNumber','issuedAt','completedAt','holderName','organisationName','title','quizScore','areasAssessed','courseId','courseVersion','snapshotOrigin']
    AND snapshot->>'certificateNumber' = certificate_number
    AND snapshot->>'kind' = kind
  ) IS TRUE),
  status text NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'revoked')),
  revoked_at timestamptz,
  revoked_by uuid,
  revocation_reason text,
  CHECK (
    (status = 'valid' AND revoked_at IS NULL AND revoked_by IS NULL AND revocation_reason IS NULL)
    OR (status = 'revoked' AND revoked_at IS NOT NULL AND revoked_by IS NOT NULL
      AND revocation_reason IS NOT NULL AND length(btrim(revocation_reason)) BETWEEN 1 AND 1000)
  )
);
CREATE INDEX IF NOT EXISTS certificate_records_user_idx ON public.certificate_records(user_id, kind);
CREATE INDEX IF NOT EXISTS certificate_records_org_idx ON public.certificate_records(organisation_id);

-- Freeze the best available legacy details ONCE. This is explicitly reconstructed
-- evidence, not a claim that the current name/course version was captured at issue.
-- Legacy certificates have no training_key: preserve duplicates/references without
-- asserting that they satisfy today's issuance/quiz policy.
INSERT INTO public.certificate_records
  (certificate_number, kind, source_id, user_id, organisation_id, session_id, snapshot)
SELECT c.certificate_number, 'training', c.id, c.user_id, u.organisation_id, c.session_id,
  jsonb_build_object(
    'kind','training','certificateNumber',c.certificate_number,'issuedAt',c.issued_at,
    'completedAt',NULL,'holderName',coalesce(nullif(wp.full_name,''),u.name,''),
    'organisationName',coalesce(nullif(o.name,''),wp.organization_name,''),
    'title','Fraud Risk Awareness Workshop','quizScore',c.quiz_score,'areasAssessed',NULL,
    'courseId','fraud-risk-awareness','courseVersion',NULL,'snapshotOrigin','legacy_reconstructed'
  )
FROM public.certificates c
LEFT JOIN public.users u ON u.id=c.user_id
LEFT JOIN public.workshop_profiles wp ON wp.user_id=c.user_id
LEFT JOIN public.organisations o ON o.id=u.organisation_id;

INSERT INTO public.certificate_records
  (certificate_number, kind, source_id, user_id, organisation_id, assessment_id, snapshot)
SELECT c.certificate_number, 'assessment', c.id, a.created_by_user_id, c.organisation_id, c.assessment_id,
  jsonb_build_object(
    'kind','assessment','certificateNumber',c.certificate_number,'issuedAt',c.issued_at,
    'completedAt',a.submitted_at,'holderName',coalesce(o.name,''),'organisationName',coalesce(o.name,''),
    'title',a.title,'quizScore',NULL,'areasAssessed',13,
    'courseId','fraud-risk-assessment','courseVersion',a.result->>'methodVersion','snapshotOrigin','legacy_reconstructed'
  )
FROM public.assessment_certificates c
JOIN public.assessments a ON a.id=c.assessment_id
LEFT JOIN public.organisations o ON o.id=c.organisation_id;

-- Snapshots/ownership never change. Correction requires a new record, not rewriting
-- evidence at the same reference. Revocation is one-way and keeps its first reason.
CREATE OR REPLACE FUNCTION public.guard_certificate_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.certificate_number,NEW.kind,NEW.source_id,NEW.user_id,NEW.organisation_id,
      NEW.assessment_id,NEW.session_id,NEW.training_key,NEW.snapshot)
    IS DISTINCT FROM
     (OLD.certificate_number,OLD.kind,OLD.source_id,OLD.user_id,OLD.organisation_id,
      OLD.assessment_id,OLD.session_id,OLD.training_key,OLD.snapshot) THEN
    RAISE EXCEPTION 'Certificate evidence is immutable';
  END IF;
  IF OLD.status='revoked' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Certificate revocation is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guard_certificate_record BEFORE UPDATE ON public.certificate_records
FOR EACH ROW EXECUTE FUNCTION public.guard_certificate_record();
