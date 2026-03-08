import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/constants/theme';
import ProgressBar from './ProgressBar';

// All sections in order for the training app (7 sections)
// IDs match the numeric string IDs passed by the app ('0' through '6')
const ALL_SECTIONS = ['0', '1', '2', '3', '4', '5', '6'] as const;

const TOTAL_SECTIONS = ALL_SECTIONS.length;

interface ProgressHeaderProps {
  /** List of completed section IDs */
  completedScreens: string[];
  /** Current screen ID (to show position) */
  currentScreen?: string;
}

export default function ProgressHeader({
  completedScreens,
  currentScreen,
}: ProgressHeaderProps) {
  const completed = completedScreens.length;
  const currentIndex = currentScreen
    ? ALL_SECTIONS.indexOf(currentScreen as (typeof ALL_SECTIONS)[number])
    : -1;

  return (
    <View style={styles.container} accessibilityRole="progressbar" accessibilityValue={{ now: completed, min: 0, max: TOTAL_SECTIONS }}>
      <View style={styles.textRow}>
        <Text style={styles.label}>
          {completed} of {TOTAL_SECTIONS} sections completed
        </Text>
        {currentIndex >= 0 && (
          <Text style={styles.position}>
            Section {currentIndex + 1}/{TOTAL_SECTIONS}
          </Text>
        )}
      </View>
      <ProgressBar
        current={completed}
        max={TOTAL_SECTIONS}
        color={completed === TOTAL_SECTIONS ? colors.success : colors.primary}
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
