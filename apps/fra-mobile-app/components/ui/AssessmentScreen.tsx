/**
 * AssessmentScreen Component
 *
 * Reusable wrapper for assessment screens with consistent layout
 * Eliminates ~150 lines of duplicate layout code
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ViewStyle,
} from 'react-native';
import { useRouter } from 'expo-router';
import colors from '@/constants/colors';
import { Button } from './Button';
import { SyncStatus } from './SyncStatus';
import { useAssessment } from '@/contexts/AssessmentContext';

export interface AssessmentScreenProps {
  /** Screen title/intro text */
  title: string;
  /** Main content (questions, inputs, etc.) */
  children: React.ReactNode;
  /** Next screen route */
  nextRoute?: string;
  /** Previous screen route */
  previousRoute?: string;
  /** Custom next button text */
  nextButtonText?: string;
  /** Custom previous button text */
  previousButtonText?: string;
  /** Custom next handler (overrides nextRoute navigation) */
  onNext?: () => void;
  /** Custom previous handler (overrides previousRoute navigation) */
  onPrevious?: () => void;
  /** Disable next button */
  disableNext?: boolean;
  /** Show loading on next button */
  loadingNext?: boolean;
  /** Hide next button */
  hideNext?: boolean;
  /** Hide previous button */
  hidePrevious?: boolean;
  /** Custom content container style */
  contentStyle?: ViewStyle;
  /** Show progress indicator */
  progress?: {
    current: number;
    total: number;
  };
}

export function AssessmentScreen({
  title,
  children,
  nextRoute,
  previousRoute,
  nextButtonText = 'Next',
  previousButtonText = 'Back',
  onNext,
  onPrevious,
  disableNext = false,
  loadingNext = false,
  hideNext = false,
  hidePrevious = true,
  contentStyle,
  progress,
}: AssessmentScreenProps) {
  const router = useRouter();
  const { syncStatus, isOnline, syncQueue } = useAssessment();

  const handleNext = () => {
    if (onNext) {
      onNext();
    } else if (nextRoute) {
      router.push(nextRoute as any);
    }
  };

  const handlePrevious = () => {
    if (onPrevious) {
      onPrevious();
    } else if (previousRoute) {
      router.push(previousRoute as any);
    } else {
      router.back();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, contentStyle]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Progress Indicator */}
        {progress && (
          <View style={styles.progressContainer}>
            <View
              style={styles.progressBar}
              accessibilityRole="progressbar"
              accessibilityValue={{
                min: 0,
                max: progress.total,
                now: progress.current
              }}
              accessibilityLabel={`Progress: Step ${progress.current} of ${progress.total}`}
            >
              <View
                style={[
                  styles.progressFill,
                  { width: `${(progress.current / progress.total) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {progress.current} of {progress.total}
            </Text>
          </View>
        )}

        {/* Sync Status */}
        {(syncStatus.state !== 'synced' || !isOnline) && (
          <SyncStatus
            state={syncStatus.state}
            lastSync={syncStatus.lastSync}
            isOnline={isOnline}
            queueCount={syncQueue.length}
            errorMessage={syncStatus.errorMessage}
            compact
          />
        )}

        {/* Title */}
        <Text
          style={styles.title}
          accessibilityRole="header"
        >
          {title}
        </Text>

        {/* Main Content */}
        <View style={styles.content}>{children}</View>

        {/* Navigation Buttons */}
        <View style={styles.buttonContainer}>
          {!hidePrevious && (
            <Button
              onPress={handlePrevious}
              variant="outline"
              fullWidth={hideNext}
              style={!hideNext ? styles.halfButton : undefined}
            >
              {previousButtonText}
            </Button>
          )}

          {!hideNext && (
            <Button
              onPress={handleNext}
              variant="primary"
              disabled={disableNext}
              loading={loadingNext}
              fullWidth={hidePrevious}
              style={!hidePrevious ? styles.halfButton : undefined}
            >
              {nextButtonText}
            </Button>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 8,
    backgroundColor: colors.govGrey4,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.govBlue,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: colors.govGrey2,
    textAlign: 'right',
  },
  title: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 24,
  },
  content: {
    marginBottom: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  halfButton: {
    flex: 1,
  },
});
