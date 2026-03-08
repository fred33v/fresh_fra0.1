/**
 * QuestionGroup Component
 *
 * Reusable question group with radio options
 * Eliminates ~200 lines of duplicate code across assessment modules
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import colors from '@/constants/colors';
import { RadioOption } from './RadioOption';

export interface QuestionOption<T> {
  value: T;
  label: string;
  description?: string;
}

export interface QuestionGroupProps<T> {
  /** Question text */
  question: string;
  /** Optional hint/description below the question */
  hint?: string;
  /** Array of options to display */
  options: QuestionOption<T>[];
  /** Currently selected value */
  value: T | null;
  /** Callback when an option is selected */
  onChange: (value: T) => void;
  /** Disable all options */
  disabled?: boolean;
  /** Custom style for the container */
  containerStyle?: ViewStyle;
  /** Show required indicator */
  required?: boolean;
  /** Error message to display */
  error?: string;
}

export function QuestionGroup<T extends string | number>({
  question,
  hint,
  options,
  value,
  onChange,
  disabled = false,
  containerStyle,
  required = false,
  error,
}: QuestionGroupProps<T>) {
  const accessibilityLabel = `${question}${required ? ', required' : ''}`;
  const hasError = Boolean(error);

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.header}>
        <Text
          style={styles.questionText}
          accessibilityLabel={accessibilityLabel}
        >
          {question}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
        {hint && <Text style={styles.hint}>{hint}</Text>}
      </View>

      <View
        style={styles.optionsContainer}
        accessibilityRole="radiogroup"
        accessibilityLabel={question}
      >
        {options.map((option, index) => (
          <RadioOption
            key={`${String(option.value)}-${index}`}
            value={option.value}
            label={option.label}
            description={option.description}
            selected={value === option.value}
            onPress={onChange}
            disabled={disabled}
          />
        ))}
      </View>

      {hasError && (
        <Text
          style={styles.errorText}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
        >
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 28,
  },
  header: {
    marginBottom: 12,
  },
  questionText: {
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
  optionsContainer: {
    // Options rendered here
  },
  errorText: {
    fontSize: 14,
    color: colors.govRed,
    marginTop: 8,
    fontWeight: '600' as const,
  },
});
