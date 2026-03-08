/**
 * Typography Design Tokens
 *
 * Consistent typography scale for all Stop FRA apps
 * Based on GOV.UK Design System typography guidelines
 */

// Font sizes (in pixels, convert as needed for platform)
export const fontSizes = {
  /** 12px - Caption, helper text */
  xs: 12,
  /** 14px - Small text, labels */
  sm: 14,
  /** 16px - Body text (base) */
  base: 16,
  /** 17px - Large body text */
  md: 17,
  /** 18px - Lead text */
  lg: 18,
  /** 20px - Subheading */
  xl: 20,
  /** 24px - Heading 3 */
  '2xl': 24,
  /** 28px - Heading 2 */
  '3xl': 28,
  /** 32px - Heading 1 */
  '4xl': 32,
  /** 40px - Display */
  '5xl': 40,
} as const;

// Font weights
export const fontWeights = {
  /** 400 - Normal text */
  normal: '400',
  /** 500 - Medium emphasis */
  medium: '500',
  /** 600 - Semi-bold, labels */
  semibold: '600',
  /** 700 - Bold, headings */
  bold: '700',
} as const;

// Line heights (multipliers)
export const lineHeights = {
  /** 1 - Single line, icons */
  none: 1,
  /** 1.2 - Tight, headings */
  tight: 1.2,
  /** 1.4 - Normal, body text */
  normal: 1.4,
  /** 1.5 - Relaxed */
  relaxed: 1.5,
  /** 1.75 - Loose, large blocks */
  loose: 1.75,
} as const;

// Letter spacing
export const letterSpacing = {
  /** -0.5px - Tight, large headings */
  tight: -0.5,
  /** 0 - Normal */
  normal: 0,
  /** 0.5px - Wide, small caps */
  wide: 0.5,
  /** 1px - Extra wide, labels */
  wider: 1,
} as const;

// Pre-defined text styles
export const textStyles = {
  // Headings
  heading1: {
    fontSize: fontSizes['4xl'],
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.tight,
  },
  heading2: {
    fontSize: fontSizes['3xl'],
    fontWeight: fontWeights.bold,
    lineHeight: lineHeights.tight,
  },
  heading3: {
    fontSize: fontSizes['2xl'],
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.tight,
  },
  heading4: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.normal,
  },

  // Body text
  bodyLarge: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.normal,
    lineHeight: lineHeights.relaxed,
  },
  body: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.normal,
    lineHeight: lineHeights.normal,
  },
  bodySmall: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.normal,
    lineHeight: lineHeights.normal,
  },

  // UI elements
  label: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.normal,
  },
  caption: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.normal,
    lineHeight: lineHeights.normal,
  },
  button: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.none,
  },
  buttonSmall: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.none,
  },
  buttonLarge: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.none,
  },

  // Special
  link: {
    fontSize: fontSizes.base,
    fontWeight: fontWeights.normal,
    lineHeight: lineHeights.normal,
  },
  error: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.semibold,
    lineHeight: lineHeights.normal,
  },
} as const;

export type FontSizeKey = keyof typeof fontSizes;
export type FontWeightKey = keyof typeof fontWeights;
export type LineHeightKey = keyof typeof lineHeights;
export type TextStyleKey = keyof typeof textStyles;
