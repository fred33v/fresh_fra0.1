import { test, expect } from '@playwright/test';

test.describe('Auth page — sign in', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
  });

  test('loads the sign-in form by default', async ({ page }) => {
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
  });

  test('shows validation error for invalid email', async ({ page }) => {
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: /Sign In/i }).click();

    await expect(page.getByText('Please enter a valid email address')).toBeVisible();
  });

  test('shows validation error for short password', async ({ page }) => {
    await page.getByLabel('Email').fill('test@example.com');
    await page.getByLabel('Password').fill('12345');
    await page.getByRole('button', { name: /Sign In/i }).click();

    await expect(page.getByText('Password must be at least 6 characters')).toBeVisible();
  });
});

test.describe('Auth page — sign up', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth?mode=signup');
  });

  test('loads the sign-up form', async ({ page }) => {
    await expect(page.getByText('Create an account')).toBeVisible();
    await expect(page.getByLabel('Full Name')).toBeVisible();
    await expect(page.getByLabel('Organisation Name')).toBeVisible();
    await expect(page.getByRole('button', { name: /Create Account/i })).toBeVisible();
  });

  test('can switch between sign-in and sign-up', async ({ page }) => {
    // Currently on sign-up — click to switch to sign-in
    await page.getByRole('button', { name: /Sign in/i }).click();
    await expect(page.getByText('Welcome back')).toBeVisible();

    // Switch back to sign-up
    await page.getByRole('button', { name: /Create one/i }).click();
    await expect(page.getByText('Create an account')).toBeVisible();
  });
});
