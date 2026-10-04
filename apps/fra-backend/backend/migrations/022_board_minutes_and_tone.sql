-- Migration: 022_board_minutes_and_tone.sql
-- ECCTA principle 1 (top-level commitment): board and committee minutes on fraud,
-- and tone-from-the-top statements, join the counter-fraud register kinds.

ALTER TABLE public.counter_fraud_records DROP CONSTRAINT IF EXISTS counter_fraud_records_kind_check;
ALTER TABLE public.counter_fraud_records ADD CONSTRAINT counter_fraud_records_kind_check
    CHECK (kind IN ('strategy', 'loss', 'investigator', 'detection', 'gift_hospitality', 'conflict_of_interest', 'policy',
                    'reporting_route', 'associated_person', 'board_minute', 'tone_statement'));
