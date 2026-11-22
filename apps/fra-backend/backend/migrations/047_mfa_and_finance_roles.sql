-- Additive security state: no implicit conversion of environment allowlists to grants.
CREATE TABLE public.user_mfa (
 user_id uuid PRIMARY KEY REFERENCES public.users(id), secret jsonb NOT NULL,
 enabled boolean NOT NULL DEFAULT false, version integer NOT NULL DEFAULT 1,
 last_counter bigint NOT NULL DEFAULT -1, attempts integer NOT NULL DEFAULT 0,
 locked_until timestamptz, pending_until timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.user_security_roles (
 user_id uuid NOT NULL REFERENCES public.users(id), role text NOT NULL CHECK(role='finance'),
 granted_by uuid NOT NULL REFERENCES public.users(id), reason text NOT NULL CHECK(length(reason)>=10),
 granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
 PRIMARY KEY(user_id,role)
);
CREATE TABLE public.security_role_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, user_id uuid NOT NULL,
 actor_id uuid NOT NULL, action text NOT NULL, reason text NOT NULL,
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION public.security_events_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Security role events are append only'; END $$;
CREATE TRIGGER security_events_immutable BEFORE UPDATE OR DELETE ON public.security_role_events
 FOR EACH ROW EXECUTE FUNCTION public.security_events_immutable();
