/**
 * RadioOption Component
 *
 * Reusable radio button option for assessment screens
 * Eliminates ~100 lines of duplicate code across 13 assessment modules
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import colors from '@/constants/colors';

export interface RadioOptionProps<T> {
  /** The value of this option */
  value: T;
  /** Display label for the option */
  label: string;
  /** Whether this option is currently selected */
  selected: boolean;
  /** Callback when option is pressed */
  onPress: (value: T) => void;
  /** Optional description text below the label */
  description?: string;
  /** Disable the option */
  disabled?: boolean;
  /** Custom style for the container */
  containerStyle?: ViewStyle;
}

export function RadioOption<T extends string | number>({
  value,
  label,
  selected,
  onPress,
  description,
  disabled = false,
  containerStyle,
}: RadioOptionProps<T>) {
  const handlePress = () => {
    if (!disabled) {
      onPress(value);
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        selected && styles.containerSelected,
        disabled && styles.containerDisabled,
        containerStyle,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{
        selected,
        disabled
      }}
      accessibilityHint={description}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View
        style={[
          styles.radio,
          selected && styles.radioSelected,
          disabled && styles.radioDisabled,
        ]}
      >
        {selected && <View style={styles.radioInner} />}
      </View>

      <View style={styles.textContainer}>
        <Text
          style={[
            styles.label,
            selected && styles.labelSelected,
            disabled && styles.labelDisabled,
          ]}
        >
          {label}
        </Text>

        {description && (
          <Text style={[styles.description, disabled && styles.descriptionDisabled]}>
            {description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderWidth: 2,
    borderColor: colors.govGrey1,
    borderRadius: 4,
    marginBottom: 8,
    backgroundColor: colors.white,
  },
  containerSelected: {
    borderColor: colors.govBlue,
    backgroundColor: colors.lightBlue,
  },
  containerDisabled: {
    opacity: 0.5,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.govGrey1,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  radioSelected: {
    borderColor: colors.govBlue,
  },
  radioDisabled: {
    borderColor: colors.govGrey3,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.govBlue,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    color: colors.govGrey1,
  },
  labelSelected: {
    color: colors.govBlue,
    fontWeight: '600' as const,
  },
  labelDisabled: {
    color: colors.govGrey3,
  },
  description: {
    fontSize: 14,
    color: colors.govGrey2,
    marginTop: 4,
  },
  descriptionDisabled: {
    color: colors.govGrey3,
  },
});
