import type { DbExecutor } from './transaction.js';
import { getDbPool } from '../db.js';
import type { Organisation } from '../types.js';

export async function dbInsertOrganisation(org: Organisation): Promise<void> {
  const pool = getDbPool();
  await pool.query(
    'insert into public.organisations (id, name, created_by_user_id, employee_count, region, industry, created_at, updated_at) values ($1,$2,$3,$4,$5,$6,$7,$8)',
    [org.id, org.name, org.createdByUserId, org.employeeCount ?? null, org.region ?? null, org.industry ?? null, org.createdAt, org.updatedAt]
  );
}

export async function dbGetOrganisationById(id: string, db?: DbExecutor): Promise<Organisation | null> {
  const pool = db ?? getDbPool();
  const res = await pool.query<{
    id: string; name: string; created_by_user_id: string; employee_count: string | null;
    region: string | null; industry: string | null; created_at: string; updated_at: string;
  }>('select id, name, created_by_user_id, employee_count, region, industry, created_at, updated_at from public.organisations where id = $1 limit 1', [id]);
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id, name: row.name, createdByUserId: row.created_by_user_id,
    employeeCount: row.employee_count ?? undefined, region: row.region ?? undefined,
    industry: row.industry ?? undefined,
    createdAt: new Date(row.created_at).toISOString(), updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function dbUpdateOrganisation(
  id: string,
  updates: { name?: string; employeeCount?: string; region?: string; industry?: string },
  updatedAt: string,
): Promise<void> {
  const pool = getDbPool();
  await pool.query(
    `update public.organisations set
       name = coalesce($2, name),
       employee_count = coalesce($3, employee_count),
       region = coalesce($4, region),
       industry = coalesce($5, industry),
       updated_at = $6
     where id = $1`,
    [id, updates.name ?? null, updates.employeeCount ?? null, updates.region ?? null, updates.industry ?? null, updatedAt]
  );
}
