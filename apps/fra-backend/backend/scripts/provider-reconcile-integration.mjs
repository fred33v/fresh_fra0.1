// Disposable PostgreSQL only. Verifies the real backup and atomic legacy-schema reconciliation.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import pg from 'pg';
const url = new URL(process.env.DATABASE_URL ?? 'https://invalid');
assert(
  process.env.PROVIDER_RECONCILE_TEST_DATABASE === '1' &&
    process.env.NODE_ENV === 'test' &&
    ['127.0.0.1', 'localhost'].includes(url.hostname) &&
    url.pathname === '/provider_reconcile_test'
);
let pool = new pg.Pool({ connectionString: url.href });
const run = (script, args = []) =>
  execFileSync(process.execPath, ['--import', 'tsx', script, ...args], {
    env: { ...process.env, DATABASE_URL: url.href, DATABASE_URL_UNPOOLED: url.href },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
const files = readdirSync('migrations')
  .filter((f) => f.endsWith('.sql'))
  .sort();
try {
  await pool.query(
    'CREATE TABLE public.schema_migrations(version text PRIMARY KEY,applied_at timestamptz DEFAULT now())'
  );
  for (const f of files.filter((f) => f < '037')) {
    await pool.query(readFileSync(resolve('migrations', f), 'utf8'));
    await pool.query('INSERT INTO public.schema_migrations(version) VALUES($1)', [f]);
  }
  for (const f of ['037_provider_recruitment.sql', '038_provider_agreements.sql']) {
    await pool.query(readFileSync(resolve('__tests__/fixtures/pr94', f), 'utf8'));
    await pool.query('INSERT INTO public.schema_migrations(version) VALUES($1)', [f]);
  }
  const id = randomUUID(),
    user = randomUUID(),
    org = randomUUID(),
    doc = randomUUID(),
    agreement = randomUUID();
  await pool.query(
    `INSERT INTO public.provider_applications(id,user_id,organisation_id,contact_email,profile,commission_basis_points,terms_version,acknowledged_at) VALUES($1,$2,$3,'fixture@example.test',$4,1700,'provider-programme-2026-11',now())`,
    [
      id,
      user,
      org,
      { fullName: 'Legacy Fixture', businessName: 'Retained Legacy Ltd', kind: 'both' },
    ]
  );
  await pool.query(
    "INSERT INTO public.provider_application_events(application_id,version,actor_id,actor_role,event,snapshot) VALUES($1,1,$2,'employer','application.submitted',$3)",
    [id, user, { retained: 'original application' }]
  );
  await pool.query(
    `INSERT INTO public.esign_documents(id,organisation_id,created_by,title,original_pdf,original_sha256,source_pdf,source_sha256,pages) VALUES($1,$2,$3,'Legacy signed-source reference','fixture',encode(sha256('fixture'::bytea),'hex'),'fixture',encode(sha256('fixture'::bytea),'hex'),'[]')`,
    [doc, org, user]
  );
  await pool.query(
    `INSERT INTO public.provider_agreements(id,application_id,application_version,document_id,source_sha256,terms,application_snapshot,created_by) VALUES($1,$2,1,$3,repeat('a',64),'{}','{}',$4)`,
    [agreement, id, doc, user]
  );
  const legacy = (
    await pool.query('SELECT row_to_json(t) AS row FROM public.provider_applications t')
  ).rows;
  const evidenceBefore = (
    await pool.query(
      'SELECT id,source_sha256,final_key,final_version FROM public.esign_documents ORDER BY id'
    )
  ).rows;
  const receiptsBefore = (
    await pool.query('SELECT version,applied_at FROM public.schema_migrations ORDER BY version')
  ).rows;
  const dry = run('scripts/reconcile-pr94-local.mjs');
  assert(dry.includes('DRY RUN ONLY'));
  assert(
    (await pool.query("SELECT to_regclass('pr94_legacy.provider_applications') AS name")).rows[0]
      .name === null
  );
  let migrationRefused = false;
  try {
    run('src/migrate.ts');
  } catch (e) {
    migrationRefused = (String(e.stdout) + String(e.stderr)).includes(
      'PR94 provider schema detected'
    );
  }
  assert(migrationRefused, 'Normal migration must refuse incompatible PR94 layout');
  await pool.end();
  pool = new pg.Pool({ connectionString: url.href });
  const applied = run('scripts/reconcile-pr94-local.mjs', ['--apply']);
  assert(applied.includes('PASS: PR94 evidence archived unchanged'));
  const backup = applied.match(/Private backup created: (.+)/)[1];
  assert.equal(readFileSync(backup).subarray(0, 5).toString(), 'PGDMP');
  const restoreEnv = {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGSSLMODE: 'disable',
  };
  const restore = process.env.PG_RESTORE ?? 'pg_restore';
  const listing = execFileSync(restore, ['--list', backup], {
    env: restoreEnv,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert(listing.includes('provider_application_events'));
  await pool.query('CREATE DATABASE provider_reconcile_restore_test');
  execFileSync(
    restore,
    ['--no-owner', '--no-privileges', '--dbname', 'provider_reconcile_restore_test', backup],
    { env: restoreEnv, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const restoreUrl = new URL(url.href);
  restoreUrl.pathname = '/provider_reconcile_restore_test';
  const restored = new pg.Pool({ connectionString: restoreUrl.href });
  try {
    assert.deepEqual(
      (await restored.query('SELECT row_to_json(t) AS row FROM public.provider_applications t'))
        .rows,
      legacy
    );
    assert.deepEqual(
      (
        await restored.query(
          'SELECT id,source_sha256,final_key,final_version FROM public.esign_documents ORDER BY id'
        )
      ).rows,
      evidenceBefore
    );
  } finally {
    await restored.end();
  }

  assert.deepEqual(
    (await pool.query('SELECT row_to_json(t) AS row FROM pr94_legacy.provider_applications t'))
      .rows,
    legacy
  );
  assert.deepEqual(
    (
      await pool.query(
        'SELECT id,source_sha256,final_key,final_version FROM public.esign_documents ORDER BY id'
      )
    ).rows,
    evidenceBefore
  );
  assert.deepEqual(
    (
      await pool.query(
        'SELECT version,applied_at FROM pr94_legacy.migration_receipts ORDER BY version'
      )
    ).rows,
    receiptsBefore
  );
  assert.equal(
    Number((await pool.query('SELECT count(*) AS n FROM public.provider_applications')).rows[0].n),
    0
  );
  assert.equal(
    Number(
      (await pool.query('SELECT count(*) AS n FROM public.provider_commission_entries')).rows[0].n
    ),
    0
  );
  assert.equal(
    Number(
      (
        await pool.query(
          'SELECT count(*) AS n FROM public.schema_migrations WHERE version LIKE $1',
          ['04%']
        )
      ).rows[0].n
    ),
    2
  );
  await assert.rejects(pool.query('DELETE FROM pr94_legacy.provider_application_events'));
  const again = run('scripts/reconcile-pr94-local.mjs', ['--apply']);
  assert(again.includes('NO RECONCILIATION'));
  run('src/migrate.ts');
  console.log(
    'PASS local-only dry run, real private pg_dump, canonical migration refusal, preserved archive/receipts/e-sign refs, no invented approvals/ledger and idempotent rerun'
  );
  console.log('BACKUP_FOR_RESTORE_TEST=' + backup);
} finally {
  await pool.end();
}
