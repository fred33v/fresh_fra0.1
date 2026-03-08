import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors, spacing, borderRadius } from '@/constants/theme';

interface ChecklistItemProps {
  label: string;
  checked: boolean;
  onToggle?: () => void;
  /** Description text below the label */
  description?: string;
  /** Read-only mode (no toggle) */
  readOnly?: boolean;
}

export default function ChecklistItem({
  label,
  checked,
  onToggle,
  description,
  readOnly = false,
}: ChecklistItemProps) {
  const content = (
    <>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Check color={colors.surface} size={14} />}
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.label, checked && styles.labelChecked]}>{label}</Text>
        {description && (
          <Text style={styles.description}>{description}</Text>
        )}
      </View>
    </>
  );

  if (readOnly || !onToggle) {
    return (
      <View style={styles.container} accessibilityRole="checkbox" accessibilityState={{ checked }}>
        {content}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onToggle}
      activeOpacity={0.7}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm / 2,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  textContainer: {
    flex: 1,
  },
  label: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 21,
  },
  labelChecked: {
    textDecorationLine: 'line-through',
    color: colors.textMuted,
  },
  description: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: 2,
  },
});
