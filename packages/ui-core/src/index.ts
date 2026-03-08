/**
 * @stopfra/ui-core
 *
 * Shared UI design tokens, types, and utilities for Stop FRA applications
 *
 * This package provides:
 * - Design Tokens: Colors, spacing, typography, borders
 * - Component Types: Shared interfaces for UI components
 * - Accessibility: A11y utilities and constants
 * - Constants: Animation, z-index, breakpoints, etc.
 *
 * @example
 * ```typescript
 * // Import tokens
 * import { colors, spacing, fontSizes } from '@stopfra/ui-core/tokens';
 *
 * // Import component types
 * import { BaseButtonProps, BUTTON_VARIANTS } from '@stopfra/ui-core/types';
 *
 * // Import accessibility utilities
 * import { getButtonAccessibilityLabel } from '@stopfra/ui-core/accessibility';
 *
 * // Import constants
 * import { ANIMATION_DURATION, Z_INDEX } from '@stopfra/ui-core/constants';
 * ```
 */

// Re-export everything from submodules
export * from './tokens/index.js';
export * from './types/index.js';
export * from './accessibility/index.js';
export * from './constants/index.js';
