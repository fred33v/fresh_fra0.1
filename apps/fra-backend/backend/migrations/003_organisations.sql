create table if not exists public.organisations (
  id uuid primary key,
  name text not null,
  created_by_user_id uuid not null references public.users(id) on delete restrict,
  employee_count text,
  region text,
  industry text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organisations_created_by_user_id_idx
  on public.organisations(created_by_user_id);

-- Backfill: add a foreign key from users to organisations (nullable for migration safety)
alter table public.users
  add column if not exists organisation_name text;
