// ============================================================
// Budget holder programme storage: Postgres when DATABASE_URL is set,
// in memory otherwise (local development and tests).
// ============================================================

import { hasDatabase } from './helpers.js';
import { getDbPool } from './db.js';

export type ApprovalLimits = { bands: string[]; rows: { type: string; approvers: string[] }[] };
export type ReportContacts = Record<string, { name: string; contact: string }>;

export type BudgetHolderMember = {
  userId: string;
  organisationId: string;
  required: boolean;
  requiredAt: string | null;
  completedParts: string[];
  scenarioAnswers: Record<string, number>;
  scenarioScore: number | null;
  scenarioPassedAt: string | null;
  pledgeName: string | null;
  pledgedAt: string | null;
  conflictDeclared: boolean | null;
  conflictDetails: string | null;
  completedAt: string | null;
  previousCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BudgetHolderSettings = {
  organisationId: string;
  approvalLimits: ApprovalLimits | null;
  contacts: ReportContacts;
  updatedBy: string | null;
  updatedAt: string | null;
};

const memMembers = new Map<string, BudgetHolderMember>();
const memSettings = new Map<string, BudgetHolderSettings>();

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

type MemberRow = {
  user_id: string; organisation_id: string; required: boolean; required_at: Date | null; completed_parts: string[];
  scenario_answers: Record<string, number>; scenario_score: number | null; scenario_passed_at: Date | null;
  pledge_name: string | null; pledged_at: Date | null; conflict_declared: boolean | null; conflict_details: string | null;
  completed_at: Date | null; previous_completed_at: Date | null; created_at: Date; updated_at: Date;
};

const fromRow = (r: MemberRow): BudgetHolderMember => ({
  userId: r.user_id,
  organisationId: r.organisation_id,
  required: r.required,
  requiredAt: iso(r.required_at),
  completedParts: r.completed_parts ?? [],
  scenarioAnswers: r.scenario_answers ?? {},
  scenarioScore: r.scenario_score,
  scenarioPassedAt: iso(r.scenario_passed_at),
  pledgeName: r.pledge_name,
  pledgedAt: iso(r.pledged_at),
  conflictDeclared: r.conflict_declared,
  conflictDetails: r.conflict_details,
  completedAt: iso(r.completed_at),
  previousCompletedAt: iso(r.previous_completed_at),
  createdAt: iso(r.created_at) as string,
  updatedAt: iso(r.updated_at) as string,
});

export function emptyMember(userId: string, organisationId: string): BudgetHolderMember {
  const now = new Date().toISOString();
  return {
    userId, organisationId, required: false, requiredAt: null, completedParts: [], scenarioAnswers: {}, scenarioScore: null,
    scenarioPassedAt: null, pledgeName: null, pledgedAt: null, conflictDeclared: null, conflictDetails: null,
    completedAt: null, previousCompletedAt: null, createdAt: now, updatedAt: now,
  };
}

export async function getMember(userId: string): Promise<BudgetHolderMember | null> {
  if (!hasDatabase()) return memMembers.get(userId) ?? null;
  const { rows } = await getDbPool().query<MemberRow>('select * from public.budget_holder_members where user_id = $1', [userId]);
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function listMembers(organisationId: string): Promise<BudgetHolderMember[]> {
  if (!hasDatabase()) return [...memMembers.values()].filter((m) => m.organisationId === organisationId);
  const { rows } = await getDbPool().query<MemberRow>('select * from public.budget_holder_members where organisation_id = $1', [organisationId]);
  return rows.map(fromRow);
}

/** Insert or replace a person's row. */
export async function saveMember(m: BudgetHolderMember): Promise<BudgetHolderMember> {
  const saved = { ...m, updatedAt: new Date().toISOString() };
  if (!hasDatabase()) {
    memMembers.set(m.userId, saved);
    return saved;
  }
  const { rows } = await getDbPool().query<MemberRow>(
    `insert into public.budget_holder_members (user_id, organisation_id, required, required_at, completed_parts, scenario_answers,
       scenario_score, scenario_passed_at, pledge_name, pledged_at, conflict_declared, conflict_details, completed_at, previous_completed_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     on conflict (user_id) do update set organisation_id = excluded.organisation_id, required = excluded.required,
       required_at = excluded.required_at, completed_parts = excluded.completed_parts, scenario_answers = excluded.scenario_answers,
       scenario_score = excluded.scenario_score, scenario_passed_at = excluded.scenario_passed_at, pledge_name = excluded.pledge_name,
       pledged_at = excluded.pledged_at, conflict_declared = excluded.conflict_declared, conflict_details = excluded.conflict_details,
       completed_at = excluded.completed_at, previous_completed_at = excluded.previous_completed_at, updated_at = now()
     returning *`,
    [m.userId, m.organisationId, m.required, m.requiredAt, m.completedParts, JSON.stringify(m.scenarioAnswers), m.scenarioScore,
      m.scenarioPassedAt, m.pledgeName, m.pledgedAt, m.conflictDeclared, m.conflictDetails, m.completedAt, m.previousCompletedAt],
  );
  return fromRow(rows[0]);
}

type SettingsRow = { organisation_id: string; approval_limits: ApprovalLimits | null; contacts: ReportContacts; updated_by: string | null; updated_at: Date };

export async function getSettings(organisationId: string): Promise<BudgetHolderSettings> {
  const empty: BudgetHolderSettings = { organisationId, approvalLimits: null, contacts: {}, updatedBy: null, updatedAt: null };
  if (!hasDatabase()) return memSettings.get(organisationId) ?? empty;
  const { rows } = await getDbPool().query<SettingsRow>('select * from public.budget_holder_settings where organisation_id = $1', [organisationId]);
  const r = rows[0];
  return r ? { organisationId, approvalLimits: r.approval_limits, contacts: r.contacts ?? {}, updatedBy: r.updated_by, updatedAt: iso(r.updated_at) } : empty;
}

export async function saveSettings(s: BudgetHolderSettings): Promise<BudgetHolderSettings> {
  const saved = { ...s, updatedAt: new Date().toISOString() };
  if (!hasDatabase()) {
    memSettings.set(s.organisationId, saved);
    return saved;
  }
  await getDbPool().query(
    `insert into public.budget_holder_settings (organisation_id, approval_limits, contacts, updated_by, updated_at)
     values ($1, $2, $3, $4, now())
     on conflict (organisation_id) do update set approval_limits = excluded.approval_limits, contacts = excluded.contacts,
       updated_by = excluded.updated_by, updated_at = now()`,
    [s.organisationId, s.approvalLimits ? JSON.stringify(s.approvalLimits) : null, JSON.stringify(s.contacts), s.updatedBy],
  );
  return saved;
}
