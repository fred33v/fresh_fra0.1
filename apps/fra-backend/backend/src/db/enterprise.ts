import { getDbPool } from '../db.js';
import type { ApiKey, RiskRegisterEntry, WebhookEndpoint, WebhookEvent, ControlEffectiveness, RiskPriority, RiskStatus } from '../types.js';

const iso = (v: string | Date | null | undefined) => (v ? new Date(v).toISOString() : undefined);

// ── API keys ────────────────────────────────────────────────────

type ApiKeyRow = {
  id: string; organisation_id: string; created_by_user_id: string; name: string;
  key_prefix: string; key_hash: string; created_at: string; last_used_at: string | null; revoked_at: string | null;
};

function rowToApiKey(r: ApiKeyRow): ApiKey {
  return {
    id: r.id, organisationId: r.organisation_id, createdByUserId: r.created_by_user_id, name: r.name,
    keyPrefix: r.key_prefix, keyHash: r.key_hash, createdAt: iso(r.created_at)!,
    lastUsedAt: iso(r.last_used_at), revokedAt: iso(r.revoked_at),
  };
}

export async function dbInsertApiKey(k: ApiKey): Promise<void> {
  await getDbPool().query(
    'insert into public.api_keys (id, organisation_id, created_by_user_id, name, key_prefix, key_hash, created_at) values ($1,$2,$3,$4,$5,$6,$7)',
    [k.id, k.organisationId, k.createdByUserId, k.name, k.keyPrefix, k.keyHash, k.createdAt]
  );
}

export async function dbGetApiKeyByHash(hash: string): Promise<ApiKey | null> {
  const res = await getDbPool().query<ApiKeyRow>('select * from public.api_keys where key_hash = $1 limit 1', [hash]);
  return res.rows[0] ? rowToApiKey(res.rows[0]) : null;
}

export async function dbListApiKeysByOrganisation(orgId: string): Promise<ApiKey[]> {
  const res = await getDbPool().query<ApiKeyRow>('select * from public.api_keys where organisation_id = $1 order by created_at desc', [orgId]);
  return res.rows.map(rowToApiKey);
}

export async function dbRevokeApiKey(id: string, orgId: string): Promise<number> {
  const res = await getDbPool().query(
    'update public.api_keys set revoked_at = now() where id = $1 and organisation_id = $2 and revoked_at is null',
    [id, orgId]
  );
  return res.rowCount ?? 0;
}

export async function dbTouchApiKey(id: string): Promise<void> {
  await getDbPool().query('update public.api_keys set last_used_at = now() where id = $1', [id]);
}

// ── Risk register ───────────────────────────────────────────────

type RiskRow = {
  id: string; organisation_id: string; title: string; risk_area: string; description: string | null;
  impact: number; likelihood: number; control_effectiveness: string; controls: string | null;
  inherent_score: number; residual_score: number; priority: string; owner_user_id: string | null;
  action_plan: string | null; due_date: string | Date | null; status: string; created_by_user_id: string;
  created_at: string; updated_at: string;
};

function rowToRisk(r: RiskRow): RiskRegisterEntry {
  return {
    id: r.id, organisationId: r.organisation_id, title: r.title, riskArea: r.risk_area,
    description: r.description ?? undefined, impact: r.impact, likelihood: r.likelihood,
    controlEffectiveness: r.control_effectiveness as ControlEffectiveness, controls: r.controls ?? undefined,
    inherentScore: r.inherent_score, residualScore: r.residual_score, priority: r.priority as RiskPriority,
    ownerUserId: r.owner_user_id ?? undefined, actionPlan: r.action_plan ?? undefined,
    dueDate: r.due_date ? new Date(r.due_date).toISOString().slice(0, 10) : undefined,
    status: r.status as RiskStatus, createdByUserId: r.created_by_user_id,
    createdAt: iso(r.created_at)!, updatedAt: iso(r.updated_at)!,
  };
}

const RISK_COLUMNS = 'id, organisation_id, title, risk_area, description, impact, likelihood, control_effectiveness, controls, inherent_score, residual_score, priority, owner_user_id, action_plan, due_date, status, created_by_user_id, created_at, updated_at';

function riskValues(r: RiskRegisterEntry) {
  return [
    r.id, r.organisationId, r.title, r.riskArea, r.description ?? null, r.impact, r.likelihood,
    r.controlEffectiveness, r.controls ?? null, r.inherentScore, r.residualScore, r.priority,
    r.ownerUserId ?? null, r.actionPlan ?? null, r.dueDate ?? null, r.status, r.createdByUserId,
    r.createdAt, r.updatedAt,
  ];
}

export async function dbInsertRisk(r: RiskRegisterEntry): Promise<void> {
  await getDbPool().query(
    `insert into public.risk_register (${RISK_COLUMNS}) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
    riskValues(r)
  );
}

export async function dbUpdateRisk(r: RiskRegisterEntry): Promise<void> {
  await getDbPool().query(
    `update public.risk_register set title=$3, risk_area=$4, description=$5, impact=$6, likelihood=$7,
       control_effectiveness=$8, controls=$9, inherent_score=$10, residual_score=$11, priority=$12,
       owner_user_id=$13, action_plan=$14, due_date=$15, status=$16, updated_at=$17
     where id=$1 and organisation_id=$2`,
    [
      r.id, r.organisationId, r.title, r.riskArea, r.description ?? null, r.impact, r.likelihood,
      r.controlEffectiveness, r.controls ?? null, r.inherentScore, r.residualScore, r.priority,
      r.ownerUserId ?? null, r.actionPlan ?? null, r.dueDate ?? null, r.status, r.updatedAt,
    ]
  );
}

export async function dbGetRisk(id: string, orgId: string): Promise<RiskRegisterEntry | null> {
  const res = await getDbPool().query<RiskRow>(
    `select ${RISK_COLUMNS} from public.risk_register where id = $1 and organisation_id = $2 limit 1`, [id, orgId]
  );
  return res.rows[0] ? rowToRisk(res.rows[0]) : null;
}

export async function dbListRisks(orgId: string): Promise<RiskRegisterEntry[]> {
  const res = await getDbPool().query<RiskRow>(
    `select ${RISK_COLUMNS} from public.risk_register where organisation_id = $1 order by residual_score desc, created_at desc`, [orgId]
  );
  return res.rows.map(rowToRisk);
}

export async function dbDeleteRisk(id: string, orgId: string): Promise<number> {
  const res = await getDbPool().query('delete from public.risk_register where id = $1 and organisation_id = $2', [id, orgId]);
  return res.rowCount ?? 0;
}

// ── Webhook endpoints ───────────────────────────────────────────

type WebhookRow = {
  id: string; organisation_id: string; url: string; secret: string; events: string[]; is_active: boolean;
  created_by_user_id: string; created_at: string; last_delivery_at: string | null; last_delivery_status: number | null;
};

function rowToWebhook(r: WebhookRow): WebhookEndpoint {
  return {
    id: r.id, organisationId: r.organisation_id, url: r.url, secret: r.secret,
    events: r.events as WebhookEvent[], isActive: r.is_active, createdByUserId: r.created_by_user_id,
    createdAt: iso(r.created_at)!, lastDeliveryAt: iso(r.last_delivery_at),
    lastDeliveryStatus: r.last_delivery_status ?? undefined,
  };
}

export async function dbInsertWebhookEndpoint(w: WebhookEndpoint): Promise<void> {
  await getDbPool().query(
    'insert into public.webhook_endpoints (id, organisation_id, url, secret, events, is_active, created_by_user_id, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8)',
    [w.id, w.organisationId, w.url, w.secret, w.events, w.isActive, w.createdByUserId, w.createdAt]
  );
}

export async function dbListWebhookEndpoints(orgId: string): Promise<WebhookEndpoint[]> {
  const res = await getDbPool().query<WebhookRow>(
    'select * from public.webhook_endpoints where organisation_id = $1 order by created_at desc', [orgId]
  );
  return res.rows.map(rowToWebhook);
}

export async function dbDeleteWebhookEndpoint(id: string, orgId: string): Promise<number> {
  const res = await getDbPool().query('delete from public.webhook_endpoints where id = $1 and organisation_id = $2', [id, orgId]);
  return res.rowCount ?? 0;
}

export async function dbRecordWebhookDelivery(id: string, status: number): Promise<void> {
  await getDbPool().query(
    'update public.webhook_endpoints set last_delivery_at = now(), last_delivery_status = $2 where id = $1', [id, status]
  );
}
