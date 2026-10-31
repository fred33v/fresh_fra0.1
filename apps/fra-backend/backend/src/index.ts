// Must stay the first import: modules below read process.env when they load
import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono, type Context } from 'hono';
import { getDbPool, closeDbPool } from './db.js';
import { getRedis } from './redis.js';
import { usingDevJwtSecret, jwtSecret, hasDatabase } from './helpers.js';
import { checkProductionEnv } from './production-env.js';
import { createLogger } from './logger.js';
import { scheduleRetention } from './retention.js';
import { scheduleReassessmentReminders } from './reassessment.js';
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
import complianceRoutes from './routes/compliance.js';
import apiKeyRoutes, { apiKeyMiddleware } from './routes/api-keys.js';
import riskRegisterRoutes from './routes/risk-register.js';
import teamTrainingRoutes from './routes/team-training.js';
import budgetHolderRoutes from './routes/budget-holder.js';
import webhookEndpointRoutes from './routes/webhook-endpoints.js';
import organisationRoutes from './routes/organisations.js';
import speakUpRoutes from './routes/speak-up.js';
import certificatesRoutes from './routes/certificates.js';
import workshop from './workshop.js';
import budgetGuide from './budget-guide.js';

const app = new Hono();

// ── Global middleware (CORS, security headers, logging) ──────────
const allowedOrigins = applyGlobalMiddleware(app);

// ── Global error handler ────────────────────────────────────────
app.onError((err, c) => {
  const requestId = (c.get('requestId' as never) as string) ?? 'unknown';
  logger.error('Unhandled error', {
    rid: requestId,
    method: c.req.method,
    // Speak-up paths carry intake tokens (see the request log in middleware.ts)
    path: c.req.path.startsWith('/api/v1/speak-up') ? '/api/v1/speak-up/[redacted]' : c.req.path,
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
// Served at /health and at /api/v1/health, which the load balancer and deploy script probe
app.get('/health', healthCheck);
app.get('/api/v1/health', healthCheck);

async function healthCheck(c: Context) {
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
}

// ── API routes ──────────────────────────────────────────────────
const api = app.basePath('/api/v1');

// Apply API-level middleware (body-size, sanitization, CSRF, rate-limit)
applyApiMiddleware(api, allowedOrigins);

// Enterprise API keys (read-only) resolve to an AuthContext before routes run
api.use('*', apiKeyMiddleware);

// Mount route modules
api.route('/', authRoutes);
api.route('/', assessmentRoutes);
api.route('/', keypassRoutes);
api.route('/', paymentRoutes);
api.route('/', analyticsRoutes);
api.route('/', s3Routes);
api.route('/', reportsExportsRoutes);
api.route('/', apiKeyRoutes);
api.route('/', riskRegisterRoutes);
api.route('/', teamTrainingRoutes);
api.route('/', budgetHolderRoutes);
api.route('/', webhookEndpointRoutes);
api.route('/', organisationRoutes);
api.route('/', certificatesRoutes);
api.route('/speak-up', speakUpRoutes);
api.route('/compliance', complianceRoutes);
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

  const { errors, warnings } = checkProductionEnv(process.env, {
    usingDevSecret: usingDevJwtSecret,
    usingDevRefreshSecret: usingDevRefreshSecret,
  });

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
  // Daily data-retention job (dry run unless RETENTION_ENABLED=true); needs the database
  const stopRetention = hasDatabase() ? scheduleRetention() : () => {};
  // Daily quarterly-reassessment reminders (audit trail and reassessment.due webhooks)
  const stopReminders = scheduleReassessmentReminders();

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully`);
    stopRetention();
    stopReminders();
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

  // Log what would otherwise vanish. After an uncaught exception the process state is
  // unknown, so exit and let systemd restart it.
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { error: reason instanceof Error ? reason.stack : String(reason) });
  });
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception, exiting', { error: err.stack ?? String(err) });
    process.exit(1);
  });
}

export default app;
