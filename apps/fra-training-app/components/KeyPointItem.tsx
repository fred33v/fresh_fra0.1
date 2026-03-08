import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CheckCircle } from 'lucide-react-native';
import { colors, spacing } from '@/constants/theme';

interface KeyPointItemProps {
  text: string;
}

export default function KeyPointItem({ text }: KeyPointItemProps) {
  return (
    <View style={styles.container}>
      <CheckCircle color={colors.success} size={20} style={styles.icon} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.xs,
  },
  icon: {
    marginRight: spacing.sm,
    marginTop: 2,
    flexShrink: 0,
  },
  text: {
    flex: 1,
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
});
