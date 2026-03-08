import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Clock } from 'lucide-react-native';
import { colors, spacing, borderRadius } from '@/constants/theme';

interface TimeBadgeProps {
  duration: string;
}

export default function TimeBadge({ duration }: TimeBadgeProps) {
  return (
    <View style={styles.pill}>
      <Clock color={colors.primary} size={12} />
      <Text style={styles.text}>{duration}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    gap: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary,
  },
});
