import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { X, AlertTriangle, Zap, CheckCircle } from 'lucide-react-native';
import colors from '@/constants/colors';

interface HelpModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function HelpModal({ visible, onClose }: HelpModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>How to Read This Dashboard</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close help">
              <X size={24} color={colors.govGrey1} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.helpContent}>
            <View style={styles.helpSection}>
              <Text style={styles.helpSectionTitle}>Overview Tab</Text>
              <Text style={styles.helpText}>View key metrics, completion rates by department, and risk distribution across all completed assessments.</Text>
            </View>

            <View style={styles.helpSection}>
              <Text style={styles.helpSectionTitle}>Employees Tab</Text>
              <Text style={styles.helpText}>See all employees who have used key-passes. Tap any employee to view their detailed assessment status and results.</Text>
            </View>

            <View style={styles.helpSection}>
              <Text style={styles.helpSectionTitle}>Key-Passes Tab</Text>
              <Text style={styles.helpText}>Manage your employee access codes. Generate new invite links and view remaining key-passes.</Text>
            </View>

            <View style={styles.helpSection}>
              <Text style={styles.helpSectionTitle}>Risk Levels</Text>
              <View style={styles.helpRiskRow}>
                <View style={[styles.helpRiskBadge, { backgroundColor: colors.errorRed }]} />
                <AlertTriangle size={16} color={colors.errorRed} style={{ marginLeft: -4 }} />
                <Text style={styles.helpText}>High Risk (15-25): Immediate action required</Text>
              </View>
              <View style={styles.helpRiskRow}>
                <View style={[styles.helpRiskBadge, { backgroundColor: colors.riskMedium }]} />
                <Zap size={16} color="#FF8C00" style={{ marginLeft: -4 }} />
                <Text style={styles.helpText}>Medium Risk (8-14): Plan mitigation within 3-6 months</Text>
              </View>
              <View style={styles.helpRiskRow}>
                <View style={[styles.helpRiskBadge, { backgroundColor: colors.govGreen }]} />
                <CheckCircle size={16} color={colors.govGreen} style={{ marginLeft: -4 }} />
                <Text style={styles.helpText}>Low Risk (1-7): Monitor and review annually</Text>
              </View>
            </View>

            <View style={styles.helpSection}>
              <Text style={styles.helpSectionTitle}>Data Updates</Text>
              <Text style={styles.helpText}>Dashboard metrics refresh automatically when employees complete assessments. Check the &ldquo;Last updated&rdquo; timestamp at the top.</Text>
            </View>
          </ScrollView>
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
  helpContent: {
    maxHeight: 500,
  },
  helpSection: {
    marginBottom: 20,
  },
  helpSectionTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: colors.govGrey2,
    lineHeight: 21,
  },
  helpRiskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  helpRiskBadge: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
});
