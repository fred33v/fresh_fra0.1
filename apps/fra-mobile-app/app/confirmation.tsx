import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Share, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useAuth } from '@/contexts/AuthContext';
import { CheckCircle2, Download, Share2 } from 'lucide-react-native';
import colors from '@/constants/colors';
import { createLogger } from '@/utils/logger';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { buildReportHtml, buildRiskRegisterCsv, fileSlug } from '@/utils/reportExport';
import {
  PaymentSummaryCard,
  EmployeeAccessCard,
  ExecutiveSummary,
  ReportSections,
} from '@/components/confirmation';

export default function ConfirmationScreen() {
  const logger = createLogger('Confirmation');
  const router = useRouter();
  const { assessment } = useAssessment();
  const { organisation } = useAuth();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const [exporting, setExporting] = useState<'pdf' | 'csv' | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const baseName = `fraud-risk-assessment-${fileSlug(assessment.organisation.name)}-${today}`;

  // Opens the system share sheet so the file can be saved to Files, emailed or sent on
  const shareFile = async (uri: string, mimeType: string, UTI: string, dialogTitle: string) => {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Sharing unavailable', 'This device cannot share files. Try again on a phone or tablet.');
      return;
    }
    await Sharing.shareAsync(uri, { mimeType, UTI, dialogTitle });
  };

  const handleDownloadReport = async () => {
    if (exporting) return;
    setExporting('pdf');
    try {
      const { uri } = await Print.printToFileAsync({ html: buildReportHtml(assessment) });
      // printToFileAsync picks a random name; give the PDF a meaningful one before sharing
      const pdf = new File(Paths.cache, `${baseName}.pdf`);
      if (pdf.exists) pdf.delete();
      new File(uri).move(pdf);
      await shareFile(pdf.uri, 'application/pdf', 'com.adobe.pdf', 'Fraud risk assessment report');
    } catch (error: unknown) {
      logger.error('PDF export failed:', error);
      Alert.alert('Export failed', 'The PDF report could not be created. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  const handleExportRegister = async () => {
    if (exporting) return;
    if (assessment.riskRegister.length === 0) {
      Alert.alert('Nothing to export', 'No risks were identified in this assessment.');
      return;
    }
    setExporting('csv');
    try {
      const csv = new File(Paths.cache, `${baseName}-risk-register.csv`);
      if (csv.exists) csv.delete();
      csv.create();
      csv.write(buildRiskRegisterCsv(assessment.riskRegister));
      await shareFile(csv.uri, 'text/csv', 'public.comma-separated-values-text', 'Risk register (CSV)');
    } catch (error: unknown) {
      logger.error('CSV export failed:', error);
      Alert.alert('Export failed', 'The risk register could not be exported. Please try again.');
    } finally {
      setExporting(null);
    }
  };

  const handleShareReport = async () => {
    try {
      await Share.share({
        message: `Fraud Risk Assessment Version 2.0 completed for ${assessment.organisation.name}.`,
        title: 'FRA Report',
      });
    } catch (error: unknown) {
      logger.error('Error sharing:', error);
    }
  };

  const packageName = assessment.payment.packageType === 'health-check'
    ? 'Health Check FRA'
    : assessment.payment.packageType === 'with-awareness'
    ? 'FRA + Awareness Briefing'
    : 'FRA + Dashboard (12 months)';

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const highRiskCount = assessment.riskRegister.filter(r => r.priority === 'high').length;
  const mediumRiskCount = assessment.riskRegister.filter(r => r.priority === 'medium').length;
  const lowRiskCount = assessment.riskRegister.filter(r => r.priority === 'low').length;
  const totalRisks = assessment.riskRegister.length;

  const overallRiskRating = highRiskCount > 3 ? 'High' : highRiskCount > 0 ? 'Medium' : 'Low';

  const showEmployeeAccess = organisation && (organisation.keyPassesAllocated ?? 0) > 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.successIcon}>
          <CheckCircle2 size={64} color={colors.govGreen} strokeWidth={2} />
        </View>

        <Text style={styles.title} accessibilityRole="header">Payment Successful!</Text>
        <Text style={styles.subtitle}>Your comprehensive fraud risk assessment is complete</Text>

        <PaymentSummaryCard
          packageName={packageName}
          price={assessment.payment.price}
          transactionId={assessment.payment.transactionId}
          date={assessment.payment.date}
        />

        {showEmployeeAccess && (
          <EmployeeAccessCard
            organisationId={organisation?.organisationId || 'unknown'}
            keyPassesAllocated={organisation?.keyPassesAllocated ?? 0}
            keyPassesUsed={organisation?.keyPassesUsed ?? 0}
            onShareError={(error) => logger.error('Error sharing link:', error)}
          />
        )}

        <ExecutiveSummary
          organisationName={assessment.organisation.name}
          documentControl={assessment.documentControl}
          overallRiskRating={overallRiskRating}
          totalRisks={totalRisks}
          highRiskCount={highRiskCount}
          mediumRiskCount={mediumRiskCount}
          lowRiskCount={lowRiskCount}
          topPriorityActions={assessment.actionPlan.highPriority}
        />

        <ReportSections
          expandedSections={expandedSections}
          onToggleSection={toggleSection}
          riskRegister={assessment.riskRegister}
          paymentsModule={assessment.paymentsModule}
          trainingAwareness={assessment.trainingAwareness}
          monitoringEvaluation={assessment.monitoringEvaluation}
          complianceMapping={assessment.complianceMapping}
          fraudResponsePlan={assessment.fraudResponsePlan}
          actionPlan={assessment.actionPlan}
        />

        <View style={styles.actionsContainer}>
          <Text style={styles.actionsTitle}>Export Options</Text>

          <TouchableOpacity style={styles.actionButton} onPress={handleDownloadReport} disabled={exporting !== null} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Download Full Report as PDF" accessibilityState={{ busy: exporting === 'pdf' }}>
            <View style={styles.actionIcon}>
              <Download size={20} color={colors.govBlue} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Download Full Report (PDF)</Text>
              <Text style={styles.actionSubtitle}>{exporting === 'pdf' ? 'Creating PDF…' : 'Complete FRA Version 2.0 document'}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleExportRegister} disabled={exporting !== null} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Export Risk Register as CSV" accessibilityState={{ busy: exporting === 'csv' }}>
            <View style={styles.actionIcon}>
              <Download size={20} color={colors.govBlue} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Export Risk Register (CSV)</Text>
              <Text style={styles.actionSubtitle}>{exporting === 'csv' ? 'Preparing CSV…' : 'For use in Excel or other tools'}</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={handleShareReport} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Share Assessment">
            <View style={styles.actionIcon}>
              <Share2 size={20} color={colors.govBlue} />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Share Assessment</Text>
              <Text style={styles.actionSubtitle}>Send details to colleagues</Text>
            </View>
          </TouchableOpacity>
        </View>

        <Text style={styles.emailNote}>
          A confirmation email with download links has been sent to your registered address.
        </Text>

        <TouchableOpacity
          style={styles.signButton}
          onPress={() => router.push('/signature')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Sign Assessment"
        >
          <Text style={styles.signButtonText}>Sign Assessment</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => router.push('/')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Return to Home"
        >
          <Text style={styles.homeButtonText}>Return to Home</Text>
        </TouchableOpacity>
      </ScrollView>
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
    paddingBottom: 40,
  },
  successIcon: {
    alignItems: 'center',
    marginVertical: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.govGrey1,
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.govGrey2,
    textAlign: 'center' as const,
    marginBottom: 24,
  },
  actionsContainer: {
    marginBottom: 20,
    marginTop: 8,
  },
  actionsTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: colors.govGrey4,
    borderRadius: 8,
    marginBottom: 10,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 14,
    color: colors.govGrey1,
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 13,
    color: colors.govGrey2,
  },
  emailNote: {
    fontSize: 13,
    color: colors.govGrey2,
    textAlign: 'center' as const,
    marginBottom: 20,
    fontStyle: 'italic' as const,
  },
  signButton: {
    backgroundColor: colors.govGreen,
    borderRadius: 4,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  signButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.white,
  },
  homeButton: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.govBlue,
    borderRadius: 4,
    padding: 16,
    alignItems: 'center',
  },
  homeButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.govBlue,
  },
});
