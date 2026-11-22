import { readFileSync, statSync } from 'node:fs';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
export class FinanceVaultUnavailable extends Error {
  constructor() {
    super('Finance vault is not configured or its required key is unavailable');
  }
}
function keyring() {
  try {
    const path = process.env.FINANCE_VAULT_KEYS_FILE;
    if (path && process.env.NODE_ENV === 'production' && (statSync(path).mode & 0o077) !== 0)
      throw new Error();
    const raw = path
      ? readFileSync(path, 'utf8')
      : process.env.NODE_ENV !== 'production'
        ? process.env.FINANCE_VAULT_KEYS
        : null;
    if (!raw) throw new Error();
    const parsed = JSON.parse(raw);
    if (
      !/^[a-zA-Z0-9_-]{1,32}$/.test(parsed.activeKeyId) ||
      !parsed.keys ||
      typeof parsed.keys !== 'object'
    )
      throw new Error();
    const keys = new Map<string, Buffer>();
    for (const [id, value] of Object.entries(parsed.keys)) {
      if (typeof value !== 'string') throw new Error();
      const bytes = Buffer.from(value, 'base64');
      if (bytes.length !== 32 || bytes.toString('base64') !== value) throw new Error();
      keys.set(id, bytes);
    }
    if (!keys.has(parsed.activeKeyId)) throw new Error();
    return { activeKeyId: parsed.activeKeyId as string, keys };
  } catch {
    throw new FinanceVaultUnavailable();
  }
}
export function financeVaultReady() {
  try {
    keyring();
    return true;
  } catch {
    return false;
  }
}
export function sealBankDetails(value: unknown, context: string) {
  const ring = keyring(),
    iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', ring.keys.get(ring.activeKeyId)!, iv);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return {
    keyId: ring.activeKeyId,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}
export function openBankDetails(
  value: { keyId: string; iv: string; tag: string; ciphertext: string },
  context: string
) {
  const ring = keyring(),
    key = ring.keys.get(value.keyId);
  if (!key) throw new FinanceVaultUnavailable();
  const cipher = createDecipheriv('aes-256-gcm', key, Buffer.from(value.iv, 'base64'));
  cipher.setAAD(Buffer.from(context));
  cipher.setAuthTag(Buffer.from(value.tag, 'base64'));
  return JSON.parse(
    Buffer.concat([
      cipher.update(Buffer.from(value.ciphertext, 'base64')),
      cipher.final(),
    ]).toString('utf8')
  );
}
