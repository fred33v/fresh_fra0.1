import { getDbPool } from '../db.js';
import type { Keypass, KeypassStatus, DbKeypassRow } from '../types.js';

export function rowToKeypass(row: DbKeypassRow): Keypass {
  return {
    code: row.code, organisationId: row.organisation_id, status: row.status as KeypassStatus,
    createdAt: new Date(row.created_at).toISOString(), expiresAt: new Date(row.expires_at).toISOString(),
    usedAt: row.used_at ? new Date(row.used_at).toISOString() : undefined,
  };
}

export async function dbInsertKeypass(kp: Keypass): Promise<void> {
  const pool = getDbPool();
  await pool.query(
    'insert into public.keypasses (code, organisation_id, status, created_at, expires_at, used_at) values ($1,$2,$3,$4,$5,$6)',
    [kp.code, kp.organisationId, kp.status, kp.createdAt, kp.expiresAt, kp.usedAt ?? null]
  );
}

export async function dbInsertKeypassBatch(keypasses: Keypass[]): Promise<void> {
  if (keypasses.length === 0) return;
  const pool = getDbPool();
  const values: unknown[] = [];
  const placeholders: string[] = [];
  for (let i = 0; i < keypasses.length; i++) {
    const offset = i * 6;
    placeholders.push(`($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6})`);
    const kp = keypasses[i];
    values.push(kp.code, kp.organisationId, kp.status, kp.createdAt, kp.expiresAt, kp.usedAt ?? null);
  }
  await pool.query(
    `insert into public.keypasses (code, organisation_id, status, created_at, expires_at, used_at) values ${placeholders.join(',')}`,
    values
  );
}

export async function dbGetKeypassByCode(code: string): Promise<Keypass | null> {
  const pool = getDbPool();
  const res = await pool.query<DbKeypassRow>(
    'select code, organisation_id, status, created_at, expires_at, used_at, used_by_user_id from public.keypasses where code = $1 limit 1',
    [code]
  );
  const row = res.rows[0];
  if (!row) return null;
  return rowToKeypass(row);
}

export async function dbUpdateKeypassStatus(code: string, status: KeypassStatus, usedAt?: string, usedByUserId?: string): Promise<void> {
  const pool = getDbPool();
  await pool.query(
    'update public.keypasses set status = $1, used_at = coalesce($2, used_at), used_by_user_id = coalesce($3, used_by_user_id) where code = $4',
    [status, usedAt ?? null, usedByUserId ?? null, code]
  );
}

/** Atomically claim a keypass — only updates if current status is 'available'. Returns true if claimed. */
export async function dbClaimKeypass(code: string, usedAt: string, usedByUserId: string): Promise<boolean> {
  const pool = getDbPool();
  const res = await pool.query(
    `update public.keypasses set status = 'used', used_at = $1, used_by_user_id = $2
     where code = $3 and status = 'available'
     returning code`,
    [usedAt, usedByUserId, code]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function dbListKeypassesByOrganisation(orgId: string): Promise<Keypass[]> {
  const pool = getDbPool();
  const res = await pool.query<DbKeypassRow>(
    'select code, organisation_id, status, created_at, expires_at, used_at, used_by_user_id from public.keypasses where organisation_id = $1 order by created_at desc',
    [orgId]
  );
  return res.rows.map(rowToKeypass);
}

export async function dbListKeypassesByUser(userId: string): Promise<Keypass[]> {
  const pool = getDbPool();
  const res = await pool.query<DbKeypassRow>(
    'select code, organisation_id, status, created_at, expires_at, used_at, used_by_user_id from public.keypasses where used_by_user_id = $1 order by created_at desc',
    [userId]
  );
  return res.rows.map(rowToKeypass);
}

export async function dbGetKeypassStatsByOrganisation(orgId: string): Promise<{ total: number; byStatus: Record<KeypassStatus, number> }> {
  const pool = getDbPool();
  const res = await pool.query<{ status: string; count: string }>(
    'select status, count(*)::text as count from public.keypasses where organisation_id = $1 group by status',
    [orgId]
  );
  const byStatus: Record<KeypassStatus, number> = { available: 0, used: 0, revoked: 0, expired: 0 };
  let total = 0;
  for (const row of res.rows) {
    const count = parseInt(row.count, 10);
    byStatus[row.status as KeypassStatus] = count;
    total += count;
  }
  return { total, byStatus };
}
