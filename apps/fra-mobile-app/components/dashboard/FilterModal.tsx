import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { X } from 'lucide-react-native';
import colors from '@/constants/colors';
import type { FilterStatus } from './types';

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  filterStatus: FilterStatus;
  setFilterStatus: (status: FilterStatus) => void;
  filterDepartment: string;
  setFilterDepartment: (department: string) => void;
  filterRisk: string;
  setFilterRisk: (risk: string) => void;
  departments: string[];
}

export default function FilterModal({
  visible,
  onClose,
  filterStatus,
  setFilterStatus,
  filterDepartment,
  setFilterDepartment,
  filterRisk,
  setFilterRisk,
  departments,
}: FilterModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filters</Text>
            <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close filters">
              <X size={24} color={colors.govGrey1} />
            </TouchableOpacity>
          </View>

          <Text style={styles.filterSectionTitle}>Status</Text>
          <View style={styles.filterOptions}>
            {(['all', 'completed', 'in-progress', 'not-started'] as FilterStatus[]).map((status) => (
              <TouchableOpacity
                key={status}
                style={[styles.filterOption, filterStatus === status && styles.filterOptionActive]}
                onPress={() => setFilterStatus(status)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Filter by status: ${status === 'all' ? 'All' : status}`}
                accessibilityState={{ selected: filterStatus === status }}
              >
                <Text style={[styles.filterOptionText, filterStatus === status && styles.filterOptionTextActive]}>
                  {status === 'all' ? 'All' : status === 'in-progress' ? 'In Progress' : status === 'not-started' ? 'Not Started' : 'Completed'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.filterSectionTitle}>Department</Text>
          <View style={styles.filterOptions}>
            {departments.map((dept) => (
              <TouchableOpacity
                key={dept}
                style={[styles.filterOption, filterDepartment === dept && styles.filterOptionActive]}
                onPress={() => setFilterDepartment(dept)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Filter by department: ${dept === 'all' ? 'All' : dept}`}
                accessibilityState={{ selected: filterDepartment === dept }}
              >
                <Text style={[styles.filterOptionText, filterDepartment === dept && styles.filterOptionTextActive]}>
                  {dept === 'all' ? 'All Departments' : dept}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.filterSectionTitle}>Risk Level</Text>
          <View style={styles.filterOptions}>
            {['all', 'high', 'medium', 'low'].map((risk) => (
              <TouchableOpacity
                key={risk}
                style={[styles.filterOption, filterRisk === risk && styles.filterOptionActive]}
                onPress={() => setFilterRisk(risk)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Filter by risk: ${risk === 'all' ? 'All' : risk}`}
                accessibilityState={{ selected: filterRisk === risk }}
              >
                <Text style={[styles.filterOptionText, filterRisk === risk && styles.filterOptionTextActive]}>
                  {risk === 'all' ? 'All Risks' : `${risk.charAt(0).toUpperCase() + risk.slice(1)} Risk`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.applyButton}
            onPress={onClose}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Apply filters"
          >
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </TouchableOpacity>
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
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 12,
    marginTop: 16,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.govGrey4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.govGrey3,
  },
  filterOptionActive: {
    backgroundColor: colors.lightBlue,
    borderColor: colors.govBlue,
  },
  filterOptionText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.govGrey2,
  },
  filterOptionTextActive: {
    color: colors.govBlue,
  },
  applyButton: {
    backgroundColor: colors.govBlue,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.white,
  },
});
