// Test-only helper. A privileged account (administrator, facilitator, operator-organisation member or a
// security role) must have an authenticator before the API serves it anything outside /auth and /security.
// This gives a fixture account one the way a real user gets it, through the API, and returns an access token
// that carries the MFA claims. Plain JavaScript so scripts that run under bare `node` can use it.
import { createHmac } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function fromBase32(text) {
  let bits = '';
  for (const ch of text) {
    const value = ALPHABET.indexOf(ch);
    if (value < 0) throw new Error('Authenticator secret is not base32');
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

/** RFC 6238 with the server's parameters: HMAC-SHA1, 30 second steps, 6 digits. */
export function totpCode(base32Secret, step) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac('sha1', fromBase32(base32Secret)).update(counter).digest();
  const offset = digest[19] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}

function expectStatus(response, expected, what) {
  if (response.status !== expected)
    throw new Error(`${what} failed: HTTP ${response.status} ${JSON.stringify(response.body)}`);
}

/**
 * @param send async (method, path, body, token) => ({ status, body })
 * @returns a fresh access token for the same user that satisfies the MFA guard
 */
export async function enrolAndSignIn(send, { email, password, accessToken }) {
  const setup = await send('POST', '/security/mfa/enrol', { password }, accessToken);
  expectStatus(setup, 200, 'Authenticator enrolment');
  const secret = setup.body.data.secret;
  const step = Math.floor(Date.now() / 30000);
  const confirm = await send('POST', '/security/mfa/confirm', { code: totpCode(secret, step) }, accessToken);
  expectStatus(confirm, 200, 'Authenticator confirmation');
  // Each code works once, so sign in with the next time step, which the server accepts one step ahead.
  const login = await send('POST', '/auth/login', { email, password, totpCode: totpCode(secret, step + 1) });
  expectStatus(login, 200, 'Sign-in with the authenticator');
  return login.body.data.accessToken;
}
