create table if not exists public.assessments (
  id uuid primary key,
  organisation_id uuid not null,
  created_by_user_id uuid not null references public.users(id) on delete restrict,
  title text not null,
  status text not null,
  answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  submitted_at timestamptz
);

create index if not exists assessments_org_id_idx on public.assessments(organisation_id);
create index if not exists assessments_created_by_user_id_idx on public.assessments(created_by_user_id);
