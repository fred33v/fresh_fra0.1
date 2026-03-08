import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';

interface SectionCardProps {
  title: string;
  children: React.ReactNode;
  /** Optional icon component */
  icon?: React.ComponentType<{ color: string; size: number }>;
  /** Icon background color (default: primaryLight) */
  iconBgColor?: string;
  /** Icon color (default: primary) */
  iconColor?: string;
  /** Make the card pressable with a chevron */
  onPress?: () => void;
  /** Subtitle below the title */
  subtitle?: string;
}

export default function SectionCard({
  title,
  children,
  icon: Icon,
  iconBgColor = colors.primaryLight,
  iconColor = colors.primary,
  onPress,
  subtitle,
}: SectionCardProps) {
  const header = (
    <View style={styles.header}>
      {Icon && (
        <View style={[styles.iconCircle, { backgroundColor: iconBgColor }]}>
          <Icon color={iconColor} size={24} />
        </View>
      )}
      <View style={styles.headerText}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {onPress && <ChevronRight color={colors.textMuted} size={20} />}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        {header}
        {children}
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.card}>
      {header}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: 2,
  },
});
