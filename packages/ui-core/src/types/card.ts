/**
 * Card Component Types
 *
 * Shared type definitions for card/panel components
 */

/** Card variants */
export const CARD_VARIANTS = ['default', 'outlined', 'elevated', 'flat'] as const;
export type CardVariant = (typeof CARD_VARIANTS)[number];

/** Card padding sizes */
export const CARD_PADDING_SIZES = ['none', 'small', 'medium', 'large'] as const;
export type CardPaddingSize = (typeof CARD_PADDING_SIZES)[number];

/**
 * Base card props
 */
export interface BaseCardProps {
  /** Card variant */
  variant?: CardVariant;
  /** Padding size */
  padding?: CardPaddingSize;
  /** Interactive (clickable) */
  interactive?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Test ID */
  testID?: string;
}

/**
 * Metric card props (for dashboard displays)
 */
export interface BaseMetricCardProps extends BaseCardProps {
  /** Metric title/label */
  title: string;
  /** Metric value */
  value: string | number;
  /** Optional subtitle/description */
  subtitle?: string;
  /** Trend indicator */
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string | number;
    label?: string;
  };
  /** Icon name (platform-specific) */
  icon?: string;
  /** Status color key */
  status?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
}

/**
 * Status card props (for assessment status displays)
 */
export interface BaseStatusCardProps extends BaseCardProps {
  /** Status title */
  title: string;
  /** Status value */
  status: 'not_started' | 'in_progress' | 'completed' | 'pending_action' | 'overdue';
  /** Progress percentage (0-100) */
  progress?: number;
  /** Last updated timestamp */
  lastUpdated?: string | Date;
  /** Action label */
  actionLabel?: string;
}

/**
 * Card padding values
 */
export const CARD_PADDING_VALUES = {
  none: 0,
  small: 12,
  medium: 16,
  large: 24,
} as const;

/**
 * Card border radius
 */
export const CARD_BORDER_RADIUS = 8;
