import { Pool } from 'pg';
import dns from 'node:dns';
import { createLogger } from './logger.js';

const logger = createLogger('db');

let pool: Pool | null = null;

export function getDbPool(): Pool {
  if (pool) return pool;

  dns.setDefaultResultOrder('ipv4first');

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const useSsl = connectionString.includes('sslmode=require');

  pool = new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: process.env.NODE_ENV === 'production' } : undefined,
    max: Number(process.env.DB_POOL_MAX ?? 20),
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS ?? 30000),
    connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 5000),
    statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT_MS ?? 30000),
  });

  pool.on('error', (err) => {
    logger.error('Unexpected pool error', { error: err.message });
  });

  return pool;
}

export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
