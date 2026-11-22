import type { DbExecutor } from './db/transaction.js';
/** Supplier and referral references are independently controllable. Caller locks application first. */
export async function providerIdentifiersActive(db: DbExecutor, applicationId: string) {
  const rows = (
    await db.query(
      "SELECT kind,status FROM public.relationship_identifiers WHERE application_id=$1 AND kind IN ('supplier','provider_code') FOR SHARE",
      [applicationId]
    )
  ).rows;
  return rows.length === 2 && rows.every((r) => r.status === 'active');
}
