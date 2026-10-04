-- Migration: 021_associated_persons_and_reminders.sql
-- ECCTA principle 4: associated persons and their due diligence join the
-- counter-fraud register kinds. Reassessment reminders record what was sent,
-- so each reminder goes out once.

ALTER TABLE public.counter_fraud_records DROP CONSTRAINT IF EXISTS counter_fraud_records_kind_check;
ALTER TABLE public.counter_fraud_records ADD CONSTRAINT counter_fraud_records_kind_check
    CHECK (kind IN ('strategy', 'loss', 'investigator', 'detection', 'gift_hospitality', 'conflict_of_interest', 'policy', 'reporting_route', 'associated_person'));

CREATE TABLE IF NOT EXISTS public.reassessment_reminders (
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    due_date DATE NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('due_soon', 'overdue')),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (organisation_id, due_date, kind)
);
