import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, readdirSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
const url = new URL(process.env.DATABASE_URL ?? 'https://invalid');
assert(
  process.env.IDENTIFIER_TEST_DATABASE === '1' &&
    process.env.NODE_ENV !== 'production' &&
    ['localhost', '127.0.0.1'].includes(url.hostname) &&
    url.pathname.includes('professional'),
  'Disposable loopback database required'
);
const admin = new pg.Pool({ connectionString: url.href }),
  name = 'professional_identifier_legacy_' + randomBytes(5).toString('hex'),
  target = new URL(url);
target.pathname = '/' + name;
const temp = mkdtempSync(join(tmpdir(), 'fra-identifier-upgrade-'));
mkdirSync(join(temp, 'migrations'));
const migrate = new URL('../src/migrate.ts', import.meta.url).pathname,
  dir = new URL('../migrations/', import.meta.url).pathname;
let db;
function run() {
  const p = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), migrate], {
    cwd: temp,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DATABASE_URL: target.href,
      DATABASE_URL_UNPOOLED: target.href,
    },
    encoding: 'utf8',
  });
  assert.equal(p.status, 0, p.stdout + p.stderr);
}
try {
  await admin.query(`CREATE DATABASE "${name}"`);
  db = new pg.Pool({ connectionString: target.href });
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.sql') && f < '043_'))
    copyFileSync(join(dir, f), join(temp, 'migrations', f));
  run();
  const user = randomUUID(),
    org = randomUUID(),
    app = randomUUID(),
    code = 'PRV-' + randomBytes(16).toString('hex');
  await db.query('BEGIN');
  await db.query(
    "INSERT INTO public.users(id,email,name,password_hash,role,organisation_id,email_verified_at) VALUES($1,$2,'Legacy Supplier','unused','employer',$3,now())",
    [user, user + '@example.test', org]
  );
  await db.query(
    "INSERT INTO public.organisations(id,name,created_by_user_id) VALUES($1,'Legacy business',$2)",
    [org, user]
  );
  await db.query(
    "INSERT INTO public.provider_applications(id,applicant_id,organisation_id,applicant_name,applicant_email,company_name,service_interest,status,provider_code,revision) VALUES($1,$2,$3,'Legacy Supplier',$4,'Legacy business','sales','suspended',$5,2)",
    [app, user, org, user + '@example.test', code]
  );
  await db.query('COMMIT');
  const before = (
    await db.query('SELECT to_jsonb(a) AS data FROM public.provider_applications a WHERE id=$1', [
      app,
    ])
  ).rows[0].data;
  copyFileSync(
    join(dir, '043_relationship_identifiers.sql'),
    join(temp, 'migrations', '043_relationship_identifiers.sql')
  );
  run();
  const rows = (
    await db.query('SELECT * FROM relationship_identifiers WHERE application_id=$1 ORDER BY kind', [
      app,
    ])
  ).rows;
  assert.equal(rows.length, 2);
  assert.equal(rows.find((r) => r.kind === 'provider_code').code, code);
  assert(rows.every((r) => r.status === 'suspended' && r.suspension_source === 'application'));
  assert.equal(
    (await db.query('SELECT count(*)::int AS n FROM relationship_identifier_events')).rows[0].n,
    2
  );
  assert.deepEqual(
    (
      await db.query('SELECT to_jsonb(a) AS data FROM public.provider_applications a WHERE id=$1', [
        app,
      ])
    ).rows[0].data,
    before
  );
  run();
  assert.deepEqual(
    (
      await db.query(
        'SELECT * FROM relationship_identifiers WHERE application_id=$1 ORDER BY kind',
        [app]
      )
    ).rows,
    rows
  );
  console.log(
    'PASS: 042-to-043 backfill preserves original PRV/application, supplier reference, suspension and no-op rerun'
  );
} finally {
  if (db) await db.end();
  await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
  await admin.end();
  rmSync(temp, { recursive: true, force: true });
}
