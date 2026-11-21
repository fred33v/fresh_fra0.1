#!/usr/bin/env node
import {openSync,readSync,closeSync} from 'node:fs';
// One-off local reconciliation only. Default is inspection; --apply first creates a private pg_dump backup.
import '../src/env.ts';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, chmodSync, readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import pg from 'pg';
const archive = 'pr94_legacy';
const names = [
  '037_provider_applications.sql',
  '038_provider_recruitment.sql',
  '039_provider_commissions.sql',
  '040_provider_candidate_profile.sql',
  '041_provider_candidate_amendments.sql',
];
function parseUrl(value) {
  try {
    return new URL(value ?? 'https://invalid');
  } catch {
    throw new Error('Invalid database URL; no connection details printed');
  }
}
const url = parseUrl(process.env.DATABASE_URL);
const test =
  process.env.NODE_ENV === 'test' &&
  process.env.PROVIDER_RECONCILE_TEST_DATABASE === '1' &&
  url.pathname === '/provider_reconcile_test';
assert(
  process.env.NODE_ENV !== 'production' &&
    ['postgres:', 'postgresql:'].includes(url.protocol) &&
    ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) &&
    !url.search &&
    !url.hash &&
    (test || /^\/fresh_fra_esign_dev(?:_[a-z0-9]+)?$/.test(url.pathname)),
  'Only a dedicated loopback development database is permitted'
);
if (process.env.DATABASE_URL_UNPOOLED) {
  const direct = parseUrl(process.env.DATABASE_URL_UNPOOLED);
  assert(direct.href === url.href, 'DATABASE_URL_UNPOOLED must target the same local database');
}
const apply = process.argv.includes('--apply');
const pool = new pg.Pool({ connectionString: url.href }),
  db = await pool.connect();
let locked = false,
  transaction = false;
try {
  await db.query('SELECT pg_advisory_lock(193477,1)');
  locked = true;
  const columns = (
    await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='provider_applications'"
    )
  ).rows.map((r) => r.column_name);
  const canonical = columns.includes('applicant_id') && !columns.includes('user_id');
  if (canonical) {
    console.log(
      'NO RECONCILIATION: canonical #86 application schema detected. Use the normal migration runner for 040+.'
    );
  } else {
    assert(
      columns.includes('user_id') &&
        columns.includes('profile') &&
        !columns.includes('applicant_id'),
      'Unrecognised application schema; no changes made'
    );
    const applied = (await db.query('SELECT version FROM public.schema_migrations')).rows.map(
      (r) => r.version
    );
    assert(
      applied.includes('037_provider_recruitment.sql') &&
        applied.includes('038_provider_agreements.sql'),
      'Expected exact PR94 migration history'
    );
    assert(
      !names.slice(0, 3).some((n) => applied.includes(n)),
      'Mixed canonical/PR94 history requires manual inspection'
    );
    assert(
      !(await db.query('SELECT 1 FROM information_schema.schemata WHERE schema_name=$1', [archive]))
        .rowCount,
      'Archive already exists; inspect manually'
    );
    for (const name of [
      'provider_assignments',
      'provider_recruitment_audit',
      'provider_sale_attributions',
      'provider_commission_entries',
      'provider_payouts',
    ])
      assert(
        !(await db.query('SELECT to_regclass($1) AS name', [`public.${name}`])).rows[0].name,
        'Canonical accounting/recruitment tables already exist; refusing to move them'
      );
    const tables = [
      'provider_applications',
      'provider_application_events',
      'provider_agreements',
      'provider_engagement_readiness',
    ];
    const counts = {};
    for (const name of tables) {
      assert(
        (await db.query('SELECT to_regclass($1) AS name', [`public.${name}`])).rows[0].name,
        `Missing expected PR94 table: ${name}`
      );
      counts[name] = Number((await db.query(`SELECT count(*) AS n FROM public.${name}`)).rows[0].n);
    }
    console.log('PR94 schema detected. Retained archive plan:', JSON.stringify(counts));
    console.log(
      'Plan: archive all PR94 tables/history, preserve every e-sign document/object reference, create canonical #86 tables/ledger with real 037–039 SQL, apply 040–041. No legacy approval, assignment or financial entitlement will be invented.'
    );
    console.log(
      'Old applications remain in pr94_legacy for explicit reviewed import; none are automatically approved or reclassified.'
    );
    if (!apply) {
      console.log(
        'DRY RUN ONLY: no rows, schemas, files or migration receipts changed. Stop the backend, then rerun with --apply after reviewing this plan.'
      );
    } else {
      const clients = Number(
        (
          await db.query(
            "SELECT count(*) AS n FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend'"
          )
        ).rows[0].n
      );
      assert(clients === 0, 'Stop all other application/database clients before reconciliation');
      const backupDir = resolve('.local/provider-reconcile');
      mkdirSync(backupDir, { recursive: true, mode: 0o700 });
      chmodSync(backupDir, 0o700);
      const backup = join(backupDir, `before-pr94-reconcile-${Date.now()}.dump`);
      const dump = process.env.PG_DUMP ?? 'pg_dump';
      try {
        execFileSync(dump, ['--format=custom', '--file', backup], {
          env: {
            ...process.env,
            PGHOST: url.hostname.replace(/^\[|\]$/g, ''),
            PGPORT: url.port || '5432',
            PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
            PGUSER: decodeURIComponent(url.username),
            PGPASSWORD: decodeURIComponent(url.password),
            PGSSLMODE: 'disable',
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch {
        throw Error(
          'Private pg_dump backup failed. No database changes made. Set PG_DUMP to the installed matching pg_dump executable.'
        );
      }
      chmodSync(backup, 0o600);
      const backupFd = openSync(backup, 'r'); const backupHeader = Buffer.alloc(5);
      try { readSync(backupFd, backupHeader, 0, 5, 0); } finally { closeSync(backupFd); }
      assert(backupHeader.toString() === 'PGDMP', 'Invalid backup format');
      console.log('Private backup created:', backup);
      await db.query('BEGIN');
      transaction = true;
      // Lock each legacy relation before moving it; the migration advisory lock also serialises migration runners.
      for (const name of tables)
        await db.query(`LOCK TABLE public.${name} IN ACCESS EXCLUSIVE MODE`);
      await db.query(`CREATE SCHEMA ${archive}`);
      // These are PR94-only source/signer guards. Main has its own unchanged signing guards.
      await db.query(
        'DROP TRIGGER IF EXISTS provider_agreement_document_frozen ON public.esign_documents'
      );
      await db.query(
        'DROP TRIGGER IF EXISTS provider_agreement_signers_frozen ON public.esign_signers'
      );
      for (const name of tables) await db.query(`ALTER TABLE public.${name} SET SCHEMA ${archive}`);
      for (const name of [
        'provider_evidence_immutable',
        'provider_application_revision',
        'provider_agreement_freeze_document',
        'provider_agreement_freeze_signer',
      ]) {
        const found = (await db.query('SELECT to_regprocedure($1) AS name', [`public.${name}()`]))
          .rows[0].name;
        if (found) await db.query(`ALTER FUNCTION public.${name}() SET SCHEMA ${archive}`);
      }
      // Retain exact old receipt names and timestamps; never pretend new migrations already ran.
      await db.query(
        `CREATE TABLE ${archive}.migration_receipts AS SELECT * FROM public.schema_migrations`
      );
      for (const file of names) {
        const path = resolve('migrations', file);
        assert(existsSync(path), `Missing canonical migration ${file}`);
        await db.query(readFileSync(path, 'utf8'));
        await db.query('INSERT INTO public.schema_migrations(version) VALUES($1)', [file]);
      }
      for (const [name, count] of Object.entries(counts))
        assert.equal(
          Number((await db.query(`SELECT count(*) AS n FROM ${archive}.${name}`)).rows[0].n),
          count
        );
      assert.equal(
        Number(
          (await db.query('SELECT count(*) AS n FROM public.provider_commission_entries')).rows[0].n
        ),
        0
      );
      assert.equal(
        Number((await db.query('SELECT count(*) AS n FROM public.provider_payouts')).rows[0].n),
        0
      );
      await db.query('COMMIT');
      transaction = false;
      console.log(
        'PASS: PR94 evidence archived unchanged; canonical #86 migrations and 040–041 applied atomically. No e-sign evidence, commission or payment was rewritten.'
      );
    }
  }
} catch (error) {
  if (transaction) await db.query('ROLLBACK');
  console.error(error instanceof Error ? error.message : 'Reconciliation failed');
  process.exitCode = 1;
} finally {
  if (locked) await db.query('SELECT pg_advisory_unlock(193477,1)');
  db.release();
  await pool.end();
}
