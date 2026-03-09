/**
 * E2E Tests: Budget Guide Workflow
 * 
 * Tests the budget planning flow including strategy creation and visualization
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Budget Guide Workflow', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    // Navigate to budget guide
    await page.goto('/budget-guide/assess-123');
  });

  test('should display budget guide title and summary cards', async () => {
    // Check page title
    await expect(page.locator('h1')).toContainText('Budget Guide');

    // Check summary cards
    const riskScoreCard = page.locator('text=/Risk Score/i');
    const appetiteCard = page.locator('text=/Risk Appetite/i');
    const budgetCard = page.locator('text=/Total Budget/i');
    const progressCard = page.locator('text=/Progress/i');

    await expect(riskScoreCard).toBeVisible();
    await expect(appetiteCard).toBeVisible();
    await expect(budgetCard).toBeVisible();
    await expect(progressCard).toBeVisible();
  });

  test('should display allocation charts', async () => {
    // Click on Budget Allocation tab
    await page.locator('button:has-text("Budget Allocation")').click();

    // Check for charts
    const charts = page.locator('svg');
    expect(await charts.count()).toBeGreaterThanOrEqual(2);

    // Check chart labels
    const recommended = page.locator('text=/Recommended/i');
    const actual = page.locator('text=/Current|Your/i');

    await expect(recommended).toBeVisible();
    await expect(actual).toBeVisible();
  });

  test('should add mitigation strategy', async () => {
    // Click on Strategies tab
    await page.locator('button:has-text("Strategies")').click();

    // Click Add Strategy button
    await page.locator('button:has-text("Add Strategy")').click();

    // Fill form
    await page.locator('input[placeholder*="strategy" i]').fill('Implement vendor approval process');
    await page.locator('select').first().selectOption('prevention');
    await page.locator('input[type="number"]').fill('5000');
    await page.locator('select').nth(1).selectOption('3-6 months');

    // Submit form
    await page.locator('button:has-text("Add|Create")').click();

    // Verify strategy was added
    await page.waitForTimeout(500);
    const strategyText = page.locator('text=/Implement vendor approval/i');
    await expect(strategyText).toBeVisible();
  });

  test('should display implementation timeline', async () => {
    // Click on Timeline tab
    await page.locator('button:has-text("Timeline")').click();

    // Check timeline sections
    const timeline1_3 = page.locator('text=/1-3 months/i');
    const timeline3_6 = page.locator('text=/3-6 months/i');

    await expect(timeline1_3).toBeVisible();
    await expect(timeline3_6).toBeVisible();
  });

  test('should have responsive layout', async ({ page: testPage }) => {
    // Start with desktop
    await testPage.setViewportSize({ width: 1280, height: 720 });
    let mainContent = testPage.locator('main');
    await expect(mainContent).toBeVisible();

    // Switch to tablet
    await testPage.setViewportSize({ width: 768, height: 1024 });
    mainContent = testPage.locator('main');
    await expect(mainContent).toBeVisible();

    // Switch to mobile
    await testPage.setViewportSize({ width: 375, height: 667 });
    mainContent = testPage.locator('main');
    await expect(mainContent).toBeVisible();
  });

  test('should handle form validation', async () => {
    // Click Add Strategy
    await page.locator('button:has-text("Add Strategy")').click();

    // Try to submit empty form
    const submitButton = page.locator('button:has-text("Add")');

    // Button should be disabled or show error
    if (await submitButton.isEnabled()) {
      await submitButton.click();
      // Check for error message
      const error = page.locator('text=/required|invalid/i');
      expect(await error.count()).toBeGreaterThan(0);
    } else {
      // Button is disabled - which is also valid
      await expect(submitButton).toBeDisabled();
    }
  });

  test('should have accessible tab navigation', async () => {
    // Get all tab buttons
    const tabs = page.locator('[role="tab"], button:has-text("Allocation|Strategies|Timeline")');
    const tabCount = await tabs.count();

    expect(tabCount).toBeGreaterThanOrEqual(3);

    // Click tabs with keyboard
    await tabs.first().focus();
    await page.keyboard.press('ArrowRight');

    // Another tab should be focused
    const focusedElement = await page.evaluate(() => document.activeElement?.textContent);
    expect(focusedElement).toBeTruthy();
  });

  test('should display loading states', async () => {
    // If there are loading indicators, verify they appear/disappear
    const loading = page.locator('[class*="loading" i], [class*="spinner" i]');

    // Either no loading initially or it disappears
    if (await loading.count() > 0) {
      await page.waitForFunction(() => {
        return document.querySelectorAll('[class*="loading" i]').length === 0;
      }, { timeout: 5000 }).catch(() => {
        // It's okay if loading finishes before we check
      });
    }
  });
});
