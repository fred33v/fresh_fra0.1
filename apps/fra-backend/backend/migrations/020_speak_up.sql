-- Migration: 020_speak_up.sql
-- GovS 013 component 7 (reporting routes): speak-up intake link per organisation,
-- reports with an anonymous follow-up channel, and a reporting-route register kind.

CREATE TABLE IF NOT EXISTS public.speak_up_intake (
    organisation_id UUID PRIMARY KEY REFERENCES public.organisations(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    intro TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reporter IP addresses are never stored. Anonymous reports hold no contact details;
-- only a SHA-256 hash of the reporter's access key is kept.
CREATE TABLE IF NOT EXISTS public.speak_up_reports (
    id UUID PRIMARY KEY,
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    reference TEXT NOT NULL UNIQUE,
    access_key_hash TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    occurred_when TEXT,
    location TEXT,
    people_involved TEXT,
    amount_gbp NUMERIC(14, 2),
    relationship TEXT NOT NULL,
    anonymous BOOLEAN NOT NULL,
    reporter_name TEXT,
    reporter_email TEXT,
    reporter_phone TEXT,
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'triage', 'investigating', 'referred', 'closed')),
    assigned_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    referral TEXT CHECK (referral IN ('investigator', 'police', 'action_fraud', 'nhscfa', 'regulator', 'other')),
    referral_notes TEXT,
    outcome TEXT,
    incident_id UUID REFERENCES compliance_incidents(id) ON DELETE SET NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (NOT anonymous OR (reporter_name IS NULL AND reporter_email IS NULL AND reporter_phone IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_speak_up_reports_org_status ON public.speak_up_reports(organisation_id, status);

CREATE TABLE IF NOT EXISTS public.speak_up_messages (
    id UUID PRIMARY KEY,
    report_id UUID NOT NULL REFERENCES public.speak_up_reports(id) ON DELETE CASCADE,
    author TEXT NOT NULL CHECK (author IN ('reporter', 'handler')),
    author_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_speak_up_messages_report ON public.speak_up_messages(report_id, created_at);

-- Reporting routes join the counter-fraud register kinds
ALTER TABLE public.counter_fraud_records DROP CONSTRAINT IF EXISTS counter_fraud_records_kind_check;
ALTER TABLE public.counter_fraud_records ADD CONSTRAINT counter_fraud_records_kind_check
    CHECK (kind IN ('strategy', 'loss', 'investigator', 'detection', 'gift_hospitality', 'conflict_of_interest', 'policy', 'reporting_route'));
