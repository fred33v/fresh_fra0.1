// Must stay the first import: modules below read process.env when they load
import './env.js';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getDbPool, closeDbPool } from './db.js';
import { createLogger } from './logger.js';
import { computeResult } from './assessment-result.js';
import type { PoolClient } from 'pg';

const logger = createLogger('migrate');

// A stable, application-specific advisory lock, shared by migration runners.
const MIGRATION_LOCK = 'SELECT pg_advisory_lock(193477, 1)';
const MIGRATION_UNLOCK = 'SELECT pg_advisory_unlock(193477, 1)';

async function main() {
  const migrationsDir = join(process.cwd(), 'migrations');
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    logger.info('No migrations found');
    return;
  }

  // Migrations run over the direct connection: a pooled one drops session state
  const pool = getDbPool({ direct: true });
  let client: PoolClient | undefined;
  let locked = false;

  try {
    client = await pool.connect();

    // Serialize migration runners before checking the migration history.
    await client.query(MIGRATION_LOCK);
    locked = true;

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version text PRIMARY KEY,
        applied_at timestamptz DEFAULT now()
      )
    `);

    const applied = await client.query(
      'SELECT version FROM public.schema_migrations',
    );
    const appliedSet = new Set(
      applied.rows.map((r: { version: string }) => r.version),
    );

    for (const file of files) {
      if (appliedSet.has(file)) {
        logger.info(`Skipping already-applied migration ${file}`);
        continue;
      }

      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      logger.info(`Applying migration ${file}`);

      await client.query('BEGIN');

      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO public.schema_migrations (version) VALUES ($1)',
          [file],
        );
        await client.query('COMMIT');
        appliedSet.add(file);
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          logger.error('Migration rollback failed', {
            error: String(rollbackError),
          });
        }
        throw error;
      }
    }

    logger.info('Migrations applied');

    // Preserve the existing historical assessment results backfill.
    await backfillAssessmentResults(client);
  } finally {
    try {
      if (client) {
        try {
          if (locked) {
            await client.query(MIGRATION_UNLOCK);
          }
        } finally {
          client.release();
        }
      }
    } finally {
      await closeDbPool();
    }
  }
}

/**
 * Assessments submitted before results were saved (031) get their result once,
 * computed from their answers with today's method. updated_at is left alone.
 */
async function backfillAssessmentResults(client: PoolClient) {
  const { rows } = await client.query<{
    id: string;
    answers: Record<string, unknown>;
    submitted_at: Date | null;
  }>(
    "SELECT id, answers, submitted_at FROM public.assessments WHERE status IN ('submitted', 'completed') AND result IS NULL",
  );

  for (const r of rows) {
    const result = computeResult({
      id: r.id,
      answers: r.answers ?? {},
    });

    await client.query(
      'UPDATE public.assessments SET result = $1 WHERE id = $2 AND result IS NULL',
      [JSON.stringify(result), r.id],
    );
  }

  if (rows.length) {
    logger.info(
      `Saved the result of ${rows.length} assessment(s) submitted before results were kept`,
    );
  }
}

main().catch((err) => {
  logger.error('Migration failed', { error: String(err) });
  process.exit(1);
});
