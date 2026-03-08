/**
 * Color Design Tokens
 *
 * UK Government Design System (GOV.UK) aligned colors
 * Used across all Stop FRA applications
 */

// Primary Government Colors
export const govColors = {
  blue: '#003078',
  blueDark: '#002050',
  blueLight: '#1d70b8',
  green: '#00703c',
  red: '#d4351c',
  yellow: '#ffdd00',
  orange: '#f47738',
  purple: '#4c2c92',
  pink: '#d53880',
  turquoise: '#28a197',
} as const;

// Grey Scale
export const greyScale = {
  grey1: '#0b0c0c',   // Darkest - primary text
  grey2: '#505a5f',   // Secondary text
  grey3: '#b1b4b6',   // Borders, disabled
  grey4: '#f3f2f1',   // Light backgrounds
  grey5: '#f8f9fa',   // Lightest backgrounds
} as const;

// Semantic Colors
export const semanticColors = {
  // Status
  success: '#00703c',
  warning: '#f47738',
  error: '#d4351c',
  info: '#1d70b8',

  // Text
  textPrimary: '#0b0c0c',
  textSecondary: '#505a5f',
  textMuted: '#b1b4b6',
  textInverse: '#ffffff',

  // Backgrounds
  backgroundPrimary: '#ffffff',
  backgroundSecondary: '#f8f9fa',
  backgroundSection: '#f3f2f1',
  backgroundHighlight: '#e8f1f8',

  // Borders
  borderPrimary: '#0b0c0c',
  borderSecondary: '#b1b4b6',
  borderFocus: '#ffdd00',
} as const;

// Assessment Status Colors
export const statusColors = {
  notStarted: '#6c757d',
  inProgress: '#0066cc',
  completed: '#28a745',
  pendingAction: '#ffa500',
  overdue: '#dc3545',
} as const;

// Risk Level Colors
export const riskColors = {
  high: '#dc3545',
  medium: '#ff8c00',
  low: '#198754',
  critical: '#7b0a0a',
  none: '#6c757d',
} as const;

// Base colors (commonly used)
export const baseColors = {
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
} as const;

/**
 * Complete color palette
 * Single source of truth for all colors
 */
export const colors = {
  // Government colors
  ...govColors,
  gov: govColors,

  // Grey scale
  ...greyScale,
  grey: greyScale,

  // Semantic
  ...semanticColors,
  semantic: semanticColors,

  // Status
  status: statusColors,

  // Risk
  risk: riskColors,

  // Base
  ...baseColors,
  base: baseColors,
} as const;

export type ColorKey = keyof typeof colors;
export type GovColorKey = keyof typeof govColors;
export type GreyScaleKey = keyof typeof greyScale;
export type SemanticColorKey = keyof typeof semanticColors;
export type StatusColorKey = keyof typeof statusColors;
export type RiskColorKey = keyof typeof riskColors;
