import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { useAssessment } from '@/contexts/AssessmentContext';
import { AssessmentScreen, ScaleQuestion } from '@/components/ui';
import { BarChart3, TrendingUp, AlertTriangle } from 'lucide-react-native';
import colors from '@/constants/colors';
import type { ScaleValue } from '@/types/assessment';

export default function MonitoringEvaluationScreen() {
  const { assessment, updateAssessment } = useAssessment();
  const [responsiblePerson, setResponsiblePerson] = useState(assessment.monitoringEvaluation.responsiblePerson);
  const [notes, setNotes] = useState(assessment.monitoringEvaluation.notes);

  const handleNext = () => {
    updateAssessment({
      monitoringEvaluation: {
        ...assessment.monitoringEvaluation,
        notes,
        responsiblePerson,
        fraudIncidentsDetected: parseInt(assessment.monitoringEvaluation.fraudIncidentsDetected?.toString() || '0'),
        suspiciousTradeDetected: parseInt(assessment.monitoringEvaluation.suspiciousTradeDetected?.toString() || '0'),
        fraudRiskLikelihood: assessment.monitoringEvaluation.fraudRiskLikelihood,
      },
    });
  };

  return (
    <AssessmentScreen
      title="Monitoring & Evaluation"
      nextRoute="/fraud-response"
      previousRoute="/training-awareness"
      hidePrevious={false}
      progress={{ current: 11, total: 13 }}
      onNext={handleNext}
    >
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <AlertTriangle size={20} color={colors.govBlue} />
          <Text style={styles.sectionTitle}>Incident Tracking</Text>
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.label}>Fraud Incidents Detected (Last 12 months)</Text>
          <TextInput
            style={styles.input}
            value={assessment.monitoringEvaluation.fraudIncidentsDetected?.toString() || '0'}
            onChangeText={(val) =>
              updateAssessment({
                monitoringEvaluation: {
                  ...assessment.monitoringEvaluation,
                  fraudIncidentsDetected: parseInt(val) || 0,
                },
              })
            }
            placeholder="Number of incidents"
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.inputSection}>
          <Text style={styles.label}>Suspicious Trades or Anomalies Detected</Text>
          <TextInput
            style={styles.input}
            value={assessment.monitoringEvaluation.suspiciousTradeDetected?.toString() || '0'}
            onChangeText={(val) =>
              updateAssessment({
                monitoringEvaluation: {
                  ...assessment.monitoringEvaluation,
                  suspiciousTradeDetected: parseInt(val) || 0,
                },
              })
            }
            placeholder="Number of anomalies"
            keyboardType="number-pad"
          />
        </View>
      </View>

      <ScaleQuestion
        question="Based on current controls, what is the likelihood of undetected fraud occurring?"
        minLabel="Very low likelihood"
        maxLabel="Very high likelihood"
        value={assessment.monitoringEvaluation.fraudRiskLikelihood}
        onChange={(value) =>
          updateAssessment({
            monitoringEvaluation: { ...assessment.monitoringEvaluation, fraudRiskLikelihood: value },
          })
        }
      />

      <View style={styles.section}>
        <Text style={styles.label}>Responsible Person</Text>
        <Text style={styles.hint}>
          Who is responsible for monitoring and evaluation oversight?
        </Text>
        <TextInput
          style={styles.input}
          value={responsiblePerson}
          onChangeText={setResponsiblePerson}
          placeholder="e.g. Head of Internal Audit, CFO"
          placeholderTextColor={colors.govGrey3}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Key Observations & Notes</Text>
        <Text style={styles.hint}>
          Describe current monitoring practices or planned improvements
        </Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Enter monitoring and evaluation details..."
          placeholderTextColor={colors.govGrey3}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
      </View>
    </AssessmentScreen>
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
const styles = StyleSheet.create({
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
  inputSection: {
    marginBottom: 16,
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
});

});
