import { productionDatabaseUrl } from './database-tls.js';

// ============================================================
// What production needs before the server may start. Pure, so it can be tested without
// booting the server: index.ts calls it at startup and refuses to run on any error.
// ============================================================

export interface EnvProblems {
  /** Fatal: the server refuses to start */
  errors: string[];
  /** Worth knowing: logged, the server still starts */
  warnings: string[];
}

export function checkProductionEnv(
  env: NodeJS.ProcessEnv,
  jwt: { usingDevSecret: boolean; usingDevRefreshSecret: boolean },
): EnvProblems {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required (fatal)
  if (!env.DATABASE_URL) {
    errors.push('DATABASE_URL must be set');
  } else {
    try {
      productionDatabaseUrl(env.DATABASE_URL);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'DATABASE_URL TLS configuration is invalid');
    }
  }
  if (jwt.usingDevSecret) {
    errors.push('JWT_SECRET must not use the development default');
  }
  if (jwt.usingDevRefreshSecret) {
    errors.push('JWT_REFRESH_SECRET must not use the development default');
  }
  const jwtSecretValue = env.JWT_SECRET ?? '';
  const refreshSecretValue = env.JWT_REFRESH_SECRET ?? '';
  if (jwtSecretValue.length < 32 || refreshSecretValue.length < 32) {
    errors.push('JWT_SECRET and JWT_REFRESH_SECRET must each be at least 32 characters (e.g. openssl rand -hex 32)');
  } else if (jwtSecretValue === refreshSecretValue) {
    errors.push('JWT_SECRET and JWT_REFRESH_SECRET must be different');
  }
  if (!env.CORS_ORIGINS) {
    errors.push('CORS_ORIGINS must be set');
  }
  if (!env.STRIPE_WEBHOOK_SECRET) {
    errors.push('STRIPE_WEBHOOK_SECRET must be set');
  }
  if (!env.STRIPE_SECRET_KEY) {
    errors.push('STRIPE_SECRET_KEY must be set (card payments are refused without it)');
  } else if (env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
    warnings.push('STRIPE_SECRET_KEY is a test key — no real payments will be taken');
  }
  if (!env.SMTP_HOST) {
    errors.push('SMTP_HOST must be set (password reset emails cannot be sent without it)');
  } else if (env.SMTP_REQUIRE_TLS === 'false') {
    errors.push('SMTP_REQUIRE_TLS=false is for local mail catchers only; email must be sent over TLS in production');
  } else if (!env.EMAIL_FROM) {
    warnings.push('EMAIL_FROM is not set — emails come from no-reply@fraud-risk.co.uk');
  }
  if (!env.WEB_APP_URL?.startsWith('https://')) {
    errors.push('WEB_APP_URL must be set to the web app\'s https:// address (Stripe returns buyers there)');
  }

  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    // Without Redis, password-reset links and login lockouts live in one process's memory
    // and are lost on every restart or deploy
    errors.push('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set');
  }

  if (env.PROVIDER_PAYOUTS_ENABLED && !['true','false'].includes(env.PROVIDER_PAYOUTS_ENABLED)) {
    errors.push('PROVIDER_PAYOUTS_ENABLED must be true or false');
  }
  if (env.PROVIDER_REVIEW_ORGANISATION_ID && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(env.PROVIDER_REVIEW_ORGANISATION_ID)) {
    errors.push('PROVIDER_REVIEW_ORGANISATION_ID must be an operator organisation UUID');
  }
  if (env.PROVIDER_PAYOUTS_ENABLED === 'true' && !env.PROVIDER_REVIEW_ORGANISATION_ID) {
    errors.push('Payout recording requires PROVIDER_REVIEW_ORGANISATION_ID');
  }

  // Recommended (warn)
  if (!env.S3_BUCKET) {
    warnings.push('S3_BUCKET is not set — file uploads will be unavailable');
  }

  return { errors, warnings };
}
