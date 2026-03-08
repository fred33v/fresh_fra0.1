import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import ScreenContainer from '@/components/ScreenContainer';
import QuizOption from '@/components/QuizOption';
import ActionButton from '@/components/ActionButton';
import InfoBanner from '@/components/InfoBanner';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';
import { useTraining } from '@/contexts/TrainingContext';
import { quizQuestions } from '@/constants/data/quizQuestions';

export default function QuizScreen() {
  const { sectionId } = useLocalSearchParams<{ sectionId: string }>();
  const router = useRouter();
  const { saveQuizScore, completeSection } = useTraining();

  const sectionIdNum = parseInt(sectionId, 10);
  const question = quizQuestions[sectionIdNum];

  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);

  if (!question || isNaN(sectionIdNum)) {
    return (
      <ScreenContainer>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {isNaN(sectionIdNum) ? 'Invalid section' : 'No quiz available for this section'}
          </Text>
          <ActionButton
            label="Go Back"
            onPress={() => router.back()}
            variant="outline"
          />
        </View>
      </ScreenContainer>
    );
  }

  const handleSelectOption = (index: number) => {
    if (isRevealed) return;
    setSelectedAnswer(index);
    setIsRevealed(true);
  };

  const isCorrect = selectedAnswer === question.correctAnswer;

  const handleContinue = async () => {
    const score = isCorrect ? 1 : 0;
    await saveQuizScore(sectionIdNum, score);
    await completeSection(sectionIdNum);
    router.back();
  };

  const getOptionState = (index: number) => {
    if (!isRevealed) return 'default';
    if (index === question.correctAnswer) return 'correct';
    if (index === selectedAnswer) return 'incorrect';
    return 'default';
  };

  return (
    <ScreenContainer>
      {/* Question */}
      <View style={styles.questionCard}>
        <Text style={styles.questionLabel}>Question</Text>
        <Text style={styles.questionText}>{question.question}</Text>
      </View>

      {/* Options */}
      <View
        style={styles.optionsList}
        accessibilityRole="radiogroup"
        accessibilityLabel="Answer options"
      >
        {question.options.map((option, index) => (
          <View key={option} style={styles.optionItem}>
            <QuizOption
              label={option}
              state={getOptionState(index)}
              onPress={() => handleSelectOption(index)}
              disabled={isRevealed}
            />
          </View>
        ))}
      </View>

      {/* Explanation */}
      {isRevealed && (
        <View style={styles.explanationSection}>
          <InfoBanner
            message={
              isCorrect
                ? 'Well done! That is the correct answer.'
                : 'That is not quite right.'
            }
            variant={isCorrect ? 'success' : 'warning'}
          />
          <View style={styles.explanationCard}>
            <Text style={styles.explanationLabel}>Explanation</Text>
            <Text style={styles.explanationText}>
              {question.explanation}
            </Text>
          </View>
        </View>
      )}

      {/* Continue button */}
      {isRevealed && (
        <View style={styles.continueSection}>
          <ActionButton
            label="Continue"
            onPress={handleContinue}
          />
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  questionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  questionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 26,
  },
  optionsList: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  optionItem: {
    marginBottom: spacing.xs,
  },
  explanationSection: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  explanationCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  explanationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  explanationText: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  continueSection: {
    marginTop: spacing.sm,
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
    textAlign: 'center',
  },
});
