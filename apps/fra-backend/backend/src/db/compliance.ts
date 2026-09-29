import { getDbPool } from '../db.js';
import type { AuditEvent, ComplianceIncident, SeniorManager } from '../types.js';

const iso = (v: string | Date | null | undefined) => (v ? new Date(v).toISOString() : undefined);

// ── Incidents ───────────────────────────────────────────────────

type IncidentRow = {
  id: string; organisation_id: string; type: string; description: string; severity: string;
  reported_at: string; resolved_at: string | null; resolution_notes: string | null;
};

const rowToIncident = (r: IncidentRow): ComplianceIncident => ({
  id: r.id, organisationId: r.organisation_id, type: r.type as ComplianceIncident['type'],
  description: r.description, severity: r.severity as ComplianceIncident['severity'],
  reportedAt: iso(r.reported_at)!, resolvedAt: iso(r.resolved_at), resolutionNotes: r.resolution_notes ?? undefined,
});

export async function dbListIncidents(orgId: string): Promise<ComplianceIncident[]> {
  const res = await getDbPool().query<IncidentRow>(
    'select id, organisation_id, type, description, severity, reported_at, resolved_at, resolution_notes from compliance_incidents where organisation_id = $1 order by reported_at desc',
    [orgId]
  );
  return res.rows.map(rowToIncident);
}

export async function dbInsertIncident(i: ComplianceIncident): Promise<void> {
  await getDbPool().query(
    'insert into compliance_incidents (id, organisation_id, type, description, severity, reported_at) values ($1,$2,$3,$4,$5,$6)',
    [i.id, i.organisationId, i.type, i.description, i.severity, i.reportedAt]
  );
}

export async function dbResolveIncident(id: string, orgId: string, resolvedAt: string | null, notes: string | null): Promise<ComplianceIncident | null> {
  const res = await getDbPool().query<IncidentRow>(
    `update compliance_incidents set resolved_at = $3, resolution_notes = $4
     where id = $1 and organisation_id = $2
     returning id, organisation_id, type, description, severity, reported_at, resolved_at, resolution_notes`,
    [id, orgId, resolvedAt, notes]
  );
  return res.rows[0] ? rowToIncident(res.rows[0]) : null;
}

// ── Senior management accountability ────────────────────────────

type SeniorRow = {
  id: string; organisation_id: string; user_id: string; user_name: string | null; role: string;
  compliance_score: number | null; last_reviewed: string | null; review_notes: string | null;
};

const rowToSenior = (r: SeniorRow): SeniorManager => ({
  id: r.id, organisationId: r.organisation_id, userId: r.user_id, userName: r.user_name ?? undefined,
  role: r.role as SeniorManager['role'], complianceScore: r.compliance_score ?? undefined,
  lastReviewed: iso(r.last_reviewed), reviewNotes: r.review_notes ?? undefined,
});

const SENIOR_SELECT = `select s.id, s.organisation_id, s.user_id, u.name as user_name, s.role, s.compliance_score,
  s.last_reviewed, s.review_notes from senior_management_tracking s left join users u on u.id = s.user_id`;

export async function dbListSeniorManagers(orgId: string): Promise<SeniorManager[]> {
  const res = await getDbPool().query<SeniorRow>(`${SENIOR_SELECT} where s.organisation_id = $1 order by s.role`, [orgId]);
  return res.rows.map(rowToSenior);
}

export async function dbInsertSeniorManager(m: SeniorManager): Promise<void> {
  await getDbPool().query(
    'insert into senior_management_tracking (id, organisation_id, user_id, role, compliance_score, last_reviewed, review_notes) values ($1,$2,$3,$4,$5,$6,$7)',
    [m.id, m.organisationId, m.userId, m.role, m.complianceScore ?? null, m.lastReviewed ?? null, m.reviewNotes ?? null]
  );
}

export async function dbUpdateSeniorManager(m: SeniorManager): Promise<void> {
  await getDbPool().query(
    'update senior_management_tracking set role = $3, compliance_score = $4, last_reviewed = $5, review_notes = $6 where id = $1 and organisation_id = $2',
    [m.id, m.organisationId, m.role, m.complianceScore ?? null, m.lastReviewed ?? null, m.reviewNotes ?? null]
  );
}

export async function dbDeleteSeniorManager(id: string, orgId: string): Promise<number> {
  const res = await getDbPool().query('delete from senior_management_tracking where id = $1 and organisation_id = $2', [id, orgId]);
  return res.rowCount ?? 0;
}

// ── Training evidence (workshop completion + certificates) ──────

export type TrainingRecord = { userId: string; completedAt?: string; certificateNumber?: string; certificateIssuedAt?: string };

export async function dbListTrainingRecords(orgId: string): Promise<TrainingRecord[]> {
  const res = await getDbPool().query<{
    user_id: string; completed_at: string | null; certificate_number: string | null; issued_at: string | null;
  }>(
    `select u.id as user_id,
            (select max(wp.completed_at) from workshop_progress wp where wp.user_id = u.id) as completed_at,
            c.certificate_number, c.issued_at
       from users u
       left join lateral (select certificate_number, issued_at from certificates where user_id = u.id order by issued_at desc limit 1) c on true
      where u.organisation_id = $1`,
    [orgId]
  );
  return res.rows.map((r) => ({
    userId: r.user_id, completedAt: iso(r.completed_at),
    certificateNumber: r.certificate_number ?? undefined, certificateIssuedAt: iso(r.issued_at),
  }));
}

// ── Audit trail ─────────────────────────────────────────────────

type AuditRow = {
  id: string; event_type: string; actor_id: string | null; actor_email: string | null; organisation_id: string | null;
  resource_type: string | null; resource_id: string | null; details: Record<string, unknown>; ip_address: string | null; created_at: string;
};

export async function dbListAuditEvents(orgId: string, limit: number, offset: number, eventType?: string): Promise<{ events: AuditEvent[]; total: number }> {
  const params: unknown[] = [orgId];
  let where = 'organisation_id = $1';
  if (eventType) {
    params.push(`${eventType}%`);
    where += ` and event_type like $${params.length}`;
  }
  const pool = getDbPool();
  const [rows, count] = await Promise.all([
    pool.query<AuditRow>(
      `select id, event_type, actor_id, actor_email, organisation_id, resource_type, resource_id, details, ip_address, created_at
         from audit_logs where ${where} order by created_at desc limit ${Number(limit)} offset ${Number(offset)}`,
      params
    ),
    pool.query<{ count: string }>(`select count(*)::text as count from audit_logs where ${where}`, params),
  ]);
  return {
    total: Number(count.rows[0]?.count ?? 0),
    events: rows.rows.map((r) => ({
      id: r.id, eventType: r.event_type, actorId: r.actor_id ?? undefined, actorEmail: r.actor_email ?? undefined,
      organisationId: r.organisation_id ?? undefined, resourceType: r.resource_type ?? undefined,
      resourceId: r.resource_id ?? undefined, details: r.details ?? {}, ipAddress: r.ip_address ?? undefined,
      createdAt: iso(r.created_at)!,
    })),
  };
}
