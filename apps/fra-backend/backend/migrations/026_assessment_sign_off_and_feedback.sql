-- Migration: 026_assessment_sign_off_and_feedback.sql
-- The mobile app asked the employer to sign off each assessment and invited feedback,
-- but kept both on the phone only. The website now records them here.
-- (Numbered 026 so it sorts after 025_hash_refresh_tokens.sql on the security branch.)

-- One sign-off per assessment: who confirmed they reviewed and authorise it, and when
CREATE TABLE IF NOT EXISTS public.assessment_sign_offs (
  assessment_id      uuid PRIMARY KEY REFERENCES public.assessments(id) ON DELETE CASCADE,
  organisation_id    uuid NOT NULL,
  signed_by_user_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  signer_name        text NOT NULL,
  signer_role        text,
  statement          text NOT NULL,
  signed_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assessment_sign_offs_org_idx ON public.assessment_sign_offs(organisation_id);

-- Feedback on the health check: one per person per assessment (later feedback replaces earlier)
CREATE TABLE IF NOT EXISTS public.assessment_feedback (
  assessment_id    uuid NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  organisation_id  uuid NOT NULL,
  rating           integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comments         text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assessment_id, user_id)
);
