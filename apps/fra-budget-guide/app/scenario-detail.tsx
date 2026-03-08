import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertCircle, CheckCircle2, Eye, Shield } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import ScreenContainer from '@/components/ScreenContainer';
import ActionButton from '@/components/ActionButton';
import { colors, spacing, borderRadius } from '@/constants/theme';
import { scenarioData } from '@/constants/data/scenarios';

export default function ScenarioDetailScreen() {
  const params = useLocalSearchParams<{ category: string }>();
  const router = useRouter();
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [showFeedback, setShowFeedback] = useState<Record<string, boolean>>({});

  const categoryId = params.category || '';
  const scenarios = scenarioData[categoryId] || [];

  const handleAnswer = (scenarioId: string, optionIndex: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [scenarioId]: optionIndex }));
    setShowFeedback((prev) => ({ ...prev, [scenarioId]: true }));
  };

  if (scenarios.length === 0) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Scenario not found</Text>
      </View>
    );
  }

  return (
    <ScreenContainer>
      {scenarios.map((scenario) => (
        <View key={scenario.id} style={styles.scenarioContainer}>
          <Text style={styles.scenarioTitle}>{scenario.title}</Text>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <AlertCircle color={colors.text} size={20} />
              <Text style={styles.sectionTitle}>How It Works</Text>
            </View>
            <Text style={styles.sectionText}>{scenario.howItWorks}</Text>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Eye color={colors.danger} size={20} />
              <Text style={styles.sectionTitle}>Red Flags</Text>
            </View>
            {scenario.redFlags.map((flag) => (
              <View key={flag} style={styles.listItem}>
                <View style={styles.bulletRed} />
                <Text style={styles.listText}>{flag}</Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <CheckCircle2 color={colors.success} size={20} />
              <Text style={styles.sectionTitle}>What To Do</Text>
            </View>
            {scenario.whatToDo.map((action) => (
              <View key={action} style={styles.listItem}>
                <View style={styles.bulletGreen} />
                <Text style={styles.listText}>{action}</Text>
              </View>
            ))}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Shield color={colors.primary} size={20} />
              <Text style={styles.sectionTitle}>Controls</Text>
            </View>
            {scenario.controls.map((control) => (
              <View key={control} style={styles.listItem}>
                <View style={styles.bulletBlue} />
                <Text style={styles.listText}>{control}</Text>
              </View>
            ))}
          </View>

          <View style={styles.exampleCard}>
            <Text style={styles.exampleTitle}>Real Example</Text>
            <Text style={styles.exampleText}>{scenario.example}</Text>
          </View>

          {scenario.decision && (
            <View style={styles.decisionCard}>
              <Text style={styles.decisionPrompt}>{scenario.decision.prompt}</Text>
              <View style={styles.optionsContainer}>
                {scenario.decision.options.map((option, index) => {
                  const isSelected = selectedAnswers[scenario.id] === index;
                  const showResult = showFeedback[scenario.id];
                  const isCorrect = option.correct;

                  return (
                    <View key={option.text}>
                      <TouchableOpacity
                        style={[
                          styles.optionButton,
                          isSelected && showResult && isCorrect && styles.optionButtonCorrect,
                          isSelected && showResult && !isCorrect && styles.optionButtonWrong,
                        ]}
                        onPress={() => handleAnswer(scenario.id, index)}
                        disabled={showFeedback[scenario.id]}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`Answer option: ${option.text}`}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            isSelected && showResult && styles.optionTextSelected,
                          ]}
                        >
                          {option.text}
                        </Text>
                      </TouchableOpacity>
                      {isSelected && showResult && (
                        <View
                          style={[
                            styles.feedbackCard,
                            isCorrect ? styles.feedbackCorrect : styles.feedbackWrong,
                          ]}
                        >
                          <Text style={styles.feedbackText}>{option.feedback}</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      ))}

      <ActionButton
        label="View Approval Checklists"
        onPress={() => router.push('/checklists')}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  scenarioContainer: {
    marginBottom: spacing.xl,
  },
  scenarioTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 20,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginLeft: spacing.sm,
  },
  sectionText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  listItem: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    paddingLeft: spacing.sm,
  },
  listText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  bulletRed: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.danger,
    marginTop: 7,
    marginRight: 10,
  },
  bulletGreen: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginTop: 7,
    marginRight: 10,
  },
  bulletBlue: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 7,
    marginRight: 10,
  },
  exampleCard: {
    backgroundColor: colors.warningLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  exampleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.warningDarker,
    marginBottom: spacing.sm,
  },
  exampleText: {
    fontSize: 14,
    color: colors.warningDarkest,
    lineHeight: 20,
  },
  decisionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  decisionPrompt: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.borderLight,
    padding: 14,
  },
  optionButtonCorrect: {
    borderColor: colors.success,
    backgroundColor: colors.successLight,
  },
  optionButtonWrong: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerLight,
  },
  optionText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 19,
  },
  optionTextSelected: {
    fontWeight: '600',
  },
  feedbackCard: {
    borderRadius: borderRadius.sm,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  feedbackCorrect: {
    backgroundColor: colors.successLight,
  },
  feedbackWrong: {
    backgroundColor: colors.dangerLight,
  },
  feedbackText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
});
