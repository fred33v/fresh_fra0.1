-- Immutable attribution and append-only accounting. Amounts are integer minor units.
ALTER TABLE public.provider_assignments ADD CONSTRAINT provider_assignment_identity UNIQUE(id,application_id);
CREATE TABLE public.provider_sale_attributions (
 purchase_id uuid PRIMARY KEY REFERENCES public.purchases(id) ON DELETE RESTRICT,
 application_id uuid NOT NULL REFERENCES public.provider_applications(id) ON DELETE RESTRICT,
 assignment_id uuid NOT NULL REFERENCES public.provider_assignments(id) ON DELETE RESTRICT,
 rate_bps integer NOT NULL DEFAULT 1700 CHECK(rate_bps=1700),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(purchase_id,application_id),
 FOREIGN KEY(assignment_id,application_id) REFERENCES public.provider_assignments(id,application_id) ON DELETE RESTRICT
);
CREATE INDEX provider_attributions_application ON public.provider_sale_attributions(application_id);
CREATE TABLE public.provider_commission_entries (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 purchase_id uuid NOT NULL REFERENCES public.provider_sale_attributions(purchase_id) ON DELETE RESTRICT,
 application_id uuid NOT NULL REFERENCES public.provider_applications(id) ON DELETE RESTRICT,
 currency text NOT NULL CHECK(currency ~ '^[a-z]{3}$'),
 delta_cents integer NOT NULL CHECK(delta_cents<>0), target_cents integer NOT NULL CHECK(target_cents>=0),
 reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(purchase_id,application_id) REFERENCES public.provider_sale_attributions(purchase_id,application_id) ON DELETE RESTRICT
);
CREATE INDEX provider_commission_application ON public.provider_commission_entries(application_id,currency);
CREATE TABLE public.provider_payouts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 application_id uuid NOT NULL REFERENCES public.provider_applications(id) ON DELETE RESTRICT,
 currency text NOT NULL CHECK(currency ~ '^[a-z]{3}$'),
 amount_cents integer NOT NULL CHECK(amount_cents>0),
 status text NOT NULL DEFAULT 'prepared' CHECK(status IN ('prepared','approved','recorded','cancelled')),
 request_key uuid NOT NULL UNIQUE,
 prepared_by uuid NOT NULL, approved_by uuid, recorded_by uuid,
 settlement_reference text UNIQUE, reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),approved_at timestamptz,recorded_at timestamptz,
 CHECK(approved_by IS NULL OR approved_by<>prepared_by),
 CHECK(recorded_by IS NULL OR recorded_by<>prepared_by),
 CHECK(status NOT IN ('approved','recorded') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
 CHECK(status<>'recorded' OR (recorded_by IS NOT NULL AND recorded_at IS NOT NULL AND length(settlement_reference) BETWEEN 6 AND 160))
);
CREATE INDEX provider_payout_application ON public.provider_payouts(application_id,currency);
CREATE TRIGGER provider_attribution_retained BEFORE UPDATE OR DELETE ON public.provider_sale_attributions
 FOR EACH ROW EXECUTE FUNCTION public.esign_no_change();
CREATE TRIGGER provider_attribution_no_truncate BEFORE TRUNCATE ON public.provider_sale_attributions
 FOR EACH STATEMENT EXECUTE FUNCTION public.esign_no_change();
CREATE TRIGGER provider_commission_retained BEFORE UPDATE OR DELETE ON public.provider_commission_entries
 FOR EACH ROW EXECUTE FUNCTION public.esign_no_change();
CREATE TRIGGER provider_commission_no_truncate BEFORE TRUNCATE ON public.provider_commission_entries
 FOR EACH STATEMENT EXECUTE FUNCTION public.esign_no_change();
CREATE FUNCTION public.provider_payout_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status IN ('recorded','cancelled') THEN RAISE EXCEPTION 'Settled payout history is immutable'; END IF;
 IF (NEW.id,NEW.application_id,NEW.currency,NEW.amount_cents,NEW.request_key,NEW.prepared_by,NEW.reason,NEW.created_at)
 IS DISTINCT FROM (OLD.id,OLD.application_id,OLD.currency,OLD.amount_cents,OLD.request_key,OLD.prepared_by,OLD.reason,OLD.created_at)
 THEN RAISE EXCEPTION 'Payout instruction is immutable'; END IF;
 IF NOT ((OLD.status='prepared' AND NEW.status IN ('approved','cancelled')) OR (OLD.status='approved' AND NEW.status IN ('recorded','cancelled')))
 THEN RAISE EXCEPTION 'Invalid payout transition'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER provider_payout_states BEFORE UPDATE ON public.provider_payouts FOR EACH ROW EXECUTE FUNCTION public.provider_payout_transition();
CREATE TRIGGER provider_payout_retained BEFORE DELETE ON public.provider_payouts FOR EACH ROW EXECUTE FUNCTION public.esign_no_change();
CREATE TRIGGER provider_payout_no_truncate BEFORE TRUNCATE ON public.provider_payouts FOR EACH STATEMENT EXECUTE FUNCTION public.esign_no_change();
