import type { DbExecutor } from './transaction.js';
import { getDbPool } from '../db.js';
import type { Assessment, DbAssessmentRow } from '../types.js';

export async function dbInsertAssessment(assessment: Assessment, db?: DbExecutor): Promise<void> {
  const pool = db ?? getDbPool();
  await pool.query(
    'insert into public.assessments (id, organisation_id, created_by_user_id, title, status, answers, created_at, updated_at, submitted_at, result) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [
      assessment.id,
      assessment.organisationId,
      assessment.createdByUserId,
      assessment.title,
      assessment.status,
      assessment.answers,
      assessment.createdAt,
      assessment.updatedAt,
      assessment.submittedAt ?? null,
      assessment.result ? JSON.stringify(assessment.result) : null,
    ]
  );
}

export async function dbGetAssessmentById(id: string, db?: DbExecutor): Promise<Assessment | null> {
  const pool = db ?? getDbPool();
  const res = await pool.query<DbAssessmentRow>(
    'select id, organisation_id, created_by_user_id, title, status, answers, created_at, updated_at, submitted_at, result from public.assessments where id = $1 limit 1' + (db ? ' FOR UPDATE' : ''),
    [id]
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    organisationId: row.organisation_id,
    createdByUserId: row.created_by_user_id,
    title: row.title,
    status: row.status,
    answers: row.answers ?? {},
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : undefined,
    result: row.result ?? undefined,
  };
}

export async function dbListAssessmentsByOrganisation(orgId: string, db?: DbExecutor): Promise<Assessment[]> {
  const pool = db ?? getDbPool();
  const res = await pool.query<DbAssessmentRow>(
    'select id, organisation_id, created_by_user_id, title, status, answers, created_at, updated_at, submitted_at, result from public.assessments where organisation_id = $1 order by created_at desc',
    [orgId]
  );
  return res.rows.map((row) => ({
    id: row.id,
    organisationId: row.organisation_id,
    createdByUserId: row.created_by_user_id,
    title: row.title,
    status: row.status,
    answers: row.answers ?? {},
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : undefined,
    result: row.result ?? undefined,
  }));
}

export async function dbUpdateAssessment(id: string, patch: Partial<Assessment>, db?: DbExecutor): Promise<Assessment | null> {
  const pool = db ?? getDbPool();
  const res = await pool.query<DbAssessmentRow>(
    `update public.assessments set
       title = COALESCE($1, title),
       status = COALESCE($2, status),
       answers = COALESCE($3, answers),
       updated_at = COALESCE($4, now()),
       submitted_at = COALESCE($5, submitted_at),
       result = COALESCE($7, result)
     where id = $6
     returning id, organisation_id, created_by_user_id, title, status, answers, created_at, updated_at, submitted_at, result`,
    [
      patch.title ?? null,
      patch.status ?? null,
      patch.answers ?? null,
      patch.updatedAt ?? null,
      patch.submittedAt ?? null,
      id,
      patch.result ? JSON.stringify(patch.result) : null,
    ]
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id,
    organisationId: row.organisation_id,
    createdByUserId: row.created_by_user_id,
    title: row.title,
    status: row.status,
    answers: row.answers ?? {},
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : undefined,
    result: row.result ?? undefined,
  };
}
