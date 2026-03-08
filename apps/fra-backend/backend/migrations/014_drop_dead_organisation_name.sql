-- Drop dead column added in migration 003 but never used by application code

ALTER TABLE public.users DROP COLUMN IF EXISTS organisation_name;
