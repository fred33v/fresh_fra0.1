import type { Context } from 'hono';
import type { PoolClient } from 'pg';
import { hasDatabase, requireAuth } from './helpers.js';
import { withTransaction } from './db/transaction.js';
class RefusedWrite extends Error {
  constructor(readonly response: Response) {
    super('Domain write refused');
  }
}
/** Keep the source write, audit and outbox on one connection; start effects only after commit. */
export function domainWrite(
  handler: (
    c: Context,
    db: PoolClient | undefined,
    afterCommit: (effect: () => void) => void
  ) => Promise<Response>
) {
  return async (c: Context): Promise<Response> => {
    const auth = requireAuth(c);
    if (auth instanceof Response) return auth;
    const effects: Array<() => void> = [];
    const run = async (db?: PoolClient) => {
      if (db)
        await db.query('SELECT pg_advisory_xact_lock(193478,hashtext($1))', [auth.organisationId]);
      const response = await handler(c, db, (effect) => effects.push(effect));
      if (response.status >= 400) throw new RefusedWrite(response);
      return response;
    };
    try {
      const response = hasDatabase() ? await withTransaction(run) : await run();
      for (const effect of effects) effect();
      return response;
    } catch (error) {
      if (error instanceof RefusedWrite) return error.response;
      throw error;
    }
  };
}
