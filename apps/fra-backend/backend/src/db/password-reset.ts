import { getRedis } from '../redis.js';
import { PASSWORD_RESET_PREFIX, PASSWORD_RESET_TTL_SECONDS } from '../types.js';
import { passwordResetTokens } from '../stores.js';

export async function setPasswordResetToken(token: string, userId: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(`${PASSWORD_RESET_PREFIX}${token}`, userId, { ex: PASSWORD_RESET_TTL_SECONDS });
  } else {
    passwordResetTokens.set(token, { userId, expiresAt: Date.now() + PASSWORD_RESET_TTL_SECONDS * 1000 });
  }
}

export async function getPasswordResetUserId(token: string): Promise<string | null> {
  const redis = getRedis();
  if (redis) {
    const userId = await redis.get<string>(`${PASSWORD_RESET_PREFIX}${token}`);
    return userId ?? null;
  }
  const entry = passwordResetTokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    passwordResetTokens.delete(token);
    return null;
  }
  return entry.userId;
}

export async function deletePasswordResetToken(token: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.del(`${PASSWORD_RESET_PREFIX}${token}`);
  } else {
    passwordResetTokens.delete(token);
  }
}
