import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAssessment } from '@/contexts/AssessmentContext';
import { DollarSign, AlertTriangle, Shield, Activity } from 'lucide-react-native';
import colors from '@/constants/colors';

export default function PaymentsModuleScreen() {
  const router = useRouter();
  const { assessment, updateAssessment } = useAssessment();
  const [notes, setNotes] = useState(assessment.paymentsModule.notes);

  const handleNext = () => {
    updateAssessment({
      paymentsModule: {
        ...assessment.paymentsModule,
        notes,
      },
    });
    router.push('/training-awareness');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <DollarSign size={32} color={colors.govBlue} />
          <Text style={styles.title} accessibilityRole="header">Payments Risk Module</Text>
        </View>

        <Text style={styles.intro}>
          Payments represent one of the highest-exposure fraud areas. This section helps identify specific payment-related risks and controls.
        </Text>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AlertTriangle size={20} color={colors.govRed} />
            <Text style={styles.sectionTitle}>Key Payment Fraud Risks</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.riskCategory}>Supplier & Accounts Payable Risks:</Text>
            <Text style={styles.riskItem}>• Duplicate payments</Text>
            <Text style={styles.riskItem}>• Fictitious suppliers</Text>
            <Text style={styles.riskItem}>• Invoice manipulation or inflation</Text>
            <Text style={styles.riskItem}>• Bank detail manipulation</Text>
            <Text style={styles.riskItem}>• Business Email Compromise (BEC)</Text>
            <Text style={styles.riskItem}>• Collusion between employees and suppliers</Text>
          </View>

          <View style={[styles.card, styles.cardMargin]}>
            <Text style={styles.riskCategory}>Payroll Payment Risks:</Text>
            <Text style={styles.riskItem}>• Ghost employees</Text>
            <Text style={styles.riskItem}>• Salary overpayments</Text>
            <Text style={styles.riskItem}>• Manipulated overtime or allowances</Text>
            <Text style={styles.riskItem}>• Unauthorised payroll changes</Text>
          </View>

          <View style={[styles.card, styles.cardMargin]}>
            <Text style={styles.riskCategory}>Refund & Credit Note Risks:</Text>
            <Text style={styles.riskItem}>• Fraudulent refunds to staff-associated accounts</Text>
            <Text style={styles.riskItem}>• Excessive or unjustified refunds</Text>
            <Text style={styles.riskItem}>• Manual override of refund rules</Text>
          </View>

          <View style={[styles.card, styles.cardMargin]}>
            <Text style={styles.riskCategory}>Treasury & High-Value Payment Risks:</Text>
            <Text style={styles.riskItem}>• Unauthorised international transfers</Text>
            <Text style={styles.riskItem}>• Compromised payment tokens/devices</Text>
            <Text style={styles.riskItem}>• Bypass of dual approval</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Shield size={20} color={colors.successGreen} />
            <Text style={styles.sectionTitle}>Existing Controls</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.controlItem}>✓ 3-way match (PO, receipt, invoice)</Text>
            <Text style={styles.controlItem}>✓ Segregation of duties</Text>
            <Text style={styles.controlItem}>✓ Dual approval on high-value transfers</Text>
            <Text style={styles.controlItem}>✓ Vendor masterfile access restrictions</Text>
            <Text style={styles.controlItem}>✓ Payment tokens secured</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Activity size={20} color={colors.warningOrange} />
            <Text style={styles.sectionTitle}>Monitoring Rules</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.monitoringItem}>📊 Duplicate invoice detection (daily)</Text>
            <Text style={styles.monitoringItem}>🔍 New supplier created & paid within 7 days (weekly)</Text>
            <Text style={styles.monitoringItem}>🏦 Bank details changed & invoice within 30 days (daily)</Text>
            <Text style={styles.monitoringItem}>💸 Refunds exceeding threshold flagged (daily)</Text>
            <Text style={styles.monitoringItem}>📈 Outlier payment detection (real-time)</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Additional Notes or Concerns</Text>
          <Text style={styles.hint}>
            Describe any payment-specific risks or controls unique to your organisation
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Enter any additional payment risk considerations..."
            placeholderTextColor={colors.govGrey3}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            accessibilityLabel="Additional notes or concerns"
          />
        </View>

        <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Continue to Training and Awareness">
          <Text style={styles.nextButtonText}>Continue to Training & Awareness</Text>
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
  cardMargin: {
    marginTop: 12,
  },
  riskCategory: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 8,
  },
  riskItem: {
    fontSize: 14,
    color: colors.govGrey2,
    marginBottom: 4,
    paddingLeft: 8,
  },
  controlItem: {
    fontSize: 14,
    color: colors.govGrey1,
    marginBottom: 6,
    paddingLeft: 4,
  },
  monitoringItem: {
    fontSize: 14,
    color: colors.govGrey1,
    marginBottom: 6,
    paddingLeft: 4,
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
