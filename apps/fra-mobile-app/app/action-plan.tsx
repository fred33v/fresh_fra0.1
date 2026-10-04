import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ListChecks, AlertTriangle, Clock } from 'lucide-react-native';
import colors from '@/constants/colors';
import { useAssessment } from '@/contexts/AssessmentContext';
import { buildActionPlan, calculateRiskScore } from '@/utils/assessment';

export default function ActionPlanScreen() {
  const router = useRouter();
  const { assessment, updateAssessment } = useAssessment();

  // Built from this organisation's answers, so the screen, the review and the PDF agree
  const risks = useMemo(() => calculateRiskScore(assessment), [assessment]);
  const plan = useMemo(() => buildActionPlan(risks), [risks]);
  const highPriorityActions = plan.highPriority;
  const mediumPriorityActions = plan.mediumPriority;
  const lowPriorityActions = plan.lowPriority;
  const focusAreas = [...new Set(risks.map((r) => r.area))];

  const handleNext = () => {
    updateAssessment({ actionPlan: plan });
    router.push('/review');
  };

  const renderActionCard = (action: { id: string; title: string; owner: string; timeline: string }, index: number, priority: 'high' | 'medium' | 'low') => {
    const priorityColor = priority === 'high' ? colors.govRed : priority === 'medium' ? colors.warningOrange : colors.successGreen;
    
    return (
      <View key={action.id} style={[styles.actionCard, { borderLeftColor: priorityColor }]}>
        <Text style={styles.actionTitle}>{action.title}</Text>
        <View style={styles.actionMeta}>
          <Text style={styles.metaItem}>👤 {action.owner}</Text>
          <Text style={styles.metaItem}>📅 {action.timeline}</Text>
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <ListChecks size={32} color={colors.govBlue} />
        <Text style={styles.title} accessibilityRole="header">Action Plan</Text>
      </View>

      <Text style={styles.intro}>
        Based on your assessment, here are prioritized actions to strengthen your fraud prevention framework.
      </Text>

      {highPriorityActions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <AlertTriangle size={20} color={colors.govRed} />
            <Text style={styles.sectionTitle}>High Priority (0-3 Months)</Text>
          </View>
          <View style={styles.priorityBadge}>
            <Text style={styles.priorityText}>{highPriorityActions.length} critical action{highPriorityActions.length === 1 ? '' : 's'}</Text>
          </View>
          {highPriorityActions.map((action, index) => renderActionCard(action, index, 'high'))}
        </View>
      )}

      {mediumPriorityActions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Clock size={20} color={colors.warningOrange} />
            <Text style={styles.sectionTitle}>Medium Priority (3-6 Months)</Text>
          </View>
          <View style={[styles.priorityBadge, styles.mediumBadge]}>
            <Text style={styles.priorityText}>{mediumPriorityActions.length} important action{mediumPriorityActions.length === 1 ? '' : 's'}</Text>
          </View>
          {mediumPriorityActions.map((action, index) => renderActionCard(action, index, 'medium'))}
        </View>
      )}

      {lowPriorityActions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ListChecks size={20} color={colors.successGreen} />
            <Text style={styles.sectionTitle}>Low Priority (6-12 Months)</Text>
          </View>
          <View style={[styles.priorityBadge, styles.lowBadge]}>
            <Text style={styles.priorityText}>{lowPriorityActions.length} enhancement action{lowPriorityActions.length === 1 ? '' : 's'}</Text>
          </View>
          {lowPriorityActions.map((action, index) => renderActionCard(action, index, 'low'))}
        </View>
      )}

      <View style={styles.summaryBox}>
        <Text style={styles.summaryTitle}>📊 Action Plan Summary</Text>
        <Text style={styles.summaryItem}>• Total actions: {highPriorityActions.length + mediumPriorityActions.length + lowPriorityActions.length}</Text>
        <Text style={styles.summaryItem}>• Risks identified: {risks.length}</Text>
        <Text style={styles.summaryItem}>• Key focus areas: {focusAreas.join(', ')}</Text>
      </View>

      <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Review Complete Assessment">
        <Text style={styles.nextButtonText}>Review Complete Assessment</Text>
      </TouchableOpacity>
    </ScrollView>
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
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.govGrey1,
  },
  priorityBadge: {
    backgroundColor: colors.govRed,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  mediumBadge: {
    backgroundColor: colors.warningOrange,
  },
  lowBadge: {
    backgroundColor: colors.successGreen,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: colors.white,
    textTransform: 'uppercase' as const,
  },
  actionCard: {
    backgroundColor: colors.lightBlue,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  actionTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 8,
  },
  actionMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  metaItem: {
    fontSize: 13,
    color: colors.govGrey2,
  },
  summaryBox: {
    backgroundColor: colors.govBlue,
    borderRadius: 8,
    padding: 18,
    marginTop: 8,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: colors.white,
    marginBottom: 12,
  },
  summaryItem: {
    fontSize: 14,
    color: colors.white,
    marginBottom: 6,
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
