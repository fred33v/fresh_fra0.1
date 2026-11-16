import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
export const sha256 = (value: string | Uint8Array): string =>
  createHash('sha256').update(value).digest('hex');
export const newToken = (): string => randomBytes(32).toString('base64url');
export const newCode = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0');
export function codeHash(signerId: string, code: string): string {
  const key = process.env.ESIGN_OTP_SECRET;
  if (!key || key.length < 32)
    throw new Error('ESIGN_OTP_SECRET must contain at least 32 characters');
  return createHmac('sha256', key).update(`esign-otp:${signerId}:${code}`).digest('hex');
}
export function equalHash(a: string, b: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(a) || !/^[a-f0-9]{64}$/.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}
export const CONSENT =
  'I agree to use electronic records and signatures. I have reviewed this document and intend my typed name to serve as my electronic signature.';
