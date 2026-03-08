import { Link } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { colors, spacing, borderRadius } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <AlertCircle color={colors.textMuted} size={48} />
      <Text style={styles.title}>Page not found</Text>
      <Text style={styles.message}>
        The page you are looking for does not exist.
      </Text>
      <Link href="/home" style={styles.link}>
        <Text style={styles.linkText}>Back to Home</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  message: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  link: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  linkText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.surface,
  },
});
