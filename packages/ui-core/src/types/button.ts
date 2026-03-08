/**
 * Button Component Types
 *
 * Shared type definitions for button components
 * Platform-specific implementations should extend these types
 */

/** Button visual variants */
export const BUTTON_VARIANTS = ['primary', 'secondary', 'outline', 'danger', 'success', 'ghost', 'link'] as const;
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];

/** Button size options */
export const BUTTON_SIZES = ['small', 'medium', 'large'] as const;
export type ButtonSize = (typeof BUTTON_SIZES)[number];

/**
 * Base button props shared across platforms
 * Platform-specific implementations extend this interface
 */
export interface BaseButtonProps {
  /** Button visual variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Disable the button */
  disabled?: boolean;
  /** Show loading state */
  loading?: boolean;
  /** Full width button */
  fullWidth?: boolean;
  /** Test ID for automated testing */
  testID?: string;
}

/**
 * Button variant to color mapping
 */
export const BUTTON_VARIANT_COLORS = {
  primary: {
    background: 'blue',
    text: 'white',
    border: 'blue',
  },
  secondary: {
    background: 'grey2',
    text: 'white',
    border: 'grey2',
  },
  outline: {
    background: 'transparent',
    text: 'blue',
    border: 'blue',
  },
  danger: {
    background: 'red',
    text: 'white',
    border: 'red',
  },
  success: {
    background: 'green',
    text: 'white',
    border: 'green',
  },
  ghost: {
    background: 'transparent',
    text: 'blue',
    border: 'transparent',
  },
  link: {
    background: 'transparent',
    text: 'blue',
    border: 'transparent',
  },
} as const;

/**
 * Button size to padding mapping
 */
export const BUTTON_SIZE_PADDING = {
  small: { vertical: 8, horizontal: 16 },
  medium: { vertical: 12, horizontal: 20 },
  large: { vertical: 16, horizontal: 24 },
} as const;

/**
 * Button size to font size mapping
 */
export const BUTTON_SIZE_FONT = {
  small: 14,
  medium: 16,
  large: 17,
} as const;
