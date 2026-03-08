import { useRouter } from 'expo-router';
import { Award } from 'lucide-react-native';
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '@/components/ScreenContainer';
import ProgressHeader from '@/components/ProgressHeader';
import SectionCard from '@/components/SectionCard';
import ActionButton from '@/components/ActionButton';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';
import { useTraining } from '@/contexts/TrainingContext';
import { workshopSections } from '@/constants/data/workshopContent';

export default function HomeScreen() {
  const router = useRouter();
  const { completedSections, isComplete, isLoading } = useTraining();

  const handleSectionPress = (sectionId: number) => {
    router.push(`/section/${sectionId}`);
  };

  const handleViewCertificate = () => {
    router.push('/certificate');
  };

  if (isLoading) {
    return (
      <ScreenContainer>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Training Dashboard</Text>
        <Text style={styles.subtitle}>
          Fraud Risk Awareness Workshop
        </Text>
      </View>

      {/* Progress */}
      <View style={styles.progressSection}>
        <ProgressHeader
          completedScreens={completedSections.map(String)}
          currentScreen={undefined}
        />
      </View>

      {/* Section list */}
      <View style={styles.sectionList} accessibilityRole="list">
        {workshopSections.map((section) => (
          <View key={section.id} style={styles.sectionItem} accessibilityRole="none">
            <SectionCard
              title={section.title}
              duration={section.duration}
              iconName={section.icon}
              completed={completedSections.includes(section.id)}
              onPress={() => handleSectionPress(section.id)}
            />
          </View>
        ))}
      </View>

      {/* Certificate button */}
      {isComplete && (
        <View style={styles.certificateSection}>
          <View style={styles.certificateCard}>
            <Award color={colors.success} size={32} />
            <Text style={styles.certificateTitle}>
              All sections completed!
            </Text>
            <Text style={styles.certificateSubtitle}>
              You have completed all training sections. View your certificate of completion.
            </Text>
            <View style={styles.certificateButton}>
              <ActionButton
                label="View Certificate"
                onPress={handleViewCertificate}
              />
            </View>
          </View>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  progressSection: {
    marginBottom: spacing.lg,
  },
  sectionList: {
    gap: spacing.sm,
  },
  sectionItem: {
    marginBottom: spacing.sm,
  },
  certificateSection: {
    marginTop: spacing.xl,
  },
  certificateCard: {
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.success,
    ...shadows.md,
  },
  certificateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.successDarker,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  certificateSubtitle: {
    fontSize: 14,
    color: colors.successDarker,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  certificateButton: {
    width: '100%',
  },
});
