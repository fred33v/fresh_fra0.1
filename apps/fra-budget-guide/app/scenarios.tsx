import { useApp, UserRole } from '@/contexts/AppContext';
import { useRouter } from 'expo-router';
import {
  FileText,
  CreditCard,
  Users,
  FileSignature,
  CheckSquare,
  AlertCircle,
} from 'lucide-react-native';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import ScreenContainer from '@/components/ScreenContainer';
import ActionButton from '@/components/ActionButton';
import InfoBanner from '@/components/InfoBanner';
import { colors, spacing, borderRadius } from '@/constants/theme';

interface ScenarioCategory {
  id: string;
  title: string;
  icon: React.ComponentType<{ color: string; size: number }>;
  description: string;
  relevantRoles: UserRole[];
  scenarioCount: number;
}

const scenarioCategories: ScenarioCategory[] = [
  {
    id: 'procurement',
    title: 'Procurement Fraud',
    icon: FileText,
    description: 'Fake suppliers, inflated pricing, kickbacks, and split purchases',
    relevantRoles: ['procurement', 'invoices'],
    scenarioCount: 3,
  },
  {
    id: 'invoice-payment',
    title: 'Invoice & Payment Fraud',
    icon: CreditCard,
    description: 'Email impersonation, duplicate payments, and bank fraud',
    relevantRoles: ['invoices'],
    scenarioCount: 2,
  },
  {
    id: 'payroll',
    title: 'Payroll & HR Fraud',
    icon: Users,
    description: 'Ghost employees, timesheet fraud, and payroll manipulation',
    relevantRoles: ['payroll'],
    scenarioCount: 2,
  },
  {
    id: 'expenses',
    title: 'Expense Fraud',
    icon: FileSignature,
    description: 'False claims, mileage fraud, and fabricated receipts',
    relevantRoles: ['expenses'],
    scenarioCount: 2,
  },
  {
    id: 'contracts',
    title: 'Contract Fraud',
    icon: CheckSquare,
    description: 'Contract splitting and revenue manipulation',
    relevantRoles: ['contracts'],
    scenarioCount: 2,
  },
];

export default function ScenariosScreen() {
  const { selectedRoles } = useApp();
  const router = useRouter();

  const isRelevant = (category: ScenarioCategory) => {
    return category.relevantRoles.some((role) => selectedRoles.includes(role));
  };

  const sortedCategories = [...scenarioCategories].sort((a, b) => {
    const aRelevant = isRelevant(a);
    const bRelevant = isRelevant(b);
    if (aRelevant && !bRelevant) return -1;
    if (!aRelevant && bRelevant) return 1;
    return 0;
  });

  return (
    <ScreenContainer screenId="scenarios">
      <View style={styles.header}>
        <AlertCircle color={colors.danger} size={40} />
        <Text style={styles.title}>Fraud Scenarios You Will Encounter</Text>
        <Text style={styles.subtitle}>
          Real-world fraud examples with red flags and prevention strategies
        </Text>
      </View>

      {selectedRoles.length > 0 && (
        <InfoBanner
          message="Categories relevant to your role are shown first"
          variant="info"
        />
      )}

      <View style={styles.categoriesContainer}>
        {sortedCategories.map((category) => {
          const Icon = category.icon;
          const relevant = isRelevant(category);

          return (
            <TouchableOpacity
              key={category.id}
              style={[styles.categoryCard, relevant && styles.categoryCardRelevant]}
              onPress={() =>
                router.push({
                  pathname: '/scenario-detail',
                  params: { category: category.id },
                })
              }
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${category.title}: ${category.description}. ${category.scenarioCount} scenarios.${relevant ? ' Relevant to your role.' : ''}`}
            >
              <View style={styles.categoryHeader}>
                <View
                  style={[styles.iconCircle, relevant && styles.iconCircleRelevant]}
                >
                  <Icon color={relevant ? colors.danger : colors.textMuted} size={28} />
                </View>
                <View style={styles.categoryInfo}>
                  <View style={styles.titleRow}>
                    <Text style={styles.categoryTitle}>{category.title}</Text>
                    {relevant && <View style={styles.relevantBadge} />}
                  </View>
                  <Text style={styles.categoryDescription}>
                    {category.description}
                  </Text>
                  <Text style={styles.scenarioCount}>
                    {category.scenarioCount} scenario{category.scenarioCount > 1 ? 's' : ''}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <ActionButton
        label="Continue to Red Flags"
        onPress={() => router.push('/red-flags')}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
  categoriesContainer: {
    gap: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  categoryCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  categoryCardRelevant: {
    borderColor: colors.dangerLighter,
    backgroundColor: colors.dangerLightest,
  },
  categoryHeader: {
    flexDirection: 'row',
    padding: spacing.md,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  iconCircleRelevant: {
    backgroundColor: colors.dangerLight,
  },
  categoryInfo: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    marginRight: spacing.sm,
  },
  relevantBadge: {
    width: 8,
    height: 8,
    borderRadius: spacing.xs,
    backgroundColor: colors.danger,
  },
  categoryDescription: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 19,
    marginBottom: spacing.sm,
  },
  scenarioCount: {
    fontSize: 13,
    color: colors.textFaint,
    fontWeight: '500',
  },
});
