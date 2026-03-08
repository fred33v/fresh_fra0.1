/**
 * UI Constants
 *
 * Shared constants for UI components
 */

// Animation durations (in milliseconds)
export const ANIMATION_DURATION = {
  instant: 0,
  fast: 150,
  normal: 250,
  slow: 400,
  verySlow: 600,
} as const;

// Z-index layers
export const Z_INDEX = {
  base: 0,
  dropdown: 100,
  sticky: 200,
  fixed: 300,
  overlay: 400,
  modal: 500,
  popover: 600,
  tooltip: 700,
  toast: 800,
  max: 9999,
} as const;

// Opacity values
export const OPACITY = {
  full: 1,
  high: 0.87,
  medium: 0.6,
  low: 0.38,
  disabled: 0.5,
  subtle: 0.12,
  none: 0,
} as const;

// Hit slop for touch targets (mobile accessibility)
export const HIT_SLOP = {
  small: { top: 8, right: 8, bottom: 8, left: 8 },
  medium: { top: 12, right: 12, bottom: 12, left: 12 },
  large: { top: 16, right: 16, bottom: 16, left: 16 },
} as const;

// Minimum touch target size (WCAG 2.1 Level AA)
export const MIN_TOUCH_TARGET = 44;

// Screen breakpoints (for responsive design)
export const BREAKPOINTS = {
  xs: 0,
  sm: 576,
  md: 768,
  lg: 992,
  xl: 1200,
  xxl: 1400,
} as const;

// Maximum content widths
export const MAX_CONTENT_WIDTH = {
  narrow: 640,
  medium: 768,
  wide: 1024,
  full: 1280,
} as const;

// Common icon sizes
export const ICON_SIZES = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

// Input character limits
export const CHARACTER_LIMITS = {
  short: 50,
  medium: 200,
  long: 500,
  textarea: 2000,
  description: 5000,
} as const;

// Debounce/throttle delays
export const DEBOUNCE_DELAY = {
  instant: 0,
  fast: 100,
  normal: 300,
  slow: 500,
  search: 400,
} as const;

export type AnimationDurationKey = keyof typeof ANIMATION_DURATION;
export type ZIndexKey = keyof typeof Z_INDEX;
export type BreakpointKey = keyof typeof BREAKPOINTS;
export type IconSizeKey = keyof typeof ICON_SIZES;
