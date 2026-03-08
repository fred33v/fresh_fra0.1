import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAssessment } from '@/contexts/AssessmentContext';
import colors from '@/constants/colors';
import type { OrganisationType, EmployeeCount } from '@/types/assessment';

export default function OrganisationScreen() {
  const router = useRouter();
  const { assessment, updateAssessment } = useAssessment();
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const orgTypes: { value: OrganisationType; label: string }[] = [
    { value: 'charity', label: 'Charity / not-for-profit' },
    { value: 'public-sector', label: 'Public sector (NHS, council, etc.)' },
    { value: 'private-sme', label: 'Private company (SME)' },
    { value: 'large-corporate', label: 'Large corporate / group' },
  ];

  const employeeCounts: { value: EmployeeCount; label: string }[] = [
    { value: '1-10', label: '1–10' },
    { value: '11-50', label: '11–50' },
    { value: '51-100', label: '51–100' },
    { value: '101-250', label: '101–250' },
    { value: '251-1000', label: '251–1,000' },
    { value: '1001+', label: '1,001+' },
  ];

  const handleNext = () => {
    const newErrors: Record<string, boolean> = {};
    if (!assessment.organisation.name.trim()) newErrors.name = true;
    if (!assessment.organisation.type) newErrors.type = true;
    if (!assessment.organisation.employeeCount) newErrors.employeeCount = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    router.push('/risk-appetite');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro} accessibilityRole="header">Tell us about your organisation</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Organisation name *</Text>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            value={assessment.organisation.name}
            onChangeText={(text) => {
              updateAssessment({ organisation: { ...assessment.organisation, name: text } });
              setErrors((prev) => ({ ...prev, name: false }));
            }}
            placeholder="Enter organisation name"
            placeholderTextColor={colors.govGrey3}
            accessibilityLabel="Organisation name"
          />
          {errors.name && <Text style={styles.errorText}>Please enter organisation name</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Type of organisation *</Text>
          {orgTypes.map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.radioOption,
                assessment.organisation.type === type.value && styles.radioOptionSelected,
              ]}
              onPress={() => {
                updateAssessment({ organisation: { ...assessment.organisation, type: type.value } });
                setErrors((prev) => ({ ...prev, type: false }));
              }}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityLabel={type.label}
              accessibilityState={{ selected: assessment.organisation.type === type.value }}
            >
              <View style={styles.radio}>
                {assessment.organisation.type === type.value && <View style={styles.radioInner} />}
              </View>
              <Text style={[styles.radioText, assessment.organisation.type === type.value && styles.radioTextSelected]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
          {errors.type && <Text style={styles.errorText}>Please select organisation type</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Number of employees *</Text>
          {employeeCounts.map((count) => (
            <TouchableOpacity
              key={count.value}
              style={[
                styles.radioOption,
                assessment.organisation.employeeCount === count.value && styles.radioOptionSelected,
              ]}
              onPress={() => {
                updateAssessment({ organisation: { ...assessment.organisation, employeeCount: count.value } });
                setErrors((prev) => ({ ...prev, employeeCount: false }));
              }}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityLabel={`${count.label} employees`}
              accessibilityState={{ selected: assessment.organisation.employeeCount === count.value }}
            >
              <View style={styles.radio}>
                {assessment.organisation.employeeCount === count.value && <View style={styles.radioInner} />}
              </View>
              <Text style={[styles.radioText, assessment.organisation.employeeCount === count.value && styles.radioTextSelected]}>
                {count.label}
              </Text>
            </TouchableOpacity>
          ))}
          {errors.employeeCount && <Text style={styles.errorText}>Please select employee count</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Main country or region of operation</Text>
          <TextInput
            style={styles.input}
            value={assessment.organisation.region}
            onChangeText={(text) => updateAssessment({ organisation: { ...assessment.organisation, region: text } })}
            placeholder="e.g. United Kingdom, England, Wales"
            placeholderTextColor={colors.govGrey3}
            accessibilityLabel="Main country or region of operation"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Main activities or services</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={assessment.organisation.activities}
            onChangeText={(text) => updateAssessment({ organisation: { ...assessment.organisation, activities: text } })}
            placeholder="Briefly describe what your organisation does"
            placeholderTextColor={colors.govGrey3}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            accessibilityLabel="Main activities or services"
          />
        </View>

        <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Next">
          <Text style={styles.nextButtonText}>Next</Text>
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
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 24,
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 8,
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
  inputError: {
    borderColor: colors.errorRed,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: colors.govGrey1,
    borderRadius: 4,
    marginBottom: 8,
    backgroundColor: colors.white,
  },
  radioOptionSelected: {
    borderColor: colors.govBlue,
    backgroundColor: colors.lightBlue,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.govGrey1,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.govBlue,
  },
  radioText: {
    flex: 1,
    fontSize: 16,
    color: colors.govGrey1,
  },
  radioTextSelected: {
    color: colors.govBlue,
    fontWeight: '600' as const,
  },
  errorText: {
    fontSize: 14,
    color: colors.errorRed,
    marginTop: 4,
  },
  nextButton: {
    backgroundColor: colors.govBlue,
    borderRadius: 4,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  nextButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.white,
  },
});
