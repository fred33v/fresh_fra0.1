import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CheckCircle, ChevronRight } from 'lucide-react-native';
import * as Icons from 'lucide-react-native';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';
import IconBadge from './IconBadge';
import TimeBadge from './TimeBadge';

interface SectionCardProps {
  title: string;
  duration: string;
  iconName: string;
  completed: boolean;
  onPress: () => void;
}

export default function SectionCard({
  title,
  duration,
  iconName,
  completed,
  onPress,
}: SectionCardProps) {
  // Dynamically resolve the icon from lucide-react-native
  const IconComponent = (Icons as any)[iconName] ?? Icons.BookOpen;

  return (
    <TouchableOpacity
      style={[styles.card, completed && styles.cardCompleted]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${title}${completed ? ', completed' : ''}`}
    >
      <IconBadge
        icon={IconComponent}
        bgColor={completed ? colors.successLight : colors.primaryLight}
        iconColor={completed ? colors.success : colors.primary}
      />

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        <TimeBadge duration={duration} />
      </View>

      <View style={styles.trailing}>
        {completed ? (
          <CheckCircle color={colors.success} size={24} />
        ) : (
          <ChevronRight color={colors.textFaint} size={24} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  cardCompleted: {
    borderColor: colors.successLight,
    backgroundColor: colors.surface,
  },
  content: {
    flex: 1,
    marginLeft: spacing.md,
    gap: spacing.xs,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 22,
  },
  trailing: {
    marginLeft: spacing.sm,
  },
});
