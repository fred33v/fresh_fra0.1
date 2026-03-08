create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_id uuid,
  actor_email text,
  organisation_id uuid,
  resource_type text,
  resource_id text,
  details jsonb not null default '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_event_type_idx
  on public.audit_logs(event_type);

create index if not exists audit_logs_actor_id_idx
  on public.audit_logs(actor_id);

create index if not exists audit_logs_organisation_id_idx
  on public.audit_logs(organisation_id);

create index if not exists audit_logs_created_at_idx
  on public.audit_logs(created_at);

-- Partition-friendly index for retention queries
create index if not exists audit_logs_resource_type_idx
  on public.audit_logs(resource_type);
