import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAssessment } from '@/contexts/AssessmentContext';
import { GraduationCap, Users, Briefcase } from 'lucide-react-native';
import { CurrencyQuestion } from '@/components/ui';
import colors from '@/constants/colors';

export default function TrainingAwarenessScreen() {
  const router = useRouter();
  const { assessment, updateAssessment } = useAssessment();
  const [notes, setNotes] = useState(assessment.trainingAwareness.notes);
  const [completionRate, setCompletionRate] = useState(
    assessment.trainingAwareness.overallCompletionRate?.toString() || '0'
  );

  const handleNext = () => {
    updateAssessment({
      trainingAwareness: {
        ...assessment.trainingAwareness,
        notes,
        overallCompletionRate: parseFloat(completionRate) || 0,
        mandatoryCompletedCount: parseInt(assessment.trainingAwareness.mandatoryCompletedCount?.toString() || '0'),
        specialistCompletedCount: parseInt(assessment.trainingAwareness.specialistCompletedCount?.toString() || '0'),
        boardCompletedCount: parseInt(assessment.trainingAwareness.boardCompletedCount?.toString() || '0'),
      },
    });
    router.push('/monitoring-evaluation');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <GraduationCap size={32} color={colors.govBlue} />
          <Text style={styles.title} accessibilityRole="header">Training & Awareness</Text>
        </View>

        <Text style={styles.intro}>
          Effective fraud prevention requires regular training and awareness programs for all staff levels.
        </Text>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Users size={20} color={colors.govBlue} />
            <Text style={styles.sectionTitle}>Mandatory Training</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Organisation-wide Training</Text>
            <Text style={styles.cardDesc}>All staff must complete annual fraud awareness training covering:</Text>
            <Text style={styles.listItem}>• Fraud risk awareness</Text>
            <Text style={styles.listItem}>• Reporting procedures</Text>
            <Text style={styles.listItem}>• Ethical conduct</Text>
            <Text style={styles.listItem}>• Real-world case studies</Text>
            <View style={styles.targetBadge}>
              <Text style={styles.targetText}>Target: 95% completion rate</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Briefcase size={20} color={colors.warningOrange} />
            <Text style={styles.sectionTitle}>Specialist Training</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Finance, Procurement & HR Teams</Text>
            <Text style={styles.cardDesc}>Specialist training tailored to high-risk areas:</Text>
            <Text style={styles.listItem}>• Advanced fraud detection techniques</Text>
            <Text style={styles.listItem}>• Payment verification procedures</Text>
            <Text style={styles.listItem}>• Supplier due diligence</Text>
            <Text style={styles.listItem}>• Payroll integrity checks</Text>
            <View style={styles.frequencyBadge}>
              <Text style={styles.frequencyText}>Frequency: Annually</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <GraduationCap size={20} color={colors.successGreen} />
            <Text style={styles.sectionTitle}>Board Training</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Executive & Board Members</Text>
            <Text style={styles.cardDesc}>Leadership training covering:</Text>
            <Text style={styles.listItem}>• Governance responsibilities</Text>
            <Text style={styles.listItem}>• GovS-013 & ECCTA 2023 compliance</Text>
            <Text style={styles.listItem}>• Strategic fraud risk oversight</Text>
            <Text style={styles.listItem}>• Tone from the top</Text>
            <View style={styles.frequencyBadge}>
              <Text style={styles.frequencyText}>Frequency: Every 2 years</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Staff Completing Mandatory Training</Text>
          <TextInput
            style={styles.input}
            value={assessment.trainingAwareness.mandatoryCompletedCount?.toString() || '0'}
            onChangeText={(val) =>
              updateAssessment({
                trainingAwareness: { ...assessment.trainingAwareness, mandatoryCompletedCount: parseInt(val) || 0 },
              })
            }
            placeholder="Number of staff"
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Staff Completing Specialist Training</Text>
          <TextInput
            style={styles.input}
            value={assessment.trainingAwareness.specialistCompletedCount?.toString() || '0'}
            onChangeText={(val) =>
              updateAssessment({
                trainingAwareness: { ...assessment.trainingAwareness, specialistCompletedCount: parseInt(val) || 0 },
              })
            }
            placeholder="Number of staff"
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Board Members Completing Training</Text>
          <TextInput
            style={styles.input}
            value={assessment.trainingAwareness.boardCompletedCount?.toString() || '0'}
            onChangeText={(val) =>
              updateAssessment({
                trainingAwareness: { ...assessment.trainingAwareness, boardCompletedCount: parseInt(val) || 0 },
              })
            }
            placeholder="Number of board members"
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Overall Training Completion Rate (%)</Text>
          <TextInput
            style={styles.input}
            value={completionRate}
            onChangeText={setCompletionRate}
            placeholder="e.g. 92"
            placeholderTextColor={colors.govGrey3}
            keyboardType="numeric"
            accessibilityLabel="Overall Training Completion Rate percentage"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Training Notes</Text>
          <Text style={styles.hint}>
            Describe current training programs, challenges, or planned improvements
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Enter training program details..."
            placeholderTextColor={colors.govGrey3}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            accessibilityLabel="Training Notes"
          />
        </View>

        <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Continue to Monitoring and Evaluation">
          <Text style={styles.nextButtonText}>Continue to Monitoring & Evaluation</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.govGrey1,
  },
  intro: {
    fontSize: 16,
    color: colors.govGrey2,
    marginBottom: 24,
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.govGrey1,
  },
  card: {
    backgroundColor: colors.lightBlue,
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.govBlue,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 14,
    color: colors.govGrey2,
    marginBottom: 12,
  },
  listItem: {
    fontSize: 14,
    color: colors.govGrey1,
    marginBottom: 6,
    paddingLeft: 8,
  },
  targetBadge: {
    backgroundColor: colors.successGreen,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  targetText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.white,
  },
  frequencyBadge: {
    backgroundColor: colors.warningOrange,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  frequencyText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.white,
  },
  label: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 8,
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
    minHeight: 120,
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
