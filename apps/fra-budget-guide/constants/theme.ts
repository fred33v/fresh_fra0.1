// Design tokens for FRA Budget Guide
// All colors follow the Slate/Blue palette from Tailwind CSS

export type ThemeColors = { [K in keyof typeof colors]: string };

export const colors = {
  // Primary (Blue)
  primary: '#1e40af',        // blue-800 — buttons, headers, links
  primaryLight: '#eff6ff',   // blue-50 — card backgrounds
  primaryBorder: '#bfdbfe',  // blue-200 — borders on primary cards

  // Text
  text: '#0f172a',           // slate-900 — headings, primary text
  textSecondary: '#334155',  // slate-700 — body text
  textMuted: '#64748b',      // slate-500 — captions, hints
  textFaint: '#94a3b8',      // slate-400 — disabled, placeholders

  // Backgrounds
  background: '#f8fafc',     // slate-50 — screen background
  backgroundAlt: '#f1f5f9',  // slate-100 — alternate sections
  surface: '#ffffff',        // white — cards, modals

  // Borders
  border: '#e2e8f0',         // slate-200 — default borders
  borderLight: '#cbd5e1',    // slate-300 — heavier borders

  // Success (Green)
  success: '#059669',        // emerald-600 — positive actions
  successDark: '#047857',    // emerald-700 — hover/pressed
  successDarker: '#065f46',  // emerald-800 — text on green bg
  successLight: '#d1fae5',   // emerald-100 — success backgrounds

  // Warning (Amber)
  warning: '#f59e0b',        // amber-500 — warning icons
  warningDark: '#d97706',    // amber-600 — warning text
  warningDarker: '#92400e',  // amber-800 — text on amber bg
  warningDarkest: '#78350f', // amber-900 — dark warning text
  warningLight: '#fef3c7',   // amber-100 — warning backgrounds
  warningLighter: '#fffbeb', // amber-50 — light warning bg

  // Danger (Red)
  danger: '#dc2626',         // red-600 — alerts, errors
  dangerDark: '#991b1b',     // red-800 — text on red bg
  dangerDarkest: '#7f1d1d',  // red-900 — dark danger text
  dangerLight: '#fee2e2',    // red-100 — danger backgrounds
  dangerLighter: '#fecaca',  // red-200 — lighter danger bg
  dangerLightest: '#fef2f2', // red-50 — lightest danger bg

  // Misc
  black: '#000',
  overlay: '#00000080',      // 50% black overlay
} as const;

export const darkColors: ThemeColors = {
  // Primary (Blue) — slightly lighter for dark backgrounds
  primary: '#3b82f6',        // blue-500
  primaryLight: '#1e293b',   // slate-800 — card backgrounds
  primaryBorder: '#1e3a5f',  // blue-900ish — borders on primary cards

  // Text — inverted for dark mode
  text: '#f1f5f9',           // slate-100 — headings, primary text
  textSecondary: '#cbd5e1',  // slate-300 — body text
  textMuted: '#94a3b8',      // slate-400 — captions, hints
  textFaint: '#64748b',      // slate-500 — disabled, placeholders

  // Backgrounds
  background: '#0f172a',     // slate-900 — screen background
  backgroundAlt: '#1e293b',  // slate-800 — alternate sections
  surface: '#1e293b',        // slate-800 — cards, modals

  // Borders
  border: '#334155',         // slate-700 — default borders
  borderLight: '#475569',    // slate-600 — heavier borders

  // Success (Green)
  success: '#34d399',        // emerald-400
  successDark: '#059669',    // emerald-600
  successDarker: '#6ee7b7',  // emerald-300 — text on green bg
  successLight: '#064e3b',   // emerald-900 — success backgrounds

  // Warning (Amber)
  warning: '#fbbf24',        // amber-400
  warningDark: '#f59e0b',    // amber-500
  warningDarker: '#fcd34d',  // amber-300 — text on amber bg
  warningDarkest: '#fef3c7', // amber-100 — dark warning text
  warningLight: '#451a03',   // amber-950 — warning backgrounds
  warningLighter: '#78350f', // amber-900 — light warning bg

  // Danger (Red)
  danger: '#f87171',         // red-400
  dangerDark: '#fca5a5',     // red-300
  dangerDarkest: '#fee2e2',  // red-100
  dangerLight: '#450a0a',    // red-950
  dangerLighter: '#7f1d1d',  // red-900
  dangerLightest: '#991b1b', // red-800

  // Misc
  black: '#000',
  overlay: '#00000099',      // 60% black overlay
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const typography = {
  h1: {
    fontSize: 28,
    fontWeight: 'bold' as const,
    color: colors.text,
  },
  h2: {
    fontSize: 22,
    fontWeight: 'bold' as const,
    color: colors.text,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text,
  },
  body: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  caption: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  small: {
    fontSize: 12,
    color: colors.textFaint,
  },
} as const;

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
} as const;
