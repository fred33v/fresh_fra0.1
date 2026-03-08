import dotenv from 'dotenv';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { getDbPool, closeDbPool } from './db.js';
import { getRedis } from './redis.js';
import { usingDevJwtSecret, jwtSecret, hasDatabase } from './helpers.js';
import { createLogger } from './logger.js';
import { usingDevRefreshSecret, refreshSecret } from './types.js';
import { applyGlobalMiddleware, applyApiMiddleware } from './middleware.js';

const logger = createLogger('server');
import authRoutes from './routes/auth.js';
import assessmentRoutes from './routes/assessments.js';
import keypassRoutes from './routes/keypasses.js';
import paymentRoutes from './routes/payments.js';
import analyticsRoutes from './routes/analytics.js';
import s3Routes from './routes/s3.js';
import reportsExportsRoutes from './routes/reports-exports.js';
import workshop from './workshop.js';
import budgetGuide from './budget-guide.js';

dotenv.config();

const app = new Hono();

// ── Global middleware (CORS, security headers, logging) ──────────
const allowedOrigins = applyGlobalMiddleware(app);

// ── Global error handler ────────────────────────────────────────
app.onError((err, c) => {
  const requestId = (c.get('requestId' as never) as string) ?? 'unknown';
  logger.error('Unhandled error', {
    rid: requestId,
    method: c.req.method,
    path: c.req.path,
    error: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  });
  return c.json(
    { success: false, error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } },
    500
  );
});

// ── 404 handler ─────────────────────────────────────────────────
app.notFound((c) => {
  return c.json(
    { success: false, error: { code: 'NOT_FOUND', message: 'Not found' } },
    404
  );
});

// ── Health check (verifies DB + Redis connectivity) ─────────────
app.get('/health', async (c) => {
  const checks: Record<string, string> = {};
  let healthy = true;

  // DB check
  if (hasDatabase()) {
    try {
      const pool = getDbPool();
      const result = await pool.query('select 1 as ok');
      checks.database = result.rows?.[0]?.ok === 1 ? 'ok' : 'error';
    } catch {
      checks.database = 'error';
      healthy = false;
    }
  } else {
    checks.database = 'not_configured';
  }

  // Redis check
  const redis = getRedis();
  if (redis) {
    try {
      await redis.ping();
      checks.redis = 'ok';
    } catch {
      checks.redis = 'error';
      healthy = false;
    }
  } else {
    checks.redis = 'not_configured';
  }

  const status = healthy ? 'ok' : 'degraded';
  c.header('Cache-Control', 'no-cache, max-age=0');
  return c.json({
    status, checks, uptime: Math.floor(process.uptime()),
    version: process.env.APP_VERSION ?? '2.0.0',
    commit: process.env.GIT_SHA ?? undefined,
  }, healthy ? 200 : 503);
});

// ── API routes ──────────────────────────────────────────────────
const api = app.basePath('/api/v1');

// Apply API-level middleware (body-size, sanitization, CSRF, rate-limit)
applyApiMiddleware(api, allowedOrigins);

// Mount route modules
api.route('/', authRoutes);
api.route('/', assessmentRoutes);
api.route('/', keypassRoutes);
api.route('/', paymentRoutes);
api.route('/', analyticsRoutes);
api.route('/', s3Routes);
api.route('/', reportsExportsRoutes);
api.route('/workshop', workshop);
api.route('/budget-guide', budgetGuide);

// ── Catch-all for unversioned /api requests ─────────────────────
app.all('/api/*', (c) => {
  // Allow /api/v1/* to fall through to the normal 404 handler
  if (c.req.path.startsWith('/api/v1/')) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Not found' } },
      404
    );
  }
  return c.json(
    { success: false, error: { code: 'VERSION_REQUIRED', message: 'API version prefix required (e.g., /api/v1)' } },
    400
  );
});

// ── Server startup ──────────────────────────────────────────────
const port = Number(process.env.PORT ?? 3000);
const hostname =
  process.env.HOST ?? (process.env.NODE_ENV === 'production' ? '127.0.0.1' : undefined);

function validateProductionEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const errors: string[] = [];
  const warnings: string[] = [];

  // Required (fatal)
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL must be set');
  }
  if (usingDevJwtSecret) {
    errors.push('JWT_SECRET must not use the development default');
  }
  if (usingDevRefreshSecret) {
    errors.push('JWT_REFRESH_SECRET must not use the development default');
  }
  if (!process.env.CORS_ORIGINS) {
    errors.push('CORS_ORIGINS must be set');
  }
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    errors.push('STRIPE_WEBHOOK_SECRET must be set');
  }

  // Recommended (warn)
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    warnings.push('UPSTASH_REDIS_REST_URL is not set — rate limiting will use in-memory fallback');
  }
  if (!process.env.S3_BUCKET) {
    warnings.push('S3_BUCKET is not set — file uploads will be unavailable');
  }

  for (const w of warnings) {
    logger.warn(`[env] ${w}`);
  }

  if (errors.length > 0) {
    throw new Error(
      `Production environment validation failed:\n  - ${errors.join('\n  - ')}`
    );
  }
}

if (!process.env.JEST_WORKER_ID && process.env.NODE_ENV !== 'test') {
  validateProductionEnv();
  const server = serve({ fetch: app.fetch, port, hostname });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(async () => {
      await closeDbPool();
      logger.info('Shutdown complete');
      process.exit(0);
    });
    // Force exit after 10s if graceful shutdown stalls
    const forceExitTimer = setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000) as NodeJS.Timeout;
    forceExitTimer.unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

export default app;
