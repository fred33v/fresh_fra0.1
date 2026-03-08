import { getDbPool } from '../db.js';
import type { Assessment, DbAssessmentRow } from '../types.js';

export async function dbInsertAssessment(assessment: Assessment): Promise<void> {
  const pool = getDbPool();
  await pool.query(
    'insert into public.assessments (id, organisation_id, created_by_user_id, title, status, answers, created_at, updated_at, submitted_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
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
    ]
  );
}

export async function dbGetAssessmentById(id: string): Promise<Assessment | null> {
  const pool = getDbPool();
  const res = await pool.query<DbAssessmentRow>(
    'select id, organisation_id, created_by_user_id, title, status, answers, created_at, updated_at, submitted_at from public.assessments where id = $1 limit 1',
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
  };
}

export async function dbListAssessmentsByOrganisation(orgId: string): Promise<Assessment[]> {
  const pool = getDbPool();
  const res = await pool.query<DbAssessmentRow>(
    'select id, organisation_id, created_by_user_id, title, status, answers, created_at, updated_at, submitted_at from public.assessments where organisation_id = $1 order by created_at desc',
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
  }));
}

export async function dbUpdateAssessment(id: string, patch: Partial<Assessment>): Promise<Assessment | null> {
  const pool = getDbPool();
  const res = await pool.query<DbAssessmentRow>(
    `update public.assessments set
       title = COALESCE($1, title),
       status = COALESCE($2, status),
       answers = COALESCE($3, answers),
       updated_at = COALESCE($4, now()),
       submitted_at = COALESCE($5, submitted_at)
     where id = $6
     returning id, organisation_id, created_by_user_id, title, status, answers, created_at, updated_at, submitted_at`,
    [
      patch.title ?? null,
      patch.status ?? null,
      patch.answers ?? null,
      patch.updatedAt ?? null,
      patch.submittedAt ?? null,
      id,
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
  };
}
