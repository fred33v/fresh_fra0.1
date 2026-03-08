-- Composite indexes to support common query patterns

-- Purchases: duplicate check by org + package + status
create index if not exists purchases_org_package_status_idx
  on public.purchases(organisation_id, package_id, status);

-- Keypasses: quota counting by org + status
create index if not exists keypasses_org_status_idx
  on public.keypasses(organisation_id, status);

-- Assessments: analytics queries by org + status
create index if not exists assessments_org_status_idx
  on public.assessments(organisation_id, status);

-- Purchases: listing by org ordered by creation date
create index if not exists purchases_org_created_idx
  on public.purchases(organisation_id, created_at desc);
