#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import pg from 'pg';

const url = new URL(process.env.DATABASE_URL ?? 'postgres://invalid');
const allowed =
  process.env.GITHUB_ACTIONS === 'true' &&
  process.env.CI === 'true' &&
  url.protocol === 'postgresql:' &&
  url.hostname === 'localhost' &&
  url.port === '5432' &&
  url.username === 'fra' &&
  url.password === 'fra-ci-only' &&
  url.pathname === '/fra';

if (!allowed) {
  console.error('REFUSED: requires the exact isolated GitHub CI PostgreSQL environment');
  process.exit(2);
}

const name = 'fra_migration_test_' + randomBytes(6).toString('hex');
const directory = mkdtempSync(join(tmpdir(), 'fra-migrations-'));
const migrations = join(directory, 'migrations');
const backend = process.cwd();
const tsx = resolve(backend, 'node_modules/.bin/tsx');
const runner = resolve(backend, 'src/migrate.ts');

mkdirSync(migrations);

const admin = new pg.Client({ connectionString: url.toString() });
const testUrl = new URL(url);
testUrl.pathname = '/' + name;

function migration(filename, sql) {
  writeFileSync(join(migrations, filename), sql);
}

function runMigration() {
  return new Promise((resolveResult, reject) => {
    const child = spawn(tsx, [runner], {
      cwd: directory,
      env: {
        ...process.env,
        DATABASE_URL: testUrl.toString(),
        DB_POOL_MAX: '2',
        DB_STATEMENT_TIMEOUT_MS: '30000',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
    }, 90000);

    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    child.on('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', code => {
      clearTimeout(timeout);
      resolveResult({ code, output });
    });
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log('PASS:', message);
}

let databaseCreated = false;
let testDb;

try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  databaseCreated = true;

  testDb = new pg.Client({ connectionString: testUrl.toString() });
  await testDb.connect();

  migration('001_fixture.sql', `
    CREATE TABLE public.assessments (
      id uuid PRIMARY KEY,
      answers jsonb,
      submitted_at timestamptz,
      status text,
      result jsonb
    );
  `);

  migration('002_failure.sql', `
    CREATE TABLE public.partial_migration_test (id integer);
    SELECT 1 / 0;
  `);

  const failed = await runMigration();
  assert(failed.code !== 0, 'Faulty migration fails');

  const partial = await testDb.query(
    "SELECT to_regclass('public.partial_migration_test') AS name"
  );
  assert(partial.rows[0].name === null,
    'Failed migration leaves no partially created table');

  const history = await testDb.query(
    'SELECT version FROM public.schema_migrations ORDER BY version'
  );
  assert(
    JSON.stringify(history.rows.map(row => row.version)) ===
      JSON.stringify(['001_fixture.sql']),
    'Failed migration is not recorded as applied'
  );

  migration('002_failure.sql', `
    CREATE TABLE public.partial_migration_test (id integer);
  `);

  const recovered = await runMigration();
  assert(recovered.code === 0,
    'Corrected migration succeeds on retry: ' + recovered.output.slice(-400));

  const recoveredTable = await testDb.query(
    "SELECT to_regclass('public.partial_migration_test') AS name"
  );
  assert(recoveredTable.rows[0].name !== null,
    'Corrected migration creates the expected table');

  migration('003_concurrent.sql', `
    SELECT pg_sleep(2);
    CREATE TABLE public.concurrent_migration_test (id integer);
  `);

  const concurrent = await Promise.all([
    runMigration(),
    runMigration(),
  ]);

  assert(concurrent.every(result => result.code === 0),
    'Both concurrent migration runners finish successfully');

  const concurrentTable = await testDb.query(
    "SELECT to_regclass('public.concurrent_migration_test') AS name"
  );
  assert(concurrentTable.rows[0].name !== null,
    'Concurrent migration creates the expected table');

  const count = await testDb.query(
    `SELECT COUNT(*)::integer AS count
     FROM public.schema_migrations
     WHERE version = '003_concurrent.sql'`
  );

  assert(count.rows[0].count === 1,
    'Concurrent migration is recorded exactly once');

  console.log('MIGRATION_INTEGRATION=PASS');
} catch (error) {
  console.error('MIGRATION_INTEGRATION=FAIL');
  console.error(error);
  process.exitCode = 1;
} finally {
  if (testDb) {
    try { await testDb.end(); } catch (error) {
      console.error('Test database connection cleanup failed:', error);
      process.exitCode = 1;
    }
  }

  if (databaseCreated) {
    try {
      await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    } catch (error) {
      console.error('Temporary database cleanup failed:', error);
      process.exitCode = 1;
    }
  }

  try { await admin.end(); } catch (error) {
    console.error('Admin connection cleanup failed:', error);
    process.exitCode = 1;
  }

  rmSync(directory, { recursive: true, force: true });
}
