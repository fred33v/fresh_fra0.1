import { describe, it, expect } from 'vitest';
import { keyPassErrorMessage } from '../utils/keypass';

describe('keyPassErrorMessage', () => {
  it.each([
    ['NOT_FOUND', /don't recognise that code/],
    ['EXPIRED', /has expired/],
    ['NOT_AVAILABLE', /already been used or was withdrawn/],
    ['ALREADY_USED', /already been used or was withdrawn/],
    ['PACKAGE_INACTIVE', /package is no longer active/],
    ['ACCOUNT_EXISTS', /already exists/],
    ['RATE_LIMITED', /Too many attempts/],
    ['VALIDATION_ERROR', /check your details/],
    ['NETWORK_ERROR', /couldn't reach the server/],
    ['TIMEOUT', /couldn't reach the server/],
  ])('explains %s in plain language', (code, text) => {
    expect(keyPassErrorMessage({ code, message: 'server text' })).toMatch(text);
  });

  it("uses the server's message for a code it does not know", () => {
    expect(keyPassErrorMessage({ code: 'SOMETHING_NEW', message: 'Key-pass expired' })).toBe('Key-pass expired');
    expect(keyPassErrorMessage({ message: 'Key-pass expired' })).toBe('Key-pass expired');
  });

  it('has a last-resort message when there is nothing to go on', () => {
    expect(keyPassErrorMessage(undefined)).toBe('Invalid key-pass code');
    expect(keyPassErrorMessage(null)).toBe('Invalid key-pass code');
    expect(keyPassErrorMessage({})).toBe('Invalid key-pass code');
  });
});
