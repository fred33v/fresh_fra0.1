import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertTriangle, CheckCircle } from 'lucide-react-native';
import ScreenContainer from '@/components/ScreenContainer';
import ScenarioOption from '@/components/ScenarioOption';
import ActionButton from '@/components/ActionButton';
import InfoBanner from '@/components/InfoBanner';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';
import { useTraining } from '@/contexts/TrainingContext';
import { scenarioExercise } from '@/constants/data/scenarioExercise';

type Phase = 'intro' | 'step' | 'summary';

export default function ScenarioScreen() {
  const router = useRouter();
  const { saveScenarioChoice, completeSection } = useTraining();

  const [phase, setPhase] = useState<Phase>('intro');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [choices, setChoices] = useState<Record<string, string>>({});

  const totalSteps = scenarioExercise.steps.length;
  const currentStep = scenarioExercise.steps[currentStepIndex];

  const handleBeginScenario = () => {
    setPhase('step');
  };

  const handleSelectOption = (optionId: string) => {
    if (isRevealed) return;
    setSelectedOptionId(optionId);
    setIsRevealed(true);

    const stepId = currentStep.id;
    saveScenarioChoice(stepId, optionId);
    setChoices((prev) => ({ ...prev, [stepId]: optionId }));
  };

  const handleNextStep = () => {
    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex((prev) => prev + 1);
      setSelectedOptionId(null);
      setIsRevealed(false);
    } else {
      setPhase('summary');
    }
  };

  const handleComplete = async () => {
    await completeSection(5);
    router.back();
  };

  // Calculate score for summary
  const getScore = () => {
    let correct = 0;
    for (const step of scenarioExercise.steps) {
      const choiceId = choices[step.id];
      const option = step.options.find((o) => o.id === choiceId);
      if (option?.isCorrect) correct++;
    }
    return correct;
  };

  if (phase === 'intro') {
    return (
      <ScreenContainer>
        <View style={styles.introSection}>
          <View style={styles.iconContainer}>
            <AlertTriangle color={colors.warning} size={48} />
          </View>
          <Text style={styles.scenarioTitle}>{scenarioExercise.title}</Text>
          <Text style={styles.introText}>{scenarioExercise.introduction}</Text>
          <InfoBanner
            message="You will work through a realistic scenario and make decisions at key points."
            variant="info"
          />
          <View style={styles.beginButton}>
            <ActionButton
              label="Begin Scenario"
              onPress={handleBeginScenario}
            />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  if (phase === 'summary') {
    const score = getScore();
    const allCorrect = score === totalSteps;

    return (
      <ScreenContainer>
        <View style={styles.summarySection}>
          <View style={styles.summaryIconContainer}>
            <CheckCircle
              color={allCorrect ? colors.success : colors.warning}
              size={48}
            />
          </View>
          <Text style={styles.summaryTitle}>Scenario Complete</Text>
          <Text style={styles.summaryScore}>
            You answered {score} of {totalSteps} decisions correctly
          </Text>

          {/* Review choices */}
          {scenarioExercise.steps.map((step, index) => {
            const choiceId = choices[step.id];
            const chosenOption = step.options.find((o) => o.id === choiceId);
            const correctOption = step.options.find((o) => o.isCorrect);
            const wasCorrect = chosenOption?.isCorrect;

            return (
              <View key={step.id} style={styles.reviewCard}>
                <Text style={styles.reviewStepLabel}>
                  Decision {index + 1}
                </Text>
                <Text style={styles.reviewDescription}>
                  {step.description}
                </Text>
                <View
                  style={[
                    styles.reviewResult,
                    {
                      backgroundColor: wasCorrect
                        ? colors.successLight
                        : colors.dangerLight,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.reviewResultText,
                      {
                        color: wasCorrect
                          ? colors.successDarker
                          : colors.danger,
                      },
                    ]}
                  >
                    Your choice: {chosenOption?.text}
                  </Text>
                  {!wasCorrect && correctOption && (
                    <Text style={styles.reviewCorrectText}>
                      Better choice: {correctOption.text}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}

          <View style={styles.continueButton}>
            <ActionButton
              label="Continue"
              onPress={handleComplete}
            />
          </View>
        </View>
      </ScreenContainer>
    );
  }

  // Step phase
  return (
    <ScreenContainer>
      <View style={styles.stepHeader}>
        <Text style={styles.stepIndicator}>
          Decision {currentStepIndex + 1} of {totalSteps}
        </Text>
        <Text style={styles.stepDescription}>
          {currentStep.description}
        </Text>
      </View>

      <View
        style={styles.optionsList}
        accessibilityRole="radiogroup"
        accessibilityLabel="Scenario options"
      >
        {currentStep.options.map((option) => (
          <View key={option.id} style={styles.optionItem}>
            <ScenarioOption
              text={option.text}
              feedback={option.feedback}
              isCorrect={option.isCorrect}
              selected={selectedOptionId === option.id}
              revealed={isRevealed}
              onPress={() => handleSelectOption(option.id)}
            />
          </View>
        ))}
      </View>

      {isRevealed && (
        <View style={styles.nextButton}>
          <ActionButton
            label={
              currentStepIndex < totalSteps - 1
                ? 'Next Decision'
                : 'View Summary'
            }
            onPress={handleNextStep}
          />
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  introSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  iconContainer: {
    marginBottom: spacing.sm,
  },
  scenarioTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
  },
  introText: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
    textAlign: 'center',
  },
  beginButton: {
    width: '100%',
    marginTop: spacing.md,
  },
  stepHeader: {
    marginBottom: spacing.lg,
  },
  stepIndicator: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  stepDescription: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 26,
  },
  optionsList: {
    gap: spacing.sm,
  },
  optionItem: {
    marginBottom: spacing.xs,
  },
  nextButton: {
    marginTop: spacing.lg,
  },
  summarySection: {
    alignItems: 'center',
    gap: spacing.md,
  },
  summaryIconContainer: {
    marginBottom: spacing.xs,
  },
  summaryTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  summaryScore: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  reviewCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  reviewStepLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  reviewDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  reviewResult: {
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  reviewResultText: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  reviewCorrectText: {
    fontSize: 13,
    color: colors.successDarker,
    marginTop: spacing.xs,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  continueButton: {
    width: '100%',
    marginTop: spacing.md,
  },
});
