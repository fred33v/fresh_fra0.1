/**
 * Input/TextArea Component Types
 *
 * Shared type definitions for input components
 * Platform-specific implementations should extend these types
 */

/** Input size variants */
export const INPUT_SIZES = ['small', 'medium', 'large'] as const;
export type InputSize = (typeof INPUT_SIZES)[number];

/** Input state variants */
export const INPUT_STATES = ['default', 'focus', 'error', 'disabled', 'success'] as const;
export type InputState = (typeof INPUT_STATES)[number];

/**
 * Base input props shared across platforms
 */
export interface BaseInputProps {
  /** Input label */
  label?: string;
  /** Hint text below label */
  hint?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Disable the input */
  disabled?: boolean;
  /** Show required indicator */
  required?: boolean;
  /** Error message */
  error?: string;
  /** Input size */
  size?: InputSize;
  /** Test ID for automated testing */
  testID?: string;
}

/**
 * Base text area props extending input props
 */
export interface BaseTextAreaProps extends BaseInputProps {
  /** Number of visible lines */
  numberOfLines?: number;
  /** Maximum character length */
  maxLength?: number;
  /** Show character count */
  showCount?: boolean;
  /** Minimum height in pixels */
  minHeight?: number;
}

/**
 * Input size to padding mapping
 */
export const INPUT_SIZE_PADDING = {
  small: { vertical: 8, horizontal: 12 },
  medium: { vertical: 12, horizontal: 12 },
  large: { vertical: 16, horizontal: 16 },
} as const;

/**
 * Input size to font size mapping
 */
export const INPUT_SIZE_FONT = {
  small: 14,
  medium: 16,
  large: 18,
} as const;

/**
 * Input state to border width mapping
 */
export const INPUT_STATE_BORDER = {
  default: 2,
  focus: 3,
  error: 3,
  disabled: 2,
  success: 2,
} as const;
