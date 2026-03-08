create table if not exists public.keypasses (
  code text primary key,
  organisation_id uuid not null,
  status text not null default 'available',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_user_id uuid references public.users(id) on delete set null
);

create index if not exists keypasses_organisation_id_idx
  on public.keypasses(organisation_id);

create index if not exists keypasses_status_idx
  on public.keypasses(status);
