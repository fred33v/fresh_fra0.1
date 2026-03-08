import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAssessment } from '@/contexts/AssessmentContext';
import { Star } from 'lucide-react-native';
import colors from '@/constants/colors';

export default function FeedbackScreen() {
  const router = useRouter();
  const { submitFeedback } = useAssessment();
  const [rating, setRating] = useState<number | null>(null);
  const [whatWorkedWell, setWhatWorkedWell] = useState('');
  const [improvements, setImprovements] = useState('');
  const [consentFollowUp, setConsentFollowUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = () => {
    if (!rating) {
      Alert.alert('Rating Required', 'Please select a rating before submitting');
      return;
    }

    setIsSubmitting(true);
    try {
      submitFeedback({
        rating,
        whatWorkedWell,
        improvements,
        consentFollowUp,
      });

      Alert.alert(
        'Thank You!',
        'Your feedback has been submitted. We appreciate you taking the time to help us improve.',
        [
          {
            text: 'Return to Home',
            onPress: () => router.push('/'),
          },
        ]
      );
    } catch {
      Alert.alert('Submission Failed', 'Unable to submit feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    router.push('/');
  };

  const ratingLabels = [
    'Not useful',
    'Slightly useful',
    'Moderately useful',
    'Very useful',
    'Extremely useful',
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro} accessibilityRole="header">Your feedback</Text>
        <Text style={styles.subtitle}>
          Help us improve this Fraud Risk Assessment app by sharing your experience.
        </Text>

        <View style={styles.ratingSection}>
          <Text style={styles.questionText}>How useful was this FRA Health Check overall?</Text>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                style={styles.starButton}
                onPress={() => setRating(star)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Rate ${star} out of 5, ${ratingLabels[star - 1]}`}
                accessibilityState={{ selected: rating === star }}
              >
                <Star
                  size={40}
                  color={rating && rating >= star ? colors.govYellow : colors.govGrey3}
                  fill={rating && rating >= star ? colors.govYellow : 'transparent'}
                  strokeWidth={2}
                />
              </TouchableOpacity>
            ))}
          </View>
          {rating !== null && (
            <Text style={styles.ratingLabel}>{ratingLabels[rating - 1]}</Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>What worked well for you?</Text>
          <Text style={styles.hint}>Optional</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={whatWorkedWell}
            onChangeText={setWhatWorkedWell}
            placeholder="Tell us what you liked about the assessment..."
            placeholderTextColor={colors.govGrey3}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            accessibilityLabel="What worked well for you"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>What could we improve or add?</Text>
          <Text style={styles.hint}>Optional</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={improvements}
            onChangeText={setImprovements}
            placeholder="Share your suggestions for improvement..."
            placeholderTextColor={colors.govGrey3}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            accessibilityLabel="What could we improve or add"
          />
        </View>

        <TouchableOpacity
          style={styles.consentContainer}
          onPress={() => setConsentFollowUp(!consentFollowUp)}
          activeOpacity={0.7}
          accessibilityRole="checkbox"
          accessibilityLabel="I am happy to be contacted about my feedback"
          accessibilityState={{ checked: consentFollowUp }}
        >
          <View style={styles.checkbox}>
            {consentFollowUp && <View style={styles.checkboxInner} />}
          </View>
          <Text style={styles.consentText}>
            I&apos;m happy to be contacted about my feedback
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Submit Feedback"
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>Submit Feedback</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Skip for now">
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </TouchableOpacity>
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
  intro: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.govGrey2,
    marginBottom: 24,
    lineHeight: 22,
  },
  ratingSection: {
    marginBottom: 28,
    alignItems: 'center',
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 16,
    textAlign: 'center' as const,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  starButton: {
    padding: 4,
  },
  ratingLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.govBlue,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    color: colors.govGrey2,
    marginBottom: 8,
    fontStyle: 'italic' as const,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.govGrey1,
    borderRadius: 4,
    padding: 12,
    fontSize: 16,
    color: colors.govGrey1,
    backgroundColor: colors.white,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  consentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    padding: 12,
    backgroundColor: colors.govGrey4,
    borderRadius: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.govGrey1,
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxInner: {
    width: 14,
    height: 14,
    backgroundColor: colors.govBlue,
    borderRadius: 2,
  },
  consentText: {
    flex: 1,
    fontSize: 15,
    color: colors.govGrey1,
  },
  submitButton: {
    backgroundColor: colors.govBlue,
    borderRadius: 4,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.white,
  },
  skipButton: {
    alignItems: 'center',
    padding: 12,
  },
  skipButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.govGrey2,
    textDecorationLine: 'underline' as const,
  },
});
