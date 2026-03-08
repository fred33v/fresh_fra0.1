/**
 * Spacing Design Tokens
 *
 * Consistent spacing scale based on 4px grid
 * Used for padding, margin, and gaps
 */

// Base spacing unit (4px)
export const SPACING_UNIT = 4;

// Spacing scale
export const spacing = {
  /** 0px */
  none: 0,
  /** 2px - Extra small details */
  xxs: 2,
  /** 4px - Tight spacing */
  xs: 4,
  /** 8px - Small spacing */
  sm: 8,
  /** 12px - Medium-small spacing */
  md: 12,
  /** 16px - Standard spacing */
  lg: 16,
  /** 20px - Medium-large spacing */
  xl: 20,
  /** 24px - Large spacing */
  xxl: 24,
  /** 32px - Extra large spacing */
  xxxl: 32,
  /** 40px - Section spacing */
  section: 40,
  /** 48px - Major section spacing */
  page: 48,
} as const;

// Component-specific spacing
export const componentSpacing = {
  // Button padding
  button: {
    small: { vertical: 8, horizontal: 16 },
    medium: { vertical: 12, horizontal: 20 },
    large: { vertical: 16, horizontal: 24 },
  },

  // Input padding
  input: {
    padding: 12,
    labelGap: 8,
    errorGap: 8,
  },

  // Card padding
  card: {
    padding: 16,
    gap: 12,
  },

  // List item spacing
  listItem: {
    padding: 16,
    gap: 12,
  },

  // Form spacing
  form: {
    fieldGap: 24,
    sectionGap: 32,
  },

  // Screen/page padding
  screen: {
    horizontal: 20,
    vertical: 24,
  },
} as const;

// Gap presets for flex/grid layouts
export const gaps = {
  /** 4px */
  tight: 4,
  /** 8px */
  small: 8,
  /** 12px */
  medium: 12,
  /** 16px */
  normal: 16,
  /** 24px */
  large: 24,
  /** 32px */
  spacious: 32,
} as const;

export type SpacingKey = keyof typeof spacing;
export type GapKey = keyof typeof gaps;
