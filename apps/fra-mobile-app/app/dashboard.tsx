import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, Users, Key, FileText, HelpCircle, Bell } from 'lucide-react-native';
import colors from '@/constants/colors';

import type { TabType, VisibleMetrics } from '@/components/dashboard/types';
import { useDashboardFilters } from '@/components/dashboard/useDashboardFilters';
import OverviewTab from '@/components/dashboard/OverviewTab';
import EmployeesTab from '@/components/dashboard/EmployeesTab';
import KeyPassesTab from '@/components/dashboard/KeyPassesTab';
import SignOffTab from '@/components/dashboard/SignOffTab';
import FilterModal from '@/components/dashboard/FilterModal';
import AssessmentDetailModal from '@/components/dashboard/AssessmentDetailModal';
import HelpModal from '@/components/dashboard/HelpModal';

export default function DashboardScreen() {
  const { organisation } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showFilters, setShowFilters] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [lastUpdated] = useState(new Date());
  const [bannerCollapsed, setBannerCollapsed] = useState(false);
  const [visibleMetrics] = useState<VisibleMetrics>({
    keyPasses: true,
    completionRate: true,
    riskDistribution: true,
    departmentBreakdown: true,
  });
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [showAssessmentDetails, setShowAssessmentDetails] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const {
    filterStatus, setFilterStatus,
    searchQuery, setSearchQuery,
    sortBy, setSortBy,
    viewMode, setViewMode,
    filterDepartment, setFilterDepartment,
    filterRisk, setFilterRisk,
    filteredEmployees,
    departments,
    clearAllFilters,
    isLoading,
    error,
    refetch,
  } = useDashboardFilters();

  const totalKeyPasses = organisation?.keyPassesAllocated || 0;
  const usedKeyPasses = organisation?.keyPassesUsed || 0;
  const remainingKeyPasses = totalKeyPasses - usedKeyPasses;

  const alertsCount = useMemo(() => {
    let count = 0;
    const allCompleted = filteredEmployees.length > 0 && filteredEmployees.every(e => e.status === 'completed');
    if (allCompleted) count += 1;
    const highRisk = filteredEmployees.filter(e => e.overallRiskLevel === 'high').length;
    if (highRisk > 0) count += 1;
    return count;
  }, [filteredEmployees]);

  const employeesStarted = useMemo(() => filteredEmployees.filter(e => e.status !== 'not-started').length, [filteredEmployees]);
  const employeesCompleted = useMemo(() => filteredEmployees.filter(e => e.status === 'completed').length, [filteredEmployees]);
  const completionRate = useMemo(() => filteredEmployees.length > 0 ? Math.round((employeesCompleted / filteredEmployees.length) * 100) : 0, [employeesCompleted, filteredEmployees]);

  const riskDistribution = useMemo(() => {
    const completed = filteredEmployees.filter(e => e.status === 'completed');
    return {
      high: completed.filter(e => e.overallRiskLevel === 'high').length,
      medium: completed.filter(e => e.overallRiskLevel === 'medium').length,
      low: completed.filter(e => e.overallRiskLevel === 'low').length,
    };
  }, [filteredEmployees]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  if (!organisation || organisation.packageType !== 'with-dashboard') {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.emptyState}>
            <LayoutDashboard size={64} color={colors.govGrey3} />
            <Text style={styles.emptyTitle}>Dashboard Unavailable</Text>
            <Text style={styles.emptyText}>
              The organisation dashboard is only available with the All Inclusive (FRA + Dashboard) package.
            </Text>
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => router.push('/packages')}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Upgrade Package"
            >
              <Text style={styles.upgradeButtonText}>Upgrade Package</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  if (isLoading && filteredEmployees.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.govBlue} />
          <Text style={styles.loadingText}>Loading dashboard data...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.govBlue} />}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.orgIconContainer}>
              <LayoutDashboard size={28} color={colors.govBlue} />
            </View>
            <View>
              <Text style={styles.title}>{organisation.name}</Text>
              <Text style={styles.subtitle}>Organisation Dashboard</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => setShowHelp(true)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Help"
            >
              <HelpCircle size={24} color={colors.govBlue} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButtonBadge}
              accessibilityRole="button"
              accessibilityLabel={`Notifications, ${alertsCount} pending`}
              onPress={() => {
                const actions: string[] = [];
                const allDone = filteredEmployees.length > 0 && filteredEmployees.every(e => e.status === 'completed');
                if (allDone) actions.push('Main Assessment Sign-Off: Requires your signature');
                const highRisk = filteredEmployees.filter(e => e.overallRiskLevel === 'high').length;
                if (highRisk > 0) actions.push(`${highRisk} high-risk employee${highRisk !== 1 ? 's' : ''} require${highRisk === 1 ? 's' : ''} attention`);
                const message = actions.length > 0
                  ? `You have ${actions.length} pending action${actions.length !== 1 ? 's' : ''}:\n\n${actions.map(a => `• ${a}`).join('\n')}`
                  : 'No pending actions at this time.';
                Alert.alert(
                  'Pending Actions',
                  message,
                  actions.length > 0 && allDone
                    ? [{ text: 'View Later' }, { text: 'Sign Now', onPress: () => router.push('/signature') }]
                    : [{ text: 'OK' }]
                );
              }}
              activeOpacity={0.7}
            >
              <Bell size={24} color={colors.govBlue} />
              {alertsCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>{alertsCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
            <TouchableOpacity
              style={styles.errorRetryButton}
              onPress={onRefresh}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Retry loading data"
            >
              <Text style={styles.errorRetryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'overview' && styles.tabActive]}
            onPress={() => setActiveTab('overview')}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityLabel="Overview"
            accessibilityState={{ selected: activeTab === 'overview' }}
          >
            <LayoutDashboard size={18} color={activeTab === 'overview' ? colors.govBlue : colors.govGrey2} />
            <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>Overview</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'employees' && styles.tabActive]}
            onPress={() => setActiveTab('employees')}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityLabel="Employees"
            accessibilityState={{ selected: activeTab === 'employees' }}
          >
            <Users size={18} color={activeTab === 'employees' ? colors.govBlue : colors.govGrey2} />
            <Text style={[styles.tabText, activeTab === 'employees' && styles.tabTextActive]}>Employees</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'keypasses' && styles.tabActive]}
            onPress={() => setActiveTab('keypasses')}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityLabel="Key-Passes"
            accessibilityState={{ selected: activeTab === 'keypasses' }}
          >
            <Key size={18} color={activeTab === 'keypasses' ? colors.govBlue : colors.govGrey2} />
            <Text style={[styles.tabText, activeTab === 'keypasses' && styles.tabTextActive]}>Key-Passes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'signoff' && styles.tabActive]}
            onPress={() => setActiveTab('signoff')}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityLabel="Sign-Off"
            accessibilityState={{ selected: activeTab === 'signoff' }}
          >
            <FileText size={18} color={activeTab === 'signoff' ? colors.govBlue : colors.govGrey2} />
            <Text style={[styles.tabText, activeTab === 'signoff' && styles.tabTextActive]}>Sign-Off</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'overview' && (
          <OverviewTab
            bannerCollapsed={bannerCollapsed}
            setBannerCollapsed={setBannerCollapsed}
            lastUpdated={lastUpdated}
            visibleMetrics={visibleMetrics}
            setActiveTab={setActiveTab}
            usedKeyPasses={usedKeyPasses}
            totalKeyPasses={totalKeyPasses}
            employeesCompleted={employeesCompleted}
            completionRate={completionRate}
            employeesStarted={employeesStarted}
            riskDistribution={riskDistribution}
            filteredEmployees={filteredEmployees}
          />
        )}
        {activeTab === 'employees' && (
          <EmployeesTab
            filteredEmployees={filteredEmployees}
            viewMode={viewMode}
            setViewMode={setViewMode}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            filterDepartment={filterDepartment}
            setFilterDepartment={setFilterDepartment}
            filterRisk={filterRisk}
            setFilterRisk={setFilterRisk}
            sortBy={sortBy}
            setSortBy={setSortBy}
            setShowFilters={setShowFilters}
            setSelectedEmployee={setSelectedEmployee}
            setShowAssessmentDetails={setShowAssessmentDetails}
            clearAllFilters={clearAllFilters}
          />
        )}
        {activeTab === 'keypasses' && (
          <KeyPassesTab
            usedKeyPasses={usedKeyPasses}
            totalKeyPasses={totalKeyPasses}
            remainingKeyPasses={remainingKeyPasses}
            organisationId={organisation.organisationId}
          />
        )}
        {activeTab === 'signoff' && (
          <SignOffTab
            organisationName={organisation.name}
            totalEmployees={filteredEmployees.length}
            completedEmployees={employeesCompleted}
            packageName={organisation.packageType === 'with-dashboard' ? 'Full (with Dashboard)' : 'Standard'}
          />
        )}
      </ScrollView>

      <FilterModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        filterDepartment={filterDepartment}
        setFilterDepartment={setFilterDepartment}
        filterRisk={filterRisk}
        setFilterRisk={setFilterRisk}
        departments={departments}
      />

      <AssessmentDetailModal
        visible={showAssessmentDetails}
        onClose={() => setShowAssessmentDetails(false)}
        selectedEmployee={selectedEmployee}
        employeeData={filteredEmployees.find(e => e.userId === selectedEmployee) ?? null}
      />

      <HelpModal
        visible={showHelp}
        onClose={() => setShowHelp(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
    gap: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  orgIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  title: {
    fontSize: 28,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 4,
    letterSpacing: -0.28,
    lineHeight: 36.4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.govGrey2,
    lineHeight: 21,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    padding: 4,
  },
  iconButtonBadge: {
    padding: 4,
    position: 'relative' as const,
  },
  notificationBadge: {
    position: 'absolute' as const,
    top: 0,
    right: 0,
    backgroundColor: colors.errorRed,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: colors.white,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.govGrey4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    minHeight: 48,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.govBlue,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: colors.govGrey2,
    letterSpacing: -0.13,
  },
  tabTextActive: {
    color: colors.govBlue,
    fontWeight: '600' as const,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.govGrey1,
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: colors.govGrey2,
    textAlign: 'center' as const,
    lineHeight: 22,
    maxWidth: 300,
    marginBottom: 24,
  },
  upgradeButton: {
    backgroundColor: colors.govBlue,
    borderRadius: 4,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  upgradeButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.white,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: colors.govGrey2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
    gap: 12,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  errorRetryButton: {
    backgroundColor: '#F59E0B',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  errorRetryText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.white,
  },
});
