/**
 * TextArea Component
 *
 * Reusable text area input with label and hint
 * Eliminates ~30 lines of duplicate input code
 */

import React from 'react';
import { View, Text, StyleSheet, TextInput, ViewStyle, TextStyle } from 'react-native';
import colors from '@/constants/colors';

export interface TextAreaProps {
  /** Input label */
  label: string;
  /** Optional hint below label */
  hint?: string;
  /** Current value */
  value: string;
  /** Change handler */
  onChangeText: (text: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Number of lines to show */
  numberOfLines?: number;
  /** Disable input */
  disabled?: boolean;
  /** Show required indicator */
  required?: boolean;
  /** Maximum character length */
  maxLength?: number;
  /** Show character count */
  showCount?: boolean;
  /** Custom container style */
  containerStyle?: ViewStyle;
  /** Custom input style */
  inputStyle?: TextStyle;
  /** Test ID for testing */
  testID?: string;
  /** Error message to display */
  error?: string;
}

export function TextArea({
  label,
  hint,
  value,
  onChangeText,
  placeholder = 'Enter details...',
  numberOfLines = 4,
  disabled = false,
  required = false,
  maxLength,
  showCount = false,
  containerStyle,
  inputStyle,
  testID,
  error,
}: TextAreaProps) {
  const characterCount = value.length;
  const showCharacterCount = showCount || (maxLength !== undefined);
  const hasError = Boolean(error);

  // Build accessible label
  const accessibilityLabel = `${label}${required ? ', required' : ''}`;
  const accessibilityHint = hint || (maxLength ? `Maximum ${maxLength} characters` : undefined);

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.header}>
        <Text
          style={styles.label}
          accessibilityLabel={accessibilityLabel}
        >
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
        {hint && <Text style={styles.hint}>{hint}</Text>}
      </View>

      <TextInput
        style={[
          styles.input,
          disabled && styles.inputDisabled,
          hasError && styles.inputError,
          inputStyle,
        ]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.govGrey3}
        multiline
        numberOfLines={numberOfLines}
        textAlignVertical="top"
        editable={!disabled}
        maxLength={maxLength}
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
      />

      {hasError && (
        <Text
          style={styles.errorText}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      )}

      {showCharacterCount && (
        <Text
          style={styles.characterCount}
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${characterCount}${maxLength !== undefined ? ` of ${maxLength}` : ''} characters`}
        >
          {characterCount}
          {maxLength !== undefined && ` / ${maxLength}`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.govGrey1,
  },
  required: {
    color: colors.govRed,
  },
  hint: {
    fontSize: 14,
    color: colors.govGrey2,
    marginTop: 4,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.govGrey1,
    borderRadius: 4,
    padding: 12,
    fontSize: 16,
    color: colors.govGrey1,
    backgroundColor: colors.white,
    minHeight: 100,
    paddingTop: 12,
  },
  inputDisabled: {
    backgroundColor: colors.govGrey4,
    color: colors.govGrey3,
  },
  inputError: {
    borderColor: colors.govRed,
    borderWidth: 3,
  },
  errorText: {
    fontSize: 14,
    color: colors.govRed,
    marginTop: 8,
    fontWeight: '600' as const,
  },
  characterCount: {
    fontSize: 12,
    color: colors.govGrey2,
    textAlign: 'right',
    marginTop: 4,
  },
});
