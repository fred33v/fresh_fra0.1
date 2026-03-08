import { getDbPool } from '../db.js';
import type { Purchase, Package, PurchaseStatus } from '../types.js';

export async function dbInsertPurchase(p: Purchase): Promise<void> {
  const pool = getDbPool();
  await pool.query(
    'insert into public.purchases (id, organisation_id, user_id, package_id, status, payment_intent_id, client_secret, amount_cents, currency, created_at, confirmed_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
    [p.id, p.organisationId, p.userId, p.packageId, p.status, p.paymentIntentId ?? null, p.clientSecret ?? null, p.amountCents, p.currency, p.createdAt, p.confirmedAt ?? null]
  );
}

export async function dbGetPurchaseById(id: string): Promise<Purchase | null> {
  const pool = getDbPool();
  const res = await pool.query<{
    id: string; organisation_id: string; user_id: string; package_id: string; status: string;
    payment_intent_id: string | null; client_secret: string | null; amount_cents: number;
    currency: string; created_at: string; confirmed_at: string | null;
  }>('select id, organisation_id, user_id, package_id, status, payment_intent_id, client_secret, amount_cents, currency, created_at, confirmed_at from public.purchases where id = $1 limit 1', [id]);
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id, organisationId: row.organisation_id, userId: row.user_id,
    packageId: row.package_id, status: row.status as PurchaseStatus,
    paymentIntentId: row.payment_intent_id ?? undefined, clientSecret: row.client_secret ?? undefined,
    amountCents: row.amount_cents, currency: row.currency,
    createdAt: new Date(row.created_at).toISOString(),
    confirmedAt: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : undefined,
  };
}

export async function dbUpdatePurchaseStatus(id: string, status: PurchaseStatus, confirmedAt?: string, expectedCurrentStatus?: PurchaseStatus): Promise<number> {
  const pool = getDbPool();
  const sql = expectedCurrentStatus
    ? 'update public.purchases set status = $1, confirmed_at = $2 where id = $3 and status = $4'
    : 'update public.purchases set status = $1, confirmed_at = $2 where id = $3';
  const params = expectedCurrentStatus
    ? [status, confirmedAt ?? null, id, expectedCurrentStatus]
    : [status, confirmedAt ?? null, id];
  const res = await pool.query(sql, params);
  return res.rowCount ?? 0;
}

export async function dbListPurchasesByOrganisation(orgId: string): Promise<Purchase[]> {
  const pool = getDbPool();
  const res = await pool.query<{
    id: string; organisation_id: string; user_id: string; package_id: string; status: string;
    payment_intent_id: string | null; client_secret: string | null; amount_cents: number;
    currency: string; created_at: string; confirmed_at: string | null;
  }>('select id, organisation_id, user_id, package_id, status, payment_intent_id, client_secret, amount_cents, currency, created_at, confirmed_at from public.purchases where organisation_id = $1 order by created_at desc', [orgId]);
  return res.rows.map((row) => ({
    id: row.id, organisationId: row.organisation_id, userId: row.user_id,
    packageId: row.package_id, status: row.status as PurchaseStatus,
    paymentIntentId: row.payment_intent_id ?? undefined, clientSecret: row.client_secret ?? undefined,
    amountCents: row.amount_cents, currency: row.currency,
    createdAt: new Date(row.created_at).toISOString(),
    confirmedAt: row.confirmed_at ? new Date(row.confirmed_at).toISOString() : undefined,
  }));
}

export async function dbListPackages(): Promise<Package[]> {
  const pool = getDbPool();
  const res = await pool.query<{
    id: string; name: string; description: string | null; price_cents: number; currency: string;
    keypass_allowance: number; features: string[]; is_active: boolean; sort_order: number;
  }>('select id, name, description, price_cents, currency, keypass_allowance, features, is_active, sort_order from public.packages where is_active = true order by sort_order');
  return res.rows.map((row) => ({
    id: row.id, name: row.name, description: row.description ?? undefined,
    priceCents: row.price_cents, currency: row.currency,
    keypassAllowance: row.keypass_allowance, features: row.features ?? [],
    isActive: row.is_active, sortOrder: row.sort_order,
  }));
}

export async function dbGetPackageById(id: string): Promise<Package | null> {
  const pool = getDbPool();
  const res = await pool.query<{
    id: string; name: string; description: string | null; price_cents: number; currency: string;
    keypass_allowance: number; features: string[]; is_active: boolean; sort_order: number;
  }>('select id, name, description, price_cents, currency, keypass_allowance, features, is_active, sort_order from public.packages where id = $1 limit 1', [id]);
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: row.id, name: row.name, description: row.description ?? undefined,
    priceCents: row.price_cents, currency: row.currency,
    keypassAllowance: row.keypass_allowance, features: row.features ?? [],
    isActive: row.is_active, sortOrder: row.sort_order,
  };
}
