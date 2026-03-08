import { getDbPool } from '../db.js';
import type { User, DbUserRow, EmployeeDashboardRow, DbEmployeeDashboardRow } from '../types.js';

export async function dbGetUserByEmail(email: string): Promise<User | null> {
  const pool = getDbPool();
  const res = await pool.query<DbUserRow>(
    'select id, email, name, password_hash, role, organisation_id, department, created_at from public.users where email = $1 limit 1',
    [email.toLowerCase()]
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    role: row.role,
    organisationId: row.organisation_id,
    department: row.department ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function dbGetUserById(id: string): Promise<User | null> {
  const pool = getDbPool();
  const res = await pool.query<DbUserRow>(
    'select id, email, name, password_hash, role, organisation_id, department, created_at from public.users where id = $1 limit 1',
    [id]
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: row.password_hash,
    role: row.role,
    organisationId: row.organisation_id,
    department: row.department ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function dbInsertUser(user: User): Promise<void> {
  const pool = getDbPool();
  await pool.query(
    'insert into public.users (id, email, name, password_hash, role, organisation_id, department, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8)',
    [
      user.id,
      user.email.toLowerCase(),
      user.name,
      user.passwordHash,
      user.role,
      user.organisationId,
      user.department ?? null,
      user.createdAt,
    ]
  );
}

export async function dbUpdateUserPasswordHash(userId: string, passwordHash: string): Promise<void> {
  const pool = getDbPool();
  await pool.query('update public.users set password_hash = $1 where id = $2', [passwordHash, userId]);
}

export async function dbListUsersByOrganisation(organisationId: string): Promise<User[]> {
  const pool = getDbPool();
  const res = await pool.query<Omit<DbUserRow, 'password_hash'>>(
    'select id, email, name, role, organisation_id, department, created_at from public.users where organisation_id = $1 order by created_at desc',
    [organisationId]
  );
  return res.rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: '',
    role: row.role,
    organisationId: row.organisation_id,
    department: row.department ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function dbUpdateUserProfile(userId: string, fields: { name?: string; department?: string }): Promise<void> {
  const pool = getDbPool();
  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;
  if (fields.name !== undefined) { sets.push(`name = $${idx++}`); vals.push(fields.name); }
  if (fields.department !== undefined) { sets.push(`department = $${idx++}`); vals.push(fields.department || null); }
  if (sets.length === 0) return;
  vals.push(userId);
  await pool.query(`update public.users set ${sets.join(', ')} where id = $${idx}`, vals);
}

export async function dbGetEmployeeDashboardData(organisationId: string): Promise<EmployeeDashboardRow[]> {
  const pool = getDbPool();
  const res = await pool.query<DbEmployeeDashboardRow>(
    `select u.id, u.email, u.name, u.role, u.organisation_id, u.department, u.created_at,
            a.id as assessment_id, a.status as assessment_status,
            a.created_at as assessment_started, a.submitted_at as assessment_completed,
            coalesce((select count(*)::int from jsonb_object_keys(coalesce(a.answers, '{}'::jsonb))), 0) as answer_count
     from public.users u
     left join public.assessments a on a.created_by_user_id = u.id
     where u.organisation_id = $1
     order by u.created_at desc`,
    [organisationId]
  );
  return res.rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    department: row.department,
    createdAt: new Date(row.created_at).toISOString(),
    assessmentId: row.assessment_id,
    assessmentStatus: row.assessment_status,
    assessmentStarted: row.assessment_started ? new Date(row.assessment_started).toISOString() : null,
    assessmentCompleted: row.assessment_completed ? new Date(row.assessment_completed).toISOString() : null,
    answerCount: Number(row.answer_count) || 0,
  }));
}
