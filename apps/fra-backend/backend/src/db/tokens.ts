import crypto from 'node:crypto';
import { getDbPool } from '../db.js';

/**
 * Only a SHA-256 hash of each refresh token is stored, so a leaked database or backup
 * does not hand out working sessions. Callers pass the raw token.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function dbUpsertRefreshToken(token: string, userId: string): Promise<void> {
  const pool = getDbPool();
  await pool.query(
    'insert into public.refresh_tokens (token, user_id) values ($1,$2) on conflict (token) do update set user_id = excluded.user_id',
    [hashToken(token), userId]
  );
}

export async function dbHasRefreshToken(token: string): Promise<boolean> {
  const pool = getDbPool();
  const res = await pool.query<{ token: string }>('select token from public.refresh_tokens where token = $1 limit 1', [hashToken(token)]);
  return !!res.rows[0];
}

export async function dbDeleteRefreshToken(token: string): Promise<void> {
  const pool = getDbPool();
  await pool.query('delete from public.refresh_tokens where token = $1', [hashToken(token)]);
}

export async function dbDeleteAllRefreshTokensForUser(userId: string): Promise<void> {
  const pool = getDbPool();
  await pool.query('delete from public.refresh_tokens where user_id = $1', [userId]);
}
