import { getDbPool } from '../db.js';
import type { CounterFraudKind, CounterFraudRecord } from '../counter-fraud.js';

type RecordRow = {
  id: string; organisation_id: string; kind: string; data: unknown;
  created_by_user_id: string; created_at: string; updated_at: string;
};

const rowToRecord = (r: RecordRow): CounterFraudRecord => ({
  id: r.id, organisationId: r.organisation_id, kind: r.kind as CounterFraudKind,
  data: r.data as CounterFraudRecord['data'], createdByUserId: r.created_by_user_id,
  createdAt: new Date(r.created_at).toISOString(), updatedAt: new Date(r.updated_at).toISOString(),
});

const COLUMNS = 'id, organisation_id, kind, data, created_by_user_id, created_at, updated_at';

export async function dbListCounterFraudRecords(orgId: string, kind?: CounterFraudKind): Promise<CounterFraudRecord[]> {
  const res = kind
    ? await getDbPool().query<RecordRow>(
      `select ${COLUMNS} from public.counter_fraud_records where organisation_id = $1 and kind = $2 order by created_at desc`, [orgId, kind])
    : await getDbPool().query<RecordRow>(
      `select ${COLUMNS} from public.counter_fraud_records where organisation_id = $1 order by created_at desc`, [orgId]);
  return res.rows.map(rowToRecord);
}

export async function dbGetCounterFraudRecord(id: string, orgId: string): Promise<CounterFraudRecord | null> {
  const res = await getDbPool().query<RecordRow>(
    `select ${COLUMNS} from public.counter_fraud_records where id = $1 and organisation_id = $2 limit 1`, [id, orgId]);
  return res.rows[0] ? rowToRecord(res.rows[0]) : null;
}

export async function dbInsertCounterFraudRecord(r: CounterFraudRecord): Promise<void> {
  await getDbPool().query(
    `insert into public.counter_fraud_records (${COLUMNS}) values ($1,$2,$3,$4,$5,$6,$7)`,
    [r.id, r.organisationId, r.kind, JSON.stringify(r.data), r.createdByUserId, r.createdAt, r.updatedAt]
  );
}

export async function dbUpdateCounterFraudRecord(r: CounterFraudRecord): Promise<void> {
  await getDbPool().query(
    'update public.counter_fraud_records set data = $3, updated_at = $4 where id = $1 and organisation_id = $2',
    [r.id, r.organisationId, JSON.stringify(r.data), r.updatedAt]
  );
}

export async function dbDeleteCounterFraudRecord(id: string, orgId: string): Promise<number> {
  const res = await getDbPool().query('delete from public.counter_fraud_records where id = $1 and organisation_id = $2', [id, orgId]);
  return res.rowCount ?? 0;
}
