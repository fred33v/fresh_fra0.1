/**
 * Package catalogue - Unit Tests
 *
 * Prices and allowances must match the backend catalogue and the web app.
 */

import { PACKAGES, billingNote, formatGbp, keyPassAllocation, spokenPrice } from '@/constants/packages';

describe('package catalogue', () => {
  it('matches the backend prices, billing and key-pass allowances', () => {
    expect(PACKAGES['health-check']).toMatchObject({ backendId: 'pkg_basic', priceGbp: 795, billing: 'one-time', keyPasses: 1 });
    expect(PACKAGES['with-awareness']).toMatchObject({ backendId: 'pkg_training', priceGbp: 1799, billing: 'annual', keyPasses: 50 });
    expect(PACKAGES['with-dashboard']).toMatchObject({ backendId: 'pkg_full', priceGbp: 4995, billing: 'annual', keyPasses: 'unlimited' });
  });

  it('gives every package real features', () => {
    for (const pkg of Object.values(PACKAGES)) {
      expect(pkg.features.length).toBeGreaterThan(2);
      expect(pkg.features.join(' ')).not.toMatch(/no features|must upgrade/i);
    }
  });

  it('formats prices and billing for display and screen readers', () => {
    expect(formatGbp(1799)).toBe('£1,799');
    expect(billingNote(PACKAGES['health-check'])).toBe('one-time + VAT');
    expect(billingNote(PACKAGES['with-dashboard'])).toBe('/year + VAT');
    expect(spokenPrice(PACKAGES['with-awareness'])).toBe('1799 pounds per year plus VAT');
  });

  it('requests no more key-passes than the package allows', () => {
    expect(keyPassAllocation('health-check', '11-50')).toBe(1);
    expect(keyPassAllocation('with-awareness', '251-1000')).toBe(50);
    expect(keyPassAllocation('with-dashboard', '101-250')).toBe(250);
    expect(keyPassAllocation('with-dashboard', '1001+')).toBe(500);
    expect(keyPassAllocation('with-dashboard', null)).toBe(500);
  });
});
