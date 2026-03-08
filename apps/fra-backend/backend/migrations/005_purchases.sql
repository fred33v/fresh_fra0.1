create table if not exists public.purchases (
  id uuid primary key,
  organisation_id uuid not null,
  user_id uuid not null references public.users(id) on delete restrict,
  package_id text not null,
  status text not null default 'requires_confirmation',
  payment_intent_id text,
  client_secret text,
  amount_cents integer not null default 0,
  currency text not null default 'gbp',
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create index if not exists purchases_organisation_id_idx
  on public.purchases(organisation_id);

create index if not exists purchases_user_id_idx
  on public.purchases(user_id);

create index if not exists purchases_payment_intent_id_idx
  on public.purchases(payment_intent_id);
