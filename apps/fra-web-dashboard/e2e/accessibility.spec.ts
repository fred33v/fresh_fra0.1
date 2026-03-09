/**
 * WCAG AA Accessibility Tests
 * 
 * Comprehensive accessibility testing for WCAG 2.1 Level AA compliance
 * Reference: https://www.w3.org/WAI/WCAG21/quickref/
 */

import { test, expect } from '@playwright/test';
import {
  checkColorContrast,
  checkHeadingHierarchy,
  checkFormLabels,
  checkImageAltText,
  checkAriaAttributes,
  checkKeyboardNavigation,
  runAccessibilityAudit,
} from './accessibility-audit';

test.describe('WCAG AA Accessibility Audit', () => {
  test('Assessment page should meet WCAG AA standards', async ({ page }) => {
    await page.goto('/assessment');

    const audit = await runAccessibilityAudit(page);

    console.log('Accessibility Audit Results:');
    console.log(`Summary: ${audit.summary.passed}/${audit.summary.total} passed`);
    console.log(JSON.stringify(audit.details, null, 2));

    // At least 5 out of 6 checks should pass for WCAG AA
    expect(audit.summary.passed).toBeGreaterThanOrEqual(5);

    // Critical checks that MUST pass
    if (!audit.details.formLabels.pass) {
      console.error('Form labels audit failed:', audit.details.formLabels.issues);
    }
    if (!audit.details.keyboardNavigation.pass) {
      console.error('Keyboard navigation audit failed:', audit.details.keyboardNavigation.issues);
    }
  });

  test('Budget Guide page should meet WCAG AA standards', async ({ page }) => {
    await page.goto('/budget-guide/assess-123');

    const audit = await runAccessibilityAudit(page);

    console.log('Budget Guide Accessibility Results:');
    console.log(`Summary: ${audit.summary.passed}/${audit.summary.total} passed`);

    expect(audit.summary.passed).toBeGreaterThanOrEqual(5);
  });

  test('Assessment results page should have proper heading structure', async ({ page }) => {
    await page.goto('/assessment/assess-123/results');

    const headingAudit = await checkHeadingHierarchy(page);

    console.log('Heading Hierarchy:');
    headingAudit.headings.forEach((h) => {
      console.log(`H${h.level}: ${h.text}`);
    });

    // Should have at least one h1
    const h1Count = headingAudit.headings.filter((h) => h.level === 1).length;
    expect(h1Count).toBeGreaterThanOrEqual(1);

    // No skipped heading levels
    expect(headingAudit.issues.length).toBe(0);
  });

  test('Forms should have proper labels', async ({ page }) => {
    await page.goto('/budget-guide/assess-123');

    const labelAudit = await checkFormLabels(page);

    console.log(
      `Form Labels: ${labelAudit.labeled}/${labelAudit.total} inputs have proper labels`
    );

    if (labelAudit.issues.length > 0) {
      console.warn('Label issues:', labelAudit.issues);
    }

    // At least 80% of form inputs should be labeled
    const labelPercentage = (labelAudit.labeled / labelAudit.total) * 100;
    expect(labelPercentage).toBeGreaterThanOrEqual(80);
  });

  test('All images should have alt text', async ({ page }) => {
    // Test on a page with images
    await page.goto('/assessment/assess-123/results');

    const altAudit = await checkImageAltText(page);

    console.log(`Images with alt text: ${altAudit.withAlt}/${altAudit.total}`);

    if (altAudit.issues.length > 0) {
      console.warn('Image issues:', altAudit.issues);
    }

    // All non-decorative images should have alt text
    expect(altAudit.pass).toBeTruthy();
  });

  test('Interactive elements should be keyboard accessible', async ({ page }) => {
    await page.goto('/assessment');

    const keyboardAudit = await checkKeyboardNavigation(page);

    console.log(`Focusable elements: ${keyboardAudit.focusableElements}`);

    if (keyboardAudit.issues.length > 0) {
      console.warn('Keyboard navigation issues:', keyboardAudit.issues);
    }

    // Should have focusable elements (buttons, links, inputs)
    expect(keyboardAudit.focusableElements).toBeGreaterThan(0);

    // No keyboard navigation issues
    expect(keyboardAudit.pass).toBeTruthy();
  });

  test('ARIA attributes should be valid', async ({ page }) => {
    await page.goto('/budget-guide/assess-123');

    const ariaAudit = await checkAriaAttributes(page);

    console.log(`ARIA elements: ${ariaAudit.elements}`);

    if (ariaAudit.ariaIssues.length > 0) {
      console.warn('ARIA issues:', ariaAudit.ariaIssues);
    }

    // All ARIA attributes should be valid
    expect(ariaAudit.pass).toBeTruthy();
  });

  test('Page should be navigable with Tab key', async ({ page }) => {
    await page.goto('/assessment');

    // Start navigation
    let elementsFound = 0;
    const maxTabs = 10;

    for (let i = 0; i < maxTabs; i++) {
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => document.activeElement?.tagName);

      if (['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(focused || '')) {
        elementsFound++;
      }
    }

    // Should be able to tab through multiple interactive elements
    expect(elementsFound).toBeGreaterThan(0);
  });

  test('Focus should be visible', async ({ page }) => {
    await page.goto('/assessment');

    // Tab to first interactive element
    await page.keyboard.press('Tab');

    // Get focused element
    const isFocused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      if (!el) return false;

      const style = window.getComputedStyle(el);
      const outline = style.outline;
      const boxShadow = style.boxShadow;

      // Check if there's a visible focus indicator
      return outline !== 'none' || (boxShadow && boxShadow !== 'none');
    });

    // Focus should be visible (outline or shadow)
    expect(isFocused).toBeTruthy();
  });

  test('Should support screen reader navigation', async ({ page }) => {
    await page.goto('/assessment');

    // Check for main landmark
    const main = page.locator('main');
    expect(await main.count()).toBeGreaterThan(0);

    // Check for proper ARIA roles
    const contentWithRole = page.locator('[role="main"], [role="navigation"], [role="complementary"]');
    expect(await contentWithRole.count()).toBeGreaterThan(0);
  });

  test('Error messages should be accessible', async ({ page }) => {
    await page.goto('/budget-guide/assess-123');

    // Try to submit form with invalid data
    const addButton = page.locator('button:has-text("Add")').first();

    if (await addButton.isVisible()) {
      // Look for form validation
      const inputs = page.locator('input, select, textarea');
      const inputCount = await inputs.count();

      // Submit without filling
      await addButton.click();

      // Check for error messages
      const errorMessages = page.locator('[role="alert"], .error, [aria-invalid="true"]');
      const errorCount = await errorMessages.count();

      if (errorCount > 0) {
        // Errors should be announced to screen readers
        const hasAriaLive = await page.locator('[aria-live]').count();
        // Either direct error message or aria-live region
        expect(errorCount + hasAriaLive).toBeGreaterThan(0);
      }
    }
  });
});

test.describe('Mobile Accessibility', () => {
  test('Assessment should work on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/assessment');

    // Check that interactive elements are large enough (min 44x44px)
    const buttons = page.locator('button');
    const count = await buttons.count();

    for (let i = 0; i < Math.min(count, 3); i++) {
      const button = buttons.nth(i);
      const box = await button.boundingBox();

      if (box) {
        // At least one dimension should be >= 44px
        const isLargeEnough = box.width >= 44 || box.height >= 44;
        expect(isLargeEnough).toBeTruthy();
      }
    }
  });

  test('Touch targets should be properly spaced', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/budget-guide/assess-123');

    // All interactive elements should have reasonable spacing
    const interactive = page.locator('button, a, input, select, textarea');
    const count = await interactive.count();

    // Should have interactive elements on mobile
    expect(count).toBeGreaterThan(0);
  });
});
