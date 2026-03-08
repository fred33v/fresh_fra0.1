import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAssessment } from '@/contexts/AssessmentContext';
import { CheckCircle, AlertCircle, FileCheck, TrendingUp } from 'lucide-react-native';
import colors from '@/constants/colors';

// Calculate compliance status based on assessment data
function calculateComplianceStatus(assessment: any) {
  const status = {
    govS013: { score: 0, gaps: [] as string[], actions: [] as string[] },
    fraudPreventionStandard: { score: 0, gaps: [] as string[], actions: [] as string[] },
    eccta2023: { score: 0, gaps: [] as string[], actions: [] as string[] },
  };

  // Analyse procurement controls for GovS-013
  if (assessment.procurement.controlMaturity && assessment.procurement.controlMaturity >= 4) {
    status.govS013.score += 15;
  } else if (assessment.procurement.controlMaturity && assessment.procurement.controlMaturity >= 3) {
    status.govS013.score += 10;
    status.govS013.gaps.push('Procurement control maturity below recommended level');
    status.govS013.actions.push('Enhance supplier due diligence procedures and approval workflows');
  } else {
    status.govS013.gaps.push('Weak procurement controls detected');
    status.govS013.actions.push('Implement comprehensive procurement controls framework');
  }

  // Analyse cash banking controls
  if (assessment.cashBanking.controlEffectiveness && assessment.cashBanking.controlEffectiveness >= 4) {
    status.govS013.score += 15;
  } else {
    status.govS013.gaps.push('Cash and banking controls need strengthening');
    status.govS013.actions.push('Implement daily reconciliation and segregation of duties');
  }

  // Analyse payroll controls (critical for fraud prevention)
  if (assessment.payrollHR.unauthorizedChangesDetected === 'no' && assessment.payrollHR.controlMaturity >= 3) {
    status.govS013.score += 15;
    status.fraudPreventionStandard.score += 15;
  } else if (assessment.payrollHR.unauthorizedChangesDetected === 'yes') {
    status.govS013.gaps.push('Critical: Unauthorized payroll changes detected');
    status.govS013.actions.push('URGENT: Conduct investigation and implement multi-level approval controls');
    status.fraudPreventionStandard.gaps.push('Payroll fraud risk requires immediate attention');
  } else {
    status.govS013.score += 8;
    status.fraudPreventionStandard.gaps.push('Payroll control maturity below optimal level');
  }

  // Analyse IT systems and security
  if (assessment.itSystems.cybersecurityMaturity && assessment.itSystems.cybersecurityMaturity >= 3) {
    status.eccta2023.score += 20;
  } else {
    status.eccta2023.gaps.push('Cybersecurity maturity below required standards');
    status.eccta2023.actions.push('Develop comprehensive cybersecurity incident response plan');
  }

  if (assessment.itSystems.mfaAdoption && assessment.itSystems.mfaAdoption >= 4) {
    status.eccta2023.score += 15;
  } else {
    status.eccta2023.gaps.push('Multi-factor authentication adoption insufficient');
    status.eccta2023.actions.push('Mandate MFA for all user accounts and critical systems');
  }

  // Revenue and receivables controls
  if (assessment.revenue.collectionEffectiveness && assessment.revenue.collectionEffectiveness >= 3) {
    status.fraudPreventionStandard.score += 10;
  } else {
    status.fraudPreventionStandard.gaps.push('Receivables controls need improvement');
    status.fraudPreventionStandard.actions.push('Strengthen collection procedures and credit review');
  }

  // Training and awareness (critical for all frameworks)
  if (assessment.trainingAwareness.overallCompletionRate >= 80) {
    status.govS013.score += 15;
    status.fraudPreventionStandard.score += 15;
    status.eccta2023.score += 15;
  } else {
    status.govS013.gaps.push('Training completion rates below expected levels');
    status.fraudPreventionStandard.gaps.push('Limited fraud awareness across workforce');
    status.eccta2023.gaps.push('Staff understanding of fraud prevention procedures insufficient');
  }

  // Monitoring and controls
  if (assessment.controlsTechnology.monitoring === 'regularly') {
    status.govS013.score += 10;
    status.fraudPreventionStandard.score += 10;
  } else {
    status.govS013.gaps.push('Monitoring and data checks require enhancement');
  }

  // Final status determination (max 100)
  status.govS013.score = Math.min(100, status.govS013.score);
  status.fraudPreventionStandard.score = Math.min(100, status.fraudPreventionStandard.score);
  status.eccta2023.score = Math.min(100, status.eccta2023.score);

  return status;
}

function getComplianceStatus(score: number) {
  if (score >= 80) return { label: 'Substantially Compliant', color: colors.successGreen };
  if (score >= 60) return { label: 'Partially Compliant', color: colors.warningOrange };
  return { label: 'Below Standard', color: colors.errorRed };
}

export default function ComplianceMappingScreen() {
  const router = useRouter();
  const { assessment, updateAssessment } = useAssessment();
  const [notes, setNotes] = useState(assessment.complianceMapping.notes);

  // Calculate compliance status dynamically based on assessment
  const complianceStatus = useMemo(() => calculateComplianceStatus(assessment), [assessment]);

  const handleNext = () => {
    updateAssessment({
      complianceMapping: {
        ...assessment.complianceMapping,
        notes,
        govS013: {
          status: complianceStatus.govS013.score >= 80 ? 'compliant' : complianceStatus.govS013.score >= 60 ? 'partial' : 'non-compliant',
          gaps: complianceStatus.govS013.gaps,
          actions: complianceStatus.govS013.actions,
        },
        fraudPreventionStandard: {
          status: complianceStatus.fraudPreventionStandard.score >= 80 ? 'compliant' : complianceStatus.fraudPreventionStandard.score >= 60 ? 'partial' : 'non-compliant',
          gaps: complianceStatus.fraudPreventionStandard.gaps,
          actions: complianceStatus.fraudPreventionStandard.actions,
        },
        eccta2023: {
          status: complianceStatus.eccta2023.score >= 80 ? 'compliant' : complianceStatus.eccta2023.score >= 60 ? 'partial' : 'non-compliant',
          gaps: complianceStatus.eccta2023.gaps,
          actions: complianceStatus.eccta2023.actions,
        },
      },
    });
    router.push('/fraud-response');
  };

  const govStatus = getComplianceStatus(complianceStatus.govS013.score);
  const fraudStatus = getComplianceStatus(complianceStatus.fraudPreventionStandard.score);
  const eccStatus = getComplianceStatus(complianceStatus.eccta2023.score);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TrendingUp size={32} color={colors.govBlue} />
          <Text style={styles.title} accessibilityRole="header">Compliance Assessment</Text>
        </View>

        <Text style={styles.intro}>
          Your compliance status against key UK fraudprevention standards based on your assessment responses.
        </Text>

        <View style={styles.section}>
          {/* GovS-013 */}
          <View style={[styles.standardCard, complianceStatus.govS013.score >= 80 && styles.compliantCard]}>
            <View style={styles.standardHeader}>
              <CheckCircle size={24} color={govStatus.color} />
              <Text style={styles.standardTitle}>GovS-013 Counter Fraud Standard</Text>
            </View>
            <View style={[styles.scoreBar, { backgroundColor: govStatus.color }]}>
              <Text style={styles.scoreText}>{complianceStatus.govS013.score}%</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: govStatus.color + '20' }]}>
              <Text style={[styles.statusText, { color: govStatus.color }]}>{govStatus.label}</Text>
            </View>
            {complianceStatus.govS013.gaps.length > 0 && (
              <>
                <Text style={styles.gapsTitle}>Gaps Identified:</Text>
                {complianceStatus.govS013.gaps.map((gap, i) => (
                  <Text key={i} style={styles.gapItem}>• {gap}</Text>
                ))}
              </>
            )}
            {complianceStatus.govS013.actions.length > 0 && (
              <>
                <Text style={styles.actionsTitle}>Recommended Actions:</Text>
                {complianceStatus.govS013.actions.map((action, i) => (
                  <Text key={i} style={styles.actionItem}>→ {action}</Text>
                ))}
              </>
            )}
          </View>

          {/* Fraud Prevention Standard */}
          <View style={[styles.standardCard, complianceStatus.fraudPreventionStandard.score >= 80 && styles.compliantCard]}>
            <View style={styles.standardHeader}>
              <AlertCircle size={24} color={fraudStatus.color} />
              <Text style={styles.standardTitle}>Fraud Prevention Standard</Text>
            </View>
            <View style={[styles.scoreBar, { backgroundColor: fraudStatus.color }]}>
              <Text style={styles.scoreText}>{complianceStatus.fraudPreventionStandard.score}%</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: fraudStatus.color + '20' }]}>
              <Text style={[styles.statusText, { color: fraudStatus.color }]}>{fraudStatus.label}</Text>
            </View>
            {complianceStatus.fraudPreventionStandard.gaps.length > 0 && (
              <>
                <Text style={styles.gapsTitle}>Gaps Identified:</Text>
                {complianceStatus.fraudPreventionStandard.gaps.map((gap, i) => (
                  <Text key={i} style={styles.gapItem}>• {gap}</Text>
                ))}
              </>
            )}
            {complianceStatus.fraudPreventionStandard.actions.length > 0 && (
              <>
                <Text style={styles.actionsTitle}>Recommended Actions:</Text>
                {complianceStatus.fraudPreventionStandard.actions.map((action, i) => (
                  <Text key={i} style={styles.actionItem}>→ {action}</Text>
                ))}
              </>
            )}
          </View>

          {/* ECCTA 2023 */}
          <View style={[styles.standardCard, complianceStatus.eccta2023.score >= 80 && styles.compliantCard]}>
            <View style={styles.standardHeader}>
              <CheckCircle size={24} color={eccStatus.color} />
              <Text style={styles.standardTitle}>ECCTA 2023 Aligned</Text>
            </View>
            <View style={[styles.scoreBar, { backgroundColor: eccStatus.color }]}>
              <Text style={styles.scoreText}>{complianceStatus.eccta2023.score}%</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: eccStatus.color + '20' }]}>
              <Text style={[styles.statusText, { color: eccStatus.color }]}>{eccStatus.label}</Text>
            </View>
            {complianceStatus.eccta2023.gaps.length > 0 && (
              <>
                <Text style={styles.gapsTitle}>Process Improvements Needed:</Text>
                {complianceStatus.eccta2023.gaps.map((gap, i) => (
                  <Text key={i} style={styles.gapItem}>• {gap}</Text>
                ))}
              </>
            )}
            {complianceStatus.eccta2023.actions.length > 0 && (
              <>
                <Text style={styles.actionsTitle}>Recommended Actions:</Text>
                {complianceStatus.eccta2023.actions.map((action, i) => (
                  <Text key={i} style={styles.actionItem}>→ {action}</Text>
                ))}
              </>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.summaryTitle}>Assessment Notes</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Add any additional compliance notes or context..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={4}
            placeholderTextColor={colors.lightGrey}
          />
        </View>

        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>Continue to Fraud Response Plan</Text>
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
  standardCard: {
    backgroundColor: colors.lightBlue,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.govBlue,
  },
  compliantCard: {
    borderLeftColor: colors.successGreen,
  },
  standardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  standardTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: colors.govGrey1,
    flex: 1,
  },
  scoreBar: {
    height: 30,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.white,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
  },
  gapsTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginTop: 10,
    marginBottom: 8,
  },
  gapItem: {
    fontSize: 13,
    color: colors.govGrey2,
    marginBottom: 6,
    marginLeft: 4,
  },
  actionsTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginTop: 10,
    marginBottom: 8,
  },
  actionItem: {
    fontSize: 13,
    color: colors.govGrey2,
    marginBottom: 6,
    marginLeft: 4,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 12,
  },
  notesInput: {
    backgroundColor: colors.lightGrey,
    borderRadius: 4,
    padding: 12,
    fontSize: 14,
    color: colors.govGrey1,
    minHeight: 100,
    textAlignVertical: 'top' as const,
  },
  nextButton: {
    backgroundColor: colors.govBlue,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 20,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.white,
  },
});

