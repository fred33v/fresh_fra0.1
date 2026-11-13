import { Pool } from 'pg';
import { productionDatabaseConfig } from './database-tls.js';
import dns from 'node:dns';
import { createLogger } from './logger.js';

const logger = createLogger('db');

let pool: Pool | null = null;

export function getDbPool(): Pool {
  if (pool) return pool;

  dns.setDefaultResultOrder('ipv4first');

  const configuredUrl = process.env.DATABASE_URL;
  if (!configuredUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const connection = process.env.NODE_ENV === 'production'
    ? productionDatabaseConfig(configuredUrl)
    : { connectionString: configuredUrl, ssl: configuredUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined };

  pool = new Pool({
    ...connection,
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
