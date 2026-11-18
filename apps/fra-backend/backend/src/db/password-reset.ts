import { getRedis } from '../redis.js';
import { PASSWORD_RESET_PREFIX, PASSWORD_RESET_TTL_SECONDS } from '../types.js';
import { passwordResetTokens } from '../stores.js';
import { hashToken } from './tokens.js';

// Reset tokens are stored by their SHA-256 hash, so reading Redis does not give working reset links

export async function setPasswordResetToken(token: string, userId: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(`${PASSWORD_RESET_PREFIX}${hashToken(token)}`, userId, { ex: PASSWORD_RESET_TTL_SECONDS });
  } else {
    passwordResetTokens.set(hashToken(token), { userId, expiresAt: Date.now() + PASSWORD_RESET_TTL_SECONDS * 1000 });
  }
}

export async function getPasswordResetUserId(token: string): Promise<string | null> {
  const redis = getRedis();
  if (redis) {
    const userId = await redis.get<string>(`${PASSWORD_RESET_PREFIX}${hashToken(token)}`);
    return userId ?? null;
  }
  const entry = passwordResetTokens.get(hashToken(token));
  if (!entry || entry.expiresAt < Date.now()) {
    passwordResetTokens.delete(hashToken(token));
    return null;
  }
  return entry.userId;
}

export async function deletePasswordResetToken(token: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.del(`${PASSWORD_RESET_PREFIX}${hashToken(token)}`);
  } else {
    passwordResetTokens.delete(hashToken(token));
  }
}

/** Atomically claim a link. A failed account operation requires a fresh link. */
export async function consumePasswordResetToken(token: string): Promise<string | null> {
  const redis = getRedis();
  if (redis) return redis.getdel<string>(`${PASSWORD_RESET_PREFIX}${hashToken(token)}`);
  const key = hashToken(token);
  const entry = passwordResetTokens.get(key);
  passwordResetTokens.delete(key);
  return entry && entry.expiresAt > Date.now() ? entry.userId : null;
}
