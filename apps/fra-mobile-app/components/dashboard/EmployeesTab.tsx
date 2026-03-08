import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput, Share } from 'react-native';
import { Users, Filter, ChevronRight, X, Search, Download, Grid, List, Eye } from 'lucide-react-native';
import colors from '@/constants/colors';
import type { FilterStatus, SortOption, ViewMode, EmployeeData } from './types';

interface EmployeesTabProps {
  filteredEmployees: EmployeeData[];
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterStatus: FilterStatus;
  setFilterStatus: (status: FilterStatus) => void;
  filterDepartment: string;
  setFilterDepartment: (department: string) => void;
  filterRisk: string;
  setFilterRisk: (risk: string) => void;
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;
  setShowFilters: (show: boolean) => void;
  setSelectedEmployee: (userId: string | null) => void;
  setShowAssessmentDetails: (show: boolean) => void;
  clearAllFilters: () => void;
}

export default function EmployeesTab({
  filteredEmployees,
  viewMode,
  setViewMode,
  searchQuery,
  setSearchQuery,
  filterStatus,
  setFilterStatus,
  filterDepartment,
  setFilterDepartment,
  filterRisk,
  setFilterRisk,
  sortBy,
  setSortBy,
  setShowFilters,
  setSelectedEmployee,
  setShowAssessmentDetails,
  clearAllFilters,
}: EmployeesTabProps) {
  const handleExport = useCallback(async () => {
    if (filteredEmployees.length === 0) {
      Alert.alert('No Data', 'There are no employees to export with the current filters.');
      return;
    }
    const header = 'Name,Email,Department,Status,Risk Level,Started,Completed';
    const rows = filteredEmployees.map(e =>
      [
        `"${e.userName}"`,
        `"${e.email}"`,
        `"${e.department}"`,
        e.status,
        e.overallRiskLevel ?? 'N/A',
        e.startedAt ?? '',
        e.completedAt ?? '',
      ].join(',')
    );
    const csv = [header, ...rows].join('\n');
    await Share.share({ message: csv, title: 'Employee Assessment Data' });
  }, [filteredEmployees]);

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Employee Assessments</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={viewMode === 'list' ? 'Switch to grid view' : 'Switch to list view'}
          >
            {viewMode === 'list' ? <Grid size={20} color={colors.govBlue} /> : <List size={20} color={colors.govBlue} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleExport}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Export employee data"
          >
            <Download size={20} color={colors.govBlue} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Search size={18} color={colors.govGrey2} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or email..."
          placeholderTextColor={colors.govGrey2}
          value={searchQuery}
          onChangeText={setSearchQuery}
          accessibilityLabel="Search employees"
        />
        {searchQuery !== '' && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X size={18} color={colors.govGrey2} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterChipsContainer}>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilters(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Open filters"
        >
          <Filter size={16} color={colors.govBlue} />
          <Text style={styles.filterButtonText}>Filters</Text>
        </TouchableOpacity>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChips}>
          {filterStatus !== 'all' && (
            <View style={styles.activeFilterChip}>
              <Text style={styles.activeFilterChipText}>
                {filterStatus === 'in-progress' ? 'In Progress' : filterStatus === 'not-started' ? 'Not Started' : 'Completed'}
              </Text>
              <TouchableOpacity onPress={() => setFilterStatus('all')}>
                <X size={14} color={colors.govBlue} />
              </TouchableOpacity>
            </View>
          )}
          {filterDepartment !== 'all' && (
            <View style={styles.activeFilterChip}>
              <Text style={styles.activeFilterChipText}>{filterDepartment}</Text>
              <TouchableOpacity onPress={() => setFilterDepartment('all')}>
                <X size={14} color={colors.govBlue} />
              </TouchableOpacity>
            </View>
          )}
          {filterRisk !== 'all' && (
            <View style={styles.activeFilterChip}>
              <Text style={styles.activeFilterChipText}>{filterRisk} risk</Text>
              <TouchableOpacity onPress={() => setFilterRisk('all')}>
                <X size={14} color={colors.govBlue} />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </View>

      <View style={styles.sortContainer}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(['name', 'status', 'risk', 'department'] as SortOption[]).map((option) => (
            <TouchableOpacity
              key={option}
              style={[styles.sortOption, sortBy === option && styles.sortOptionActive]}
              onPress={() => setSortBy(option)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Sort by ${option}`}
              accessibilityState={{ selected: sortBy === option }}
            >
              <Text style={[styles.sortOptionText, sortBy === option && styles.sortOptionTextActive]}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {filteredEmployees.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <Users size={48} color={colors.govGrey3} />
          <Text style={styles.emptyStateTitle}>No Employees Found</Text>
          <Text style={styles.emptyStateText}>
            {searchQuery ? 'Try adjusting your search or filters' : 'No employees match the current filters'}
          </Text>
          {(searchQuery || filterStatus !== 'all' || filterDepartment !== 'all' || filterRisk !== 'all') && (
            <TouchableOpacity
              style={styles.clearFiltersButton}
              onPress={clearAllFilters}
              activeOpacity={0.8}
            >
              <Text style={styles.clearFiltersButtonText}>Clear All Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={viewMode === 'grid' ? styles.employeeGrid : undefined}>
      {filteredEmployees.map((employee) => {
        const hasDetails = employee.status === 'completed';
        return (
        <TouchableOpacity
          key={employee.userId}
          style={[styles.employeeCard, viewMode === 'grid' && styles.employeeCardGrid, hasDetails && styles.employeeCardClickable]}
          onPress={() => {
            if (hasDetails) {
              setSelectedEmployee(employee.userId);
              setShowAssessmentDetails(true);
            } else {
              Alert.alert(
                employee.userName,
                `Department: ${employee.department}\nStatus: ${employee.status}\nEmail: ${employee.email}${employee.completedAt ? `\nCompleted: ${new Date(employee.completedAt).toLocaleDateString('en-GB')}` : ''}${employee.overallRiskLevel ? `\nRisk Level: ${employee.overallRiskLevel}` : ''}`,
                [{ text: 'Close' }]
              );
            }
          }}
          activeOpacity={0.8}
        >
          <View style={styles.employeeInfo}>
            <Text style={styles.employeeName}>{employee.userName}</Text>
            <Text style={styles.employeeEmail}>{employee.email}</Text>
            <Text style={styles.employeeDepartment}>{employee.department}</Text>
          </View>

          <View style={styles.employeeStatus}>
            <View style={[
              styles.statusBadge,
              employee.status === 'completed' && styles.statusCompleted,
              employee.status === 'in-progress' && styles.statusInProgress,
              employee.status === 'not-started' && styles.statusNotStarted,
            ]}>
              <Text style={styles.statusText}>
                {employee.status === 'completed' ? 'Completed' :
                 employee.status === 'in-progress' ? 'In Progress' : 'Not Started'}
              </Text>
            </View>

            {employee.status === 'completed' && employee.overallRiskLevel && (
              <View style={[
                styles.riskBadge,
                employee.overallRiskLevel === 'high' && styles.riskHigh,
                employee.overallRiskLevel === 'medium' && styles.riskMedium,
                employee.overallRiskLevel === 'low' && styles.riskLow,
              ]}>
                <Text style={styles.riskText}>
                  {employee.overallRiskLevel.charAt(0).toUpperCase() + employee.overallRiskLevel.slice(1)}
                </Text>
              </View>
            )}

            {hasDetails && (
              <View style={styles.viewDetailsButton}>
                <Eye size={16} color={colors.govBlue} />
                <Text style={styles.viewDetailsText}>View Details</Text>
              </View>
            )}
            {!hasDetails && viewMode === 'list' && (
              <ChevronRight size={20} color={colors.govGrey2} />
            )}
          </View>
        </TouchableOpacity>
        );
      })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 16,
    letterSpacing: -0.2,
    lineHeight: 26,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.govGrey3,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.govGrey1,
    padding: 0,
    lineHeight: 20,
  },
  filterChipsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.lightBlue,
    borderRadius: 6,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.govBlue,
  },
  filterChips: {
    flexGrow: 0,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightBlue,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    gap: 6,
  },
  activeFilterChipText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.govBlue,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  sortLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.govGrey2,
  },
  sortOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.govGrey4,
    borderRadius: 20,
    marginRight: 8,
  },
  sortOptionActive: {
    backgroundColor: colors.govBlue,
  },
  sortOptionText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.govGrey2,
  },
  sortOptionTextActive: {
    color: colors.white,
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
  clearFiltersButton: {
    backgroundColor: colors.govBlue,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    minHeight: 44,
    justifyContent: 'center',
  },
  clearFiltersButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.white,
  },
  employeeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  employeeCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    minHeight: 44,
  },
  employeeCardGrid: {
    flex: 1,
    minWidth: '45%',
  },
  employeeCardClickable: {
    borderWidth: 1,
    borderColor: colors.govBlue + '20',
  },
  employeeInfo: {
    marginBottom: 12,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 2,
  },
  employeeEmail: {
    fontSize: 13,
    color: colors.govGrey2,
  },
  employeeDepartment: {
    fontSize: 12,
    color: colors.govGrey2,
    marginTop: 2,
  },
  employeeStatus: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusCompleted: {
    backgroundColor: colors.statusCompleted,
  },
  statusInProgress: {
    backgroundColor: colors.statusInProgress,
  },
  statusNotStarted: {
    backgroundColor: colors.statusNotStarted,
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
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.lightBlue,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  viewDetailsText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.govBlue,
  },
});
