-- Add foreign key constraints for organisation_id columns
-- These reference the organisations table created in 003_organisations.sql

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_organisation_id_fk') THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_organisation_id_fk
      FOREIGN KEY (organisation_id) REFERENCES public.organisations(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'assessments_organisation_id_fk') THEN
    ALTER TABLE public.assessments
      ADD CONSTRAINT assessments_organisation_id_fk
      FOREIGN KEY (organisation_id) REFERENCES public.organisations(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'keypasses_organisation_id_fk') THEN
    ALTER TABLE public.keypasses
      ADD CONSTRAINT keypasses_organisation_id_fk
      FOREIGN KEY (organisation_id) REFERENCES public.organisations(id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchases_organisation_id_fk') THEN
    ALTER TABLE public.purchases
      ADD CONSTRAINT purchases_organisation_id_fk
      FOREIGN KEY (organisation_id) REFERENCES public.organisations(id);
  END IF;
END $$;
