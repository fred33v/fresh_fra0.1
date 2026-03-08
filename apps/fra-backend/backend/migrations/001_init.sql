create table if not exists public.users (
  id uuid primary key,
  email text not null unique,
  name text not null,
  password_hash text not null,
  role text not null,
  organisation_id uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists public.refresh_tokens (
  token text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists refresh_tokens_user_id_idx on public.refresh_tokens(user_id);
