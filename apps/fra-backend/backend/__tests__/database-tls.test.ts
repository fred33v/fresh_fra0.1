import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import pg from 'pg';
import { productionDatabaseUrl, productionDatabaseConfig } from '../src/database-tls.js';
import { closeDbPool, getDbPool } from '../src/db.js';

afterEach(async () => { await closeDbPool(); jest.restoreAllMocks(); });
const base = 'postgresql://fixture:fake-password@database.example.test/app';
function effectiveSsl(query: string) {
  const client = new pg.Client(productionDatabaseConfig(`${base}${query}`));
  // Inspect the driver's parsed configuration, not only the object passed to Pool.
  return (client as unknown as { connectionParameters: { ssl: false | Record<string, unknown> } }).connectionParameters.ssl;
}
describe('production database TLS', () => {
  it.each(['', '?sslmode=require', '?sslmode=verify-ca', '?sslmode=verify-full', '?sslmode=require&uselibpqcompat=true', '?ssl=true'])('keeps certificate and hostname verification enabled for %s', query => {
    const ssl = effectiveSsl(query);
    expect(ssl).toBeTruthy();
    expect(ssl).toHaveProperty('rejectUnauthorized', true);
    expect(ssl).not.toHaveProperty('checkServerIdentity');
    expect(new URL(productionDatabaseUrl(`${base}${query}`)).searchParams.getAll('sslmode')).toEqual(['verify-full']);
  });
  it.each(['sslmode=disable', 'sslmode=prefer', 'sslmode=allow', 'sslmode=no-verify', 'ssl=0', 'ssl=false', 'sslmode=verify-full&sslmode=disable'])('rejects insecure mode %s', query => {
    expect(() => productionDatabaseUrl(`${base}?${query}`)).toThrow('DATABASE_URL');
  });
  it.each(['not a url containing fake-password', 'https://fixture:fake-password@database.example.test', 'postgres:///app', `${base}?host=%2Ftmp`])('reports invalid configuration without including credentials', input => {
    try { productionDatabaseUrl(input); throw new Error('Expected refusal'); }
    catch (error) {
      expect((error as Error).message).toContain('DATABASE_URL');
      expect((error as Error).message).not.toContain('fake-password');
    }
  });
  it('preserves credentials, driver options and custom certificate paths', () => {
    const url = new URL(productionDatabaseUrl(`${base}?application_name=stopfra&sslrootcert=%2Fcerts%2Froot.pem&sslcert=%2Fcerts%2Fclient.pem`));
    expect(url.password).toBe('fake-password');
    expect(url.searchParams.get('application_name')).toBe('stopfra');
    expect(url.searchParams.get('sslrootcert')).toBe('/certs/root.pem');
    expect(url.searchParams.get('sslcert')).toBe('/certs/client.pem');
  });
  it('loads the custom CA while retaining explicit verification in the driver', () => {
    const dir = mkdtempSync(join(tmpdir(), 'stopfra-tls-'));
    try {
      const caPath = join(dir, 'ca.pem');
      writeFileSync(caPath, 'test CA fixture');
      const config = productionDatabaseConfig(`${base}?sslmode=require&sslrootcert=${encodeURIComponent(caPath)}`);
      const client = new pg.Client(config);
      const ssl = (client as unknown as { connectionParameters: { ssl: Record<string, unknown> } }).connectionParameters.ssl;
      expect(ssl).toEqual({ rejectUnauthorized: true, ca: 'test CA fixture' });
      expect(new URL(config.connectionString!).searchParams.has('sslrootcert')).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it('refuses unreadable certificate files without leaking their path or the URL', () => {
    expect(() => productionDatabaseConfig(`${base}?sslrootcert=%2Fmissing-fake-password-cert`))
      .toThrow('DATABASE_URL sslrootcert file cannot be read');
  });
  it('applies secure normalization through the real pool factory', () => {
    jest.replaceProperty(process, 'env', { ...process.env, NODE_ENV: 'production', DATABASE_URL: `${base}?sslmode=require&uselibpqcompat=true` });
    const pool = getDbPool();
    expect(new URL(pool.options.connectionString!).searchParams.has('sslmode')).toBe(false);
    expect(pool.options.ssl).toEqual({ rejectUnauthorized: true });
  });
  it('retains plaintext local development and database-test connections', () => {
    jest.replaceProperty(process, 'env', { ...process.env, NODE_ENV: 'development', DATABASE_URL: base });
    const pool = getDbPool();
    expect(pool.options.connectionString).toBe(base);
    expect(pool.options.ssl).toBeUndefined();
  });
});
