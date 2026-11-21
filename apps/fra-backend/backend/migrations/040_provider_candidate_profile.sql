-- Extend the canonical #86 application. Do not replace its assignments or financial ledger.
ALTER TABLE public.provider_applications ADD COLUMN candidate_profile jsonb;
ALTER TABLE public.provider_applications ADD CONSTRAINT provider_candidate_profile_object
 CHECK(candidate_profile IS NULL OR jsonb_typeof(candidate_profile)='object');
