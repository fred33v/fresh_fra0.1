import { base32, totp, matchTotp } from '../src/mfa.js';
describe('TOTP second factor', () => {
  const secret = Buffer.from('12345678901234567890').toString('base64');
  test('matches RFC 6238 SHA1 vectors truncated to six digits', () => {
    for (const [seconds, expected] of [
      [59, '287082'],
      [1111111109, '081804'],
      [1111111111, '050471'],
      [1234567890, '005924'],
      [2000000000, '279037'],
      [20000000000, '353130'],
    ] as const)
      expect(totp(secret, Math.floor(seconds / 30))).toBe(expected);
  });
  test('rejects replay, invalid inputs and codes outside the clock window', () => {
    const now = 1700000000000,
      step = Math.floor(now / 30000),
      code = totp(secret, step);
    expect(matchTotp(secret, code, -1, now)).toBe(step);
    expect(matchTotp(secret, code, step, now)).toBeNull();
    expect(matchTotp(secret, 'abc', -1, now)).toBeNull();
    expect(matchTotp(secret, totp(secret, step - 2), -1, now)).toBeNull();
  });
  test('encodes authenticator secrets using RFC4648 base32', () => {
    expect(base32(Buffer.from('foo'))).toBe('MZXW6');
  });
});
