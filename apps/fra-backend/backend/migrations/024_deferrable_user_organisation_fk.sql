-- Migration: 024_deferrable_user_organisation_fk.sql
-- users.organisation_id references organisations, and organisations.created_by_user_id
-- references users, so sign-up (which creates both in one transaction) could insert
-- neither first: every sign-up failed with a foreign key violation on a real database.
-- Checking the users -> organisations key at commit lets the pair be created together.

ALTER TABLE public.users
    ALTER CONSTRAINT users_organisation_id_fk DEFERRABLE INITIALLY DEFERRED;
