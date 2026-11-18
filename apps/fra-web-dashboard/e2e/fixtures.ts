/**
 * E2E Test Fixtures
 *
 * Provides authenticated page contexts and test data for E2E tests.
 * The fixture intentionally avoids requiring real auth during Playwright runs
 * and stands up a deterministic test assessment id.
 */

import { test as base, expect, Page, Locator } from '@playwright/test';

export type TestFixtures = {
  authenticatedPage: Page;
  testAssessmentId: string;
  testData: {
    email: string;
    password: string;
    organizationId: string;
  };
};

export const test = base.extend<TestFixtures>({
  testData: async ({}, use) => {
    const testData = {
      email: 'test@example.com',
      password: 'Test123!@#',
      organizationId: 'org-test-001',
    };
    await use(testData);
  },

  testAssessmentId: async ({}, use) => {
    // Use one deterministic assessment id in the fixture so every route test is
    // anchored to the same synthetic route object instead of guessing one.
    const assessmentId = 'test-assessment-001';
    await use(assessmentId);
  },

  authenticatedPage: async ({ page, testData }, use) => {
    // Seed a stable authentication shell before the first page navigation.
    // This lets protected pages inherit a token state without depending on a
    // live login or a localStorage write that happens after navigation starts.
    await page.addInitScript(({ email, orgId }) => {
      localStorage.setItem('fra_access_token', 'mock-access-token-for-e2e');
      localStorage.setItem('fra_refresh_token', 'mock-refresh-token-for-e2e');
      localStorage.setItem(
        'user',
        JSON.stringify({
          id: 'user-001',
          email,
          organizationId: orgId,
          name: 'Test User',
        })
      );
      localStorage.setItem(
        'organization',
        JSON.stringify({
          id: orgId,
          name: 'Test Organization',
          plan: 'professional',
        })
      );
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'fra_access_token',
          newValue: 'mock-access-token-for-e2e',
        })
      );
    }, { email: testData.email, orgId: testData.organizationId });

    await use(page);
  },
});

export { expect };

/**
 * Helper to safely navigate to a protected page with retries
 */
export async function navigateToPage(page: Page, url: string, timeout = 10000): Promise<void> {
  try {
    await page.goto(url, { waitUntil: 'load', timeout });
  } catch (e) {
    // If navigation fails, try one more time
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    } catch {
      // If both fail, just proceed - test will check if page loaded
      console.warn(`Failed to navigate to ${url}, proceeding with test`);
    }
  }
}

/**
 * Helper to check if page has content (not blank/error)
 */
export async function isPageLoaded(page: Page): Promise<boolean> {
  try {
    const bodyContent = await page.locator('body').textContent();
    return (bodyContent || '').length > 10; // At least some content
  } catch {
    return false;
  }
}

/**
 * Helper to safely find elements with fallback
 */
export async function findElement(
  page: Page,
  ...selectors: string[]
): Promise<Locator | null> {
  for (const selector of selectors) {
    try {
      const element = page.locator(selector);
      if (await element.isVisible({ timeout: 1000 })) {
        return element;
      }
    } catch {
      // Selector not found, try next one
    }
  }
  return null;
}

/**
 * Helper to wait for page to show content
 */
export async function waitForPageContent(page: Page, timeout = 10000): Promise<boolean> {
  try {
    await page.waitForFunction(
      () => document.body.textContent && document.body.textContent.length > 50,
      { timeout }
    );
    return true;
  } catch {
    return false;
  }
}
