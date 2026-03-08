import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { colors, spacing, borderRadius } from '@/constants/theme';

type OptionState = 'default' | 'selected' | 'correct' | 'incorrect';

interface QuizOptionProps {
  label: string;
  state?: OptionState;
  onPress?: () => void;
  disabled?: boolean;
}

const stateConfig = {
  default: {
    bg: colors.surface,
    border: colors.border,
    text: colors.text,
  },
  selected: {
    bg: colors.primaryLight,
    border: colors.primary,
    text: colors.primary,
  },
  correct: {
    bg: colors.successLight,
    border: colors.success,
    text: colors.successDarker,
  },
  incorrect: {
    bg: colors.dangerLight,
    border: colors.danger,
    text: colors.danger,
  },
} as const;

export default function QuizOption({
  label,
  state = 'default',
  onPress,
  disabled = false,
}: QuizOptionProps) {
  const config = stateConfig[state];
  const showIcon = state === 'correct' || state === 'incorrect';

  return (
    <TouchableOpacity
      style={[
        styles.option,
        {
          backgroundColor: config.bg,
          borderColor: config.border,
        },
      ]}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected: state === 'selected', disabled }}
    >
      <Text style={[styles.label, { color: config.text }]}>{label}</Text>
      {showIcon && (
        <View style={styles.iconContainer}>
          {state === 'correct' ? (
            <Check color={colors.success} size={20} />
          ) : (
            <X color={colors.danger} size={20} />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 48,
  },
  label: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
  },
  iconContainer: {
    marginLeft: spacing.sm,
  },
});
