/// <reference types="jest" />

import { describe, expect, it } from '@jest/globals';
import { checkProductionEnv } from '../src/production-env';

// Obviously fake values: nothing here is a real secret
const JWT_A = 'a'.repeat(64);
const JWT_B = 'b'.repeat(64);

const complete: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgres://user:pass@db.example.test/app?sslmode=require',
  JWT_SECRET: JWT_A,
  JWT_REFRESH_SECRET: JWT_B,
  CORS_ORIGINS: 'https://app.example.test',
  STRIPE_SECRET_KEY: 'sk_live_fake',
  STRIPE_WEBHOOK_SECRET: 'whsec_fake',
  SMTP_HOST: 'smtp.example.test',
  EMAIL_FROM: 'no-reply@example.test',
  WEB_APP_URL: 'https://app.example.test',
  UPSTASH_REDIS_REST_URL: 'https://redis.example.test',
  UPSTASH_REDIS_REST_TOKEN: 'token',
  S3_BUCKET: 'bucket',
};
const realSecrets = { usingDevSecret: false, usingDevRefreshSecret: false };

function check(overrides: Record<string, string | undefined> = {}, jwt = realSecrets) {
  const env = { ...complete };
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
  return checkProductionEnv(env, jwt);
}

describe('checkProductionEnv', () => {
  it('accepts a complete configuration with no problems', () => {
    expect(check()).toEqual({ errors: [], warnings: [] });
  });

  // The server must refuse to start when any of these is missing, so a forgotten setting
  // can never turn into a site that takes orders for free or sends no email
  it.each([
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'CORS_ORIGINS',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'SMTP_HOST',
    'WEB_APP_URL',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
  ])('refuses to start without %s', (name) => {
    const { errors } = check({ [name]: undefined });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.join('\n')).toContain(name);
  });

  it('refuses a JWT secret shorter than 32 characters', () => {
    expect(check({ JWT_SECRET: 'short' }).errors.join('\n')).toMatch(/at least 32 characters/);
    expect(check({ JWT_REFRESH_SECRET: 'short' }).errors.join('\n')).toMatch(/at least 32 characters/);
  });

  it('refuses identical access and refresh secrets', () => {
    expect(check({ JWT_REFRESH_SECRET: JWT_A }).errors.join('\n')).toMatch(/must be different/);
  });

  it('refuses the development JWT defaults', () => {
    const { errors } = check({}, { usingDevSecret: true, usingDevRefreshSecret: true });
    expect(errors.join('\n')).toMatch(/JWT_SECRET must not use the development default/);
    expect(errors.join('\n')).toMatch(/JWT_REFRESH_SECRET must not use the development default/);
  });

  it('refuses a web app address that is not https', () => {
    expect(check({ WEB_APP_URL: 'http://app.example.test' }).errors.join('\n')).toMatch(/https/);
  });

  it('refuses to send email without TLS', () => {
    expect(check({ SMTP_REQUIRE_TLS: 'false' }).errors.join('\n')).toMatch(/SMTP_REQUIRE_TLS=false/);
  });

  it('only warns for a Stripe test key, so a rehearsal can run before the live key', () => {
    const { errors, warnings } = check({ STRIPE_SECRET_KEY: 'sk_test_fake' });
    expect(errors).toEqual([]);
    expect(warnings.join('\n')).toMatch(/test key/);
  });

  it('only warns when the database URL has no sslmode, EMAIL_FROM or S3_BUCKET is missing', () => {
    expect(check({ DATABASE_URL: 'postgres://u:p@db.example.test/app' })).toMatchObject({ errors: [] });
    expect(check({ EMAIL_FROM: undefined }).errors).toEqual([]);
    expect(check({ EMAIL_FROM: undefined }).warnings.join('\n')).toMatch(/EMAIL_FROM/);
    expect(check({ S3_BUCKET: undefined }).errors).toEqual([]);
    expect(check({ S3_BUCKET: undefined }).warnings.join('\n')).toMatch(/S3_BUCKET/);
  });

  it('lists every problem at once, not only the first', () => {
    const { errors } = checkProductionEnv({ NODE_ENV: 'production' }, realSecrets);
    const text = errors.join('\n');
    for (const name of ['DATABASE_URL', 'CORS_ORIGINS', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SMTP_HOST', 'WEB_APP_URL', 'UPSTASH_REDIS_REST_URL']) {
      expect(text).toContain(name);
    }
  });
});
