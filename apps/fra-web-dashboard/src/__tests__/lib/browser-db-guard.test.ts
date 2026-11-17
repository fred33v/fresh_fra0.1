import { describe, expect, it } from 'vitest';
import { browserTestDatabase } from '../../../e2e-database/guard';

describe('real browser suite database boundary', () => {
  it('requires explicit opt-in even for a local disposable database', () => {
    expect(() => browserTestDatabase({ DATABASE_URL: 'postgresql://fixture:fake@localhost/fra' })).toThrow();
  });
  it.each([
    'postgresql://fixture:fake@production.example/fra',
    'postgresql://fixture:fake@localhost/fra?host=production.example',
    'postgresql://fixture:fake@localhost/fra?port=6543',
    'postgresql://fixture:fake@localhost/important',
    'https://localhost/fra',
    'invalid fixture URL',
  ])('refuses a remote, ambiguous or non-disposable target: %s', DATABASE_URL => {
    expect(() => browserTestDatabase({ BROWSER_DATABASE_TEST: '1', DATABASE_URL })).toThrow();
  });
  it.each(['postgresql://fixture:fake@localhost/fra', 'postgresql://fixture:fake@127.0.0.1:55439/fra_browser_test'])('allows the explicit disposable target %s', DATABASE_URL => {
    expect(browserTestDatabase({ BROWSER_DATABASE_TEST: '1', DATABASE_URL })).toBe(DATABASE_URL);
  });
});
