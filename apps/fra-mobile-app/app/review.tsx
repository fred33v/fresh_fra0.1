import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useAssessment } from '@/contexts/AssessmentContext';
import { ChevronRight, Building2, Target, AlertTriangle, ShoppingCart, Banknote, Users2, TrendingUp, Monitor, Heart, Shield, DollarSign, GraduationCap, BarChart3, FileCheck, AlertOctagon, ListChecks } from 'lucide-react-native';
import colors from '@/constants/colors';

export default function ReviewScreen() {
  const router = useRouter();
  const { assessment, submitAssessment } = useAssessment();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = () => {
    Alert.alert(
      'Submit Assessment',
      'Are you sure you want to submit your assessment? You can still edit your answers afterwards.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', onPress: performSubmit },
      ]
    );
  };

  const performSubmit = async () => {
    setIsSubmitting(true);
    try {
      submitAssessment();
      if (assessment.payment?.packageType) {
        router.push('/payment');
      } else {
        router.push('/packages');
      }
    } catch {
      Alert.alert(
        'Submission Failed',
        'Unable to submit your assessment. Your answers are saved locally and will sync when possible.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSectionSummary = (section: string): string => {
    switch (section) {
      case 'organisation':
        return assessment.organisation.name || 'Not completed';
      case 'riskAppetite':
        return assessment.riskAppetite.tolerance ? `${assessment.riskAppetite.tolerance} tolerance` : 'Not completed';
      case 'fraudTriangle':
        return assessment.fraudTriangle.pressure ? `${assessment.fraudTriangle.pressure} pressure` : 'Not completed';
      default:
        return 'Completed';
    }
  };

  const coreSections = [
    { icon: Building2, title: 'Organisation Details', route: '/organisation', key: 'organisation' },
    { icon: Target, title: 'Risk Appetite', route: '/risk-appetite', key: 'riskAppetite' },
    { icon: AlertTriangle, title: 'Fraud Triangle', route: '/fraud-triangle', key: 'fraudTriangle' },
    { icon: ShoppingCart, title: 'Procurement', route: '/procurement', key: 'procurement' },
    { icon: Banknote, title: 'Cash & Banking', route: '/cash-banking', key: 'cashBanking' },
    { icon: Users2, title: 'Payroll & HR', route: '/payroll-hr', key: 'payrollHR' },
    { icon: TrendingUp, title: 'Revenue', route: '/revenue', key: 'revenue' },
    { icon: Monitor, title: 'IT Systems', route: '/it-systems', key: 'itSystems' },
    { icon: Heart, title: 'People & Culture', route: '/people-culture', key: 'peopleCulture' },
    { icon: Shield, title: 'Controls & Technology', route: '/controls-technology', key: 'controlsTechnology' },
  ];

  const comprehensiveSections = [
    { icon: DollarSign, title: 'Payments Risk Module', route: '/payments-module', key: 'paymentsModule' },
    { icon: GraduationCap, title: 'Training & Awareness', route: '/training-awareness', key: 'trainingAwareness' },
    { icon: BarChart3, title: 'Monitoring & Evaluation', route: '/monitoring-evaluation', key: 'monitoringEvaluation' },
    { icon: FileCheck, title: 'Compliance Mapping', route: '/compliance-mapping', key: 'complianceMapping' },
    { icon: AlertOctagon, title: 'Fraud Response Plan', route: '/fraud-response', key: 'fraudResponsePlan' },
    { icon: ListChecks, title: 'Action Plan', route: '/action-plan', key: 'actionPlan' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.intro} accessibilityRole="header">Review your answers before submitting</Text>
        <Text style={styles.subtitle}>Tap any section to edit your responses</Text>

        <Text style={styles.groupTitle}>Core Assessment</Text>
        <View style={styles.sectionsContainer}>
          {coreSections.map((section, index) => {
            const IconComponent = section.icon;
            return (
              <TouchableOpacity
                key={section.key}
                style={styles.sectionCard}
                onPress={() => router.push(section.route as Href)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${section.title}, ${getSectionSummary(section.key)}`}
              >
                <View style={styles.sectionIcon}>
                  <IconComponent size={20} color={colors.govBlue} />
                </View>
                <View style={styles.sectionContent}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.sectionSummary}>{getSectionSummary(section.key)}</Text>
                </View>
                <ChevronRight size={20} color={colors.govGrey3} />
              </TouchableOpacity>
            );
          })}
        </View>

        {assessment.priorities && (
          <View style={styles.prioritiesCard}>
            <Text style={styles.prioritiesTitle}>Your Priorities</Text>
            <Text style={styles.prioritiesText}>{assessment.priorities}</Text>
            <TouchableOpacity
              style={styles.editLink}
              onPress={() => router.push('/priorities')}
              accessibilityRole="button"
              accessibilityLabel="Edit priorities"
            >
              <Text style={styles.editLinkText}>Edit priorities</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.groupTitle}>Comprehensive FRA Modules</Text>
        <View style={styles.sectionsContainer}>
          {comprehensiveSections.map((section, index) => {
            const IconComponent = section.icon;
            return (
              <TouchableOpacity
                key={section.key}
                style={styles.sectionCard}
                onPress={() => router.push(section.route as Href)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${section.title}, Completed`}
              >
                <View style={styles.sectionIcon}>
                  <IconComponent size={20} color={colors.govBlue} />
                </View>
                <View style={styles.sectionContent}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={styles.sectionSummary}>Completed</Text>
                </View>
                <ChevronRight size={20} color={colors.govGrey3} />
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Submit and Continue"
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>Submit and Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  intro: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.govGrey2,
    marginBottom: 24,
  },
  groupTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.govGrey1,
    marginBottom: 12,
    marginTop: 20,
  },
  sectionsContainer: {
    gap: 12,
  },
  sectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.govGrey4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.govGrey3,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  sectionContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 2,
  },
  sectionSummary: {
    fontSize: 14,
    color: colors.govGrey2,
  },
  prioritiesCard: {
    marginTop: 20,
    padding: 16,
    backgroundColor: colors.lightBlue,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.govBlue,
  },
  prioritiesTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.govBlue,
    marginBottom: 8,
  },
  prioritiesText: {
    fontSize: 15,
    color: colors.govGrey1,
    lineHeight: 22,
    marginBottom: 12,
  },
  editLink: {
    alignSelf: 'flex-start',
  },
  editLinkText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.govBlue,
    textDecorationLine: 'underline' as const,
  },
  footer: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.govGrey3,
  },
  submitButton: {
    backgroundColor: colors.govGreen,
    borderRadius: 4,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.white,
  },
});
