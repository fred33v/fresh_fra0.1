import React from 'react';
import { StyleSheet, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import { useApp } from '@/contexts/AppContext';
import ProgressHeader from './ProgressHeader';

interface ScreenContainerProps {
  children: React.ReactNode;
  /** Disable scrolling (e.g. for screens with their own ScrollView) */
  noScroll?: boolean;
  /** Current screen ID — pass to show ProgressHeader */
  screenId?: string;
}

export default function ScreenContainer({ children, noScroll, screenId }: ScreenContainerProps) {
  const { completedChannels } = useApp();
  const completedScreenIds = completedChannels.map((c) => c.channelId);

  const progressHeader = screenId ? (
    <ProgressHeader completedScreens={completedScreenIds} currentScreen={screenId} />
  ) : null;

  if (noScroll) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.contentContainer}>
          {progressHeader}
          {children}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {progressHeader}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
});
