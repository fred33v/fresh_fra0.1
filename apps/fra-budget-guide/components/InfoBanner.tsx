import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertCircle, Info, AlertTriangle, CheckCircle } from 'lucide-react-native';
import { colors, spacing, borderRadius } from '@/constants/theme';

type BannerVariant = 'info' | 'warning' | 'danger' | 'success';

interface InfoBannerProps {
  message: string;
  variant?: BannerVariant;
  /** Show icon (default: true) */
  showIcon?: boolean;
}

const variantConfig = {
  info: {
    bg: colors.primaryLight,
    text: colors.primary,
    icon: Info,
  },
  warning: {
    bg: colors.warningLight,
    text: colors.warningDarker,
    icon: AlertTriangle,
  },
  danger: {
    bg: colors.danger,
    text: colors.surface,
    icon: AlertCircle,
  },
  success: {
    bg: colors.success,
    text: colors.surface,
    icon: CheckCircle,
  },
} as const;

export default function InfoBanner({
  message,
  variant = 'info',
  showIcon = true,
}: InfoBannerProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <View
      style={[styles.banner, { backgroundColor: config.bg }]}
      accessibilityRole="alert"
    >
      {showIcon && (
        <Icon color={config.text} size={20} style={styles.icon} />
      )}
      <Text style={[styles.text, { color: config.text }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  icon: {
    marginRight: spacing.sm,
    flexShrink: 0,
  },
  text: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
  },
});
