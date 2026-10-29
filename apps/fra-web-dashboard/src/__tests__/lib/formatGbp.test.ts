import { formatGbp } from '@/data/packages';

describe('formatGbp', () => {
  it('adds thousands separators and always shows pence', () => {
    expect(formatGbp(2158.8)).toBe('£2,158.80');
    expect(formatGbp(1799)).toBe('£1,799.00');
    expect(formatGbp(4995 * 1.2)).toBe('£5,994.00');
  });

  it('leaves small amounts alone', () => {
    expect(formatGbp(795)).toBe('£795.00');
    expect(formatGbp(0)).toBe('£0.00');
  });

  it('rounds floating-point noise to pence', () => {
    // 1799 * 1.2 is 2158.7999999999997 in floating point
    expect(formatGbp(1799 * 1.2)).toBe('£2,158.80');
  });
});
