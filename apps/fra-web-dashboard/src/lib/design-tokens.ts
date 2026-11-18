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

import { colors, spacing, textStyles, shadows, borderRadius } from '@stopfra/ui-core';

/** Convert native numeric tokens into CSS values at the web boundary. */
function toCssShadow(shadow: (typeof shadows)['sm' | 'md' | 'lg' | 'xl']): string {
  return `${shadow.shadowOffset.width}px ${shadow.shadowOffset.height}px ${shadow.shadowRadius}px rgba(0, 0, 0, ${shadow.shadowOpacity})`;
}

export const designTokens = {
  // Color tokens
  colors: {
    // Primary - Fraud assessment blue
    primary: '#3B82F6',
    'primary-light': '#DBEAFE',
    'primary-dark': '#1E40AF',

    // Secondary - Process green
    secondary: '#10B981',
    'secondary-light': '#D1FAE5',
    'secondary-dark': '#065F46',

    // Accent - Action orange
    accent: '#F59E0B',
    'accent-light': '#FEF3C7',
    'accent-dark': '#B45309',

    // Risk levels
    'risk-critical': '#7C2D12',
    'risk-high': '#EF4444',
    'risk-medium': '#F59E0B',
    'risk-low': '#10B981',

    // Neutral
    'neutral-50': '#F9FAFB',
    'neutral-100': '#F3F4F6',
    'neutral-200': '#E5E7EB',
    'neutral-300': '#D1D5DB',
    'neutral-400': '#9CA3AF',
    'neutral-500': '#6B7280',
    'neutral-600': '#4B5563',
    'neutral-700': '#374151',
    'neutral-800': '#1F2937',
    'neutral-900': '#111827',

    // Semantic
    success: colors.success || '#10B981',
    warning: colors.warning || '#F59E0B',
    error: colors.error || '#EF4444',
    info: colors.info || '#3B82F6',
  },

  // Spacing scale
  spacing: {
    '0': '0',
    '1': `${spacing.xs}px`,
    '2': `${spacing.sm}px`,
    '3': `${spacing.md}px`,
    '4': `${spacing.lg}px`,
    '6': `${spacing.xl}px`,
    '8': `${spacing.xxl}px`,
    '12': `${spacing.xxxl}px`,
    '16': `${spacing.page}px`,
  },

  // Typography
  typography: {
    // Headings
    'h1': {
      fontSize: `${textStyles.heading1.fontSize}px`,
      fontWeight: textStyles.heading1.fontWeight,
      lineHeight: String(textStyles.heading1.lineHeight),
      letterSpacing: '-0.02em',
    },
    'h2': {
      fontSize: `${textStyles.heading2.fontSize}px`,
      fontWeight: textStyles.heading2.fontWeight,
      lineHeight: String(textStyles.heading2.lineHeight),
      letterSpacing: '-0.02em',
    },
    'h3': {
      fontSize: `${textStyles.heading3.fontSize}px`,
      fontWeight: textStyles.heading3.fontWeight,
      lineHeight: String(textStyles.heading3.lineHeight),
      letterSpacing: '-0.01em',
    },
    'h4': {
      fontSize: `${textStyles.heading4.fontSize}px`,
      fontWeight: textStyles.heading4.fontWeight,
      lineHeight: String(textStyles.heading4.lineHeight),
      letterSpacing: '0em',
    },

    // Body
    'body-lg': {
      fontSize: `${textStyles.bodyLarge.fontSize}px`,
      fontWeight: textStyles.bodyLarge.fontWeight,
      lineHeight: String(textStyles.bodyLarge.lineHeight),
      letterSpacing: '0em',
    },
    'body-md': {
      fontSize: `${textStyles.body.fontSize}px`,
      fontWeight: textStyles.body.fontWeight,
      lineHeight: String(textStyles.body.lineHeight),
      letterSpacing: '0em',
    },
    'body-sm': {
      fontSize: `${textStyles.bodySmall.fontSize}px`,
      fontWeight: textStyles.bodySmall.fontWeight,
      lineHeight: String(textStyles.bodySmall.lineHeight),
      letterSpacing: '0em',
    },

    // Caption
    'caption': {
      fontSize: `${textStyles.caption.fontSize}px`,
      fontWeight: textStyles.caption.fontWeight,
      lineHeight: String(textStyles.caption.lineHeight),
      letterSpacing: '0.02em',
    },
  },

  // Shadows
  shadows: {
    'sm': toCssShadow(shadows.sm),
    'md': toCssShadow(shadows.md),
    'lg': toCssShadow(shadows.lg),
    'xl': toCssShadow(shadows.xl),
    'elevation-1': '0 2px 4px rgba(0, 0, 0, 0.08)',
    'elevation-2': '0 4px 8px rgba(0, 0, 0, 0.12)',
    'elevation-3': '0 8px 16px rgba(0, 0, 0, 0.16)',
  },

  // Border radius
  borderRadius: {
    'none': `${borderRadius.none}px`,
    'xs': `${borderRadius.xs}px`,
    'sm': `${borderRadius.sm}px`,
    'md': `${borderRadius.md}px`,
    'lg': `${borderRadius.lg}px`,
    'xl': `${borderRadius.xl}px`,
    'full': `${borderRadius.full}px`,
  },

  // Component tokens
  components: {
    // Button variants
    button: {
      primary: {
        bg: '#3B82F6',
        text: '#FFFFFF',
        hover: '#1E40AF',
        active: '#1E40AF',
        disabled: '#D1D5DB',
      },
      secondary: {
        bg: '#F3F4F6',
        text: '#111827',
        hover: '#E5E7EB',
        active: '#E5E7EB',
        disabled: '#D1D5DB',
      },
      danger: {
        bg: colors.error || '#EF4444',
        text: '#FFFFFF',
        hover: '#DC2626',
        active: '#DC2626',
        disabled: '#D1D5DB',
      },
    },

    // Input tokens
    input: {
      borderColor: '#D1D5DB',
      borderColorFocus: '#3B82F6',
      bg: '#FFFFFF',
      bgDisabled: '#F3F4F6',
      text: '#111827',
      textDisabled: '#6B7280',
      placeholder: '#9CA3AF',
    },

    // Card tokens
    card: {
      bg: '#FFFFFF',
      border: '#E5E7EB',
      shadow: toCssShadow(shadows.md),
    },

    // Badge tokens
    badge: {
      critical: {
        bg: '#7C2D12',
        text: '#FFFFFF',
        border: '#7C2D12',
      },
      high: {
        bg: '#FEE2E2',
        text: '#EF4444',
        border: '#FCA5A5',
      },
      medium: {
        bg: '#FEF3C7',
        text: '#B45309',
        border: '#FCD34D',
      },
      low: {
        bg: '#D1FAE5',
        text: '#065F46',
        border: '#A7F3D0',
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
