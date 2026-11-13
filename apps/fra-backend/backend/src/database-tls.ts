import { readFileSync } from 'node:fs';
import type { PoolConfig } from 'pg';
import type { ConnectionOptions } from 'node:tls';

/** Enforce certificate and hostname verification without exposing URL credentials in errors. */
export function productionDatabaseUrl(connectionString: string): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) {
    throw new Error('DATABASE_URL must be a PostgreSQL URL with a network hostname');
  }
  if (url.searchParams.getAll('host').some(host => !host || host.includes('/'))) {
    throw new Error('DATABASE_URL must use a network hostname in production');
  }
  const modes = url.searchParams.getAll('sslmode');
  if (modes.some(mode => !['require', 'verify-ca', 'verify-full'].includes(mode))) {
    throw new Error('DATABASE_URL must not disable TLS or certificate verification in production; use sslmode=verify-full');
  }
  if (url.searchParams.getAll('ssl').some(value => !['true', '1'].includes(value))) {
    throw new Error('DATABASE_URL must not disable TLS in production');
  }
  // pg reparses connectionString and can override Pool.ssl. Enforce the secure
  // mode in the URL itself, including when libpq compatibility is enabled.
  // Retain client certificates, custom CA paths and unrelated connection options.
  url.searchParams.set('sslmode', 'verify-full');
  return url.toString();
}

/** Keep URL parsing from replacing the explicit TLS verification options in pg. */
export function productionDatabaseConfig(connectionString: string): Pick<PoolConfig, 'connectionString' | 'ssl'> {
  const url = new URL(productionDatabaseUrl(connectionString));
  const ssl: ConnectionOptions = { rejectUnauthorized: true };
  for (const [parameter, property] of [['sslrootcert', 'ca'], ['sslcert', 'cert'], ['sslkey', 'key']] as const) {
    const path = url.searchParams.getAll(parameter).at(-1);
    if (path) {
      try { ssl[property] = readFileSync(path, 'utf8'); }
      catch { throw new Error(`DATABASE_URL ${parameter} file cannot be read`); }
    }
  }
  for (const parameter of ['sslmode', 'ssl', 'sslrootcert', 'sslcert', 'sslkey', 'uselibpqcompat']) {
    url.searchParams.delete(parameter);
  }
  return { connectionString: url.toString(), ssl };
}
