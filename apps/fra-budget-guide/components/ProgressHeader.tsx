import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/constants/theme';
import ProgressBar from './ProgressBar';

// All screens in order (matching _layout.tsx routes)
const ALL_SCREENS = [
  'legal',
  'fraud-basics',
  'scenarios',
  'red-flags',
  'checklists',
  'authority',
  'reporting',
  'whistleblower',
  'myths',
  'pledge',
  'resources',
] as const;

interface ProgressHeaderProps {
  /** List of completed channel/screen IDs */
  completedScreens: string[];
  /** Current screen ID (to show position) */
  currentScreen?: string;
}

export default function ProgressHeader({
  completedScreens,
  currentScreen,
}: ProgressHeaderProps) {
  const completed = completedScreens.length;
  const total = ALL_SCREENS.length;
  const currentIndex = currentScreen
    ? ALL_SCREENS.indexOf(currentScreen as (typeof ALL_SCREENS)[number])
    : -1;

  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityValue={{ now: completed, min: 0, max: total }}>
      <View style={styles.textRow}>
        <Text style={styles.label}>
          {completed} of {total} sections completed
        </Text>
        {currentIndex >= 0 && (
          <Text style={styles.position}>
            Section {currentIndex + 1}/{total}
          </Text>
        )}
      </View>
      <ProgressBar
        current={completed}
        max={total}
        color={completed === total ? colors.success : colors.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  textRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textMuted,
  },
  position: {
    fontSize: 13,
    color: colors.textFaint,
  },
});
