/**
 * Design Token Integration with @stopfra/ui-core
 * 
 * Integrates the design system tokens from @stopfra/ui-core
 * into Tailwind CSS for consistent styling across the dashboard.
 * 
 * Usage:
 * - Import tokens from '@stopfra/ui-core'
 * - Apply via Tailwind classes (text-primary, bg-accent, etc.)
 * - Extend in tailwind.config.ts
 */

import { colors, spacing, typography, shadows, borderRadius } from '@stopfra/ui-core';

export const designTokens = {
  // Color tokens
  colors: {
    // Primary - Fraud assessment blue
    primary: colors.primary || '#3B82F6',
    'primary-light': colors.primaryLight || '#DBEAFE',
    'primary-dark': colors.primaryDark || '#1E40AF',

    // Secondary - Process green
    secondary: colors.secondary || '#10B981',
    'secondary-light': colors.secondaryLight || '#D1FAE5',
    'secondary-dark': colors.secondaryDark || '#065F46',

    // Accent - Action orange
    accent: colors.accent || '#F59E0B',
    'accent-light': colors.accentLight || '#FEF3C7',
    'accent-dark': colors.accentDark || '#B45309',

    // Risk levels
    'risk-critical': colors.riskCritical || '#7C2D12',
    'risk-high': colors.riskHigh || '#EF4444',
    'risk-medium': colors.riskMedium || '#F59E0B',
    'risk-low': colors.riskLow || '#10B981',

    // Neutral
    'neutral-50': colors.neutral50 || '#F9FAFB',
    'neutral-100': colors.neutral100 || '#F3F4F6',
    'neutral-200': colors.neutral200 || '#E5E7EB',
    'neutral-300': colors.neutral300 || '#D1D5DB',
    'neutral-400': colors.neutral400 || '#9CA3AF',
    'neutral-500': colors.neutral500 || '#6B7280',
    'neutral-600': colors.neutral600 || '#4B5563',
    'neutral-700': colors.neutral700 || '#374151',
    'neutral-800': colors.neutral800 || '#1F2937',
    'neutral-900': colors.neutral900 || '#111827',

    // Semantic
    success: colors.success || '#10B981',
    warning: colors.warning || '#F59E0B',
    error: colors.error || '#EF4444',
    info: colors.info || '#3B82F6',
  },

  // Spacing scale
  spacing: {
    '0': '0',
    '1': spacing.xs || '0.25rem',
    '2': spacing.sm || '0.5rem',
    '3': spacing.md || '0.75rem',
    '4': spacing.lg || '1rem',
    '6': spacing.xl || '1.5rem',
    '8': spacing['2xl'] || '2rem',
    '12': spacing['3xl'] || '3rem',
    '16': spacing['4xl'] || '4rem',
  },

  // Typography
  typography: {
    // Headings
    'h1': {
      fontSize: typography.h1?.fontSize || '2.25rem',
      fontWeight: typography.h1?.fontWeight || '700',
      lineHeight: typography.h1?.lineHeight || '2.5rem',
      letterSpacing: typography.h1?.letterSpacing || '-0.02em',
    },
    'h2': {
      fontSize: typography.h2?.fontSize || '1.875rem',
      fontWeight: typography.h2?.fontWeight || '700',
      lineHeight: typography.h2?.lineHeight || '2.25rem',
      letterSpacing: typography.h2?.letterSpacing || '-0.02em',
    },
    'h3': {
      fontSize: typography.h3?.fontSize || '1.5rem',
      fontWeight: typography.h3?.fontWeight || '600',
      lineHeight: typography.h3?.lineHeight || '1.75rem',
      letterSpacing: typography.h3?.letterSpacing || '-0.01em',
    },
    'h4': {
      fontSize: typography.h4?.fontSize || '1.25rem',
      fontWeight: typography.h4?.fontWeight || '600',
      lineHeight: typography.h4?.lineHeight || '1.5rem',
      letterSpacing: typography.h4?.letterSpacing || '0em',
    },

    // Body
    'body-lg': {
      fontSize: typography.bodyLg?.fontSize || '1.125rem',
      fontWeight: typography.bodyLg?.fontWeight || '400',
      lineHeight: typography.bodyLg?.lineHeight || '1.75rem',
      letterSpacing: typography.bodyLg?.letterSpacing || '0em',
    },
    'body-md': {
      fontSize: typography.bodyMd?.fontSize || '1rem',
      fontWeight: typography.bodyMd?.fontWeight || '400',
      lineHeight: typography.bodyMd?.lineHeight || '1.5rem',
      letterSpacing: typography.bodyMd?.letterSpacing || '0em',
    },
    'body-sm': {
      fontSize: typography.bodySm?.fontSize || '0.875rem',
      fontWeight: typography.bodySm?.fontWeight || '400',
      lineHeight: typography.bodySm?.lineHeight || '1.25rem',
      letterSpacing: typography.bodySm?.letterSpacing || '0em',
    },

    // Caption
    'caption': {
      fontSize: typography.caption?.fontSize || '0.75rem',
      fontWeight: typography.caption?.fontWeight || '500',
      lineHeight: typography.caption?.lineHeight || '1rem',
      letterSpacing: typography.caption?.letterSpacing || '0.02em',
    },
  },

  // Shadows
  shadows: {
    'sm': shadows.sm || '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    'md': shadows.md || '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    'lg': shadows.lg || '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    'xl': shadows.xl || '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    'elevation-1': shadows.elevation1 || '0 2px 4px rgba(0, 0, 0, 0.08)',
    'elevation-2': shadows.elevation2 || '0 4px 8px rgba(0, 0, 0, 0.12)',
    'elevation-3': shadows.elevation3 || '0 8px 16px rgba(0, 0, 0, 0.16)',
  },

  // Border radius
  borderRadius: {
    'none': borderRadius.none || '0',
    'xs': borderRadius.xs || '0.25rem',
    'sm': borderRadius.sm || '0.375rem',
    'md': borderRadius.md || '0.5rem',
    'lg': borderRadius.lg || '0.75rem',
    'xl': borderRadius.xl || '1rem',
    'full': borderRadius.full || '9999px',
  },

  // Component tokens
  components: {
    // Button variants
    button: {
      primary: {
        bg: colors.primary || '#3B82F6',
        text: '#FFFFFF',
        hover: colors.primaryDark || '#1E40AF',
        active: colors.primaryDark || '#1E40AF',
        disabled: '#D1D5DB',
      },
      secondary: {
        bg: colors.neutral100 || '#F3F4F6',
        text: colors.neutral900 || '#111827',
        hover: colors.neutral200 || '#E5E7EB',
        active: colors.neutral200 || '#E5E7EB',
        disabled: '#D1D5DB',
      },
      danger: {
        bg: colors.error || '#EF4444',
        text: '#FFFFFF',
        hover: colors.riskHigh || '#DC2626',
        active: colors.riskHigh || '#DC2626',
        disabled: '#D1D5DB',
      },
    },

    // Input tokens
    input: {
      borderColor: colors.neutral300 || '#D1D5DB',
      borderColorFocus: colors.primary || '#3B82F6',
      bg: '#FFFFFF',
      bgDisabled: colors.neutral100 || '#F3F4F6',
      text: colors.neutral900 || '#111827',
      textDisabled: colors.neutral500 || '#6B7280',
      placeholder: colors.neutral400 || '#9CA3AF',
    },

    // Card tokens
    card: {
      bg: '#FFFFFF',
      border: colors.neutral200 || '#E5E7EB',
      shadow: shadows.md || '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    },

    // Badge tokens
    badge: {
      critical: {
        bg: colors.riskCritical || '#7C2D12',
        text: '#FFFFFF',
        border: colors.riskCritical || '#7C2D12',
      },
      high: {
        bg: colors.riskHigh || '#FEE2E2',
        text: colors.riskHigh || '#EF4444',
        border: colors.riskHigh || '#FCA5A5',
      },
      medium: {
        bg: colors.riskMedium || '#FEF3C7',
        text: '#B45309',
        border: colors.riskMedium || '#FCD34D',
      },
      low: {
        bg: colors.riskLow || '#D1FAE5',
        text: colors.riskLow || '#065F46',
        border: colors.riskLow || '#A7F3D0',
      },
    },
  },
};

/**
 * Tailwind Config Extension
 * Add to tailwind.config.ts:
 * 
 * import { designTokens } from '@/lib/design-tokens'
 * 
 * export default {
 *   theme: {
 *     extend: {
 *       colors: designTokens.colors,
 *       spacing: designTokens.spacing,
 *       borderRadius: designTokens.borderRadius,
 *       boxShadow: designTokens.shadows,
 *       fontSize: {
 *         'h1': designTokens.typography.h1,
 *         'h2': designTokens.typography.h2,
 *         // ... etc
 *       }
 *     }
 *   }
 * }
 */

/**
 * Usage Examples:
 * 
 * // Colors
 * <div className="bg-primary text-white">Primary button</div>
 * <div className="bg-risk-high">High risk badge</div>
 * <div className="border border-neutral-200">Card border</div>
 * 
 * // Spacing
 * <div className="p-4 gap-6 mb-8">With design tokens</div>
 * 
 * // Shadows
 * <div className="shadow-md">Elevated card</div>
 * <div className="shadow-elevation-2">Component shadow</div>
 * 
 * // Border radius
 * <div className="rounded-lg">Standard rounded</div>
 * <div className="rounded-full">Pill shape</div>
 */
