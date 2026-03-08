import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { DocumentControl, ActionItem } from '@/types/assessment';
import colors from '@/constants/colors';

interface ExecutiveSummaryProps {
  organisationName: string;
  documentControl: DocumentControl;
  overallRiskRating: string;
  totalRisks: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  topPriorityActions: ActionItem[];
}

export default function ExecutiveSummary({
  organisationName,
  documentControl,
  overallRiskRating,
  totalRisks,
  highRiskCount,
  mediumRiskCount,
  lowRiskCount,
  topPriorityActions,
}: ExecutiveSummaryProps) {
  return (
    <>
      <View style={styles.fraHeaderCard}>
        <Text style={styles.fraTitle}>COMPREHENSIVE FRAUD RISK ASSESSMENT</Text>
        <Text style={styles.fraSubtitle}>Version 2.0</Text>
        <Text style={styles.fraStandards}>Aligned with UK GovS-013, Fraud Prevention Standard &amp; ECCTA 2023</Text>
      </View>

      <View style={styles.documentControlCard}>
        <Text style={styles.sectionTitle}>DOCUMENT CONTROL</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Organisation:</Text>
          <Text style={styles.infoValue}>{organisationName}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Version:</Text>
          <Text style={styles.infoValue}>{documentControl.version}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Last Updated:</Text>
          <Text style={styles.infoValue}>{new Date(documentControl.lastUpdated).toLocaleDateString('en-GB')}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Classification:</Text>
          <Text style={styles.infoValue}>{documentControl.classification}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Retention Period:</Text>
          <Text style={styles.infoValue}>{documentControl.retentionPeriod}</Text>
        </View>
      </View>

      <View style={styles.executiveSummaryCard}>
        <Text style={styles.sectionTitle}>EXECUTIVE SUMMARY</Text>

        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>Purpose</Text>
          <Text style={styles.bodyText}>This assessment identifies, evaluates, and prioritizes fraud risks and establishes proportionate prevention procedures.</Text>
        </View>

        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>Standards Applied</Text>
          <Text style={styles.bodyText}>{'\u2022'} GovS-013 Counter Fraud Standard</Text>
          <Text style={styles.bodyText}>{'\u2022'} Fraud Prevention Standard</Text>
          <Text style={styles.bodyText}>{'\u2022'} ECCTA 2023 &quot;Failure to Prevent Fraud&quot; offence</Text>
        </View>

        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>Overall Risk Rating</Text>
          <View style={[
            styles.riskBadge,
            overallRiskRating === 'High' && { backgroundColor: colors.errorRed },
            overallRiskRating === 'Medium' && { backgroundColor: colors.warningOrange },
            overallRiskRating === 'Low' && { backgroundColor: colors.govGreen },
          ]}>
            <Text style={styles.riskBadgeText}>{overallRiskRating}</Text>
          </View>
        </View>

        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>Key Findings</Text>
          <Text style={styles.bodyText}>Risks Identified: {totalRisks}</Text>
          <View style={styles.priorityRow}>
            <View style={styles.priorityBadgeHigh}>
              <Text style={styles.priorityBadgeSmallText}>High: {highRiskCount}</Text>
            </View>
            <View style={styles.priorityBadgeMedium}>
              <Text style={styles.priorityBadgeSmallText}>Medium: {mediumRiskCount}</Text>
            </View>
            <View style={styles.priorityBadgeLow}>
              <Text style={styles.priorityBadgeSmallText}>Low: {lowRiskCount}</Text>
            </View>
          </View>
        </View>

        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>Top Priority Recommendations</Text>
          {topPriorityActions.slice(0, 3).map((action) => (
            <Text key={action.id} style={styles.bodyText}>{'\u2022'} {action.title}</Text>
          ))}
          {topPriorityActions.length === 0 && (
            <>
              <Text style={styles.bodyText}>{'\u2022'} Strengthen procurement controls and supplier due diligence</Text>
              <Text style={styles.bodyText}>{'\u2022'} Implement continuous transaction monitoring</Text>
              <Text style={styles.bodyText}>{'\u2022'} Introduce updated whistleblowing portal</Text>
            </>
          )}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fraHeaderCard: {
    backgroundColor: colors.govBlue,
    borderRadius: 8,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center' as const,
  },
  fraTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.white,
    textAlign: 'center' as const,
    marginBottom: 4,
  },
  fraSubtitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.white,
    marginBottom: 8,
  },
  fraStandards: {
    fontSize: 12,
    color: colors.white,
    textAlign: 'center' as const,
    opacity: 0.9,
  },
  documentControlCard: {
    backgroundColor: colors.govGrey4,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  executiveSummaryCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.govBlue,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.govGrey1,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.govGrey2,
    fontWeight: '600' as const,
  },
  infoValue: {
    fontSize: 14,
    color: colors.govGrey1,
  },
  subsection: {
    marginBottom: 16,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 14,
    color: colors.govGrey1,
    lineHeight: 20,
    marginBottom: 4,
  },
  riskBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    alignSelf: 'flex-start' as const,
  },
  riskBadgeText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.white,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap' as const,
  },
  priorityBadgeHigh: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.errorRed,
    borderRadius: 12,
  },
  priorityBadgeMedium: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.warningOrange,
    borderRadius: 12,
  },
  priorityBadgeLow: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.govGreen,
    borderRadius: 12,
  },
  priorityBadgeSmallText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: colors.white,
  },
});
