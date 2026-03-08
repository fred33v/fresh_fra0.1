import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('displays the main heading', async ({ page }) => {
    const heading = page.locator('h1');
    await expect(heading).toContainText('FRAUD-RISK.CO.UK');
  });

  test('shows all three package cards', async ({ page }) => {
    // The pricing section contains three packages: Starter, Professional, Enterprise
    await expect(page.getByText('Starter')).toBeVisible();
    await expect(page.getByText('Professional').first()).toBeVisible();
    await expect(page.getByText('Enterprise').first()).toBeVisible();

    // Verify their prices are displayed
    await expect(page.getByText('£795')).toBeVisible();
    await expect(page.getByText('£1,995').first()).toBeVisible();
    await expect(page.getByText('£4,995').first()).toBeVisible();
  });

  test('navigates to the auth page via Get Started button', async ({ page }) => {
    // When not logged in the hero CTA says "Get Started"
    const getStartedButton = page.getByRole('link', { name: /Get Started/i });
    await expect(getStartedButton).toBeVisible();
    await getStartedButton.click();

    await expect(page).toHaveURL(/\/auth/);
  });

  test('footer is present with copyright text', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('FRAUD-RISK.CO.UK');
    await expect(footer).toContainText('All rights reserved');
  });
});
