import { createHmac, timingSafeEqual } from 'node:crypto';
import type { DbExecutor } from './db/transaction.js';
import { openBankDetails } from './finance-vault.js';
export function base32(bytes: Buffer) {
  let bits = '';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  return (bits.match(/.{1,5}/g) ?? [])
    .map((v) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[parseInt(v.padEnd(5, '0'), 2)])
    .join('');
}
export function totp(secret: string, counter: number) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', Buffer.from(secret, 'base64')).update(buf).digest();
  const offset = digest[19] & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).toString().padStart(6, '0');
}
export function matchTotp(secret: string, code: unknown, last: number, now = Date.now()) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return null;
  const step = Math.floor(now / 30000);
  for (const n of [step - 1, step, step + 1])
    if (n > last && timingSafeEqual(Buffer.from(totp(secret, n)), Buffer.from(code))) return n;
  return null;
}
export async function privileged(db: DbExecutor, userId: string) {
  const {
    rows: [u],
  } = await db.query(
    `SELECT u.role='admin' OR u.role='facilitator'
    OR EXISTS(SELECT 1 FROM public.workshop_roles wr WHERE wr.user_id=u.id AND wr.role IN ('admin','facilitator'))
    OR u.organisation_id::text=$2 OR EXISTS(SELECT 1 FROM public.user_security_roles r WHERE r.user_id=u.id AND r.revoked_at IS NULL) AS required
    FROM public.users u WHERE u.id=$1`,
    [userId, process.env.PROVIDER_REVIEW_ORGANISATION_ID ?? '']
  );
  return u?.required === true;
}
// Caller holds a transaction. Row locking makes successful counters one-use across replicas.
export async function verifyMfa(db: DbExecutor, userId: string, code: unknown, enrolling = false) {
  const {
    rows: [row],
  } = await db.query('SELECT * FROM public.user_mfa WHERE user_id=$1 FOR UPDATE', [userId]);
  if (
    !row ||
    (!row.enabled && !enrolling) ||
    (enrolling && (row.enabled || new Date(row.pending_until).getTime() < Date.now()))
  )
    return null;
  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) return null;
  const { secret } = openBankDetails(row.secret, `mfa:${userId}`);
  const counter = matchTotp(secret, code, Number(row.last_counter));
  if (counter === null) {
    await db.query(
      `UPDATE public.user_mfa SET attempts=attempts+1,locked_until=CASE WHEN attempts>=4 THEN now()+interval '5 minutes' ELSE locked_until END WHERE user_id=$1`,
      [userId]
    );
    return null;
  }
  await db.query(
    `UPDATE public.user_mfa SET enabled=true,last_counter=$2,attempts=0,locked_until=NULL,pending_until=NULL,updated_at=now() WHERE user_id=$1`,
    [userId, counter]
  );
  return { mfaVersion: row.version as number, mfaAt: Math.floor(Date.now() / 1000) };
}
