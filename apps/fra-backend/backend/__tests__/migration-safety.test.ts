import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('PostgreSQL migration safety requirements', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/migrate.ts'),
    'utf8',
  );

  it('uses a dedicated PostgreSQL client', () => {
    expect(source).toContain('pool.connect()');
  });

  it('uses transactions for applying migrations', () => {
    expect(source).toMatch(/client\.query\(['"]BEGIN['"]\)/);
    expect(source).toMatch(/client\.query\(['"]COMMIT['"]\)/);
    expect(source).toMatch(/client\.query\(['"]ROLLBACK['"]\)/);
  });

  it('protects against concurrent migration runners', () => {
    expect(source).toMatch(/pg_advisory_lock|pg_try_advisory_lock/);
  });

  it('preserves the assessment results backfill', () => {
    expect(source).toContain('backfillAssessmentResults');
    expect(source).toContain('computeResult');
  });

  it('releases database resources', () => {
    expect(source).toContain('client.release()');
    expect(source).toContain('closeDbPool()');
  });
});
