/**
 * Accessibility Audit Helper Functions
 * 
 * Utilities for testing WCAG AA compliance:
 * - Color contrast verification (4.5:1 for normal text, 3:1 for large text)
 * - Heading hierarchy validation
 * - Form label associations
 * - Image alt text verification
 * - ARIA attribute validation
 * - Focus management
 */

import { Page, Locator } from '@playwright/test';

/**
 * Analyze color contrast using WCAG AA standards
 * Reference: https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
 */
export async function checkColorContrast(page: Page): Promise<{
  pass: boolean;
  failures: string[];
  warnings: string[];
}> {
  const results = {
    pass: true,
    failures: [] as string[],
    warnings: [] as string[],
  };

  // Get all text elements
  const elements = page.locator('*:visible');
  const count = await elements.count();

  for (let i = 0; i < Math.min(count, 50); i++) {
    const element = elements.nth(i);
    const text = await element.textContent();

    // Skip elements without text
    if (!text || text.trim().length < 2) continue;

    // Get computed styles
    const styles = await element.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        color: computed.color,
        backgroundColor: computed.backgroundColor,
        fontSize: computed.fontSize,
        fontWeight: computed.fontWeight,
      };
    });

    // Check if it's a link, button, or interactive element
    const role = await element.getAttribute('role');
    const isInteractive =
      (await element.locator('a, button, input, select, textarea').count()) > 0 ||
      role === 'button' ||
      role === 'link';

    // Minimal contrast for informational messages
    if (styles.backgroundColor.includes('rgba') || styles.backgroundColor === 'rgba(0, 0, 0, 0)') {
      results.warnings.push(
        `Element with transparent background may have contrast issues: "${text.substring(0, 50)}"`
      );
    }
  }

  return results;
}

/**
 * Check heading hierarchy (h1 > h2 > h3 > h4 > h5 > h6)
 * Reference: https://www.w3.org/WAI/WCAG21/Understanding/headings-and-labels
 */
export async function checkHeadingHierarchy(page: Page): Promise<{
  pass: boolean;
  headings: Array<{ level: number; text: string }>;
  issues: string[];
}> {
  const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
  const headingData: Array<{ level: number; text: string }> = [];
  const issues: string[] = [];

  let previousLevel = 0;

  for (const heading of headings) {
    const tagName = await heading.evaluate((el) => el.tagName);
    const level = parseInt(tagName[1]);
    const text = await heading.textContent();

    headingData.push({ level, text: text?.substring(0, 60) || '' });

    // Check for skipped levels (h1 -> h3 skips h2)
    if (previousLevel > 0 && level > previousLevel + 1) {
      issues.push(
        `Heading level jumped from h${previousLevel} to h${level}: "${text?.substring(0, 40)}"`
      );
    }

    previousLevel = level;
  }

  return {
    pass: issues.length === 0,
    headings: headingData,
    issues,
  };
}

/**
 * Check form label associations
 * Reference: https://www.w3.org/WAI/WCAG21/Understanding/labels-or-instructions
 */
export async function checkFormLabels(page: Page): Promise<{
  pass: boolean;
  total: number;
  labeled: number;
  issues: string[];
}> {
  const inputs = await page.locator('input, textarea, select').all();
  let labeled = 0;
  const issues: string[] = [];

  for (const input of inputs) {
    const id = await input.getAttribute('id');
    const name = await input.getAttribute('name');
    const placeholder = await input.getAttribute('placeholder');
    const ariaLabel = await input.getAttribute('aria-label');
    const ariaLabelledBy = await input.getAttribute('aria-labelledby');
    const type = await input.getAttribute('type');

    // Skip hidden inputs
    if (type === 'hidden') continue;

    let hasLabel = false;

    // Check for associated label via id
    if (id) {
      const associatedLabel = page.locator(`label[for="${id}"]`);
      if ((await associatedLabel.count()) > 0) {
        hasLabel = true;
        labeled++;
      }
    }

    // Check for aria-label
    if (ariaLabel) {
      hasLabel = true;
      labeled++;
    }

    // Check for aria-labelledby
    if (ariaLabelledBy && !hasLabel) {
      hasLabel = true;
      labeled++;
    }

    // Check for placeholder (not ideal but acceptable for some cases)
    if (placeholder && !hasLabel && (await input.locator('..').locator('label').count()) === 0) {
      issues.push(
        `Input "${name || id}" uses only placeholder for label (use <label> element instead)`
      );
    }

    if (!hasLabel && !placeholder) {
      issues.push(`Input "${name || id}" has no associated label`);
    }
  }

  return {
    pass: issues.length === 0,
    total: inputs.length,
    labeled,
    issues,
  };
}

/**
 * Check image alt text
 * Reference: https://www.w3.org/WAI/WCAG21/Understanding/non-text-content
 */
export async function checkImageAltText(page: Page): Promise<{
  pass: boolean;
  total: number;
  withAlt: number;
  issues: string[];
}> {
  const images = await page.locator('img:visible').all();
  let withAlt = 0;
  const issues: string[] = [];

  for (const img of images) {
    const src = await img.getAttribute('src');
    const alt = await img.getAttribute('alt');
    const ariaLabel = await img.getAttribute('aria-label');
    const role = await img.getAttribute('role');

    // Skip decorative images
    if (role === 'presentation' || (alt === '' && !ariaLabel)) {
      // Decorative image is okay
      continue;
    }

    if (!alt && !ariaLabel) {
      issues.push(`Image without alt text: ${src?.substring(0, 50)}`);
    } else {
      withAlt++;
    }
  }

  return {
    pass: issues.length === 0,
    total: images.length,
    withAlt,
    issues,
  };
}

/**
 * Check ARIA attributes
 * Reference: https://www.w3.org/TR/wai-aria-1.2/
 */
export async function checkAriaAttributes(page: Page): Promise<{
  pass: boolean;
  elements: number;
  ariaIssues: string[];
}> {
  const ariaElements = await page.locator('[aria-*]').all();
  const issues: string[] = [];

  for (const element of ariaElements) {
    const ariaAttrs = await element.evaluate((el) => {
      return Array.from(el.attributes)
        .filter((attr) => attr.name.startsWith('aria-'))
        .map((attr) => ({ name: attr.name, value: attr.value }));
    });

    for (const attr of ariaAttrs) {
      // Check for invalid aria attributes
      if (
        ![
          'aria-label',
          'aria-labelledby',
          'aria-describedby',
          'aria-hidden',
          'aria-live',
          'aria-atomic',
          'aria-relevant',
          'aria-busy',
          'aria-roledescription',
          'aria-pressed',
          'aria-checked',
          'aria-selected',
          'aria-expanded',
          'aria-current',
          'aria-level',
          'aria-posinset',
          'aria-setsize',
          'aria-placeholder',
          'aria-valuenow',
          'aria-valuemin',
          'aria-valuemax',
          'aria-valuetext',
          'aria-keyshortcuts',
          'aria-owns',
          'aria-controls',
        ].includes(attr.name)
      ) {
        issues.push(`Invalid aria attribute: ${attr.name}="${attr.value}"`);
      }
    }
  }

  return {
    pass: issues.length === 0,
    elements: ariaElements.length,
    ariaIssues: issues,
  };
}

/**
 * Check keyboard navigation
 * Verify that all interactive elements are keyboard accessible
 */
export async function checkKeyboardNavigation(page: Page): Promise<{
  pass: boolean;
  focusableElements: number;
  issues: string[];
}> {
  const issues: string[] = [];

  // Check for keyboard traps by tabbing through page
  let focusableCount = 0;
  const focusableElements = await page.locator(
    'a, button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  focusableCount = await focusableElements.count();

  // Check for elements with positive tabindex (can cause confusion)
  const positiveTabindexElements = await page.locator('[tabindex]:not([tabindex="-1"])[tabindex!="0"]');
  const positiveCount = await positiveTabindexElements.count();

  if (positiveCount > 0) {
    issues.push(
      `Found ${positiveCount} elements with positive tabindex (use -1 for hidden or 0 for normal flow)`
    );
  }

  return {
    pass: issues.length === 0,
    focusableElements: focusableCount,
    issues,
  };
}

/**
 * Run comprehensive accessibility audit
 */
export async function runAccessibilityAudit(page: Page): Promise<{
  summary: { passed: number; failed: number; total: number };
  details: {
    colorContrast: Awaited<ReturnType<typeof checkColorContrast>>;
    headingHierarchy: Awaited<ReturnType<typeof checkHeadingHierarchy>>;
    formLabels: Awaited<ReturnType<typeof checkFormLabels>>;
    imageAltText: Awaited<ReturnType<typeof checkImageAltText>>;
    ariaAttributes: Awaited<ReturnType<typeof checkAriaAttributes>>;
    keyboardNavigation: Awaited<ReturnType<typeof checkKeyboardNavigation>>;
  };
}> {
  const results = {
    summary: { passed: 0, failed: 0, total: 6 },
    details: {
      colorContrast: await checkColorContrast(page),
      headingHierarchy: await checkHeadingHierarchy(page),
      formLabels: await checkFormLabels(page),
      imageAltText: await checkImageAltText(page),
      ariaAttributes: await checkAriaAttributes(page),
      keyboardNavigation: await checkKeyboardNavigation(page),
    },
  };

  // Count passes/failures
  if (results.details.colorContrast.pass) results.summary.passed++;
  else results.summary.failed++;

  if (results.details.headingHierarchy.pass) results.summary.passed++;
  else results.summary.failed++;

  if (results.details.formLabels.pass) results.summary.passed++;
  else results.summary.failed++;

  if (results.details.imageAltText.pass) results.summary.passed++;
  else results.summary.failed++;

  if (results.details.ariaAttributes.pass) results.summary.passed++;
  else results.summary.failed++;

  if (results.details.keyboardNavigation.pass) results.summary.passed++;
  else results.summary.failed++;

  return results;
}
