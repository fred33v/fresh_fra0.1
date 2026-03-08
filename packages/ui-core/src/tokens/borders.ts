/**
 * Border & Radius Design Tokens
 *
 * Consistent border styles across all Stop FRA apps
 */

// Border widths
export const borderWidths = {
  /** 0px - No border */
  none: 0,
  /** 1px - Subtle borders */
  thin: 1,
  /** 2px - Standard borders (GOV.UK default) */
  normal: 2,
  /** 3px - Emphasis borders, focus states */
  thick: 3,
  /** 4px - Heavy emphasis */
  heavy: 4,
} as const;

// Border radius
export const borderRadius = {
  /** 0px - Sharp corners */
  none: 0,
  /** 2px - Subtle rounding */
  xs: 2,
  /** 4px - Standard (GOV.UK default) */
  sm: 4,
  /** 6px - Medium rounding */
  md: 6,
  /** 8px - Larger rounding */
  lg: 8,
  /** 12px - Prominent rounding */
  xl: 12,
  /** 16px - Very rounded */
  '2xl': 16,
  /** 9999px - Full/pill shape */
  full: 9999,
} as const;

// Pre-defined border styles
export const borderStyles = {
  // Input borders
  input: {
    width: borderWidths.normal,
    radius: borderRadius.sm,
  },
  inputFocus: {
    width: borderWidths.thick,
    radius: borderRadius.sm,
  },
  inputError: {
    width: borderWidths.thick,
    radius: borderRadius.sm,
  },

  // Button borders
  button: {
    width: borderWidths.normal,
    radius: borderRadius.sm,
  },

  // Card borders
  card: {
    width: borderWidths.thin,
    radius: borderRadius.md,
  },

  // Chip/tag borders
  chip: {
    width: borderWidths.thin,
    radius: borderRadius.full,
  },
} as const;

// Shadow definitions (for elevation)
export const shadows = {
  none: 'none',
  sm: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  xl: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

export type BorderWidthKey = keyof typeof borderWidths;
export type BorderRadiusKey = keyof typeof borderRadius;
export type ShadowKey = keyof typeof shadows;
