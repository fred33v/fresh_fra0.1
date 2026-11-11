#!/usr/bin/env node
import { randomBytes, randomUUID } from 'node:crypto';
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
      updated_at timestamptz,
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


  // Historical assessment backfill: preserve previously stored results.
  const historicalAnswers = {
    'procurement.dueDiligenceLevel': 1,
    'procurement.monthlySpend': 750000,
    'procurement.recentFraud': 'yes',
    'procurement.controlMaturity': 2,
  };
  const historicalDate = '2025-01-15T12:00:00.000Z';
  const ids = Array.from({ length: 4 }, () => randomUUID());
  const originalResult = { methodVersion: 999, preserved: true };

  for (const [index, status] of ['submitted', 'completed', 'draft', 'submitted'].entries()) {
    await testDb.query(
      `INSERT INTO public.assessments (id, answers, submitted_at, updated_at, status, result)
       VALUES ($1, $2::jsonb, $3::timestamptz, $4::timestamptz, $5, $6::jsonb)`,
      [
        ids[index],
        JSON.stringify(historicalAnswers),
        status === 'draft' ? null : historicalDate,
        historicalDate,
        status,
        index === 3 ? JSON.stringify(originalResult) : null,
      ],
    );
  }

  const historicalRun = await runMigration();
  assert(historicalRun.code === 0, 'Historical assessment backfill succeeds');

  const historicalRows = await testDb.query(
    `SELECT id, result, updated_at FROM public.assessments WHERE id = ANY($1::uuid[])`,
    [ids],
  );
  const byId = new Map(historicalRows.rows.map(row => [row.id, row]));

  for (const id of ids.slice(0, 2)) {
    const result = byId.get(id)?.result;
    assert(result?.methodVersion === 1, 'Historical scoring version is 1');
    assert(result?.risk?.level === 'high', 'Historical risk level is high');
    assert(
      result?.results?.modules?.find(module => module.id === 'procurement')?.score === 95,
      'Historical procurement score is 95',
    );
  }

  assert(byId.get(ids[2])?.result === null, 'Draft remains unscored');
  assert(
    JSON.stringify(byId.get(ids[3])?.result) === JSON.stringify(originalResult),
    'Existing result remains unchanged',
  );

  for (const id of ids) {
    assert(
      byId.get(id)?.updated_at?.toISOString() === historicalDate,
      'Assessment updated_at is preserved',
    );
  }

  const savedResults = new Map(historicalRows.rows.map(row => [row.id, row.result]));
  const repeatedRun = await runMigration();
  assert(repeatedRun.code === 0, 'Historical backfill can run twice');

  const repeatedRows = await testDb.query(
    `SELECT id, result FROM public.assessments WHERE id = ANY($1::uuid[])`,
    [ids],
  );
  assert(
    repeatedRows.rows.every(row =>
      JSON.stringify(row.result) === JSON.stringify(savedResults.get(row.id))
    ),
    'Historical results remain unchanged on second run',
  );
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
