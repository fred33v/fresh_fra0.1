-- Keep main's commission ledger and staff bank traces; generated references do not prove bank settlement.
ALTER TABLE public.provider_payouts
 ADD COLUMN instruction_reference text GENERATED ALWAYS AS ('FRA-COM-'||replace(id::text,'-','')) STORED,
 ADD COLUMN confirmation_reference text GENERATED ALWAYS AS (CASE WHEN status='recorded' THEN 'FRA-CNF-COM-'||replace(id::text,'-','') END) STORED;
CREATE UNIQUE INDEX provider_payout_instruction_ref ON public.provider_payouts(instruction_reference);
CREATE UNIQUE INDEX provider_payout_confirmation_ref ON public.provider_payouts(confirmation_reference);
CREATE TABLE public.finance_payment_profiles (
 id uuid PRIMARY KEY,identifier_id uuid NOT NULL REFERENCES public.relationship_identifiers(id) ON DELETE RESTRICT,
 version integer NOT NULL CHECK(version>0),revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 kind text NOT NULL CHECK(kind IN ('supplier','payroll')),last4 text NOT NULL CHECK(last4 ~ '^\d{4}$'),
 encrypted_details jsonb NOT NULL CHECK(jsonb_typeof(encrypted_details)='object'),
 status text NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','approved','rejected','suspended')),
 verification_method text CHECK(verification_method='staff_evidence_review'),verification_reference text,
 reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 2000),submitted_by uuid NOT NULL,reviewed_by uuid,
 created_at timestamptz NOT NULL DEFAULT now(),reviewed_at timestamptz,
 UNIQUE(identifier_id,version),
 CHECK(status<>'approved' OR (reviewed_by IS NOT NULL AND reviewed_by<>submitted_by AND verification_method IS NOT NULL AND verification_reference IS NOT NULL AND length(verification_reference)>=6 AND reviewed_at IS NOT NULL))
);
CREATE TABLE public.finance_fee_agreements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),delivery_id uuid NOT NULL REFERENCES public.service_deliveries(id) ON DELETE RESTRICT,
 purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE RESTRICT,
 identifier_id uuid NOT NULL REFERENCES public.relationship_identifiers(id) ON DELETE RESTRICT,
 version integer NOT NULL CHECK(version>0),revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 net_cents integer NOT NULL CHECK(net_cents>0),vat_cents integer NOT NULL CHECK(vat_cents>=0),
 total_cents integer GENERATED ALWAYS AS(net_cents+vat_cents) STORED CHECK(total_cents BETWEEN 1 AND 100000000),
 currency text NOT NULL DEFAULT 'gbp' CHECK(currency='gbp'),terms text NOT NULL CHECK(length(terms) BETWEEN 20 AND 4000),
 status text NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','accepted','refused')),
 proposed_by uuid NOT NULL,decided_by uuid,decided_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(delivery_id,version),CHECK(status='proposed' OR (decided_by IS NOT NULL AND proposed_by<>decided_by AND decided_at IS NOT NULL))
);
CREATE TABLE public.finance_instructions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_key uuid NOT NULL UNIQUE,
 kind text NOT NULL CHECK(kind IN ('supplier_service_fee','payroll_gross')),
 identifier_id uuid NOT NULL REFERENCES public.relationship_identifiers(id) ON DELETE RESTRICT,
 profile_id uuid NOT NULL REFERENCES public.finance_payment_profiles(id) ON DELETE RESTRICT,
 fee_id uuid REFERENCES public.finance_fee_agreements(id) ON DELETE RESTRICT,
 delivery_id uuid REFERENCES public.service_deliveries(id) ON DELETE RESTRICT,
 gross_cents integer NOT NULL CHECK(gross_cents BETWEEN 1 AND 100000000),currency text NOT NULL DEFAULT 'gbp' CHECK(currency='gbp'),
 period_from date,period_until date,
 status text NOT NULL DEFAULT 'prepared' CHECK(status IN ('prepared','approved','recorded','cancelled')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),reason text NOT NULL CHECK(length(reason) BETWEEN 10 AND 2000),action_reason text CHECK(action_reason IS NULL OR length(action_reason) BETWEEN 10 AND 2000),
 prepared_by uuid NOT NULL,last_action_by uuid NOT NULL,approved_by uuid,recorded_by uuid,external_reference text UNIQUE,recording_method text,
 created_at timestamptz NOT NULL DEFAULT now(),approved_at timestamptz,recorded_at timestamptz,
 instruction_reference text GENERATED ALWAYS AS('FRA-'||CASE WHEN kind='payroll_gross' THEN 'PAYROLL-' ELSE 'SUPFEE-' END||replace(id::text,'-','')) STORED UNIQUE,
 confirmation_reference text GENERATED ALWAYS AS(CASE WHEN status='recorded' THEN 'FRA-CNF-'||replace(id::text,'-','') END) STORED UNIQUE,
 CHECK((kind='supplier_service_fee' AND fee_id IS NOT NULL AND delivery_id IS NOT NULL AND period_from IS NULL AND period_until IS NULL) OR (kind='payroll_gross' AND fee_id IS NULL AND delivery_id IS NULL AND period_from IS NOT NULL AND period_until>period_from)),
 CHECK(approved_by IS NULL OR approved_by<>prepared_by),CHECK(recorded_by IS NULL OR recorded_by<>prepared_by),
 CHECK(status NOT IN ('approved','recorded') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
 CHECK(status<>'recorded' OR (recorded_by IS NOT NULL AND external_reference IS NOT NULL AND length(external_reference)>=6 AND recorded_at IS NOT NULL AND recording_method IS NOT NULL AND recording_method=CASE WHEN kind='payroll_gross' THEN 'staff_payroll_run_attestation' ELSE 'staff_bank_attestation' END))
);
CREATE UNIQUE INDEX finance_fee_one_live_settlement ON public.finance_instructions(delivery_id) WHERE kind='supplier_service_fee' AND status<>'cancelled';
CREATE UNIQUE INDEX finance_payroll_one_live_period ON public.finance_instructions(identifier_id,period_from,period_until) WHERE kind='payroll_gross' AND status<>'cancelled';
CREATE INDEX finance_profiles_identity ON public.finance_payment_profiles(identifier_id,version DESC);
CREATE INDEX finance_instructions_identity ON public.finance_instructions(identifier_id,created_at);
CREATE TABLE public.finance_events (
 aggregate_type text NOT NULL,aggregate_id uuid NOT NULL,revision integer NOT NULL,snapshot jsonb NOT NULL,occurred_at timestamptz NOT NULL,
 previous_hash text NOT NULL,hash text NOT NULL,canonical text NOT NULL,PRIMARY KEY(aggregate_type,aggregate_id,revision)
);
CREATE FUNCTION public.finance_record_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='finance_payment_profiles' THEN
  IF (NEW.id,NEW.identifier_id,NEW.version,NEW.kind,NEW.last4,NEW.encrypted_details,NEW.submitted_by,NEW.created_at) IS DISTINCT FROM
  (OLD.id,OLD.identifier_id,OLD.version,OLD.kind,OLD.last4,OLD.encrypted_details,OLD.submitted_by,OLD.created_at) OR NEW.revision<>OLD.revision+1 OR NOT ((OLD.status='submitted' AND NEW.status IN ('approved','rejected')) OR (OLD.status='approved' AND NEW.status='suspended')) THEN RAISE EXCEPTION 'Immutable bank profile or stale review'; END IF;
 ELSIF TG_TABLE_NAME='finance_fee_agreements' THEN
  IF (NEW.id,NEW.delivery_id,NEW.purchase_id,NEW.identifier_id,NEW.version,NEW.net_cents,NEW.vat_cents,NEW.currency,NEW.terms,NEW.proposed_by,NEW.created_at) IS DISTINCT FROM
  (OLD.id,OLD.delivery_id,OLD.purchase_id,OLD.identifier_id,OLD.version,OLD.net_cents,OLD.vat_cents,OLD.currency,OLD.terms,OLD.proposed_by,OLD.created_at) OR NEW.revision<>OLD.revision+1 OR OLD.status<>'proposed' OR NEW.status NOT IN ('accepted','refused') THEN RAISE EXCEPTION 'Immutable agreed fee or stale decision'; END IF;
 ELSE
  IF (NEW.id,NEW.request_key,NEW.kind,NEW.identifier_id,NEW.profile_id,NEW.fee_id,NEW.delivery_id,NEW.gross_cents,NEW.currency,NEW.period_from,NEW.period_until,NEW.prepared_by,NEW.reason,NEW.created_at) IS DISTINCT FROM
  (OLD.id,OLD.request_key,OLD.kind,OLD.identifier_id,OLD.profile_id,OLD.fee_id,OLD.delivery_id,OLD.gross_cents,OLD.currency,OLD.period_from,OLD.period_until,OLD.prepared_by,OLD.reason,OLD.created_at) OR NEW.revision<>OLD.revision+1 OR OLD.status IN ('recorded','cancelled') OR NOT ((OLD.status='prepared' AND NEW.status IN ('approved','cancelled')) OR (OLD.status='approved' AND NEW.status IN ('recorded','cancelled'))) THEN RAISE EXCEPTION 'Immutable finance instruction or invalid transition'; END IF;
 END IF;RETURN NEW;
END $$;
CREATE FUNCTION public.finance_record_event() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous text; moment timestamptz:=clock_timestamp(); value jsonb; payload text;
BEGIN
 value:=to_jsonb(NEW)-'encrypted_details';SELECT hash INTO previous FROM public.finance_events WHERE aggregate_type=TG_TABLE_NAME AND aggregate_id=NEW.id ORDER BY revision DESC LIMIT 1;
 previous:=COALESCE(previous,repeat('0',64));payload:=jsonb_build_array(TG_TABLE_NAME,NEW.id::text,NEW.revision,value,moment,previous)::text;
 INSERT INTO public.finance_events VALUES(TG_TABLE_NAME,NEW.id,NEW.revision,value,moment,previous,encode(sha256(convert_to(payload,'UTF8')),'hex'),payload);RETURN NEW;
END $$;
DO $$ DECLARE name text; BEGIN
 FOREACH name IN ARRAY ARRAY['finance_payment_profiles','finance_fee_agreements','finance_instructions'] LOOP
 EXECUTE format('CREATE TRIGGER finance_guard BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.finance_record_guard()',name);
 EXECUTE format('CREATE TRIGGER finance_audit AFTER INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.finance_record_event()',name);
 EXECUTE format('CREATE TRIGGER finance_no_delete BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.esign_no_change()',name);
 EXECUTE format('CREATE TRIGGER finance_no_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION public.esign_no_change()',name);
 END LOOP;
END $$;
CREATE TRIGGER finance_events_no_change BEFORE UPDATE OR DELETE ON public.finance_events FOR EACH ROW EXECUTE FUNCTION public.esign_no_change();
CREATE TRIGGER finance_events_no_truncate BEFORE TRUNCATE ON public.finance_events FOR EACH STATEMENT EXECUTE FUNCTION public.esign_no_change();
-- New bank profiles fence subsequent commission instructions too; never guess historic beneficiaries.
ALTER TABLE public.provider_payouts
 ADD COLUMN payment_profile_id uuid REFERENCES public.finance_payment_profiles(id) ON DELETE RESTRICT,
 ADD COLUMN beneficiary_source text GENERATED ALWAYS AS(CASE WHEN payment_profile_id IS NULL THEN 'legacy_external_bank_workflow' ELSE 'approved_payment_profile' END) STORED;
CREATE FUNCTION public.provider_payout_beneficiary_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.payment_profile_id IS DISTINCT FROM OLD.payment_profile_id THEN RAISE EXCEPTION 'Payout beneficiary binding is immutable'; END IF; RETURN NEW; END $$;
CREATE TRIGGER provider_payout_beneficiary_frozen BEFORE UPDATE ON public.provider_payouts FOR EACH ROW EXECUTE FUNCTION public.provider_payout_beneficiary_frozen();
