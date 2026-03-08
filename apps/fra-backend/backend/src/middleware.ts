import type { Hono, Context } from 'hono';
import { cors } from 'hono/cors';
import { jsonError } from './helpers.js';
import { createLogger } from './logger.js';
import { getRedis } from './redis.js';
import { MAX_BODY_BYTES, CSRF_SAFE_METHODS } from './types.js';
import type { RateLimitConfig } from './types.js';
import { rateLimitBuckets } from './stores.js';

const logger = createLogger('middleware');

// ── Security helpers ────────────────────────────────────────────

export function stripProtoPollution(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripProtoPollution);

  const cleaned: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    cleaned[key] = stripProtoPollution((obj as Record<string, unknown>)[key]);
  }
  return cleaned;
}

export function sanitizeString(value: string): string {
  return value
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, ''); // strip inline event handlers
}

export function sanitizeObject(obj: unknown): unknown {
  if (typeof obj === 'string') return sanitizeString(obj);
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    result[key] = sanitizeObject(val);
  }
  return result;
}

// ── Client IP ───────────────────────────────────────────────────

export function getClientIp(c: Context): string {
  const forwarded = c.req.header('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = c.req.header('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

// ── Rate limiter factory ────────────────────────────────────────

export function rateLimit(keyPrefix: string, cfg: RateLimitConfig) {
  return async (c: Context) => {
    // Skip rate limiting in test environment
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) return;

    const ip = getClientIp(c);
    const key = `${keyPrefix}:${ip}`;

    const redis = getRedis();
    if (redis) {
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.pexpire(key, cfg.windowMs);
      }

      if (count > cfg.max) {
        const ttl = await redis.pttl(key);
        c.header('Retry-After', String(Math.ceil(Math.max(ttl, 1000) / 1000)));
        return jsonError(c, 429, 'RATE_LIMITED', 'Too many requests');
      }

      return;
    }

    const now = Date.now();
    const existing = rateLimitBuckets.get(key);
    if (!existing || existing.resetAt <= now) {
      rateLimitBuckets.set(key, { count: 1, resetAt: now + cfg.windowMs });
      return;
    }

    if (existing.count >= cfg.max) {
      c.header('Retry-After', String(Math.ceil(Math.max(existing.resetAt - now, 1000) / 1000)));
      return jsonError(c, 429, 'RATE_LIMITED', 'Too many requests');
    }

    existing.count += 1;
  };
}

// ── Global middleware (CORS, security headers, logging) ──────────

export function applyGlobalMiddleware(app: Hono) {
  const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // In production, an empty CORS_ORIGINS list is a misconfiguration that would
  // allow any origin. Log a warning and deny all cross-origin requests.
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && allowedOrigins.length === 0) {
    logger.warn('CORS_ORIGINS is empty in production — all cross-origin requests will be denied');
  }

  app.use(
    '*',
    cors({
      origin: (origin) => {
        if (!origin) return '*'; // allow non-browser requests (curl, mobile)
        if (allowedOrigins.length === 0) {
          // In production, deny all when no origins are configured
          if (isProduction) return '';
          // In dev, allow all origins for convenience
          return origin;
        }
        if (allowedOrigins.includes(origin)) return origin;
        // Allow Expo tunnel URLs in dev (never in production)
        if (!isProduction && (origin.endsWith('.exp.direct') || origin.endsWith('.ngrok.io') || origin.endsWith('.ngrok-free.app'))) return origin;
        return ''; // deny
      },
      allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
      exposeHeaders: ['X-Request-ID', 'X-Response-Time'],
      credentials: true,
      maxAge: 86400,
    })
  );

  // Request ID + Response Time + Security Headers + Logging
  app.use('*', async (c, next) => {
    const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
    c.set('requestId' as never, requestId);
    c.header('X-Request-ID', requestId);

    const start = performance.now();
    await next();
    const ms = (performance.now() - start).toFixed(1);
    c.header('X-Response-Time', `${ms}ms`);

    // Security headers (helmet-style)
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    c.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    c.header('X-Permitted-Cross-Domain-Policies', 'none');
    c.header('X-Download-Options', 'noopen');
    c.header('Cross-Origin-Embedder-Policy', 'require-corp');
    c.header('Cross-Origin-Opener-Policy', 'same-origin');
    c.header('Cross-Origin-Resource-Policy', 'same-origin');
    c.header('X-XSS-Protection', '0'); // modern best practice: disable legacy XSS filter
    c.header('Cache-Control', 'no-store');
    c.header('Pragma', 'no-cache');
    if (process.env.NODE_ENV === 'production') {
      c.header('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }

    // Structured request log (skip health checks to reduce noise)
    if (c.req.path !== '/health') {
      const logEntry = {
        ts: new Date().toISOString(),
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        ms: Number(ms),
        ip: getClientIp(c),
        rid: requestId,
      };
      if (c.res.status >= 400) {
        logger.error('Request failed', logEntry);
      } else {
        logger.info('Request completed', logEntry);
      }
    }
  });

  return allowedOrigins;
}

// ── API-level middleware (body-size, sanitization, CSRF, rate-limit) ──

export function applyApiMiddleware(api: Hono, allowedOrigins: string[]) {
  // Request body size limit
  api.use('*', async (c, next) => {
    const contentLength = c.req.header('content-length');
    if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
      return jsonError(c, 413, 'PAYLOAD_TOO_LARGE', `Request body exceeds ${MAX_BODY_BYTES} bytes`);
    }
    return next();
  });

  // JSON sanitisation (proto pollution + XSS)
  api.use('*', async (c, next) => {
    const ct = c.req.header('content-type') ?? '';
    if (ct.includes('application/json') && !CSRF_SAFE_METHODS.has(c.req.method)) {
      const originalJson = c.req.json.bind(c.req);
      (c.req as unknown as Record<string, unknown>).json = async () => {
        const body = await originalJson();
        return sanitizeObject(stripProtoPollution(body));
      };
    }
    return next();
  });

  // CSRF protection (Origin / Referer validation)
  api.use('*', async (c, next) => {
    if (CSRF_SAFE_METHODS.has(c.req.method)) return next();

    // Non-browser clients (mobile apps, curl) typically omit Origin
    const origin = c.req.header('origin');
    const referer = c.req.header('referer');
    if (!origin && !referer) return next(); // allow non-browser clients

    // In production, validate Origin/Referer against allowed origins
    if (process.env.NODE_ENV === 'production' && allowedOrigins.length > 0) {
      const requestOrigin = origin ?? (referer ? new URL(referer).origin : null);
      if (requestOrigin && !allowedOrigins.includes(requestOrigin)) {
        return jsonError(c, 403, 'CSRF_REJECTED', 'Origin not allowed');
      }
    }

    return next();
  });

  // Global API rate limit (per IP)
  const GLOBAL_RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
  const GLOBAL_RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? 100);

  api.use('*', async (c, next) => {
    const limited = await rateLimit('global', { windowMs: GLOBAL_RATE_LIMIT_WINDOW_MS, max: GLOBAL_RATE_LIMIT_MAX })(c);
    if (limited instanceof Response) return limited;
    return next();
  });
}
