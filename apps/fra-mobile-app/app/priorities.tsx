import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAssessment } from '@/contexts/AssessmentContext';
import colors from '@/constants/colors';

export default function PrioritiesScreen() {
  const router = useRouter();
  const { assessment, updateAssessment } = useAssessment();

  const handleNext = () => {
    router.push('/payments-module');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro} accessibilityRole="header">What matters most to you?</Text>
        <Text style={styles.subtitle}>
          Describe the 2–3 most important things you want to protect or improve
        </Text>

        <View style={styles.field}>
          <Text style={styles.hint}>
            For example: donations, public trust, regulators, staff morale, cash flow
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={assessment.priorities}
            onChangeText={(text) => updateAssessment({ priorities: text })}
            placeholder="Enter your priorities here..."
            placeholderTextColor={colors.govGrey3}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            accessibilityLabel="Your priorities"
          />
        </View>

        <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Review Answers">
          <Text style={styles.nextButtonText}>Review Answers</Text>
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
    fontSize: 16,
    color: colors.govGrey2,
    marginBottom: 24,
    lineHeight: 22,
  },
  field: {
    marginBottom: 24,
  },
  hint: {
    fontSize: 14,
    color: colors.govGrey2,
    marginBottom: 12,
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
    minHeight: 140,
    paddingTop: 12,
  },
  nextButton: {
    backgroundColor: colors.govBlue,
    borderRadius: 4,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.white,
  },
});
