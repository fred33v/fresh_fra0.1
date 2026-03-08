import { test, expect } from '@playwright/test';

test.describe('Professional package page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/package/professional');
  });

  test('displays the Professional heading and pricing', async ({ page }) => {
    const heading = page.locator('h1');
    await expect(heading).toContainText('Professional');

    // Price shown in the hero section
    await expect(page.getByText('£1,995').first()).toBeVisible();
  });

  test('shows the "Choose Professional" CTA button', async ({ page }) => {
    const ctaButton = page.getByRole('link', { name: /Choose Professional/i });
    await expect(ctaButton.first()).toBeVisible();
  });

  test('lists included features', async ({ page }) => {
    await expect(page.getByText('Staff Awareness Training')).toBeVisible();
    await expect(page.getByText('Up to 50 Employee Key-Passes')).toBeVisible();
    await expect(page.getByText('Quarterly Reassessment')).toBeVisible();
    await expect(page.getByText('Email Support')).toBeVisible();
  });

  test('footer is present', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('All rights reserved');
  });
});

test.describe('Enterprise package page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/package/enterprise');
  });

  test('displays the Enterprise heading and pricing', async ({ page }) => {
    const heading = page.locator('h1');
    await expect(heading).toContainText('Enterprise');

    // Price shown in the hero section
    await expect(page.getByText('£4,995').first()).toBeVisible();
  });

  test('shows the "Choose Enterprise" CTA button', async ({ page }) => {
    const ctaButton = page.getByRole('link', { name: /Choose Enterprise/i });
    await expect(ctaButton.first()).toBeVisible();
  });

  test('lists included features', async ({ page }) => {
    await expect(page.getByText('Real-Time Monitoring Dashboard')).toBeVisible();
    await expect(page.getByText('Unlimited Employee Key-Passes')).toBeVisible();
    await expect(page.getByText('Risk Register & Action Tracking')).toBeVisible();
    await expect(page.getByText('API Access').first()).toBeVisible();
  });

  test('footer is present', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('All rights reserved');
  });
});
