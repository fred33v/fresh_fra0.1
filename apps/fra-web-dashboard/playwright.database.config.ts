import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { browserTestDatabase } from './e2e-database/guard';

const databaseUrl = browserTestDatabase();
const root = fileURLToPath(new URL('../../', import.meta.url));
const webOrigin = 'http://127.0.0.1:8088';
const apiOrigin = 'http://127.0.0.1:3008';

export default defineConfig({
  testDir: './e2e-database',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 60_000,
  reporter: process.env.CI ? 'github' : 'list',
  outputDir: 'test-results/database',
  use: {
    baseURL: webOrigin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {},
  },
  webServer: [
    {
      cwd: root,
      command: 'pnpm --filter @stopfra/backend exec tsx src/index.ts',
      url: `${apiOrigin}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'development', HOST: '127.0.0.1', PORT: '3008',
        DATABASE_URL: databaseUrl, DATABASE_URL_UNPOOLED: databaseUrl,
        JWT_SECRET: 'browser-access-fixture-'.repeat(3),
        JWT_REFRESH_SECRET: 'browser-refresh-fixture-'.repeat(3),
        CORS_ORIGINS: webOrigin, WEB_APP_URL: webOrigin,
        WEBHOOK_WORKER_ENABLED: 'false', RETENTION_ENABLED: 'false',
        SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '',
        STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: '',
        UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '',
      },
    },
    {
      cwd: root,
      command: 'pnpm --filter @stopfra/web-dashboard dev --host 127.0.0.1 --port 8088 --strictPort',
      url: webOrigin,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { VITE_API_URL: apiOrigin },
    },
  ],
});
