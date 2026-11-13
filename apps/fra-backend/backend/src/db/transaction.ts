import type { Pool, PoolClient } from 'pg';
import { getDbPool } from '../db.js';
import { createLogger } from '../logger.js';

export type DbExecutor = Pool | PoolClient;
const logger = createLogger('transaction');

/** Every operation in work must use this client, never a new pool checkout. */
export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getDbPool().connect();
  let releaseError: Error | undefined;
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      releaseError = rollbackError instanceof Error ? rollbackError : new Error(String(rollbackError));
      logger.error('Transaction rollback failed', { error: String(rollbackError) });
    }
    throw error;
  } finally {
    client.release(releaseError);
  }
}
