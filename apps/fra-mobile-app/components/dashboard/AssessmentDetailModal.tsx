import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, ActivityIndicator, Share } from 'react-native';
import { X, FileText, CheckCircle, AlertCircle, Share2 } from 'lucide-react-native';
import colors from '@/constants/colors';
import { apiService } from '@/services/api.service';
import type { AssessmentData } from '@/types/assessment';
import type { EmployeeData } from './types';

interface AssessmentDetailModalProps {
  visible: boolean;
  onClose: () => void;
  selectedEmployee: string | null;
  employeeData?: EmployeeData | null;
}

export default function AssessmentDetailModal({
  visible,
  onClose,
  selectedEmployee,
  employeeData,
}: AssessmentDetailModalProps) {
  const [fetchedAssessment, setFetchedAssessment] = useState<Partial<AssessmentData> | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !selectedEmployee) {
      setFetchedAssessment(null);
      setFetchError(null);
      return;
    }

    let isMounted = true;
    setIsFetching(true);
    setFetchError(null);
    apiService.get<{
      assessments: { id: string; answers: Record<string, unknown> }[];
    }>(`/api/v1/analytics/employees/${selectedEmployee}`)
      .then((response) => {
        if (!isMounted) return;
        if (response.success && response.data?.assessments?.[0]?.answers) {
          setFetchedAssessment(response.data.assessments[0].answers as Partial<AssessmentData>);
        } else {
          setFetchedAssessment(null);
        }
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        const message = err instanceof Error ? err.message : 'Failed to load assessment details';
        setFetchError(message);
        setFetchedAssessment(null);
      })
      .finally(() => { if (isMounted) setIsFetching(false); });

    return () => { isMounted = false; };
  }, [visible, selectedEmployee]);

  const assessment = fetchedAssessment;
  const employee = employeeData;

  const handleExport = useCallback(async () => {
    if (!employee || !assessment) return;

    const formatLabel = (key: string): string =>
      key.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    const lines: string[] = [
      'FRAUD RISK ASSESSMENT REPORT',
      '============================',
      '',
      `Employee: ${employee.userName}`,
      `Email: ${employee.email}`,
      `Department: ${employee.department}`,
      employee.overallRiskLevel ? `Risk Level: ${employee.overallRiskLevel.charAt(0).toUpperCase() + employee.overallRiskLevel.slice(1)}` : '',
      employee.completedAt ? `Completed: ${new Date(employee.completedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : '',
      '',
    ];

    if (assessment.organisation) {
      lines.push('ORGANISATION INFORMATION', '------------------------');
      if (assessment.organisation.name) lines.push(`Name: ${assessment.organisation.name}`);
      if (assessment.organisation.type) lines.push(`Type: ${formatLabel(assessment.organisation.type)}`);
      if (assessment.organisation.employeeCount) lines.push(`Employee Count: ${assessment.organisation.employeeCount}`);
      if (assessment.organisation.region) lines.push(`Region: ${assessment.organisation.region}`);
      if (assessment.organisation.activities) lines.push(`Activities: ${assessment.organisation.activities}`);
      lines.push('');
    }

    if (assessment.riskAppetite) {
      lines.push('RISK APPETITE', '-------------');
      if (assessment.riskAppetite.tolerance) lines.push(`Tolerance: ${formatLabel(assessment.riskAppetite.tolerance)}`);
      if (assessment.riskAppetite.fraudSeriousness) lines.push(`Fraud Seriousness: ${formatLabel(assessment.riskAppetite.fraudSeriousness)}`);
      if (assessment.riskAppetite.reputationImportance) lines.push(`Reputation Importance: ${formatLabel(assessment.riskAppetite.reputationImportance)}`);
      lines.push('');
    }

    if (assessment.riskRegister && assessment.riskRegister.length > 0) {
      lines.push('RISK REGISTER', '-------------');
      lines.push(`Total Risks: ${assessment.riskRegister.length}`);
      lines.push(`High Priority: ${assessment.riskRegister.filter(r => r.priority === 'high').length}`);
      lines.push(`Medium Priority: ${assessment.riskRegister.filter(r => r.priority === 'medium').length}`);
      lines.push(`Low Priority: ${assessment.riskRegister.filter(r => r.priority === 'low').length}`);
      lines.push('');
      assessment.riskRegister.forEach((risk, i) => {
        lines.push(`Risk ${i + 1}: ${risk.title || 'Unnamed'}`);
        if (risk.area) lines.push(`  Area: ${formatLabel(risk.area)}`);
        if (risk.priority) lines.push(`  Priority: ${formatLabel(risk.priority)}`);
        lines.push(`  Inherent Score: ${risk.inherentScore}, Residual Score: ${risk.residualScore}`);
        if (risk.description) lines.push(`  Description: ${risk.description}`);
        lines.push('');
      });
    }

    const reportText = lines.filter(l => l !== undefined).join('\n');

    try {
      await Share.share({
        message: reportText,
        title: `Assessment Report - ${employee.userName}`,
      });
    } catch {
      Alert.alert('Export Failed', 'Could not share the assessment report. Please try again.');
    }
  }, [employee, assessment]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, styles.assessmentModalContent]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Assessment Details</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close assessment details">
              <X size={24} color={colors.govGrey1} />
            </TouchableOpacity>
          </View>

          {isFetching ? (
            <View style={styles.emptyStateContainer}>
              <ActivityIndicator size="large" color={colors.govBlue} />
              <Text style={styles.emptyStateText}>Loading assessment details...</Text>
            </View>
          ) : selectedEmployee && assessment ? (
            <ScrollView style={styles.assessmentDetailsScroll} showsVerticalScrollIndicator={true}>
              {fetchError && (
                <View style={styles.warningBanner}>
                  <AlertCircle size={16} color={colors.riskMedium} />
                  <Text style={styles.warningBannerText}>
                    {fetchError}
                  </Text>
                </View>
              )}
              {(() => {

                if (!employee || !assessment) return (
                  <View style={styles.emptyStateContainer}>
                    <AlertCircle size={48} color={colors.govGrey3} />
                    <Text style={styles.emptyStateTitle}>No Data Available</Text>
                    <Text style={styles.emptyStateText}>Assessment details could not be loaded.</Text>
                  </View>
                );

                const formatLabel = (key: string): string => {
                  return key.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                };

                return (
                  <>
                    <View style={styles.detailHeader}>
                      <View style={styles.detailHeaderIcon}>
                        <FileText size={32} color={colors.govBlue} />
                      </View>
                      <View style={styles.detailHeaderText}>
                        <Text style={styles.detailEmployeeName}>{employee.userName}</Text>
                        <Text style={styles.detailEmployeeEmail}>{employee.email}</Text>
                        <Text style={styles.detailEmployeeDept}>{employee.department}</Text>
                      </View>
                    </View>

                    <View style={styles.completionInfoBanner}>
                      <CheckCircle size={20} color={colors.govGreen} />
                      <View style={styles.completionInfoText}>
                        <Text style={styles.completionInfoTitle}>Assessment Completed</Text>
                        <Text style={styles.completionInfoSubtitle}>All sections have been answered and reviewed</Text>
                      </View>
                    </View>

                    <View style={styles.detailSummaryBadges}>
                      <View style={[styles.statusBadge, styles.statusCompleted]}>
                        <Text style={styles.statusText}>Completed</Text>
                      </View>
                      {employee.overallRiskLevel && (
                        <View style={[
                          styles.riskBadge,
                          employee.overallRiskLevel === 'high' && styles.riskHigh,
                          employee.overallRiskLevel === 'medium' && styles.riskMedium,
                          employee.overallRiskLevel === 'low' && styles.riskLow,
                        ]}>
                          <Text style={styles.riskText}>
                            {employee.overallRiskLevel.charAt(0).toUpperCase() + employee.overallRiskLevel.slice(1)} Risk
                          </Text>
                        </View>
                      )}
                    </View>

                    {employee.completedAt && (
                      <View style={styles.detailMetaInfo}>
                        <Text style={styles.detailMetaLabel}>Completed on:</Text>
                        <Text style={styles.detailMetaValue}>
                          {new Date(employee.completedAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </Text>
                      </View>
                    )}

                    {assessment.riskRegister && assessment.riskRegister.length > 0 && (
                      <View style={styles.detailSummaryCards}>
                        <View style={styles.summaryCard}>
                          <Text style={styles.summaryCardValue}>{assessment.riskRegister.length}</Text>
                          <Text style={styles.summaryCardLabel}>Risks Identified</Text>
                        </View>
                        <View style={styles.summaryCard}>
                          <Text style={styles.summaryCardValue}>
                            {assessment.riskRegister.filter(r => r.priority === 'high').length}
                          </Text>
                          <Text style={styles.summaryCardLabel}>High Priority</Text>
                        </View>
                        <View style={styles.summaryCard}>
                          <Text style={styles.summaryCardValue}>
                            {assessment.riskRegister.filter(r => r.priority === 'medium').length}
                          </Text>
                          <Text style={styles.summaryCardLabel}>Medium Priority</Text>
                        </View>
                      </View>
                    )}

                    {assessment.organisation && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>Organisation Information</Text>
                        <View style={styles.detailCard}>
                          {assessment.organisation.name && (
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Organisation Name:</Text>
                              <Text style={styles.detailValue}>{assessment.organisation.name}</Text>
                            </View>
                          )}
                          {assessment.organisation.type && (
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Type:</Text>
                              <Text style={styles.detailValue}>{formatLabel(assessment.organisation.type)}</Text>
                            </View>
                          )}
                          {assessment.organisation.employeeCount && (
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Employee Count:</Text>
                              <Text style={styles.detailValue}>{assessment.organisation.employeeCount}</Text>
                            </View>
                          )}
                          {assessment.organisation.region && (
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Region:</Text>
                              <Text style={styles.detailValue}>{assessment.organisation.region}</Text>
                            </View>
                          )}
                          {assessment.organisation.activities && (
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Activities:</Text>
                              <Text style={styles.detailValue}>{assessment.organisation.activities}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {assessment.riskAppetite && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>Risk Appetite</Text>
                        <View style={styles.detailCard}>
                          {assessment.riskAppetite.tolerance && (
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Tolerance:</Text>
                              <Text style={styles.detailValue}>{formatLabel(assessment.riskAppetite.tolerance)}</Text>
                            </View>
                          )}
                          {assessment.riskAppetite.fraudSeriousness && (
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Fraud Seriousness:</Text>
                              <Text style={styles.detailValue}>{formatLabel(assessment.riskAppetite.fraudSeriousness)}</Text>
                            </View>
                          )}
                          {assessment.riskAppetite.reputationImportance && (
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Reputation Importance:</Text>
                              <Text style={styles.detailValue}>{formatLabel(assessment.riskAppetite.reputationImportance)}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {assessment.fraudTriangle && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>Fraud Triangle Assessment</Text>
                        <View style={styles.detailCard}>
                          {assessment.fraudTriangle.pressure && (
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Pressure Level:</Text>
                              <Text style={styles.detailValue}>{formatLabel(assessment.fraudTriangle.pressure)}</Text>
                            </View>
                          )}
                          {assessment.fraudTriangle.controlStrength && (
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Control Strength:</Text>
                              <Text style={styles.detailValue}>{formatLabel(assessment.fraudTriangle.controlStrength)}</Text>
                            </View>
                          )}
                          {assessment.fraudTriangle.speakUpCulture && (
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Speak-Up Culture:</Text>
                              <Text style={styles.detailValue}>{formatLabel(assessment.fraudTriangle.speakUpCulture)}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {assessment.procurement && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>Procurement Controls</Text>
                        <View style={styles.detailCard}>
                          <View style={styles.questionBlock}>
                            <Text style={styles.questionText}>How often is segregation of duties maintained in procurement?</Text>
                            <View style={styles.answerContainer}>
                              <CheckCircle size={16} color={colors.govGreen} />
                              <Text style={styles.answerText}>{formatLabel(assessment.procurement.q1 || 'Not answered')}</Text>
                            </View>
                          </View>
                          <View style={styles.questionBlock}>
                            <Text style={styles.questionText}>How frequently are suppliers verified before onboarding?</Text>
                            <View style={styles.answerContainer}>
                              <CheckCircle size={16} color={colors.govGreen} />
                              <Text style={styles.answerText}>{formatLabel(assessment.procurement.q2 || 'Not answered')}</Text>
                            </View>
                          </View>
                          <View style={styles.questionBlock}>
                            <Text style={styles.questionText}>Are purchase orders properly authorized?</Text>
                            <View style={styles.answerContainer}>
                              <CheckCircle size={16} color={colors.govGreen} />
                              <Text style={styles.answerText}>{formatLabel(assessment.procurement.q3 || 'Not answered')}</Text>
                            </View>
                          </View>
                          {assessment.procurement.notes && (
                            <View style={styles.notesBlock}>
                              <Text style={styles.notesBlockTitle}>Additional Notes:</Text>
                              <Text style={styles.notesBlockText}>{assessment.procurement.notes}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {assessment.cashBanking && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>Cash & Banking Controls</Text>
                        <View style={styles.detailCard}>
                          <View style={styles.questionBlock}>
                            <Text style={styles.questionText}>How often are transaction controls applied?</Text>
                            <View style={styles.answerContainer}>
                              <CheckCircle size={16} color={colors.govGreen} />
                              <Text style={styles.answerText}>{formatLabel(assessment.cashBanking.q1 || 'Not answered')}</Text>
                            </View>
                          </View>
                          <View style={styles.questionBlock}>
                            <Text style={styles.questionText}>How frequently are bank reconciliations performed?</Text>
                            <View style={styles.answerContainer}>
                              <CheckCircle size={16} color={colors.govGreen} />
                              <Text style={styles.answerText}>{formatLabel(assessment.cashBanking.q2 || 'Not answered')}</Text>
                            </View>
                          </View>
                          <View style={styles.questionBlock}>
                            <Text style={styles.questionText}>Is dual authorization required for payments?</Text>
                            <View style={styles.answerContainer}>
                              <CheckCircle size={16} color={colors.govGreen} />
                              <Text style={styles.answerText}>{formatLabel(assessment.cashBanking.q3 || 'Not answered')}</Text>
                            </View>
                          </View>
                          {assessment.cashBanking.notes && (
                            <View style={styles.notesBlock}>
                              <Text style={styles.notesBlockTitle}>Additional Notes:</Text>
                              <Text style={styles.notesBlockText}>{assessment.cashBanking.notes}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {assessment.payrollHR && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>Payroll & HR Controls</Text>
                        <View style={styles.detailCard}>
                          <View style={styles.questionBlock}>
                            <Text style={styles.questionText}>How often are payroll reports reviewed?</Text>
                            <View style={styles.answerContainer}>
                              <CheckCircle size={16} color={colors.govGreen} />
                              <Text style={styles.answerText}>{formatLabel(assessment.payrollHR.q1 || 'Not answered')}</Text>
                            </View>
                          </View>
                          <View style={styles.questionBlock}>
                            <Text style={styles.questionText}>How frequently are employees verified in the payroll system?</Text>
                            <View style={styles.answerContainer}>
                              <CheckCircle size={16} color={colors.govGreen} />
                              <Text style={styles.answerText}>{formatLabel(assessment.payrollHR.q2 || 'Not answered')}</Text>
                            </View>
                          </View>
                          <View style={styles.questionBlock}>
                            <Text style={styles.questionText}>Are payroll changes properly authorized?</Text>
                            <View style={styles.answerContainer}>
                              <CheckCircle size={16} color={colors.govGreen} />
                              <Text style={styles.answerText}>{formatLabel(assessment.payrollHR.q3 || 'Not answered')}</Text>
                            </View>
                          </View>
                          {assessment.payrollHR.notes && (
                            <View style={styles.notesBlock}>
                              <Text style={styles.notesBlockTitle}>Additional Notes:</Text>
                              <Text style={styles.notesBlockText}>{assessment.payrollHR.notes}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {assessment.revenue && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>Revenue Controls</Text>
                        <View style={styles.detailCard}>
                          <View style={styles.questionBlock}>
                            <Text style={styles.questionText}>How consistently is revenue recognition policy applied?</Text>
                            <View style={styles.answerContainer}>
                              <CheckCircle size={16} color={colors.govGreen} />
                              <Text style={styles.answerText}>{formatLabel(assessment.revenue.q1 || 'Not answered')}</Text>
                            </View>
                          </View>
                          <View style={styles.questionBlock}>
                            <Text style={styles.questionText}>How often are invoices properly managed and tracked?</Text>
                            <View style={styles.answerContainer}>
                              <CheckCircle size={16} color={colors.govGreen} />
                              <Text style={styles.answerText}>{formatLabel(assessment.revenue.q2 || 'Not answered')}</Text>
                            </View>
                          </View>
                          <View style={styles.questionBlock}>
                            <Text style={styles.questionText}>Are credit notes and refunds properly controlled?</Text>
                            <View style={styles.answerContainer}>
                              <CheckCircle size={16} color={colors.govGreen} />
                              <Text style={styles.answerText}>{formatLabel(assessment.revenue.q3 || 'Not answered')}</Text>
                            </View>
                          </View>
                          {assessment.revenue.notes && (
                            <View style={styles.notesBlock}>
                              <Text style={styles.notesBlockTitle}>Additional Notes:</Text>
                              <Text style={styles.notesBlockText}>{assessment.revenue.notes}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {assessment.itSystems && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>IT Systems & Security</Text>
                        <View style={styles.detailCard}>
                          <View style={styles.questionBlock}>
                            <Text style={styles.questionText}>How often are IT access controls reviewed and updated?</Text>
                            <View style={styles.answerContainer}>
                              <CheckCircle size={16} color={colors.govGreen} />
                              <Text style={styles.answerText}>{formatLabel(assessment.itSystems.q1 || 'Not answered')}</Text>
                            </View>
                          </View>
                          <View style={styles.questionBlock}>
                            <Text style={styles.questionText}>How frequently are security measures tested?</Text>
                            <View style={styles.answerContainer}>
                              <CheckCircle size={16} color={colors.govGreen} />
                              <Text style={styles.answerText}>{formatLabel(assessment.itSystems.q2 || 'Not answered')}</Text>
                            </View>
                          </View>
                          <View style={styles.questionBlock}>
                            <Text style={styles.questionText}>Are data protection measures adequately maintained?</Text>
                            <View style={styles.answerContainer}>
                              <CheckCircle size={16} color={colors.govGreen} />
                              <Text style={styles.answerText}>{formatLabel(assessment.itSystems.q3 || 'Not answered')}</Text>
                            </View>
                          </View>
                          {assessment.itSystems.notes && (
                            <View style={styles.notesBlock}>
                              <Text style={styles.notesBlockTitle}>Additional Notes:</Text>
                              <Text style={styles.notesBlockText}>{assessment.itSystems.notes}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {assessment.peopleCulture && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>People & Culture</Text>
                        <View style={styles.detailCard}>
                          {assessment.peopleCulture.staffChecks && (
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Staff Background Checks:</Text>
                              <Text style={styles.detailValue}>{formatLabel(assessment.peopleCulture.staffChecks)}</Text>
                            </View>
                          )}
                          {assessment.peopleCulture.whistleblowing && (
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Whistleblowing:</Text>
                              <Text style={styles.detailValue}>{formatLabel(assessment.peopleCulture.whistleblowing)}</Text>
                            </View>
                          )}
                          {assessment.peopleCulture.leadershipMessage && (
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Leadership Message:</Text>
                              <Text style={styles.detailValue}>{formatLabel(assessment.peopleCulture.leadershipMessage)}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {assessment.controlsTechnology && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>Controls & Technology</Text>
                        <View style={styles.detailCard}>
                          {assessment.controlsTechnology.segregation && (
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Segregation of Duties:</Text>
                              <Text style={styles.detailValue}>{formatLabel(assessment.controlsTechnology.segregation)}</Text>
                            </View>
                          )}
                          {assessment.controlsTechnology.accessManagement && (
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Access Management:</Text>
                              <Text style={styles.detailValue}>{formatLabel(assessment.controlsTechnology.accessManagement)}</Text>
                            </View>
                          )}
                          {assessment.controlsTechnology.monitoring && (
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Monitoring:</Text>
                              <Text style={styles.detailValue}>{formatLabel(assessment.controlsTechnology.monitoring)}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {assessment.priorities && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>Priorities & Recommendations</Text>
                        <View style={styles.detailCard}>
                          <Text style={styles.detailPriorities}>{assessment.priorities}</Text>
                        </View>
                      </View>
                    )}

                    {assessment.riskRegister && assessment.riskRegister.length > 0 && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>Risk Register ({assessment.riskRegister.length} items)</Text>
                        {assessment.riskRegister.map((risk) => (
                          <View key={risk.id} style={styles.riskRegisterCard}>
                            <View style={styles.riskRegisterHeader}>
                              <Text style={styles.riskRegisterTitle}>{risk.title}</Text>
                              <View style={[
                                styles.riskBadge,
                                risk.priority === 'high' && styles.riskHigh,
                                risk.priority === 'medium' && styles.riskMedium,
                                risk.priority === 'low' && styles.riskLow,
                              ]}>
                                <Text style={styles.riskText}>{risk.priority.toUpperCase()}</Text>
                              </View>
                            </View>
                            <Text style={styles.riskRegisterArea}>{risk.area}</Text>
                            <Text style={styles.riskRegisterDescription}>{risk.description}</Text>
                            <View style={styles.riskScores}>
                              <View style={styles.riskScoreItem}>
                                <Text style={styles.riskScoreLabel}>Inherent:</Text>
                                <Text style={styles.riskScoreValue}>{risk.inherentScore}/25</Text>
                              </View>
                              <View style={styles.riskScoreItem}>
                                <Text style={styles.riskScoreLabel}>Residual:</Text>
                                <Text style={styles.riskScoreValue}>{risk.residualScore}/25</Text>
                              </View>
                            </View>
                            <View style={styles.riskOwner}>
                              <Text style={styles.riskOwnerLabel}>Owner:</Text>
                              <Text style={styles.riskOwnerValue}>{risk.suggestedOwner}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {assessment.paymentsModule && assessment.paymentsModule.risks && assessment.paymentsModule.risks.length > 0 && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>Payments Module - Risk Assessment</Text>
                        {assessment.paymentsModule.risks.map((risk) => (
                          <View key={risk.id} style={styles.detailCard}>
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Risk Area:</Text>
                              <Text style={styles.detailValue}>{formatLabel(risk.area)}</Text>
                            </View>
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Title:</Text>
                              <Text style={styles.detailValue}>{risk.title}</Text>
                            </View>
                            <View style={styles.detailNotesRow}>
                              <Text style={styles.detailLabel}>Description:</Text>
                              <Text style={styles.detailNotesValue}>{risk.description}</Text>
                            </View>
                            <View style={styles.riskScores}>
                              <View style={styles.riskScoreItem}>
                                <Text style={styles.riskScoreLabel}>Inherent:</Text>
                                <Text style={styles.riskScoreValue}>{risk.inherentScore}</Text>
                              </View>
                              <View style={styles.riskScoreItem}>
                                <Text style={styles.riskScoreLabel}>Residual:</Text>
                                <Text style={styles.riskScoreValue}>{risk.residualScore}</Text>
                              </View>
                            </View>
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Control Effectiveness:</Text>
                              <Text style={styles.detailValue}>{formatLabel(risk.controlEffectiveness)}</Text>
                            </View>
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Owner:</Text>
                              <Text style={styles.detailValue}>{risk.owner}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {assessment.trainingAwareness && (assessment.trainingAwareness.mandatoryTraining?.length > 0 || assessment.trainingAwareness.specialistTraining?.length > 0) && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>Training & Awareness</Text>
                        <View style={styles.detailCard}>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Overall Completion Rate:</Text>
                            <Text style={styles.detailValue}>{assessment.trainingAwareness.overallCompletionRate}%</Text>
                          </View>
                          {assessment.trainingAwareness.mandatoryTraining?.length > 0 && (
                            <View style={styles.detailNotesRow}>
                              <Text style={styles.detailLabel}>Mandatory Training Programs:</Text>
                              <Text style={styles.detailNotesValue}>
                                {assessment.trainingAwareness.mandatoryTraining.map(t => `• ${t.trainingType} (${t.completionRate}%)`).join('\n')}
                              </Text>
                            </View>
                          )}
                          {assessment.trainingAwareness.notes && (
                            <View style={styles.detailNotesRow}>
                              <Text style={styles.detailLabel}>Notes:</Text>
                              <Text style={styles.detailNotesValue}>{assessment.trainingAwareness.notes}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {assessment.monitoringEvaluation && assessment.monitoringEvaluation.kpis?.length > 0 && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>Monitoring & Evaluation</Text>
                        <View style={styles.detailCard}>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Review Frequency:</Text>
                            <Text style={styles.detailValue}>{formatLabel(assessment.monitoringEvaluation.reviewFrequency)}</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Responsible Person:</Text>
                            <Text style={styles.detailValue}>{assessment.monitoringEvaluation.responsiblePerson || 'Not assigned'}</Text>
                          </View>
                          {assessment.monitoringEvaluation.lastReviewDate && (
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Last Review:</Text>
                              <Text style={styles.detailValue}>{new Date(assessment.monitoringEvaluation.lastReviewDate).toLocaleDateString('en-GB')}</Text>
                            </View>
                          )}
                          {assessment.monitoringEvaluation.kpis.length > 0 && (
                            <View style={styles.detailNotesRow}>
                              <Text style={styles.detailLabel}>Key Performance Indicators:</Text>
                              <Text style={styles.detailNotesValue}>
                                {assessment.monitoringEvaluation.kpis.map(kpi => `• ${kpi.name}: ${kpi.current}/${kpi.target} ${kpi.unit} (${kpi.status})`).join('\n')}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {assessment.complianceMapping && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>Compliance Mapping</Text>
                        <View style={styles.detailCard}>
                          {assessment.complianceMapping.govS013 && (
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>GovS-013 Status:</Text>
                              <Text style={styles.detailValue}>{formatLabel(assessment.complianceMapping.govS013.status)}</Text>
                            </View>
                          )}
                          {assessment.complianceMapping.fraudPreventionStandard && (
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>Fraud Prevention Standard:</Text>
                              <Text style={styles.detailValue}>{formatLabel(assessment.complianceMapping.fraudPreventionStandard.status)}</Text>
                            </View>
                          )}
                          {assessment.complianceMapping.eccta2023 && (
                            <View style={styles.detailRow}>
                              <Text style={styles.detailLabel}>ECCTA 2023:</Text>
                              <Text style={styles.detailValue}>{formatLabel(assessment.complianceMapping.eccta2023.status)}</Text>
                            </View>
                          )}
                          {assessment.complianceMapping.notes && (
                            <View style={styles.detailNotesRow}>
                              <Text style={styles.detailLabel}>Notes:</Text>
                              <Text style={styles.detailNotesValue}>{assessment.complianceMapping.notes}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {assessment.fraudResponsePlan && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>Fraud Response Plan</Text>
                        <View style={styles.detailCard}>
                          <Text style={[styles.detailLabel, { marginBottom: 8, fontWeight: '700' as const }]}>Reporting Timelines</Text>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Log Incident:</Text>
                            <Text style={styles.detailValue}>&lt; {assessment.fraudResponsePlan.reportingTimelines.logIncident} hours</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Initial Assessment:</Text>
                            <Text style={styles.detailValue}>&lt; {assessment.fraudResponsePlan.reportingTimelines.initialAssessment} hours</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Investigation Start:</Text>
                            <Text style={styles.detailValue}>&lt; {assessment.fraudResponsePlan.reportingTimelines.investigationStart} hours</Text>
                          </View>
                          <Text style={[styles.detailLabel, { marginTop: 12, marginBottom: 8, fontWeight: '700' as const }]}>Investigation Lifecycle (Days)</Text>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Triage:</Text>
                            <Text style={styles.detailValue}>{assessment.fraudResponsePlan.investigationLifecycle.triage} days</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Investigation:</Text>
                            <Text style={styles.detailValue}>{assessment.fraudResponsePlan.investigationLifecycle.investigation} days</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Findings:</Text>
                            <Text style={styles.detailValue}>{assessment.fraudResponsePlan.investigationLifecycle.findings} days</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Closure:</Text>
                            <Text style={styles.detailValue}>{assessment.fraudResponsePlan.investigationLifecycle.closure} days</Text>
                          </View>
                          {assessment.fraudResponsePlan.externalReporting && (
                            <View style={styles.detailNotesRow}>
                              <Text style={styles.detailLabel}>External Reporting:</Text>
                              <Text style={styles.detailNotesValue}>{assessment.fraudResponsePlan.externalReporting}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {assessment.actionPlan && (assessment.actionPlan.highPriority?.length > 0 || assessment.actionPlan.mediumPriority?.length > 0 || assessment.actionPlan.lowPriority?.length > 0) && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>Action Plan</Text>
                        {assessment.actionPlan.highPriority?.length > 0 && (
                          <View style={{ marginBottom: 16 }}>
                            <Text style={[styles.detailLabel, { marginBottom: 8, fontWeight: '700' as const, color: colors.errorRed }]}>High Priority Actions</Text>
                            {assessment.actionPlan.highPriority.map((action) => (
                              <View key={action.id} style={[styles.detailCard, { marginBottom: 8 }]}>
                                <View style={styles.detailRow}>
                                  <Text style={styles.detailLabel}>Title:</Text>
                                  <Text style={styles.detailValue}>{action.title}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                  <Text style={styles.detailLabel}>Timeline:</Text>
                                  <Text style={styles.detailValue}>{action.timeline}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                  <Text style={styles.detailLabel}>Owner:</Text>
                                  <Text style={styles.detailValue}>{action.owner}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                  <Text style={styles.detailLabel}>Status:</Text>
                                  <Text style={styles.detailValue}>{formatLabel(action.status)}</Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        )}
                        {assessment.actionPlan.mediumPriority?.length > 0 && (
                          <View style={{ marginBottom: 16 }}>
                            <Text style={[styles.detailLabel, { marginBottom: 8, fontWeight: '700' as const, color: colors.riskMedium }]}>Medium Priority Actions</Text>
                            {assessment.actionPlan.mediumPriority.map((action) => (
                              <View key={action.id} style={[styles.detailCard, { marginBottom: 8 }]}>
                                <View style={styles.detailRow}>
                                  <Text style={styles.detailLabel}>Title:</Text>
                                  <Text style={styles.detailValue}>{action.title}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                  <Text style={styles.detailLabel}>Timeline:</Text>
                                  <Text style={styles.detailValue}>{action.timeline}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                  <Text style={styles.detailLabel}>Owner:</Text>
                                  <Text style={styles.detailValue}>{action.owner}</Text>
                                </View>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    )}

                    {assessment.documentControl && (
                      <View style={styles.detailSection}>
                        <Text style={styles.detailSectionTitle}>Document Control</Text>
                        <View style={styles.detailCard}>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Version:</Text>
                            <Text style={styles.detailValue}>{assessment.documentControl.version}</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Last Updated:</Text>
                            <Text style={styles.detailValue}>{new Date(assessment.documentControl.lastUpdated).toLocaleDateString('en-GB')}</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Classification:</Text>
                            <Text style={styles.detailValue}>{assessment.documentControl.classification}</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Retention Period:</Text>
                            <Text style={styles.detailValue}>{assessment.documentControl.retentionPeriod}</Text>
                          </View>
                        </View>
                      </View>
                    )}

                    <View style={styles.detailFooter}>
                      <TouchableOpacity
                        style={styles.exportDetailButton}
                        onPress={handleExport}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel="Share assessment report"
                      >
                        <Share2 size={18} color={colors.govBlue} />
                        <Text style={styles.exportDetailButtonText}>Share Report</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.closeDetailButton}
                        onPress={onClose}
                        activeOpacity={0.8}
                        accessibilityRole="button"
                        accessibilityLabel="Close"
                      >
                        <Text style={styles.closeDetailButtonText}>Close</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                );
              })()}
            </ScrollView>
          ) : (
            <View style={styles.emptyStateContainer}>
              <AlertCircle size={48} color={fetchError ? colors.riskMedium : colors.govGrey3} />
              <Text style={styles.emptyStateTitle}>
                {fetchError ? 'Failed to Load Data' : 'No Assessment Data'}
              </Text>
              <Text style={styles.emptyStateText}>
                {fetchError
                  ? 'Could not retrieve assessment details. Please check your connection and try again.'
                  : 'This employee has not completed their assessment yet or data is not available.'}
              </Text>
              <TouchableOpacity
                style={styles.closeDetailButton}
                onPress={onClose}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Text style={styles.closeDetailButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  assessmentModalContent: {
    maxHeight: '90%',
    paddingBottom: 40,
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.govGrey1,
  },
  assessmentDetailsScroll: {
    flexGrow: 1,
    flexShrink: 1,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.riskMedium,
  },
  warningBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.govGrey1,
    lineHeight: 18,
  },
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    backgroundColor: colors.white,
    borderRadius: 12,
    marginTop: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.govGrey2,
    textAlign: 'center' as const,
    lineHeight: 21,
    maxWidth: 280,
    marginBottom: 20,
  },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 20,
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.govGrey4,
  },
  detailHeaderIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  detailHeaderText: {
    flex: 1,
  },
  detailEmployeeName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.govGrey1,
    marginBottom: 4,
  },
  detailEmployeeEmail: {
    fontSize: 13,
    color: colors.govGrey2,
    marginBottom: 2,
  },
  detailEmployeeDept: {
    fontSize: 12,
    color: colors.govGrey2,
  },
  completionInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E7F6ED',
    borderRadius: 10,
    padding: 14,
    marginBottom: 20,
    gap: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.govGreen,
  },
  completionInfoText: {
    flex: 1,
  },
  completionInfoTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 2,
  },
  completionInfoSubtitle: {
    fontSize: 12,
    color: colors.govGrey2,
  },
  detailSummaryBadges: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusCompleted: {
    backgroundColor: colors.statusCompleted,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.white,
  },
  riskBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  riskHigh: {
    backgroundColor: colors.errorRed,
  },
  riskMedium: {
    backgroundColor: colors.riskMedium,
  },
  riskLow: {
    backgroundColor: colors.govGreen,
  },
  riskText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.white,
  },
  detailMetaInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.govGrey4,
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  detailMetaLabel: {
    fontSize: 13,
    color: colors.govGrey2,
  },
  detailMetaValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.govGrey1,
  },
  detailSummaryCards: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  summaryCardValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.govBlue,
    marginBottom: 4,
  },
  summaryCardLabel: {
    fontSize: 11,
    color: colors.govGrey2,
    textAlign: 'center' as const,
  },
  detailSection: {
    marginBottom: 24,
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 12,
    letterSpacing: -0.16,
  },
  detailCard: {
    backgroundColor: colors.govGrey4,
    borderRadius: 10,
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 12,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.govGrey2,
    flex: 1,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    flex: 1,
    textAlign: 'right' as const,
  },
  detailNotesRow: {
    marginTop: 4,
  },
  detailNotesValue: {
    fontSize: 13,
    color: colors.govGrey1,
    lineHeight: 20,
    marginTop: 6,
    fontStyle: 'italic' as const,
  },
  detailPriorities: {
    fontSize: 14,
    color: colors.govGrey1,
    lineHeight: 21,
  },
  questionBlock: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.govGrey3,
  },
  questionText: {
    fontSize: 13,
    color: colors.govGrey1,
    lineHeight: 19,
    marginBottom: 8,
    fontWeight: '500' as const,
  },
  answerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    padding: 10,
    borderRadius: 6,
  },
  answerText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.govBlue,
  },
  notesBlock: {
    backgroundColor: colors.white,
    borderRadius: 6,
    padding: 12,
    marginTop: 4,
  },
  notesBlockTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.govGrey2,
    marginBottom: 6,
  },
  notesBlockText: {
    fontSize: 13,
    color: colors.govGrey1,
    lineHeight: 19,
    fontStyle: 'italic' as const,
  },
  riskRegisterCard: {
    backgroundColor: colors.white,
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.govBlue,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  riskRegisterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 12,
  },
  riskRegisterTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    flex: 1,
  },
  riskRegisterArea: {
    fontSize: 12,
    color: colors.govBlue,
    fontWeight: '600' as const,
    marginBottom: 8,
  },
  riskRegisterDescription: {
    fontSize: 13,
    color: colors.govGrey2,
    lineHeight: 19,
    marginBottom: 12,
  },
  riskScores: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 8,
  },
  riskScoreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  riskScoreLabel: {
    fontSize: 12,
    color: colors.govGrey2,
  },
  riskScoreValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: colors.govGrey1,
  },
  riskOwner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  riskOwnerLabel: {
    fontSize: 12,
    color: colors.govGrey2,
  },
  riskOwnerValue: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.govGrey1,
  },
  detailFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 20,
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.govGrey4,
  },
  exportDetailButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.govBlue,
    borderRadius: 8,
    paddingVertical: 14,
    minHeight: 44,
  },
  exportDetailButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.govBlue,
  },
  closeDetailButton: {
    flex: 1,
    backgroundColor: colors.govBlue,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  closeDetailButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.white,
  },
});
