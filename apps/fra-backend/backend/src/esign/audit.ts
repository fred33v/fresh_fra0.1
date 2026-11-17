import type { DbExecutor } from '../db/transaction.js';
import { sha256 } from './crypto.js';
export interface AuditEntry {
  document_id: string;
  seq: string;
  event: string;
  actor: string;
  details: unknown;
  occurred_at: string;
  previous_hash: string;
  hash: string;
  canonical: string;
}
export async function appendAudit(
  db: DbExecutor,
  documentId: string,
  event: string,
  actor: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  // The database trigger allocates the sequence and hashes under the document lock.
  await db.query(
    'INSERT INTO public.esign_audit(document_id,event,actor,details) VALUES($1,$2,$3,$4)',
    [documentId, event, actor, details]
  );
}
export async function verifyAudit(db: DbExecutor, documentId: string): Promise<AuditEntry[]> {
  const { rows } = await db.query<AuditEntry>(
    'SELECT *, occurred_at::text AS occurred_at FROM public.esign_audit WHERE document_id=$1 ORDER BY seq',
    [documentId]
  );
  const { rows: documents } = await db.query(
    'SELECT audit_head,audit_seq FROM public.esign_documents WHERE id=$1',
    [documentId]
  );
  let previous = '0'.repeat(64);
  for (let i = 0; i < rows.length; i++) {
    const e = rows[i];
    const canonical = JSON.parse(e.canonical) as unknown[];
    const { rows: check } = await db.query<{ valid: boolean }>(
      `SELECT ($1::jsonb->>2)::timestamptz = $4::timestamptz AND $1::jsonb = jsonb_build_array($2::text,$3::bigint,($1::jsonb->>2),$5::text,$6::text,$7::jsonb,$8::text) AS valid`,
      [
        e.canonical,
        e.document_id,
        e.seq,
        e.occurred_at,
        e.event,
        e.actor,
        JSON.stringify(e.details),
        e.previous_hash,
      ]
    );
    if (
      !check[0]?.valid ||
      canonical.length !== 7 ||
      Number(e.seq) !== i + 1 ||
      e.previous_hash !== previous ||
      sha256(e.canonical) !== e.hash
    )
      throw new Error('E-sign audit integrity failure');
    previous = e.hash;
  }
  if (
    !documents[0] ||
    Number(documents[0].audit_seq) !== rows.length ||
    documents[0].audit_head !== previous
  )
    throw new Error('E-sign audit head mismatch');
  return rows;
}
