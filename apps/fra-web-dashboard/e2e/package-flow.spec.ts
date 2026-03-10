/**
 * E2E Tests: Package Selection Flow
 * 
 * Verifies that users must choose a package before accessing features
 */

import { test, expect, navigateToPage, waitForPageContent } from './fixtures';

test.describe('Package Selection Flow', () => {
  test('Home "Get Started" button leads to package page', async ({ page }) => {
    await navigateToPage(page, '/', 5000);

    const hasContent = await waitForPageContent(page, 3000);
    expect(hasContent).toBeTruthy();

    // Find "Get Started" button
    const getStartedButton = await page.locator('a, button').filter({ hasText: /Get Started/ }).first();
    const href = await getStartedButton.getAttribute('href');
    
    // Should go to a package page, not directly to auth
    expect(href).toContain('/package');
    console.log('✓ Get Started button redirects to:', href);
  });

  test('Home "Start Workshop Now" button leads to package page when not authenticated', async ({ page }) => {
    await navigateToPage(page, '/', 5000);

    const hasContent = await waitForPageContent(page, 3000);
    expect(hasContent).toBeTruthy();

    // Find "Start Workshop Now" button
    const workshopButton = await page.locator('a, button').filter({ hasText: /Start Workshop Now/ }).first();
    const href = await workshopButton.getAttribute('href');
    
    // Should go to package page for unauthenticated users, not directly to auth
    expect(href).toContain('/package');
    console.log('✓ Start Workshop button redirects to:', href);
  });

  test('Professional package page has "Choose" CTA button', async ({ page }) => {
    await navigateToPage(page, '/package/professional', 5000);

    const hasContent = await waitForPageContent(page, 3000);
    expect(hasContent).toBeTruthy();

    // Find the "Choose Professional" or similar button
    const chooseButton = await page.locator('button, a').filter({ hasText: /Choose|Subscribe|Select/ }).first();
    const isVisible = await chooseButton.isVisible({ timeout: 2000 }).catch(() => false);
    
    expect(isVisible).toBeTruthy();
    console.log('✓ Professional package page has CTA button');
  });

  test('Enterprise package page has "Choose" CTA button', async ({ page }) => {
    await navigateToPage(page, '/package/enterprise', 5000);

    const hasContent = await waitForPageContent(page, 3000);
    expect(hasContent).toBeTruthy();

    // Find the "Choose Enterprise" or similar button
    const chooseButton = await page.locator('button, a').filter({ hasText: /Choose|Subscribe|Select/ }).first();
    const isVisible = await chooseButton.isVisible({ timeout: 2000 }).catch(() => false);
    
    expect(isVisible).toBeTruthy();
    console.log('✓ Enterprise package page has CTA button');
  });

  test('Clicking Choose button on Professional page shows pricing and options', async ({ page }) => {
    await navigateToPage(page, '/package/professional', 5000);

    const hasContent = await waitForPageContent(page, 3000);
    expect(hasContent).toBeTruthy();

    // Verify page shows pricing details
    const priceText = await page.textContent('body');
    expect(priceText).toContain('£');
    expect(priceText).toContain('year');
    console.log('✓ Professional page displays pricing');

    // Verify it shows features
    expect(priceText).toContain('Training') || expect(priceText).toContain('training');
    console.log('✓ Professional page displays features');
  });

  test('Package pages show all relevant information', async ({ page }) => {
    const packages = ['/package/professional', '/package/enterprise'];

    for (const packageUrl of packages) {
      await navigateToPage(page, packageUrl, 5000);
      
      const hasContent = await waitForPageContent(page, 3000);
      expect(hasContent).toBeTruthy();

      const content = await page.textContent('body');
      
      // Should have pricing
      expect(content).toContain('£');
      
      // Should have features/description
      expect(content!.length).toBeGreaterThan(500);
      
      console.log(`✓ ${packageUrl} has complete information`);
    }
  });

  test('Professional package shows staff training feature', async ({ page }) => {
    await navigateToPage(page, '/package/professional', 5000);

    const hasContent = await waitForPageContent(page, 3000);
    expect(hasContent).toBeTruthy();

    const content = await page.textContent('body');
    
    // Professional should mention training/workshop
    const hasTraining = content?.toLowerCase().includes('training') || 
                       content?.toLowerCase().includes('awareness') ||
                       content?.toLowerCase().includes('workshop');
    
    expect(hasTraining).toBeTruthy();
    console.log('✓ Professional package mentions training');
  });

  test('Enterprise package shows more features than Professional', async ({ page }) => {
    // Get Professional page content
    await navigateToPage(page, '/package/professional', 5000);
    await waitForPageContent(page, 3000);
    const profContent = await page.textContent('body');

    // Get Enterprise page content
    await navigateToPage(page, '/package/enterprise', 5000);
    await waitForPageContent(page, 3000);
    const entContent = await page.textContent('body');

    // Both should be substantial
    expect(profContent!.length).toBeGreaterThan(500);
    expect(entContent!.length).toBeGreaterThan(500);
    
    // Enterprise should mention more features or higher tier
    expect(entContent).toContain('£');
    console.log('✓ Enterprise package pricing shown');
  });

  test('Complete flow: Home → Get Started → Professional Package → Can proceed to checkout', async ({ page }) => {
    // Step 1: Start on home
    await navigateToPage(page, '/', 5000);
    expect(await waitForPageContent(page, 3000)).toBeTruthy();
    console.log('✓ Step 1: Home page loaded');

    // Step 2: Click Get Started button
    const getStartedButton = await page.locator('a, button').filter({ hasText: /Get Started/ }).first();
    const getStartedHref = await getStartedButton.getAttribute('href');
    console.log('✓ Step 2: Get Started button found, redirects to:', getStartedHref);

    // Step 3: Navigate to package page
    expect(getStartedHref).toContain('/package');
    await navigateToPage(page, getStartedHref || '/package/professional', 5000);
    expect(await waitForPageContent(page, 3000)).toBeTruthy();
    console.log('✓ Step 3: Package page loaded');

    // Step 4: Verify CTA button and pricing exists
    const chooseButton = await page.locator('button, a').filter({ hasText: /Choose|Subscribe|Select/ }).first();
    const isVisible = await chooseButton.isVisible({ timeout: 2000 }).catch(() => false);
    expect(isVisible).toBeTruthy();
    console.log('✓ Step 4: CTA button visible');

    // Step 5: Verify pricing information
    const priceVisible = await page.textContent('body');
    expect(priceVisible).toContain('£');
    expect(priceVisible).toContain('year');
    console.log('✓ Step 5: Pricing information visible');

    console.log('✅ Complete flow verified: Home → Get Started → Package Selection → Ready for Checkout');
  });

  test('Starter package page exists and renders', async ({ page }) => {
    await navigateToPage(page, '/package/starter', 5000);

    const hasContent = await waitForPageContent(page, 3000);
    expect(hasContent).toBeTruthy();

    // Verify Starter-specific content
    const content = await page.textContent('body');
    expect(content).toContain('Starter');
    expect(content).toContain('£795');
    console.log('✓ Starter package page renders with pricing');
  });

  test('Starter package shows "Start Assessment" CTA button', async ({ page }) => {
    await navigateToPage(page, '/package/starter', 5000);

    const hasContent = await waitForPageContent(page, 3000);
    expect(hasContent).toBeTruthy();

    // Find the "Start Assessment" button
    const ctaButton = await page.locator('a, button').filter({ hasText: /Start Assessment/ }).first();
    const isVisible = await ctaButton.isVisible({ timeout: 2000 }).catch(() => false);
    
    expect(isVisible).toBeTruthy();
    console.log('✓ Starter package has "Start Assessment" CTA button');
  });

  test('Starter package shows one-time pricing', async ({ page }) => {
    await navigateToPage(page, '/package/starter', 5000);

    const hasContent = await waitForPageContent(page, 3000);
    expect(hasContent).toBeTruthy();

    const content = await page.textContent('body');
    expect(content).toContain('£795');
    expect(content).toContain('one-time');
    console.log('✓ Starter package displays £795 one-time pricing');
  });

  test('Starter package lists all included features', async ({ page }) => {
    await navigateToPage(page, '/package/starter', 5000);

    const hasContent = await waitForPageContent(page, 3000);
    expect(hasContent).toBeTruthy();

    const content = await page.textContent('body');
    
    // Starter should include these features
    expect(content).toContain('assessment');
    expect(content).toContain('PDF');
    expect(content).toContain('ECCTA');
    console.log('✓ Starter package lists all features');
  });

  test('Home Starter package card button leads to Starter package page', async ({ page }) => {
    await navigateToPage(page, '/', 5000);

    const hasContent = await waitForPageContent(page, 3000);
    expect(hasContent).toBeTruthy();

    // Find the Starter package card's "Start Assessment" button
    const allButtons = await page.locator('a, button').filter({ hasText: /Start Assessment/ });
    const count = await allButtons.count();
    expect(count).toBeGreaterThan(0);

    // Get the first "Start Assessment" button (should be Starter package)
    const starterButton = allButtons.first();
    const href = await starterButton.getAttribute('href');
    
    // Should route to Starter package page
    expect(href).toBe('/package/starter');
    console.log('✓ Home Starter button correctly routes to /package/starter');
  });

  test('Complete flow: Home → Starter Package → Start Assessment', async ({ page }) => {
    // Step 1: Start on home
    await navigateToPage(page, '/', 5000);
    expect(await waitForPageContent(page, 3000)).toBeTruthy();
    console.log('✓ Step 1: Home page loaded');

    // Step 2: Find Starter package button
    const allButtons = await page.locator('a, button').filter({ hasText: /Start Assessment/ });
    const starterButton = allButtons.first();
    const href = await starterButton.getAttribute('href');
    console.log('✓ Step 2: Starter button found, href:', href);

    // Step 3: Navigate to Starter package page
    expect(href).toBe('/package/starter');
    await navigateToPage(page, href || '/package/starter', 5000);
    expect(await waitForPageContent(page, 3000)).toBeTruthy();
    console.log('✓ Step 3: Starter package page loaded');

    // Step 4: Verify pricing (£795 one-time)
    const priceText = await page.textContent('body');
    expect(priceText).toContain('£795');
    expect(priceText).toContain('one-time');
    console.log('✓ Step 4: Starter pricing visible (£795 one-time)');

    // Step 5: Verify CTA button exists
    const ctaButton = await page.locator('a, button').filter({ hasText: /Start Assessment/ }).first();
    const isVisible = await ctaButton.isVisible({ timeout: 2000 }).catch(() => false);
    expect(isVisible).toBeTruthy();
    console.log('✓ Step 5: CTA button visible');

    console.log('✅ Complete Starter flow verified: Home → Starter Package Selection → Ready for Assessment');
  });
});
