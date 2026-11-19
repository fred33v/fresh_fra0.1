import { describe, expect, it } from '@jest/globals';
import { commissionTarget, verifyConcurrently } from '../src/provider-commissions.js';

describe('commissionTarget', () => {
  it('earns 17% of the VAT-exclusive price on a paid sale', () => {
    expect(commissionTarget(100000, 120000, 0, true)).toBe(17000);
  });

  it('reduces the commission in proportion to a refund that includes VAT', () => {
    expect(commissionTarget(100000, 120000, 60000, true)).toBe(8500);
  });

  it('rounds half up, once', () => {
    expect(commissionTarget(50, 60, 0, true)).toBe(9); // 8.5 pence
    expect(commissionTarget(1, 1, 0, true)).toBe(0); // 0.17 pence
    expect(commissionTarget(3, 4, 0, true)).toBe(1); // 0.51 pence
    expect(commissionTarget(100000, 120000, 1, true)).toBe(17000); // 16999.86 pence
  });

  it('earns nothing when the payment did not succeed or was free', () => {
    expect(commissionTarget(100000, 120000, 0, false)).toBe(0);
    expect(commissionTarget(0, 0, 0, true)).toBe(0);
  });

  it('earns nothing on a fully refunded sale', () => {
    expect(commissionTarget(100000, 120000, 120000, true)).toBe(0);
  });

  it('lowers the commission to zero instead of throwing when a refund exceeds the payment', () => {
    // Runs inside payment reconciliation: throwing here would roll back the payment update.
    expect(commissionTarget(100000, 120000, 120001, true)).toBe(0);
    expect(commissionTarget(100000, 120000, 999999, false)).toBe(0);
    expect(commissionTarget(100000, 0, 1, true)).toBe(0);
  });

  it('still rejects values that cannot come from integer money columns', () => {
    expect(() => commissionTarget(1.5, 120000, 0, true)).toThrow('Invalid commission amounts');
    expect(() => commissionTarget(-1, 120000, 0, true)).toThrow('Invalid commission amounts');
    expect(() => commissionTarget(100000, 120000, -1, true)).toThrow('Invalid commission amounts');
    expect(() => commissionTarget(100000, Number.NaN, 0, true)).toThrow('Invalid commission amounts');
  });
});

describe('verifyConcurrently', () => {
  const ids = Array.from({ length: 12 }, (_, i) => `sale-${i}`);

  it('verifies every sale and never runs more than the limit at once', async () => {
    let running = 0;
    let peak = 0;
    const seen: string[] = [];
    const failed = await verifyConcurrently(ids, async (id) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 2));
      seen.push(id);
      running--;
    }, 3);
    expect(failed).toEqual([]);
    expect(seen.sort()).toEqual([...ids].sort());
    expect(peak).toBe(3);
  });

  it('reports failures without stopping the rest and without throwing', async () => {
    const seen: string[] = [];
    const failed = await verifyConcurrently(ids, async (id) => {
      if (id === 'sale-2' || id === 'sale-7') throw new Error(`Stripe unavailable for ${id}`);
      seen.push(id);
    }, 4);
    expect(failed.map((f) => f.id).sort()).toEqual(['sale-2', 'sale-7']);
    expect((failed[0].error as Error).message).toContain('Stripe unavailable');
    expect(seen).toHaveLength(10);
  });

  it('copes with an empty list and a nonsensical limit', async () => {
    expect(await verifyConcurrently([], async () => undefined, 5)).toEqual([]);
    const seen: string[] = [];
    await verifyConcurrently(['a', 'b'], async (id) => { seen.push(id); }, 0);
    expect(seen.sort()).toEqual(['a', 'b']);
  });
});
