-- Migration: 019_counter_fraud_records.sql
-- GovS 013 records not derived from assessments: counter fraud strategy,
-- identified loss, investigator access, detection activity, gifts and
-- hospitality, conflicts of interest and the policies behind them.
-- Each kind's fields are validated by the API (src/counter-fraud.ts).

CREATE TABLE IF NOT EXISTS public.counter_fraud_records (
    id UUID PRIMARY KEY,
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('strategy', 'loss', 'investigator', 'detection', 'gift_hospitality', 'conflict_of_interest', 'policy')),
    data JSONB NOT NULL,
    created_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counter_fraud_records_org_kind ON public.counter_fraud_records(organisation_id, kind);
