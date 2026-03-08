/**
 * Button Component
 *
 * Reusable button for navigation and actions
 * Eliminates ~50 lines of duplicate button styles
 */

import React from 'react';
import { Text, StyleSheet, TouchableOpacity, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import colors from '@/constants/colors';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'success';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps {
  /** Button text */
  children: string;
  /** Click handler */
  onPress: () => void;
  /** Button style variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Disable the button */
  disabled?: boolean;
  /** Show loading spinner */
  loading?: boolean;
  /** Full width button */
  fullWidth?: boolean;
  /** Custom container style */
  style?: ViewStyle;
  /** Custom text style */
  textStyle?: TextStyle;
  /** Test ID for testing */
  testID?: string;
}

export function Button({
  children,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  fullWidth = true,
  style,
  textStyle,
  testID,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  // Build accessible label
  const accessibilityLabel = loading ? `${children}, loading` : children;
  const accessibilityHint = loading ? 'Please wait' : undefined;

  return (
    <TouchableOpacity
      style={[
        styles.button,
        styles[`button_${variant}`],
        styles[`button_${size}`],
        fullWidth && styles.buttonFullWidth,
        isDisabled && styles.buttonDisabled,
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={isDisabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        disabled: isDisabled,
        busy: loading
      }}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' ? colors.govBlue : colors.white}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.text,
            styles[`text_${variant}`],
            styles[`text_${size}`],
            isDisabled && styles.textDisabled,
            textStyle,
          ]}
        >
          {children}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  buttonFullWidth: {
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.5,
  },

  // Variants
  button_primary: {
    backgroundColor: colors.govBlue,
  },
  button_secondary: {
    backgroundColor: colors.govGrey2,
  },
  button_outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.govBlue,
  },
  button_danger: {
    backgroundColor: colors.govRed,
  },
  button_success: {
    backgroundColor: colors.govGreen,
  },

  // Sizes
  button_small: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  button_medium: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  button_large: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },

  // Text styles
  text: {
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  textDisabled: {
    opacity: 0.7,
  },

  // Text variants
  text_primary: {
    color: colors.white,
  },
  text_secondary: {
    color: colors.white,
  },
  text_outline: {
    color: colors.govBlue,
  },
  text_danger: {
    color: colors.white,
  },
  text_success: {
    color: colors.white,
  },

  // Text sizes
  text_small: {
    fontSize: 14,
  },
  text_medium: {
    fontSize: 16,
  },
  text_large: {
    fontSize: 17,
  },
});
