import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/constants/theme';

interface IconBadgeProps {
  icon: React.ComponentType<{ color: string; size: number }>;
  /** Icon size (default: 24) */
  size?: number;
  /** Circle size (default: 48) */
  circleSize?: number;
  /** Background color (default: primaryLight) */
  bgColor?: string;
  /** Icon color (default: primary) */
  iconColor?: string;
}

export default function IconBadge({
  icon: Icon,
  size = 24,
  circleSize = 48,
  bgColor = colors.primaryLight,
  iconColor = colors.primary,
}: IconBadgeProps) {
  return (
    <View
      style={[
        styles.circle,
        {
          width: circleSize,
          height: circleSize,
          borderRadius: circleSize / 2,
          backgroundColor: bgColor,
        },
      ]}
    >
      <Icon color={iconColor} size={size} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
