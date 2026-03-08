/**
 * Accessibility Utilities
 *
 * Shared accessibility helpers for consistent a11y across platforms
 */

/**
 * Generate accessible label for a button
 */
export function getButtonAccessibilityLabel(
  label: string,
  options?: {
    loading?: boolean;
    disabled?: boolean;
  }
): string {
  const parts = [label];

  if (options?.loading) {
    parts.push('loading');
  }

  if (options?.disabled) {
    parts.push('disabled');
  }

  return parts.join(', ');
}

/**
 * Generate accessible label for an input field
 */
export function getInputAccessibilityLabel(
  label: string,
  options?: {
    required?: boolean;
    error?: string;
    hint?: string;
  }
): string {
  const parts = [label];

  if (options?.required) {
    parts.push('required');
  }

  if (options?.error) {
    parts.push(`error: ${options.error}`);
  }

  return parts.join(', ');
}

/**
 * Generate accessible hint for an input field
 */
export function getInputAccessibilityHint(options?: {
  hint?: string;
  maxLength?: number;
  characterCount?: number;
}): string | undefined {
  const hints: string[] = [];

  if (options?.hint) {
    hints.push(options.hint);
  }

  if (options?.maxLength) {
    hints.push(`Maximum ${options.maxLength} characters`);
  }

  return hints.length > 0 ? hints.join('. ') : undefined;
}

/**
 * Generate accessible label for character count
 */
export function getCharacterCountLabel(
  current: number,
  max?: number
): string {
  if (max !== undefined) {
    return `${current} of ${max} characters`;
  }
  return `${current} characters`;
}

/**
 * Generate accessible label for a progress indicator
 */
export function getProgressAccessibilityLabel(
  progress: number,
  label?: string
): string {
  const percentage = Math.round(progress);
  if (label) {
    return `${label}: ${percentage}% complete`;
  }
  return `${percentage}% complete`;
}

/**
 * Generate accessible label for status
 */
export function getStatusAccessibilityLabel(
  status: string,
  label?: string
): string {
  const statusText = status.replace(/_/g, ' ');
  if (label) {
    return `${label}: ${statusText}`;
  }
  return statusText;
}

/**
 * Generate test ID for components
 * Provides consistent test ID generation across platforms
 */
export function generateTestID(
  componentType: string,
  identifier?: string,
  variant?: string
): string {
  const parts = [componentType];

  if (identifier) {
    parts.push(identifier);
  }

  if (variant) {
    parts.push(variant);
  }

  return parts.join('-').toLowerCase().replace(/\s+/g, '-');
}

/**
 * ARIA roles for common components
 * Reference for platform-specific implementations
 */
export const ARIA_ROLES = {
  button: 'button',
  checkbox: 'checkbox',
  radio: 'radio',
  radiogroup: 'radiogroup',
  textbox: 'textbox',
  alert: 'alert',
  status: 'status',
  progressbar: 'progressbar',
  link: 'link',
  menu: 'menu',
  menuitem: 'menuitem',
  tab: 'tab',
  tablist: 'tablist',
  tabpanel: 'tabpanel',
  dialog: 'dialog',
  alertdialog: 'alertdialog',
  list: 'list',
  listitem: 'listitem',
  heading: 'heading',
  img: 'image',
  form: 'form',
  search: 'search',
  navigation: 'navigation',
  main: 'main',
  banner: 'banner',
  complementary: 'complementary',
  contentinfo: 'contentinfo',
} as const;

/**
 * Live region settings for dynamic content
 */
export const LIVE_REGIONS = {
  polite: 'polite',
  assertive: 'assertive',
  off: 'off',
} as const;

export type AriaRole = (typeof ARIA_ROLES)[keyof typeof ARIA_ROLES];
export type LiveRegion = (typeof LIVE_REGIONS)[keyof typeof LIVE_REGIONS];
