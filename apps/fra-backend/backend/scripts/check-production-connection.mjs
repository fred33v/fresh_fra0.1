#!/usr/bin/env node
// Run with: node --import tsx scripts/check-production-connection.mjs
// Reads DATABASE_URL from the environment; never prints the URL or server errors.
import '../src/env.ts';
import pg from 'pg';
import { productionDatabaseConfig } from '../src/database-tls.ts';

if (!process.env.DATABASE_URL) {
  console.error(JSON.stringify({ ok: false, stage: 'configuration', code: 'DATABASE_URL_MISSING' }));
  process.exitCode = 2;
} else {
  let client;
  let stage = 'configuration';
  try {
    client = new pg.Client({
      ...productionDatabaseConfig(process.env.DATABASE_URL),
      connectionTimeoutMillis: 10_000,
      statement_timeout: 5_000,
      query_timeout: 7_000,
      application_name: 'stopfra-readonly-connection-check',
    });
    // Ignore later connection errors after the awaited operation; no raw secrets in logs.
    client.on('error', () => {});
    stage = 'connection';
    await client.connect();
    const stream = client.connection.stream;
    if (stream.encrypted !== true || stream.authorized !== true) {
      throw Object.assign(new Error('Unverified TLS'), { code: 'TLS_NOT_VERIFIED' });
    }
    stage = 'readonly-query';
    await client.query('BEGIN READ ONLY');
    await client.query("SET LOCAL statement_timeout = '5s'");
    const { rows: [result] } = await client.query(`
      SELECT 1 AS probe,
        current_setting('transaction_read_only') = 'on' AS read_only,
        EXISTS (SELECT 1 FROM pg_stat_ssl WHERE pid = pg_backend_pid() AND ssl) AS server_tls,
        to_regclass('public.schema_migrations') IS NOT NULL AS migration_history_present
    `);
    if (result.probe !== 1 || !result.read_only || !result.server_tls) {
      throw Object.assign(new Error('Read-only TLS probe failed'), { code: 'PROBE_FAILED' });
    }
    await client.query('ROLLBACK');
    console.log(JSON.stringify({
      ok: true,
      tls_authorized: stream.authorized,
      tls_protocol: stream.getProtocol(),
      read_only: result.read_only,
      server_tls: result.server_tls,
      migration_history_present: result.migration_history_present,
    }));
  } catch (error) {
    const candidate = error?.code;
    const code = typeof candidate === 'string' && /^[A-Z0-9_]{1,64}$/.test(candidate)
      ? candidate : 'CONNECTION_CHECK_FAILED';
    console.error(JSON.stringify({ ok: false, stage, code }));
    process.exitCode = 1;
  } finally {
    await client?.end().catch(() => undefined);
  }
}
