create table if not exists public.packages (
  id text primary key,
  name text not null,
  description text,
  price_cents integer not null default 0,
  currency text not null default 'gbp',
  keypass_allowance integer not null default 0,
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Seed the three product tiers
insert into public.packages (id, name, description, price_cents, currency, keypass_allowance, features, sort_order)
values
  ('pkg_basic', 'Starter', 'Fraud risk assessment with downloadable PDF report', 79500, 'gbp', 1, '["Single fraud risk assessment across 13 key areas", "Downloadable PDF health check report", "ECCTA 2023 compliance snapshot", "1 key-pass included"]'::jsonb, 1),
  ('pkg_training', 'Professional', 'FRA health check + staff awareness training', 179900, 'gbp', 50, '["Everything in Starter", "50 employee key-passes", "Staff awareness training with certificates", "Quarterly reassessment", "Email support"]'::jsonb, 2),
  ('pkg_full', 'Enterprise', 'Complete fraud risk management suite with live dashboard', 499500, 'gbp', -1, '["Everything in Professional", "Unlimited employee key-passes", "Real-time monitoring dashboard", "Risk register and action tracking", "API access", "Priority support", "Compliance reports"]'::jsonb, 3)
on conflict (id) do nothing;
