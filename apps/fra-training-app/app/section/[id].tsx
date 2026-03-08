import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CheckCircle } from 'lucide-react-native';
import ScreenContainer from '@/components/ScreenContainer';
import KeyPointItem from '@/components/KeyPointItem';
import TimeBadge from '@/components/TimeBadge';
import InfoBanner from '@/components/InfoBanner';
import ActionButton from '@/components/ActionButton';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';
import { useTraining } from '@/contexts/TrainingContext';
import { workshopSections, sectionContent } from '@/constants/data/workshopContent';

export default function SectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { completedSections, completeSection } = useTraining();

  const sectionId = parseInt(id, 10);
  const section = workshopSections.find((s) => s.id === sectionId);
  const content = sectionContent[sectionId];
  const isCompleted = completedSections.includes(sectionId);

  if (!section || !content) {
    return (
      <ScreenContainer>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Section not found</Text>
          <ActionButton label="Back to Home" onPress={() => router.back()} variant="outline" />
        </View>
      </ScreenContainer>
    );
  }

  const handleQuiz = () => {
    router.push(`/quiz/${sectionId}`);
  };

  const handleScenario = () => {
    router.push('/scenario');
  };

  const handleActionPlan = () => {
    router.push('/action-plan');
  };

  const handleMarkComplete = async () => {
    await completeSection(sectionId);
    router.back();
  };

  const handleBackToHome = () => {
    router.navigate('/home');
  };

  const renderBottomAction = () => {
    if (isCompleted) {
      return (
        <View style={styles.completedSection}>
          <View style={styles.completedBadge}>
            <CheckCircle color={colors.success} size={20} />
            <Text style={styles.completedText}>Completed</Text>
          </View>
          <ActionButton
            label="Back to Home"
            onPress={handleBackToHome}
            variant="outline"
          />
        </View>
      );
    }

    // Section 0: Welcome — mark as complete directly
    if (sectionId === 0) {
      return (
        <ActionButton
          label="Mark as Complete"
          onPress={handleMarkComplete}
        />
      );
    }

    // Sections 1-4: Quiz-based sections
    if (sectionId >= 1 && sectionId <= 4) {
      return (
        <ActionButton
          label="Take the Quiz"
          onPress={handleQuiz}
        />
      );
    }

    // Section 5: Case study and scenario
    if (sectionId === 5) {
      return (
        <ActionButton
          label="Start Scenario"
          onPress={handleScenario}
        />
      );
    }

    // Section 6: Action planning
    if (sectionId === 6) {
      return (
        <ActionButton
          label="Create Action Plan"
          onPress={handleActionPlan}
        />
      );
    }

    return null;
  };

  return (
    <ScreenContainer>
      {/* Section header */}
      <View style={styles.header}>
        <Text style={styles.title}>{content.title}</Text>
        <Text style={styles.subtitle}>{content.subtitle}</Text>
        <View style={styles.badgeRow}>
          <TimeBadge duration={section.duration} />
          {isCompleted && (
            <View style={styles.completedPill}>
              <CheckCircle color={colors.success} size={14} />
              <Text style={styles.completedPillText}>Completed</Text>
            </View>
          )}
        </View>
      </View>

      {/* Key points */}
      <View style={styles.keyPointsSection}>
        <Text style={styles.sectionHeading}>Key Points</Text>
        <View
          style={styles.keyPointsCard}
          accessibilityRole="list"
          accessibilityLabel="Key points"
        >
          {content.keyPoints.map((point) => (
            <View key={point} accessibilityRole="none">
              <KeyPointItem text={point} />
            </View>
          ))}
        </View>
      </View>

      {/* Discussion prompt */}
      <View style={styles.discussionSection}>
        <Text style={styles.sectionHeading}>Discussion Prompt</Text>
        <InfoBanner message={content.discussionPrompt} variant="info" />
      </View>

      {/* Bottom navigation */}
      <View style={styles.bottomAction}>
        {renderBottomAction()}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 24,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  completedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    gap: 4,
  },
  completedPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
  },
  keyPointsSection: {
    marginBottom: spacing.lg,
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  keyPointsCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  discussionSection: {
    marginBottom: spacing.xl,
  },
  bottomAction: {
    marginTop: spacing.sm,
  },
  completedSection: {
    gap: spacing.md,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  completedText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.success,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
