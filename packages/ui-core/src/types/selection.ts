/**
 * Selection Component Types (Radio, Checkbox, Toggle)
 *
 * Shared type definitions for selection components
 */

/** Selection size variants */
export const SELECTION_SIZES = ['small', 'medium', 'large'] as const;
export type SelectionSize = (typeof SELECTION_SIZES)[number];

/**
 * Base option type for radio/checkbox groups
 */
export interface BaseOptionProps<T = string> {
  /** Option value */
  value: T;
  /** Display label */
  label: string;
  /** Optional description */
  description?: string;
  /** Disable this option */
  disabled?: boolean;
}

/**
 * Base radio option props
 */
export interface BaseRadioOptionProps<T = string> extends BaseOptionProps<T> {
  /** Whether this option is selected */
  selected: boolean;
  /** Size variant */
  size?: SelectionSize;
  /** Test ID for automated testing */
  testID?: string;
}

/**
 * Base checkbox option props
 */
export interface BaseCheckboxProps {
  /** Checkbox label */
  label: string;
  /** Whether checked */
  checked: boolean;
  /** Indeterminate state (for parent checkboxes) */
  indeterminate?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Optional description */
  description?: string;
  /** Size variant */
  size?: SelectionSize;
  /** Test ID */
  testID?: string;
}

/**
 * Base toggle/switch props
 */
export interface BaseToggleProps {
  /** Toggle label */
  label?: string;
  /** Whether toggled on */
  value: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Size variant */
  size?: SelectionSize;
  /** Test ID */
  testID?: string;
}

/**
 * Question group props (for assessment forms)
 */
export interface BaseQuestionGroupProps<T = string> {
  /** Question text */
  question: string;
  /** Optional hint/description */
  hint?: string;
  /** Available options */
  options: BaseOptionProps<T>[];
  /** Currently selected value(s) */
  selected: T | T[] | null;
  /** Whether multiple selection is allowed */
  multiple?: boolean;
  /** Required field */
  required?: boolean;
  /** Error message */
  error?: string;
  /** Test ID */
  testID?: string;
}

/**
 * Selection size to dimensions mapping
 */
export const SELECTION_SIZE_DIMENSIONS = {
  small: { indicator: 16, gap: 8 },
  medium: { indicator: 20, gap: 12 },
  large: { indicator: 24, gap: 16 },
} as const;
