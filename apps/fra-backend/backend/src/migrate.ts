import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getDbPool } from './db.js';
import { createLogger } from './logger.js';

const logger = createLogger('migrate');

async function main() {
  const migrationsDir = join(process.cwd(), 'migrations');
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    logger.info('No migrations found');
    return;
  }

  const pool = getDbPool();

  // Create schema_migrations tracking table if it does not exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz DEFAULT now()
    )
  `);

  // Query already-applied migrations
  const applied = await pool.query('SELECT version FROM public.schema_migrations');
  const appliedSet = new Set(applied.rows.map((r: { version: string }) => r.version));

  for (const file of files) {
    if (appliedSet.has(file)) {
      logger.info(`Skipping already-applied migration ${file}`);
      continue;
    }

    const fullPath = join(migrationsDir, file);
    const sql = readFileSync(fullPath, 'utf8');
    logger.info(`Applying migration ${file}`);
    await pool.query(sql);
    await pool.query('INSERT INTO public.schema_migrations (version) VALUES ($1)', [file]);
  }

  logger.info('Migrations applied');
  await pool.end();
}

main().catch((err) => {
  logger.error('Migration failed', { error: String(err) });
  process.exit(1);
});
