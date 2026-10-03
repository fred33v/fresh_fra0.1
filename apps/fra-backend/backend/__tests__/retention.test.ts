/// <reference types="jest" />

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// The retention job only touches Postgres, so the pool, the database check and the audit log are faked
// (jest.mock is hoisted; factory variables must start with "mock")
const mockQuery = jest.fn<(sql: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount?: number }>>();
const mockAuditLog = jest.fn<(event: Record<string, unknown>) => Promise<void>>();
const mockDb = { configured: true };

jest.mock('../src/db', () => ({ getDbPool: () => ({ query: mockQuery }) }));
jest.mock('../src/helpers', () => ({ hasDatabase: () => mockDb.configured }));
jest.mock('../src/db/audit', () => ({ auditLog: mockAuditLog }));

import { runRetention, msUntilNextRun, RETENTION_RULES } from '../src/retention';

const query = mockQuery;
const auditLog = mockAuditLog;

const NOW = new Date('2026-10-03T12:00:00Z');

beforeEach(() => {
  query.mockReset();
  auditLog.mockReset();
  auditLog.mockResolvedValue(undefined);
  mockDb.configured = true;
  delete process.env.RETENTION_ENABLED;
  query.mockImplementation(async (sql) => {
    if (sql.startsWith('SELECT ($1::timestamptz')) return { rows: [{ cutoff: '2020-10-03T12:00:00Z' }] };
    if (sql.startsWith('SELECT count')) return { rows: [{ n: 2 }] };
    return { rows: [], rowCount: 3 };
  });
});

describe('data retention', () => {
  it('follows the documented policy: 6 years for fraud records, 7 for payments, 90 days for sessions', () => {
    const keep = Object.fromEntries(RETENTION_RULES.map((r) => [r.table, r.keepFor]));
    expect(keep['public.assessments']).toBe('6 years');
    expect(keep['public.audit_logs']).toBe('6 years');
    expect(keep['public.risk_register']).toBe('6 years');
    expect(keep['public.purchases']).toBe('7 years');
    expect(keep['public.keypasses']).toBe('2 years');
    expect(keep['public.refresh_tokens']).toBe('90 days');
  });

  it('never removes records still in use', () => {
    const rule = (t: string) => RETENTION_RULES.find((r) => r.table === t)!.expiredWhen;
    expect(rule('public.risk_register')).toContain("status IN ('mitigated', 'accepted', 'closed')");
    expect(rule('compliance_incidents')).toContain('resolved_at IS NOT NULL');
    expect(rule('public.keypasses')).toContain('expires_at');
  });

  it('only counts by default, without deleting anything', async () => {
    const result = await runRetention({ now: NOW });

    expect(result.dryRun).toBe(true);
    expect(query.mock.calls.some(([sql]) => sql.startsWith('DELETE'))).toBe(false);
    expect(result.rules).toHaveLength(RETENTION_RULES.length);
    expect(result.rules.every((r) => r.count === 2)).toBe(true);
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'retention.dry_run' }));
  });

  it('deletes past-retention records when RETENTION_ENABLED=true and audits the run', async () => {
    process.env.RETENTION_ENABLED = 'true';
    const result = await runRetention({ now: NOW });

    expect(result.dryRun).toBe(false);
    const deletes = query.mock.calls.filter(([sql]) => sql.startsWith('DELETE'));
    expect(deletes).toHaveLength(RETENTION_RULES.length);
    expect(deletes[0][1]).toEqual(['2020-10-03T12:00:00Z']);
    expect(auditLog).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'retention.run',
      details: expect.objectContaining({ total: 3 * RETENTION_RULES.length }),
    }));
  });

  it('carries on with other tables when one fails', async () => {
    query.mockImplementation(async (sql) => {
      if (sql.startsWith('SELECT ($1::timestamptz')) return { rows: [{ cutoff: 'x' }] };
      if (sql.includes('audit_logs')) throw new Error('relation does not exist');
      return { rows: [{ n: 1 }] };
    });
    const result = await runRetention({ now: NOW });

    expect(result.rules.find((r) => r.table === 'public.audit_logs')?.error).toMatch(/does not exist/);
    expect(result.rules.filter((r) => !r.error)).toHaveLength(RETENTION_RULES.length - 1);
  });

  it('does nothing without a database', async () => {
    mockDb.configured = false;
    const result = await runRetention({ now: NOW });

    expect(result.rules).toHaveLength(0);
    expect(query).not.toHaveBeenCalled();
  });

  it('schedules the next run at 02:00 UTC', () => {
    expect(msUntilNextRun(new Date('2026-10-03T01:00:00Z'))).toBe(60 * 60 * 1000);
    expect(msUntilNextRun(new Date('2026-10-03T02:00:00Z'))).toBe(24 * 60 * 60 * 1000);
    expect(msUntilNextRun(new Date('2026-10-03T23:00:00Z'))).toBe(3 * 60 * 60 * 1000);
  });
});
