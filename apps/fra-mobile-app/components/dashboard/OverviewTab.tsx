import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertCircle, CheckCircle, Clock, PenTool, ArrowRight, ChevronDown, ChevronUp, Key, Users, TrendingUp, FileText, Info, RefreshCw, AlertTriangle, Zap } from 'lucide-react-native';
import colors from '@/constants/colors';
import type { TabType, VisibleMetrics, EmployeeData, CompletionByDepartment, CompletionTrend } from './types';

interface RiskDistribution {
  high: number;
  medium: number;
  low: number;
}

interface OverviewTabProps {
  bannerCollapsed: boolean;
  setBannerCollapsed: (collapsed: boolean) => void;
  lastUpdated: Date;
  visibleMetrics: VisibleMetrics;
  setActiveTab: (tab: TabType) => void;
  usedKeyPasses: number;
  totalKeyPasses: number;
  employeesCompleted: number;
  completionRate: number;
  employeesStarted: number;
  riskDistribution: RiskDistribution;
  filteredEmployees: EmployeeData[];
}

export default function OverviewTab({
  bannerCollapsed,
  setBannerCollapsed,
  lastUpdated,
  visibleMetrics,
  setActiveTab,
  usedKeyPasses,
  totalKeyPasses,
  employeesCompleted,
  completionRate,
  employeesStarted,
  riskDistribution,
  filteredEmployees,
}: OverviewTabProps) {
  const router = useRouter();

  const departmentData = useMemo((): CompletionByDepartment[] => {
    const deptMap = new Map<string, { completed: number; total: number }>();
    for (const e of filteredEmployees) {
      const dept = e.department || 'General';
      const entry = deptMap.get(dept) ?? { completed: 0, total: 0 };
      entry.total++;
      if (e.status === 'completed') entry.completed++;
      deptMap.set(dept, entry);
    }
    return Array.from(deptMap.entries()).map(([department, { completed, total }]) => ({
      department,
      completed,
      total,
    }));
  }, [filteredEmployees]);

  const trendData = useMemo((): CompletionTrend[] => {
    const completed = filteredEmployees
      .filter((e) => e.completedAt)
      .map((e) => new Date(e.completedAt!));
    if (completed.length === 0) return [{ date: 'This week', completed: 0 }];
    completed.sort((a, b) => a.getTime() - b.getTime());
    const now = new Date();
    const weeks: CompletionTrend[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - i * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const count = completed.filter((d) => d >= weekStart && d < weekEnd).length;
      weeks.push({ date: `Week ${4 - i}`, completed: count });
    }
    return weeks;
  }, [filteredEmployees]);

  const maxTrend = Math.max(...trendData.map((t) => t.completed), 1);

  const chartData = departmentData.map((d) => ({
    department: d.department,
    rate: d.total > 0 ? (d.completed / d.total) * 100 : 0,
  }));

  return (
    <>
      {!bannerCollapsed && (
      <View style={styles.priorityBanner}>
        <View style={styles.bannerHeader}>
          <View style={styles.bannerIconContainer}>
            <AlertCircle size={24} color={colors.white} />
          </View>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerTitle}>Action Required</Text>
            <Text style={styles.bannerSubtitle}>Main Assessment Sign-Off Pending</Text>
          </View>
        </View>
        <View style={styles.progressTracker}>
          <View style={styles.progressStep}>
            <View style={[styles.progressDot, styles.progressDotComplete]}>
              <CheckCircle size={16} color={colors.white} />
            </View>
            <Text style={styles.progressLabel}>Draft</Text>
          </View>
          <View style={styles.progressLine} />
          <View style={styles.progressStep}>
            <View style={[styles.progressDot, styles.progressDotComplete]}>
              <CheckCircle size={16} color={colors.white} />
            </View>
            <Text style={styles.progressLabel}>Under Review</Text>
          </View>
          <View style={styles.progressLine} />
          <View style={styles.progressStep}>
            <View style={[styles.progressDot, styles.progressDotActive]}>
              <Clock size={16} color={colors.white} />
            </View>
            <Text style={[styles.progressLabel, styles.progressLabelActive]}>Sign-Off</Text>
          </View>
          <View style={[styles.progressLine, styles.progressLineInactive]} />
          <View style={styles.progressStep}>
            <View style={styles.progressDot}>
              <Text style={styles.progressDotNumber}>4</Text>
            </View>
            <Text style={styles.progressLabel}>Signed</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.bannerButton}
          onPress={() => router.push('/signature')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Review and Sign Now"
        >
          <PenTool size={18} color={colors.white} />
          <Text style={styles.bannerButtonText}>Review & Sign Now</Text>
          <ArrowRight size={18} color={colors.white} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.bannerCollapseButton}
          onPress={() => setBannerCollapsed(true)}
          activeOpacity={0.8}
        >
          <ChevronUp size={16} color={colors.white} />
          <Text style={styles.bannerCollapseText}>Dismiss</Text>
        </TouchableOpacity>
      </View>
      )}

      {bannerCollapsed && (
        <TouchableOpacity
          style={styles.collapsedBanner}
          onPress={() => setBannerCollapsed(false)}
          activeOpacity={0.8}
        >
          <AlertCircle size={20} color={colors.warningOrange} />
          <Text style={styles.collapsedBannerText}>Action Required: Sign-Off Pending</Text>
          <ChevronDown size={20} color={colors.warningOrange} />
        </TouchableOpacity>
      )}

      <View style={styles.lastUpdatedContainer}>
        <RefreshCw size={14} color={colors.govGrey2} />
        <Text style={styles.lastUpdatedText}>
          Last updated: {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>

      {visibleMetrics.keyPasses && (
        <View style={styles.metricsSection}>
        <View style={styles.metricsGrid}>
          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => setActiveTab('keypasses')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Key-Passes: ${usedKeyPasses} of ${totalKeyPasses} used. Tap to view details`}
          >
            <View style={styles.metricIcon}>
              <Key size={24} color={colors.govBlue} />
            </View>
            <Text style={styles.metricValue}>{usedKeyPasses}/{totalKeyPasses}</Text>
            <Text style={styles.metricLabel}>Key-Passes Used</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.metricCard}
            onPress={() => setActiveTab('employees')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${employeesCompleted} employees completed. Tap to view details`}
          >
            <View style={styles.metricIcon}>
              <Users size={24} color={colors.govGreen} />
            </View>
            <Text style={styles.metricValue}>{employeesCompleted}</Text>
            <Text style={styles.metricLabel}>Completed</Text>
          </TouchableOpacity>

          <View style={styles.metricCard} accessible accessibilityLabel={`Completion rate: ${completionRate}%`}>
            <View style={styles.metricIcon}>
              <TrendingUp size={24} color={colors.warningOrange} />
            </View>
            <Text style={styles.metricValue}>{completionRate}%</Text>
            <Text style={styles.metricLabel}>Completion Rate</Text>
          </View>

          <View style={styles.metricCard} accessible accessibilityLabel={`${employeesStarted} employees in progress`}>
            <View style={styles.metricIcon}>
              <FileText size={24} color={colors.govBlue} />
            </View>
            <Text style={styles.metricValue}>{employeesStarted}</Text>
            <Text style={styles.metricLabel}>In Progress</Text>
          </View>
        </View>
        </View>
      )}

      {visibleMetrics.departmentBreakdown && (
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.sectionTitle}>Completion by Department</Text>
            <TouchableOpacity
              onPress={() => Alert.alert('Chart Info', 'Shows the percentage of completed assessments by department.')}
              accessibilityRole="button"
              accessibilityLabel="Department chart information"
            >
              <Info size={18} color={colors.govGrey2} />
            </TouchableOpacity>
          </View>
          <View style={styles.chartPlaceholder}>
            {chartData.map((item) => (
              <TouchableOpacity
                key={item.department}
                style={styles.barChartRow}
                activeOpacity={0.7}
                onPress={() => Alert.alert(item.department, `${Math.round(item.rate)}% completed`)}
                accessibilityRole="button"
                accessibilityLabel={`${item.department}: ${Math.round(item.rate)}% completed`}
              >
                <Text style={styles.barChartLabel}>{item.department}</Text>
                <View style={styles.barChartBarContainer}>
                  <View style={[styles.barChartBar, { width: `${item.rate}%` }]}>
                    {item.rate > 15 && (
                      <Text style={styles.barChartInnerValue}>{Math.round(item.rate)}%</Text>
                    )}
                  </View>
                </View>
                <Text style={styles.barChartValue}>{Math.round(item.rate)}%</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {visibleMetrics.completionRate && (
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.sectionTitle}>Completion Trend</Text>
            <TouchableOpacity
              onPress={() => Alert.alert('Chart Info', 'Shows how many assessments were completed over the past 4 weeks.')}
              accessibilityRole="button"
              accessibilityLabel="Completion trend chart information"
            >
              <Info size={18} color={colors.govGrey2} />
            </TouchableOpacity>
          </View>
          <View style={styles.lineChartWrapper}>
            <View style={styles.yAxisLabels}>
              <Text style={styles.yAxisLabel}>{maxTrend}</Text>
              <Text style={styles.yAxisLabel}>{Math.round(maxTrend * 2 / 3)}</Text>
              <Text style={styles.yAxisLabel}>{Math.round(maxTrend / 3)}</Text>
              <Text style={styles.yAxisLabel}>0</Text>
            </View>
            <View style={styles.chartWithGrid}>
              <View style={styles.gridLines}>
                <View style={styles.gridLine} />
                <View style={styles.gridLine} />
                <View style={styles.gridLine} />
                <View style={styles.gridLine} />
              </View>
              <View style={styles.lineChartContainer}>
                {trendData.map((item) => (
                  <TouchableOpacity
                    key={item.date}
                    style={styles.lineChartPoint}
                    activeOpacity={0.7}
                    onPress={() => Alert.alert(item.date, `${item.completed} assessments completed`)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.date}: ${item.completed} assessments completed`}
                  >
                    <View style={styles.lineChartBar}>
                      <View style={[styles.lineChartBarFill, { height: `${(item.completed / maxTrend) * 100}%` }]} />
                    </View>
                    <Text style={styles.barValueLabel}>{item.completed}</Text>
                    <Text style={styles.lineChartLabel}>{item.date}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
          <View style={styles.chartTargetLine}>
            <View style={styles.targetLineDash} />
            <Text style={styles.targetLineText}>Target: {filteredEmployees.length} assessments</Text>
          </View>
        </View>
      )}

      {visibleMetrics.riskDistribution && (
        <View style={styles.riskCard}>
          <Text style={styles.sectionTitle}>Risk Distribution</Text>
          <View style={styles.riskBars}>
            <View style={styles.riskBarRow}>
              <View style={styles.riskLabelContainer}>
                <AlertTriangle size={18} color={colors.errorRed} />
                <Text style={styles.riskLabel}>High Risk</Text>
              </View>
              <View style={styles.riskBarContainer}>
                <View style={[styles.riskBarFill, styles.riskBarHigh, { width: `${Math.max(riskDistribution.high * 20, 5)}%` }]} />
              </View>
              <View style={styles.riskCountContainer}>
                <Text style={styles.riskCount}>{riskDistribution.high}</Text>
                <Text style={styles.riskPercentage}>({employeesCompleted > 0 ? Math.round((riskDistribution.high / employeesCompleted) * 100) : 0}%)</Text>
              </View>
            </View>
            <View style={styles.riskBarRow}>
              <View style={styles.riskLabelContainer}>
                <Zap size={18} color={colors.riskMedium} />
                <Text style={styles.riskLabel}>Medium Risk</Text>
              </View>
              <View style={styles.riskBarContainer}>
                <View style={[styles.riskBarFill, styles.riskBarMedium, { width: `${Math.max(riskDistribution.medium * 20, 5)}%` }]} />
              </View>
              <View style={styles.riskCountContainer}>
                <Text style={styles.riskCount}>{riskDistribution.medium}</Text>
                <Text style={styles.riskPercentage}>({employeesCompleted > 0 ? Math.round((riskDistribution.medium / employeesCompleted) * 100) : 0}%)</Text>
              </View>
            </View>
            <View style={styles.riskBarRow}>
              <View style={styles.riskLabelContainer}>
                <CheckCircle size={16} color={colors.govGreen} />
                <Text style={styles.riskLabel}>Low Risk</Text>
              </View>
              <View style={styles.riskBarContainer}>
                <View style={[styles.riskBarFill, styles.riskBarLow, { width: `${Math.max(riskDistribution.low * 20, 5)}%` }]} />
              </View>
              <View style={styles.riskCountContainer}>
                <Text style={styles.riskCount}>{riskDistribution.low}</Text>
                <Text style={styles.riskPercentage}>({employeesCompleted > 0 ? Math.round((riskDistribution.low / employeesCompleted) * 100) : 0}%)</Text>
              </View>
            </View>
          </View>
          <Text style={styles.riskLegend}>Based on {employeesCompleted} completed assessments</Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  priorityBanner: {
    backgroundColor: colors.warningOrange,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  bannerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.white,
    marginBottom: 2,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: colors.white,
    opacity: 0.9,
  },
  progressTracker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  progressStep: {
    alignItems: 'center',
    flex: 1,
  },
  progressDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  progressDotComplete: {
    backgroundColor: colors.govGreen,
  },
  progressDotActive: {
    backgroundColor: colors.govBlue,
  },
  progressDotNumber: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: colors.white,
  },
  progressLabel: {
    fontSize: 10,
    color: colors.white,
    textAlign: 'center' as const,
    opacity: 0.8,
  },
  progressLabelActive: {
    fontWeight: '700' as const,
    opacity: 1,
  },
  progressLine: {
    height: 2,
    flex: 1,
    backgroundColor: colors.govGreen,
    marginHorizontal: -8,
  },
  progressLineInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  bannerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
  },
  bannerButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.warningOrange,
  },
  bannerCollapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
  },
  bannerCollapseText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.white,
    opacity: 0.9,
  },
  collapsedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    gap: 12,
    borderLeftWidth: 4,
    borderLeftColor: colors.warningOrange,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  collapsedBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.govGrey1,
  },
  lastUpdatedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  lastUpdatedText: {
    fontSize: 12,
    color: colors.govGrey2,
  },
  metricsSection: {
    marginBottom: 24,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    minHeight: 44,
  },
  metricIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.govGrey1,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 13,
    color: colors.govGrey2,
    textAlign: 'center' as const,
  },
  chartCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 16,
    letterSpacing: -0.2,
    lineHeight: 26,
  },
  chartPlaceholder: {
    paddingVertical: 10,
  },
  barChartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  barChartLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    width: 80,
  },
  barChartBarContainer: {
    flex: 1,
    height: 24,
    backgroundColor: colors.govGrey4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barChartBar: {
    height: '100%',
    backgroundColor: colors.govBlue,
    borderRadius: 4,
  },
  barChartValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: colors.govGrey1,
    width: 40,
    textAlign: 'right' as const,
  },
  barChartInnerValue: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: colors.white,
    paddingLeft: 8,
    paddingVertical: 2,
  },
  lineChartWrapper: {
    flexDirection: 'row',
    gap: 12,
  },
  yAxisLabels: {
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  yAxisLabel: {
    fontSize: 11,
    color: colors.govGrey2,
    width: 20,
  },
  chartWithGrid: {
    flex: 1,
    position: 'relative' as const,
  },
  gridLines: {
    position: 'absolute' as const,
    top: 10,
    left: 0,
    right: 0,
    bottom: 40,
    justifyContent: 'space-between',
  },
  gridLine: {
    height: 1,
    backgroundColor: colors.govGrey4,
  },
  lineChartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: 180,
    paddingVertical: 20,
  },
  lineChartPoint: {
    alignItems: 'center',
    flex: 1,
  },
  lineChartBar: {
    width: 40,
    height: 120,
    backgroundColor: colors.govGrey4,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  lineChartBarFill: {
    width: '100%',
    backgroundColor: colors.govBlue,
    borderRadius: 4,
  },
  lineChartLabel: {
    fontSize: 11,
    color: colors.govGrey2,
    marginTop: 8,
    textAlign: 'center' as const,
  },
  barValueLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: colors.govGrey1,
    marginTop: 4,
  },
  chartTargetLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  targetLineDash: {
    flex: 1,
    height: 2,
    backgroundColor: colors.govGrey3,
    borderRadius: 1,
  },
  targetLineText: {
    fontSize: 12,
    color: colors.govGrey2,
  },
  riskCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  riskBars: {
    gap: 12,
  },
  riskBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  riskLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: 110,
  },
  riskLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    width: 80,
  },
  riskBarContainer: {
    flex: 1,
    height: 20,
    backgroundColor: colors.govGrey4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  riskBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  riskBarHigh: {
    backgroundColor: colors.errorRed,
  },
  riskBarMedium: {
    backgroundColor: colors.riskMedium,
  },
  riskBarLow: {
    backgroundColor: colors.govGreen,
  },
  riskCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 70,
  },
  riskCount: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: colors.govGrey1,
    width: 30,
    textAlign: 'right' as const,
  },
  riskPercentage: {
    fontSize: 12,
    color: colors.govGrey2,
  },
  riskLegend: {
    fontSize: 12,
    color: colors.govGrey2,
    marginTop: 12,
  },
});
