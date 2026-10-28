-- Sign-up now confirms the email address before the account can be used.
-- NULL means not yet confirmed. Accounts that already exist are treated as confirmed.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;

DO $$
BEGIN
  -- Backfill only when the column is first added (no row has a value yet), so a re-run
  -- never marks a newer, unconfirmed sign-up as confirmed
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE email_verified_at IS NOT NULL) THEN
    UPDATE public.users SET email_verified_at = created_at;
  END IF;
END $$;
