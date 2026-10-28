// One-time links that confirm a new account's email address (same storage as password resets)
import { getRedis } from '../redis.js';
import { EMAIL_VERIFY_PREFIX, EMAIL_VERIFY_TTL_SECONDS } from '../types.js';
import { emailVerificationTokens } from '../stores.js';

export async function setEmailVerificationToken(token: string, userId: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(`${EMAIL_VERIFY_PREFIX}${token}`, userId, { ex: EMAIL_VERIFY_TTL_SECONDS });
  } else {
    emailVerificationTokens.set(token, { userId, expiresAt: Date.now() + EMAIL_VERIFY_TTL_SECONDS * 1000 });
  }
}

export async function getEmailVerificationUserId(token: string): Promise<string | null> {
  const redis = getRedis();
  if (redis) {
    const userId = await redis.get<string>(`${EMAIL_VERIFY_PREFIX}${token}`);
    return userId ?? null;
  }
  const entry = emailVerificationTokens.get(token);
  if (!entry || entry.expiresAt < Date.now()) {
    emailVerificationTokens.delete(token);
    return null;
  }
  return entry.userId;
}

export async function deleteEmailVerificationToken(token: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.del(`${EMAIL_VERIFY_PREFIX}${token}`);
  } else {
    emailVerificationTokens.delete(token);
  }
}
