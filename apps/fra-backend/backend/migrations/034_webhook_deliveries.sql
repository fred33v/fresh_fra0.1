-- Durable per-endpoint delivery, with recoverable leases and no copied signing secrets.
-- Endpoint IDs intentionally survive endpoint removal so pending rows can be cancelled.
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id uuid PRIMARY KEY,
  event_id uuid NOT NULL,
  endpoint_id uuid NOT NULL,
  organisation_id uuid NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivering','delivered','dead','cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  cycle_attempts integer NOT NULL DEFAULT 0 CHECK (cycle_attempts >= 0),
  retry_count integer NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  lease_token uuid,
  leased_until timestamptz,
  last_status integer,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(event_id,endpoint_id)
);
CREATE INDEX IF NOT EXISTS webhook_deliveries_due_idx ON public.webhook_deliveries(next_attempt_at) WHERE status='pending';
CREATE INDEX IF NOT EXISTS webhook_deliveries_lease_idx ON public.webhook_deliveries(leased_until) WHERE status='delivering';
CREATE INDEX IF NOT EXISTS webhook_deliveries_org_idx ON public.webhook_deliveries(organisation_id,created_at);
