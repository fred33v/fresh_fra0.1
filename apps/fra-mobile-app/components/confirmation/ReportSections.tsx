import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertTriangle, DollarSign, GraduationCap, BarChart3, FileCheck, AlertOctagon, ListChecks } from 'lucide-react-native';
import type {
  RiskRegisterItem,
  PaymentsModule,
  TrainingAwareness,
  MonitoringEvaluation,
  ComplianceMapping,
  FraudResponsePlan,
  ActionPlan,
} from '@/types/assessment';
import colors from '@/constants/colors';
import ExpandableReportSection from './ExpandableReportSection';

interface ReportSectionsProps {
  expandedSections: Record<string, boolean>;
  onToggleSection: (section: string) => void;
  riskRegister: RiskRegisterItem[];
  paymentsModule: PaymentsModule;
  trainingAwareness: TrainingAwareness;
  monitoringEvaluation: MonitoringEvaluation;
  complianceMapping: ComplianceMapping;
  fraudResponsePlan: FraudResponsePlan;
  actionPlan: ActionPlan;
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'compliant': return 'Compliant';
    case 'partially-compliant': return 'Partially Compliant';
    case 'non-compliant': return 'Non-Compliant';
    default: return 'Not Assessed';
  }
}

function getStatusColor(status: string): { backgroundColor: string } {
  switch (status) {
    case 'compliant': return { backgroundColor: colors.govGreen };
    case 'partially-compliant': return { backgroundColor: colors.warningOrange };
    case 'non-compliant': return { backgroundColor: colors.errorRed };
    default: return { backgroundColor: colors.govGrey2 };
  }
}

export default function ReportSections({
  expandedSections,
  onToggleSection,
  riskRegister,
  paymentsModule,
  trainingAwareness,
  monitoringEvaluation,
  complianceMapping,
  fraudResponsePlan,
  actionPlan,
}: ReportSectionsProps) {
  return (
    <>
      {/* FRAUD RISK REGISTER */}
      <ExpandableReportSection
        title="FRAUD RISK REGISTER"
        icon={<AlertTriangle size={20} color={colors.govBlue} />}
        expanded={!!expandedSections.riskRegister}
        onToggle={() => onToggleSection('riskRegister')}
        accessibilityLabel="Fraud Risk Register"
      >
        {riskRegister.map((risk) => (
          <View key={risk.id} style={styles.riskItem}>
            <View style={styles.riskHeader}>
              <Text style={styles.riskId}>{risk.id}</Text>
              <View style={[
                styles.priorityBadgeSmall,
                risk.priority === 'high' && { backgroundColor: colors.errorRed },
                risk.priority === 'medium' && { backgroundColor: colors.warningOrange },
                risk.priority === 'low' && { backgroundColor: colors.govGreen },
              ]}>
                <Text style={styles.priorityBadgeSmallText}>{risk.priority.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.riskTitle}>{risk.title}</Text>
            <Text style={styles.riskArea}>Area: {risk.area}</Text>
            <Text style={styles.riskDescription}>{risk.description}</Text>
            <View style={styles.riskScores}>
              <Text style={styles.scoreText}>Inherent: {risk.inherentScore}/25</Text>
              <Text style={styles.scoreText}>Residual: {risk.residualScore}/25</Text>
            </View>
            <Text style={styles.riskOwner}>Owner: {risk.suggestedOwner}</Text>
          </View>
        ))}
      </ExpandableReportSection>

      {/* PAYMENTS RISK MODULE */}
      <ExpandableReportSection
        title="PAYMENTS RISK MODULE"
        icon={<DollarSign size={20} color={colors.govBlue} />}
        expanded={!!expandedSections.payments}
        onToggle={() => onToggleSection('payments')}
        accessibilityLabel="Payments Risk Module"
      >
        <Text style={styles.moduleTitle}>Overview</Text>
        <Text style={styles.bodyText}>Payments represent one of the highest-exposure fraud areas. This module provides full analysis of payment-related risks, controls, monitoring requirements, and scenarios.</Text>

        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>Payment Process Scope</Text>
          <Text style={styles.bodyText}>{'\u2022'} Supplier payments (domestic &amp; international)</Text>
          <Text style={styles.bodyText}>{'\u2022'} Payroll payments</Text>
          <Text style={styles.bodyText}>{'\u2022'} Refunds and customer compensation</Text>
          <Text style={styles.bodyText}>{'\u2022'} One-off / emergency payments</Text>
          <Text style={styles.bodyText}>{'\u2022'} Bank file creation, approval, and upload</Text>
        </View>

        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>Key Payment Risks Identified</Text>
          {paymentsModule.risks.map((risk) => (
            <Text key={risk.id} style={styles.bodyText}>{'\u2022'} {risk.title} (Inherent: {risk.inherentScore}/25)</Text>
          ))}
          {paymentsModule.risks.length === 0 && (
            <>
              <Text style={styles.bodyText}>{'\u2022'} Duplicate payments</Text>
              <Text style={styles.bodyText}>{'\u2022'} Fictitious suppliers</Text>
              <Text style={styles.bodyText}>{'\u2022'} Invoice manipulation or inflation</Text>
              <Text style={styles.bodyText}>{'\u2022'} Bank detail manipulation (BEC)</Text>
            </>
          )}
        </View>

        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>Monitoring KPIs</Text>
          <View style={styles.kpiRow}>
            <Text style={styles.kpiLabel}>Duplicate payments/month:</Text>
            <Text style={styles.kpiValue}>{paymentsModule.kpis.duplicatePayments} (Target: 0)</Text>
          </View>
          <View style={styles.kpiRow}>
            <Text style={styles.kpiLabel}>Manual overrides:</Text>
            <Text style={styles.kpiValue}>{paymentsModule.kpis.manualOverrides}% (Target: &lt;1%)</Text>
          </View>
          <View style={styles.kpiRow}>
            <Text style={styles.kpiLabel}>Supplier verification rate:</Text>
            <Text style={styles.kpiValue}>{paymentsModule.kpis.supplierVerificationRate}% (Target: 100%)</Text>
          </View>
        </View>
      </ExpandableReportSection>

      {/* TRAINING & AWARENESS */}
      <ExpandableReportSection
        title="TRAINING & AWARENESS"
        icon={<GraduationCap size={20} color={colors.govBlue} />}
        expanded={!!expandedSections.training}
        onToggle={() => onToggleSection('training')}
        accessibilityLabel="Training and Awareness"
      >
        <Text style={styles.bodyText}>{'\u2022'} Mandatory annual training for all staff</Text>
        <Text style={styles.bodyText}>{'\u2022'} Specialist training for Finance, Procurement, HR</Text>
        <Text style={styles.bodyText}>{'\u2022'} Board training every 2 years</Text>
        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>Overall Completion Rate</Text>
          <Text style={styles.highlight}>{trainingAwareness.overallCompletionRate}%</Text>
          <Text style={styles.bodyText}>Target: 95%</Text>
        </View>
      </ExpandableReportSection>

      {/* MONITORING & EVALUATION */}
      <ExpandableReportSection
        title="MONITORING & EVALUATION"
        icon={<BarChart3 size={20} color={colors.govBlue} />}
        expanded={!!expandedSections.monitoring}
        onToggle={() => onToggleSection('monitoring')}
        accessibilityLabel="Monitoring and Evaluation"
      >
        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>Key Performance Indicators</Text>
          {monitoringEvaluation.kpis.map((kpi) => (
            <View key={kpi.id} style={styles.kpiRow}>
              <Text style={styles.kpiLabel}>{kpi.name}:</Text>
              <Text style={styles.kpiValue}>{kpi.current}{kpi.unit} / {kpi.target}{kpi.unit} ({kpi.status})</Text>
            </View>
          ))}
          {monitoringEvaluation.kpis.length === 0 && (
            <>
              <Text style={styles.bodyText}>{'\u2022'} Training completion: 95% target</Text>
              <Text style={styles.bodyText}>{'\u2022'} Investigation closure time: &lt; 30 days</Text>
              <Text style={styles.bodyText}>{'\u2022'} High-risk controls tested: 20 per year</Text>
            </>
          )}
        </View>
        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>Review Frequency</Text>
          <Text style={styles.bodyText}>{monitoringEvaluation.reviewFrequency}</Text>
        </View>
      </ExpandableReportSection>

      {/* COMPLIANCE MAPPING */}
      <ExpandableReportSection
        title="COMPLIANCE MAPPING"
        icon={<FileCheck size={20} color={colors.govBlue} />}
        expanded={!!expandedSections.compliance}
        onToggle={() => onToggleSection('compliance')}
        accessibilityLabel="Compliance Mapping"
      >
        <View style={styles.complianceItem}>
          <Text style={styles.complianceStandard}>GovS-013</Text>
          <View style={[styles.statusBadge, getStatusColor(complianceMapping.govS013.status)]}>
            <Text style={styles.statusText}>{getStatusLabel(complianceMapping.govS013.status)}</Text>
          </View>
        </View>
        <View style={styles.complianceItem}>
          <Text style={styles.complianceStandard}>Fraud Prevention Standard</Text>
          <View style={[styles.statusBadge, getStatusColor(complianceMapping.fraudPreventionStandard.status)]}>
            <Text style={styles.statusText}>{getStatusLabel(complianceMapping.fraudPreventionStandard.status)}</Text>
          </View>
        </View>
        <View style={styles.complianceItem}>
          <Text style={styles.complianceStandard}>ECCTA 2023</Text>
          <View style={[styles.statusBadge, getStatusColor(complianceMapping.eccta2023.status)]}>
            <Text style={styles.statusText}>{getStatusLabel(complianceMapping.eccta2023.status)}</Text>
          </View>
        </View>
      </ExpandableReportSection>

      {/* FRAUD RESPONSE PLAN */}
      <ExpandableReportSection
        title="FRAUD RESPONSE PLAN"
        icon={<AlertOctagon size={20} color={colors.govBlue} />}
        expanded={!!expandedSections.response}
        onToggle={() => onToggleSection('response')}
        accessibilityLabel="Fraud Response Plan"
      >
        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>Reporting Timelines</Text>
          <Text style={styles.bodyText}>{'\u2022'} Log incident: &lt; {fraudResponsePlan.reportingTimelines.logIncident} hours</Text>
          <Text style={styles.bodyText}>{'\u2022'} Initial assessment: &lt; {fraudResponsePlan.reportingTimelines.initialAssessment} hours</Text>
          <Text style={styles.bodyText}>{'\u2022'} Investigation start: &lt; {fraudResponsePlan.reportingTimelines.investigationStart} hours</Text>
        </View>
        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>Investigation Lifecycle</Text>
          <Text style={styles.bodyText}>{'\u2022'} Triage: {fraudResponsePlan.investigationLifecycle.triage} days</Text>
          <Text style={styles.bodyText}>{'\u2022'} Investigation: {fraudResponsePlan.investigationLifecycle.investigation} days</Text>
          <Text style={styles.bodyText}>{'\u2022'} Findings: {fraudResponsePlan.investigationLifecycle.findings} days</Text>
          <Text style={styles.bodyText}>{'\u2022'} Closure: {fraudResponsePlan.investigationLifecycle.closure} days</Text>
        </View>
        <View style={styles.subsection}>
          <Text style={styles.subsectionTitle}>Disciplinary Measures</Text>
          {fraudResponsePlan.disciplinaryMeasures.map((measure) => (
            <Text key={measure} style={styles.bodyText}>{'\u2022'} {measure}</Text>
          ))}
        </View>
      </ExpandableReportSection>

      {/* ACTION PLAN */}
      <ExpandableReportSection
        title="ACTION PLAN"
        icon={<ListChecks size={20} color={colors.govBlue} />}
        expanded={!!expandedSections.actions}
        onToggle={() => onToggleSection('actions')}
        accessibilityLabel="Action Plan"
      >
        {actionPlan.highPriority.length > 0 ? (
          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>High Priority (0-3 Months)</Text>
            {actionPlan.highPriority.map((action) => (
              <View key={action.id} style={styles.actionItem}>
                <Text style={styles.actionTitle}>{'\u2022'} {action.title}</Text>
                <Text style={styles.actionOwner}>Owner: {action.owner}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>High Priority (0-3 Months)</Text>
            <Text style={styles.bodyText}>{'\u2022'} Deploy new whistleblowing system</Text>
            <Text style={styles.bodyText}>{'\u2022'} Refresh conflict of interest policy</Text>
            <Text style={styles.bodyText}>{'\u2022'} Strengthen supplier due diligence</Text>
          </View>
        )}
        {actionPlan.mediumPriority.length > 0 && (
          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>Medium Priority (3-6 Months)</Text>
            {actionPlan.mediumPriority.map((action) => (
              <View key={action.id} style={styles.actionItem}>
                <Text style={styles.actionTitle}>{'\u2022'} {action.title}</Text>
                <Text style={styles.actionOwner}>Owner: {action.owner}</Text>
              </View>
            ))}
          </View>
        )}
        {actionPlan.lowPriority.length > 0 && (
          <View style={styles.subsection}>
            <Text style={styles.subsectionTitle}>Low Priority (6-12 Months)</Text>
            {actionPlan.lowPriority.map((action) => (
              <View key={action.id} style={styles.actionItem}>
                <Text style={styles.actionTitle}>{'\u2022'} {action.title}</Text>
                <Text style={styles.actionOwner}>Owner: {action.owner}</Text>
              </View>
            ))}
          </View>
        )}
      </ExpandableReportSection>
    </>
  );
}

const styles = StyleSheet.create({
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
  highlight: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.govBlue,
    marginBottom: 4,
  },
  riskItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: colors.govGrey4,
    borderRadius: 6,
  },
  riskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  riskId: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: colors.govBlue,
  },
  priorityBadgeSmall: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priorityBadgeSmallText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: colors.white,
  },
  riskTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 4,
  },
  riskArea: {
    fontSize: 13,
    color: colors.govGrey2,
    marginBottom: 4,
  },
  riskDescription: {
    fontSize: 13,
    color: colors.govGrey1,
    lineHeight: 18,
    marginBottom: 8,
  },
  riskScores: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 4,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.govGrey2,
  },
  riskOwner: {
    fontSize: 12,
    color: colors.govGrey2,
    fontStyle: 'italic' as const,
  },
  moduleTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 8,
  },
  kpiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  kpiLabel: {
    fontSize: 13,
    color: colors.govGrey2,
    flex: 1,
  },
  kpiValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.govGrey1,
  },
  complianceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    padding: 12,
    backgroundColor: colors.govGrey4,
    borderRadius: 6,
  },
  complianceStandard: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.white,
  },
  actionItem: {
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 14,
    color: colors.govGrey1,
    marginBottom: 2,
  },
  actionOwner: {
    fontSize: 12,
    color: colors.govGrey2,
    fontStyle: 'italic' as const,
  },
});
