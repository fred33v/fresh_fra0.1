import type { PoolClient } from 'pg';
import { hasDatabase } from './helpers.js';
import { withTransaction } from './db/transaction.js';
import { createLogger } from './logger.js';

const pending = new Map<string, Promise<void>>();
const logger = createLogger('keypass-lock');

/** Serialize quota checks and writes for an organisation in both storage modes. */
export async function withKeypassLock<T>(
  organisationId: string,
  work: (client: PoolClient | undefined, afterCommit: (effect: () => void) => void) => Promise<T>,
): Promise<T> {
  const effects: Array<() => void> = [];
  const run = (client?: PoolClient) => work(client, (effect) => effects.push(effect));
  const finish = (result: T) => {
    for (const effect of effects) {
      try { effect(); } catch (error) {
        logger.error('Post-commit notification failed', { error: String(error) });
      }
    }
    return result;
  };
  if (hasDatabase()) {
    const result = await withTransaction(async (client) => {
      // Transaction-scoped: automatically released on commit, rollback or disconnect.
      await client.query('SELECT pg_advisory_xact_lock(193478, hashtext($1))', [organisationId]);
      return run(client);
    });
    return finish(result);
  }
  const previous = pending.get(organisationId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  pending.set(organisationId, current);
  await previous;
  try {
    return finish(await run());
  } finally {
    release();
    if (pending.get(organisationId) === current) pending.delete(organisationId);
  }
}
