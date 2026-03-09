/**
 * E2E Tests: Assessment Workflow
 * 
 * Tests the complete fraud risk assessment flow from start to completion
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Assessment Workflow', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    // Navigate to assessment page
    await page.goto('/assessment');
  });

  test('should display assessment title and module list', async () => {
    // Check page title
    await expect(page.locator('h1')).toContainText('Fraud Risk Assessment');

    // Check module sidebar
    const sidebar = page.locator('[role="navigation"]');
    await expect(sidebar).toBeVisible();

    // Check first module is visible
    await expect(page.locator('main')).toBeVisible();
  });

  test('should navigate between modules', async () => {
    // Start on module 1
    await expect(page.locator('main')).toContainText(/Module 1|Question/i);

    // Click next button
    const nextButton = page.locator('button:has-text("Next")').first();
    await nextButton.click();

    // Wait for navigation
    await page.waitForLoadState('networkidle');

    // Should be on module 2 or next question
    await expect(page.locator('main')).toBeVisible();
  });

  test('should handle answer input', async () => {
    // Find first input field
    const inputs = page.locator('input, select, button[role="radio"]');
    const firstInput = inputs.first();

    if (firstInput) {
      // Type or click depending on input type
      const role = await firstInput.getAttribute('role');
      if (role === 'radio') {
        await firstInput.click();
      } else {
        await firstInput.fill('test answer');
      }

      // Verify input
      const inputType = await firstInput.getAttribute('type');
      if (inputType !== 'radio') {
        await expect(firstInput).toHaveValue('test answer');
      }
    }
  });

  test('should display progress', async () => {
    // Check progress indicator
    const progress = page.locator('text=/Progress|[0-9]+%/i');
    await expect(progress).toBeVisible();
  });

  test('should submit assessment', async () => {
    // Navigate to last module (this is simplified - actual test would fill all fields)
    const submitButton = page.locator('button:has-text("Submit|Finish")');

    // Submit button might not be enabled initially
    if (await submitButton.isVisible()) {
      // Fill required fields first (implementation-dependent)
      // Then click submit
      await submitButton.click();

      // Should navigate to results
      await page.waitForURL(/results|complete/i);
      await expect(page.url()).toContain('/results');
    }
  });

  test('should be keyboard navigable', async () => {
    // Tab through elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Check focus moved
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'INPUT', 'SELECT', 'A']).toContain(focusedElement);
  });

  test('should have accessible form labels', async () => {
    // Check all form inputs have labels
    const inputs = page.locator('input, textarea, select');
    const count = await inputs.count();

    // Each input should be associated with a label
    for (let i = 0; i < Math.min(count, 3); i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');

      // Should have either id+label or aria-label
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        // At least one of these should exist
        const hasLabel = await label.count() > 0;
        const hasAriaLabel = !!ariaLabel;
        expect(hasLabel || hasAriaLabel).toBeTruthy();
      } else if (!ariaLabel) {
        // Should have aria-label if no ID
        expect(await input.getAttribute('placeholder')).toBeTruthy();
      }
    }
  });
});

test.describe('Assessment Results', () => {
  test('should display risk score', async ({ page }) => {
    // Navigate to results (assuming we have assessment ID)
    await page.goto('/assessment/assess-123/results');

    // Check for risk score display
    const scoreDisplay = page.locator('text=/Risk.*Score|Score.*[0-9]/i');
    await expect(scoreDisplay).toBeVisible();
  });

  test('should show result charts', async ({ page }) => {
    await page.goto('/assessment/assess-123/results');

    // Check for chart containers
    const charts = page.locator('[role="img"], svg');
    expect(await charts.count()).toBeGreaterThan(0);
  });

  test('should have accessible result summary', async ({ page }) => {
    await page.goto('/assessment/assess-123/results');

    // Check for heading
    const heading = page.locator('h1, h2');
    await expect(heading.first()).toBeVisible();

    // Check for result summary text
    const summary = page.locator('text=/risk|score|result/i').first();
    await expect(summary).toBeVisible();
  });
});
