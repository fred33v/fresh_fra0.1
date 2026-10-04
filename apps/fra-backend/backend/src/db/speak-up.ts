import { getDbPool } from '../db.js';
import type { SpeakUpIntake, SpeakUpMessage, SpeakUpReport } from '../speak-up.js';

const iso = (v: string | Date | null | undefined) => (v ? new Date(v).toISOString() : undefined);
const opt = <T>(v: T | null) => v ?? undefined;

// ── Intake link ─────────────────────────────────────────────────

type IntakeRow = { organisation_id: string; token: string; enabled: boolean; intro: string | null; created_at: string; updated_at: string };

const rowToIntake = (r: IntakeRow): SpeakUpIntake => ({
  organisationId: r.organisation_id, token: r.token, enabled: r.enabled, intro: opt(r.intro),
  createdAt: iso(r.created_at)!, updatedAt: iso(r.updated_at)!,
});

export async function dbGetIntakeByOrg(orgId: string): Promise<SpeakUpIntake | null> {
  const res = await getDbPool().query<IntakeRow>('select * from public.speak_up_intake where organisation_id = $1', [orgId]);
  return res.rows[0] ? rowToIntake(res.rows[0]) : null;
}

export async function dbGetIntakeByToken(token: string): Promise<SpeakUpIntake | null> {
  const res = await getDbPool().query<IntakeRow>('select * from public.speak_up_intake where token = $1', [token]);
  return res.rows[0] ? rowToIntake(res.rows[0]) : null;
}

export async function dbUpsertIntake(i: SpeakUpIntake): Promise<void> {
  await getDbPool().query(
    `insert into public.speak_up_intake (organisation_id, token, enabled, intro, created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (organisation_id) do update set token = excluded.token, enabled = excluded.enabled,
       intro = excluded.intro, updated_at = excluded.updated_at`,
    [i.organisationId, i.token, i.enabled, i.intro ?? null, i.createdAt, i.updatedAt]
  );
}

// ── Reports ─────────────────────────────────────────────────────

type ReportRow = {
  id: string; organisation_id: string; reference: string; access_key_hash: string; category: string; description: string;
  occurred_when: string | null; location: string | null; people_involved: string | null; amount_gbp: string | null;
  relationship: string; anonymous: boolean; reporter_name: string | null; reporter_email: string | null; reporter_phone: string | null;
  status: string; assigned_user_id: string | null; referral: string | null; referral_notes: string | null; outcome: string | null;
  incident_id: string | null; received_at: string; acknowledged_at: string | null; closed_at: string | null; updated_at: string;
};

const rowToReport = (r: ReportRow): SpeakUpReport => ({
  id: r.id, organisationId: r.organisation_id, reference: r.reference, accessKeyHash: r.access_key_hash,
  category: r.category as SpeakUpReport['category'], description: r.description,
  occurredWhen: opt(r.occurred_when), location: opt(r.location), peopleInvolved: opt(r.people_involved),
  amountGbp: r.amount_gbp === null ? undefined : Number(r.amount_gbp),
  relationship: r.relationship as SpeakUpReport['relationship'], anonymous: r.anonymous,
  reporterName: opt(r.reporter_name), reporterEmail: opt(r.reporter_email), reporterPhone: opt(r.reporter_phone),
  status: r.status as SpeakUpReport['status'], assignedUserId: opt(r.assigned_user_id),
  referral: opt(r.referral) as SpeakUpReport['referral'], referralNotes: opt(r.referral_notes), outcome: opt(r.outcome),
  incidentId: opt(r.incident_id), receivedAt: iso(r.received_at)!, acknowledgedAt: iso(r.acknowledged_at),
  closedAt: iso(r.closed_at), updatedAt: iso(r.updated_at)!,
});

export async function dbInsertReport(r: SpeakUpReport): Promise<void> {
  await getDbPool().query(
    `insert into public.speak_up_reports (id, organisation_id, reference, access_key_hash, category, description, occurred_when,
       location, people_involved, amount_gbp, relationship, anonymous, reporter_name, reporter_email, reporter_phone, status,
       received_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
    [r.id, r.organisationId, r.reference, r.accessKeyHash, r.category, r.description, r.occurredWhen ?? null,
      r.location ?? null, r.peopleInvolved ?? null, r.amountGbp ?? null, r.relationship, r.anonymous,
      r.reporterName ?? null, r.reporterEmail ?? null, r.reporterPhone ?? null, r.status, r.receivedAt, r.updatedAt]
  );
}

export async function dbUpdateReport(r: SpeakUpReport): Promise<void> {
  await getDbPool().query(
    `update public.speak_up_reports set status=$3, assigned_user_id=$4, referral=$5, referral_notes=$6, outcome=$7,
       incident_id=$8, acknowledged_at=$9, closed_at=$10, updated_at=$11
     where id=$1 and organisation_id=$2`,
    [r.id, r.organisationId, r.status, r.assignedUserId ?? null, r.referral ?? null, r.referralNotes ?? null,
      r.outcome ?? null, r.incidentId ?? null, r.acknowledgedAt ?? null, r.closedAt ?? null, r.updatedAt]
  );
}

export async function dbListReports(orgId: string): Promise<SpeakUpReport[]> {
  const res = await getDbPool().query<ReportRow>(
    'select * from public.speak_up_reports where organisation_id = $1 order by received_at desc', [orgId]);
  return res.rows.map(rowToReport);
}

export async function dbGetReport(id: string, orgId: string): Promise<SpeakUpReport | null> {
  const res = await getDbPool().query<ReportRow>(
    'select * from public.speak_up_reports where id = $1 and organisation_id = $2', [id, orgId]);
  return res.rows[0] ? rowToReport(res.rows[0]) : null;
}

export async function dbGetReportByReference(reference: string): Promise<SpeakUpReport | null> {
  const res = await getDbPool().query<ReportRow>('select * from public.speak_up_reports where reference = $1', [reference]);
  return res.rows[0] ? rowToReport(res.rows[0]) : null;
}

/** Touches the case so handlers see that the reporter wrote. */
export async function dbTouchReport(id: string, at: string): Promise<void> {
  await getDbPool().query('update public.speak_up_reports set updated_at = $2 where id = $1', [id, at]);
}

// ── Messages ────────────────────────────────────────────────────

type MessageRow = { id: string; report_id: string; author: string; author_user_id: string | null; body: string; created_at: string };

export async function dbListMessages(reportId: string): Promise<SpeakUpMessage[]> {
  const res = await getDbPool().query<MessageRow>(
    'select * from public.speak_up_messages where report_id = $1 order by created_at', [reportId]);
  return res.rows.map((m) => ({
    id: m.id, reportId: m.report_id, author: m.author as SpeakUpMessage['author'], authorUserId: opt(m.author_user_id),
    body: m.body, createdAt: iso(m.created_at)!,
  }));
}

export async function dbInsertMessage(m: SpeakUpMessage): Promise<void> {
  await getDbPool().query(
    'insert into public.speak_up_messages (id, report_id, author, author_user_id, body, created_at) values ($1,$2,$3,$4,$5,$6)',
    [m.id, m.reportId, m.author, m.authorUserId ?? null, m.body, m.createdAt]
  );
}
