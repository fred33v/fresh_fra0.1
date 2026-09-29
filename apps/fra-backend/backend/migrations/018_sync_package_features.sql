-- Migration: 018_sync_package_features.sql
-- Keep the packages table identical to FALLBACK_PACKAGES in src/types.ts and the web
-- catalogue (apps/fra-web-dashboard/src/data/packages.ts). 006 seeded with
-- "on conflict do nothing", so later edits never reached existing databases.

update public.packages set
  name = 'Starter', price_cents = 79500, keypass_allowance = 1,
  features = '["Single fraud risk assessment across 13 key areas","Downloadable PDF health check report","ECCTA 2023 compliance snapshot","1 key-pass included"]'::jsonb
where id = 'pkg_basic';

update public.packages set
  name = 'Professional', price_cents = 179900, keypass_allowance = 50,
  features = '["Everything in Starter","50 employee key-passes","Staff awareness training with certificates","Quarterly reassessment","Email support"]'::jsonb
where id = 'pkg_training';

update public.packages set
  name = 'Enterprise', price_cents = 499500, keypass_allowance = -1,
  features = '["Everything in Professional","Unlimited employee key-passes","Real-time monitoring dashboard","Risk register and action tracking","API access","Priority support","Compliance reports"]'::jsonb
where id = 'pkg_full';
