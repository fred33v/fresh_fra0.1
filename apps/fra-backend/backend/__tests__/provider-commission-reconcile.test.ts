import { describe, expect, it, jest } from '@jest/globals';
import { reconcileProviderCommission } from '../src/provider-commissions.js';

type Sale = { application_id: string; amount_cents: number; currency: string; status: string;
  refunded_amount_cents: number; payment_reconciled_at: Date | null };

/** Scripted executor: answers the four statements reconcileProviderCommission issues, in order. */
function fakeDb(sale: Sale | undefined, previous: number) {
  const calls: { sql: string; params?: unknown[] }[] = [];
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    if (sql.includes('FROM public.provider_sale_attributions')) return { rows: sale ? [sale] : [] };
    if (sql.includes('sum(delta_cents)')) return { rows: [{ amount: previous }] };
    return { rows: [] };
  });
  return { db: { query } as never, calls };
}
const paid = (over: Partial<Sale> = {}): Sale => ({ application_id: 'app', amount_cents: 100000, currency: 'gbp',
  status: 'succeeded', refunded_amount_cents: 0, payment_reconciled_at: new Date(), ...over });
const inserted = (calls: { sql: string; params?: unknown[] }[]) => calls.find((c) => c.sql.includes('INSERT INTO public.provider_commission_entries'));

describe('reconcileProviderCommission', () => {
  it('records the full commission once a verified payment succeeds', async () => {
    const { db, calls } = fakeDb(paid(), 0);
    await reconcileProviderCommission(db, 'purchase');
    expect(inserted(calls)?.params).toEqual(['purchase', 'app', 'gbp', 17000, 17000, 'succeeded; refunded=0']);
  });

  it('adds only the difference for a partial refund', async () => {
    const { db, calls } = fakeDb(paid({ refunded_amount_cents: 60000 }), 17000);
    await reconcileProviderCommission(db, 'purchase');
    expect(inserted(calls)?.params?.slice(3, 5)).toEqual([-8500, 8500]);
  });

  it('claws back the remainder on a later full refund', async () => {
    const { db, calls } = fakeDb(paid({ refunded_amount_cents: 120000 }), 8500);
    await reconcileProviderCommission(db, 'purchase');
    expect(inserted(calls)?.params?.slice(3, 5)).toEqual([-8500, 0]);
  });

  it('reverses the commission when the payment is no longer succeeded (dispute)', async () => {
    const { db, calls } = fakeDb(paid({ status: 'disputed' }), 17000);
    await reconcileProviderCommission(db, 'purchase');
    expect(inserted(calls)?.params?.slice(3, 5)).toEqual([-17000, 0]);
  });

  it('writes nothing when the ledger already matches', async () => {
    const { db, calls } = fakeDb(paid({ refunded_amount_cents: 60000 }), 8500);
    await reconcileProviderCommission(db, 'purchase');
    expect(inserted(calls)).toBeUndefined();
  });

  it('zeroes the commission instead of throwing when the refund exceeds the payment', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { db, calls } = fakeDb(paid({ refunded_amount_cents: 999999 }), 17000);
    await expect(reconcileProviderCommission(db, 'purchase')).resolves.toBeUndefined();
    expect(inserted(calls)?.params?.slice(3, 5)).toEqual([-17000, 0]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('ignores unverified or unattributed purchases and never takes the provider lock', async () => {
    for (const sale of [paid({ payment_reconciled_at: null }), undefined]) {
      const { db, calls } = fakeDb(sale, 0);
      await reconcileProviderCommission(db, 'purchase');
      expect(calls).toHaveLength(1);
    }
  });

  it('locks the provider row before reading the ledger', async () => {
    const { db, calls } = fakeDb(paid(), 0);
    await reconcileProviderCommission(db, 'purchase');
    const lock = calls.findIndex((c) => c.sql.includes('FOR UPDATE'));
    const ledger = calls.findIndex((c) => c.sql.includes('sum(delta_cents)'));
    expect(lock).toBeGreaterThan(-1);
    expect(lock).toBeLessThan(ledger);
  });
});
