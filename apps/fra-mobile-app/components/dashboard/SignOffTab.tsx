import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Info, FileText, Clock, HelpCircle, PenTool } from 'lucide-react-native';
import colors from '@/constants/colors';

interface SignOffTabProps {
  organisationName: string;
  totalEmployees: number;
  completedEmployees: number;
  packageName?: string;
}

export default function SignOffTab({ organisationName, totalEmployees, completedEmployees, packageName }: SignOffTabProps) {
  const router = useRouter();

  const completionPct = totalEmployees > 0 ? Math.round((completedEmployees / totalEmployees) * 100) : 0;
  const isFullyComplete = completedEmployees > 0 && completedEmployees === totalEmployees;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Sign-Off & Approvals</Text>

      <View style={styles.infoBoxWithIcon}>
        <Info size={20} color={colors.govBlue} />
        <Text style={styles.infoText}>
          This section displays signature status for your main organisational FRA assessment.
        </Text>
      </View>

      <View style={styles.signOffCardEnhanced}>
        <View style={styles.signOffHeader}>
          <View style={styles.signOffIconWrapper}>
            <FileText size={32} color={colors.govBlue} />
          </View>
          <View style={styles.signOffHeaderText}>
            <Text style={styles.signOffCardTitle}>Main Organisational FRA</Text>
            <Text style={styles.signOffAssessmentId}>{organisationName}</Text>
          </View>
        </View>

        <View style={styles.signOffProgressWrapper}>
          <Text style={styles.signOffProgressTitle}>Employee Completion</Text>
          <View style={styles.signOffProgressBar}>
            <View style={[styles.signOffProgressFill, { width: `${completionPct}%` }]} />
          </View>
          <Text style={styles.signOffProgressText}>
            {completedEmployees} of {totalEmployees} employee{totalEmployees !== 1 ? 's' : ''} completed
          </Text>
        </View>

        <View style={styles.statusBadgeContainer}>
          {isFullyComplete ? (
            <View style={[styles.statusBadgeLarge, styles.statusReady]}>
              <Clock size={16} color={colors.white} />
              <Text style={styles.statusBadgeText}>Ready for Sign-Off</Text>
            </View>
          ) : (
            <View style={[styles.statusBadgeLarge, styles.statusPending]}>
              <Clock size={16} color={colors.white} />
              <Text style={styles.statusBadgeText}>Pending Completion</Text>
            </View>
          )}
        </View>

        <View style={styles.signOffMetaInfo}>
          <View style={styles.signOffMetaRow}>
            <Text style={styles.signOffMetaLabel}>Completion Rate:</Text>
            <Text style={styles.signOffMetaValue}>{completionPct}%</Text>
          </View>
          <View style={styles.signOffMetaRow}>
            <Text style={styles.signOffMetaLabel}>Package:</Text>
            <Text style={styles.signOffMetaValue}>{packageName || 'Full'}</Text>
          </View>
          <View style={styles.signOffMetaRow}>
            <Text style={styles.signOffMetaLabel}>Organisation:</Text>
            <Text style={[styles.signOffMetaValue, { fontWeight: '600' as const }]}>{organisationName}</Text>
          </View>
        </View>

        <View style={styles.signOffHelpBox}>
          <HelpCircle size={16} color={colors.govBlue} />
          <Text style={styles.signOffHelpText}>
            Your signature confirms that you&apos;ve reviewed and approved the Fraud Risk Assessment for your organisation.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.signOffButtonPrimary}
          onPress={() => router.push('/signature')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Review and Sign Assessment"
        >
          <PenTool size={20} color={colors.white} />
          <Text style={styles.signOffButtonTextPrimary}>Review & Sign Assessment</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 16,
    letterSpacing: -0.2,
    lineHeight: 26,
  },
  infoBoxWithIcon: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: colors.lightBlue,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.govGrey1,
    lineHeight: 20,
  },
  signOffCardEnhanced: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  signOffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.govGrey4,
  },
  signOffIconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: colors.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  signOffHeaderText: {
    flex: 1,
  },
  signOffCardTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.govGrey1,
    marginBottom: 4,
  },
  signOffAssessmentId: {
    fontSize: 13,
    color: colors.govGrey2,
  },
  signOffProgressWrapper: {
    marginBottom: 20,
  },
  signOffProgressTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 8,
  },
  signOffProgressBar: {
    height: 8,
    backgroundColor: colors.govGrey4,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  signOffProgressFill: {
    height: '100%',
    backgroundColor: colors.govBlue,
    borderRadius: 4,
  },
  signOffProgressText: {
    fontSize: 12,
    color: colors.govGrey2,
  },
  statusBadgeContainer: {
    marginBottom: 20,
  },
  statusBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start' as const,
  },
  statusPending: {
    backgroundColor: colors.warningOrange,
  },
  statusReady: {
    backgroundColor: colors.govGreen,
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.white,
  },
  signOffMetaInfo: {
    backgroundColor: colors.govGrey4,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  signOffMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  signOffMetaLabel: {
    fontSize: 13,
    color: colors.govGrey2,
  },
  signOffMetaValue: {
    fontSize: 13,
    color: colors.govGrey1,
    textAlign: 'right' as const,
  },
  signOffHelpBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.lightBlue,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  signOffHelpText: {
    flex: 1,
    fontSize: 12,
    color: colors.govGrey1,
    lineHeight: 18,
  },
  signOffButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.govBlue,
    borderRadius: 8,
    paddingVertical: 16,
    gap: 10,
    shadowColor: colors.govBlue,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  signOffButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.white,
  },
});
