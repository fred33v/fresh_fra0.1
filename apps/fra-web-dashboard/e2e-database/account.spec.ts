import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { browserTestDatabase } from './guard';

const databaseUrl = browserTestDatabase();
const backend = fileURLToPath(new URL('../../fra-backend/backend/', import.meta.url));
const apiOrigin = 'http://127.0.0.1:3008';

test('real sign-up, verification, profile persistence, permissions, logout and sign-in', async ({ page }) => {
  const health = await page.request.get(`${apiOrigin}/health`);
  expect(health.ok()).toBe(true);
  expect((await health.json()).checks.database).toBe('ok');
  const email = `browser-${randomUUID()}@example.test`;
  const password = `Browser-Test-${randomUUID()}Aa1`;

  await page.goto('/auth?mode=signup');
  await page.getByLabel('Full Name', { exact: true }).fill('Browser Fixture');
  await page.getByLabel('Organisation Name', { exact: true }).fill('Browser Fixture Organisation');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm Password', { exact: true }).fill(password);
  const signup = page.waitForResponse(response => response.url().endsWith('/api/v1/auth/signup') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create Account', exact: true }).click();
  const signupResponse = await signup;
  expect(signupResponse.ok()).toBe(true);
  const { data } = await signupResponse.json();
  // Development-only response: no inbox, mocked auth, or real email service.
  expect(typeof data.verificationToken).toBe('string');
  await expect(page.getByRole('status', { name: 'Confirmation email sent' })).toBeVisible();
  await page.goto(`/auth?mode=verify&token=${encodeURIComponent(data.verificationToken)}`);
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto('/profile');
  await page.getByRole('button', { name: 'Edit Profile', exact: true }).click();
  await page.getByLabel('Department', { exact: true }).fill('Browser Finance');
  const saved = page.waitForResponse(response => response.url().endsWith('/api/v1/auth/profile') && response.request().method() === 'PATCH');
  // Profile saves already trigger a real page reload; wait for that navigation.
  await Promise.all([
    page.waitForEvent('load'),
    page.getByRole('button', { name: 'Save Changes', exact: true }).click(),
  ]);
  expect((await saved).ok()).toBe(true);
  await expect(page.getByText('Browser Finance', { exact: true })).toBeVisible();

  // Prove the mutation reached PostgreSQL, independently of browser/client caches.
  const sqlResult = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import pg from 'pg';
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
    try {
      await client.connect();
      const result = await client.query('SELECT department FROM users WHERE email = $1', [process.argv[1]]);
      console.log(JSON.stringify(result.rows));
    } finally { await client.end(); }
  `, email], { cwd: backend, env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: 'utf8', timeout: 10_000 });
  expect(JSON.parse(sqlResult)).toEqual([{ department: 'Browser Finance' }]);

  await page.goto('/certificate/manage');
  await expect(page).toHaveURL(/\/dashboard$/);
  const refused = await page.evaluate(async origin => {
    const response = await fetch(`${origin}/api/v1/certificates/FRA-BROWSER-FIXTURE/revoke`, {
      method: 'POST', headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('fra_access_token')}`,
      }, body: JSON.stringify({ reason: 'Permission test fixture' }),
    });
    return { status: response.status, body: await response.json() };
  }, apiOrigin);
  expect(refused.status).toBe(403);
  expect(refused.body.error.code).toBe('FORBIDDEN');

  await page.getByRole('button', { name: /User menu/ }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('fra_access_token'))).toBeNull();
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/auth\?returnTo=/);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByText('Browser Finance', { exact: true })).toBeVisible();
});
