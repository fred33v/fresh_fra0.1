-- Migration: 017_enterprise_integrations.sql
-- Enterprise package: API keys, risk register, outgoing webhooks

-- API keys for read-only programmatic access (GRC tools, custom dashboards)
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY,
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    created_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    key_prefix TEXT NOT NULL,
    key_hash TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_org ON public.api_keys(organisation_id);

-- Organisation-level fraud risk register (inherent/residual scoring, owners, actions)
CREATE TABLE IF NOT EXISTS public.risk_register (
    id UUID PRIMARY KEY,
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    risk_area TEXT NOT NULL,
    description TEXT,
    impact INTEGER NOT NULL CHECK (impact BETWEEN 1 AND 5),
    likelihood INTEGER NOT NULL CHECK (likelihood BETWEEN 1 AND 5),
    control_effectiveness TEXT NOT NULL CHECK (control_effectiveness IN ('very_strong', 'reasonably_strong', 'some_gaps', 'weak', 'none')),
    controls TEXT,
    inherent_score INTEGER NOT NULL,
    residual_score INTEGER NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
    owner_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action_plan TEXT,
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'mitigated', 'accepted', 'closed')),
    created_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_register_org ON public.risk_register(organisation_id);
CREATE INDEX IF NOT EXISTS idx_risk_register_org_priority ON public.risk_register(organisation_id, priority);

-- Outgoing webhooks to SIEM/GRC platforms
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
    id UUID PRIMARY KEY,
    organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events TEXT[] NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_delivery_at TIMESTAMPTZ,
    last_delivery_status INTEGER
);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org ON public.webhook_endpoints(organisation_id);
