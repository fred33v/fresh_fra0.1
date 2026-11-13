import { getRedis } from './redis.js';
import type { AuthContext } from './helpers.js';

const SSE_TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SSE_TOKEN_PREFIX = 'sse_token:';

type SseTokenEntry = {
  auth: AuthContext;
  expiresAt: number;
};

// In-memory fallback when Redis is not available
const sseTokenStore = new Map<string, SseTokenEntry>();

export async function storeSseToken(token: string, auth: AuthContext): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(`${SSE_TOKEN_PREFIX}${token}`, JSON.stringify(auth), { ex: Math.ceil(SSE_TOKEN_TTL_MS / 1000) });
    return;
  }
  sseTokenStore.set(token, { auth, expiresAt: Date.now() + SSE_TOKEN_TTL_MS });

  // Lazy cleanup of expired tokens to prevent unbounded memory growth
  if (sseTokenStore.size > 1000) {
    const now = Date.now();
    for (const [key, entry] of sseTokenStore) {
      if (entry.expiresAt <= now) sseTokenStore.delete(key);
    }
  }
}

export async function consumeSseToken(token: string): Promise<AuthContext | null> {
  const redis = getRedis();
  if (redis) {
    const key = `${SSE_TOKEN_PREFIX}${token}`;
    const raw = await redis.getdel<string | AuthContext>(key);
    if (!raw) return null;
    try {
      return typeof raw === 'string' ? JSON.parse(raw) as AuthContext : raw;
    } catch {
      return null;
    }
  }

  const entry = sseTokenStore.get(token);
  if (!entry) return null;
  // Single-use: delete immediately
  sseTokenStore.delete(token);
  if (entry.expiresAt <= Date.now()) return null;
  return entry.auth;
}

