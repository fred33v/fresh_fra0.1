/**
 * E2E Test Fixtures
 * 
 * Provides authenticated page contexts and test data for E2E tests
 */

import { test as base, expect, Page } from '@playwright/test';

export type TestFixtures = {
  authenticatedPage: Page;
  testAssessmentId: string;
  testData: {
    email: string;
    password: string;
    organizationId: string;
  };
};

/**
 * Create authenticated page fixture
 * - Skips auth for tests by storing auth state
 * - Provides pre-authenticated page for testing protected routes
 */
export const test = base.extend<TestFixtures>({
  testData: async ({}, use) => {
    const testData = {
      email: 'test@example.com',
      password: 'Test123!@#',
      organizationId: 'org-test-001',
    };
    await use(testData);
  },

  testAssessmentId: async ({ page }, use) => {
    // Create or use a known assessment ID for testing
    // For now, use a mock ID that the app can handle
    const assessmentId = 'test-assessment-001';
    await use(assessmentId);
  },

  authenticatedPage: async ({ page, testData, browser }, use) => {
    // Skip real authentication - mock local storage instead
    // This allows tests to run without a real backend
    
    // Mock authentication in localStorage to simulate logged-in state
    await page.goto('http://localhost:8080');
    
    // Set mock auth tokens and user data
    await page.evaluate(({ email, orgId }) => {
      // Mock localStorage for authenticated state
      localStorage.setItem(
        'auth_token',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwib3JnYW5pemF0aW9uSWQiOiIkb3JnSWQiLCJpYXQiOjE1MTYyMzkwMjJ9'
      );
      
      localStorage.setItem(
        'user',
        JSON.stringify({
          id: 'user-001',
          email: email,
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
      
      // Trigger storage event for app to recognize auth
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'auth_token',
          newValue: 'authenticated',
        })
      );
    }, { email: testData.email, orgId: testData.organizationId });

    // Navigate to home page and wait for app initialization
    await page.goto('http://localhost:8080');
    
    // Wait for app to load and recognize authenticated state
    try {
      await page.waitForSelector('body', { timeout: 5000 });
    } catch (e) {
      // Page loaded but selectors may not exist yet
    }

    await use(page);
  },
});

export { expect };

/**
 * Helper to safely navigate to a protected page with retries
 */
export async function navigateToPage(page: Page, url: string, timeout = 10000): Promise<void> {
  try {
    await page.goto(url, { waitUntil: 'load' });
  } catch (e) {
    // If navigation fails, try one more time
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
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
): Promise<any | null> {
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
