import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, borderRadius } from '@/constants/theme';

interface ProgressBarProps {
  /** Current progress (0 to max) */
  current: number;
  /** Maximum value */
  max: number;
  /** Optional label (e.g. "5 of 13 completed") */
  label?: string;
  /** Bar color (default: primary) */
  color?: string;
}

export default function ProgressBar({
  current,
  max,
  label,
  color = colors.primary,
}: ProgressBarProps) {
  const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0;

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.track}>
        <View
          style={[styles.fill, { width: `${percentage}%`, backgroundColor: color }]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  track: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
});
