-- One-off for a LOCAL database that applied this module's earlier migrations
-- 037_provider_recruitment.sql and 038_provider_agreements.sql.
--
-- Those files created public.provider_applications, which main's own migration
-- 037_provider_applications.sql also creates. This renames this module's tables to the
-- new names, and records 040/041 as applied instead of 037/038, so `pnpm migrate` can then
-- apply main's 037-039 and skip 040/041. It changes no rows. It does nothing when the
-- database is already in the new shape, so it is safe to run twice.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/reconcile-local-partner-tables.sql
--
-- Take a backup first. Do not run this against a shared or production database.
BEGIN;
DO $$
DECLARE r record;
BEGIN
  IF to_regclass('public.partner_applications') IS NOT NULL THEN
    RAISE NOTICE 'partner_applications already exists: nothing to do';
    RETURN;
  END IF;
  -- Only this module's table has a "profile" column; main's has "company_name".
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'provider_applications' AND column_name = 'profile'
  ) THEN
    RAISE NOTICE 'no earlier partner module tables found: nothing to do';
    RETURN;
  END IF;

  ALTER TABLE public.provider_applications RENAME TO partner_applications;
  ALTER TABLE public.provider_application_events RENAME TO partner_application_events;
  ALTER INDEX public.provider_application_queue RENAME TO partner_application_queue;
  ALTER FUNCTION public.provider_application_revision() RENAME TO partner_application_revision;

  -- A table rename keeps its constraint, index and sequence names. main's migration 037 then creates its own
  -- provider_applications with the same generated names, and its 038 drops "provider_applications_status_check",
  -- so every old-style name must move too (renaming a key constraint renames its index).
  FOR r IN
    SELECT conrelid::regclass::text AS tbl, conname
    FROM pg_constraint
    WHERE conrelid IN ('public.partner_applications'::regclass, 'public.partner_application_events'::regclass)
      AND conname LIKE 'provider\_application%'
  LOOP
    EXECUTE format('ALTER TABLE %s RENAME CONSTRAINT %I TO %I', r.tbl, r.conname,
      regexp_replace(r.conname, '^provider_application', 'partner_application'));
  END LOOP;
  FOR r IN
    SELECT s.relname AS seq
    FROM pg_class s
    WHERE s.relkind = 'S' AND s.relnamespace = 'public'::regnamespace AND s.relname LIKE 'provider\_application%'
  LOOP
    EXECUTE format('ALTER SEQUENCE public.%I RENAME TO %I', r.seq,
      regexp_replace(r.seq, '^provider_application', 'partner_application'));
  END LOOP;

  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    DELETE FROM public.schema_migrations
      WHERE version IN ('037_provider_recruitment.sql', '038_provider_agreements.sql');
    INSERT INTO public.schema_migrations (version)
      VALUES ('040_partner_applications.sql'), ('041_provider_agreements.sql')
      ON CONFLICT (version) DO NOTHING;
  END IF;
  RAISE NOTICE 'renamed the partner module tables and updated schema_migrations';
END $$;
COMMIT;
