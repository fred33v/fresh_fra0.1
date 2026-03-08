import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
} from 'react-native';
import { Clock, CalendarDays, Target, Plus, X } from 'lucide-react-native';
import ScreenContainer from '@/components/ScreenContainer';
import ActionButton from '@/components/ActionButton';
import InfoBanner from '@/components/InfoBanner';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';
import { useTraining } from '@/contexts/TrainingContext';
import { actionPlanTemplates } from '@/constants/data/actionPlanTemplates';

interface CategoryConfig {
  key: 'immediate' | 'thirtyDays' | 'ninetyDays';
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ color: string; size: number }>;
}

const categories: CategoryConfig[] = [
  {
    key: 'immediate',
    title: 'Immediate Actions',
    subtitle: 'Within the next week',
    icon: Clock,
  },
  {
    key: 'thirtyDays',
    title: '30-Day Actions',
    subtitle: 'Within the next month',
    icon: CalendarDays,
  },
  {
    key: 'ninetyDays',
    title: '90-Day Actions',
    subtitle: 'Within the next quarter',
    icon: Target,
  },
];

export default function ActionPlanScreen() {
  const router = useRouter();
  const { saveActionPlan, completeSection } = useTraining();

  const [commitments, setCommitments] = useState<{
    immediate: string[];
    thirtyDays: string[];
    ninetyDays: string[];
  }>({
    immediate: [...actionPlanTemplates.immediate],
    thirtyDays: [...actionPlanTemplates.thirtyDays],
    ninetyDays: [...actionPlanTemplates.ninetyDays],
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateItem = (
    category: 'immediate' | 'thirtyDays' | 'ninetyDays',
    index: number,
    value: string
  ) => {
    setCommitments((prev) => {
      const updated = [...prev[category]];
      updated[index] = value;
      return { ...prev, [category]: updated };
    });
  };

  const addItem = (category: 'immediate' | 'thirtyDays' | 'ninetyDays') => {
    setCommitments((prev) => ({
      ...prev,
      [category]: [...prev[category], ''],
    }));
  };

  const removeItem = (
    category: 'immediate' | 'thirtyDays' | 'ninetyDays',
    index: number
  ) => {
    setCommitments((prev) => {
      const updated = prev[category].filter((_, i) => i !== index);
      return { ...prev, [category]: updated };
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    // Filter out empty entries
    const cleaned = {
      immediate: commitments.immediate.filter((s) => s.trim()),
      thirtyDays: commitments.thirtyDays.filter((s) => s.trim()),
      ninetyDays: commitments.ninetyDays.filter((s) => s.trim()),
    };

    await saveActionPlan(cleaned);
    await completeSection(6);
    setIsSubmitting(false);
    router.back();
  };

  const hasContent =
    commitments.immediate.some((s) => s.trim()) ||
    commitments.thirtyDays.some((s) => s.trim()) ||
    commitments.ninetyDays.some((s) => s.trim());

  return (
    <ScreenContainer>
      {/* Introduction */}
      <View style={styles.introSection}>
        <Text style={styles.title}>Your Action Plan</Text>
        <Text style={styles.subtitle}>
          Review and customise the actions below to create your personal fraud
          prevention commitments.
        </Text>
      </View>

      <InfoBanner
        message="These suggestions are pre-filled from best-practice templates. Edit them to match your organisational context."
        variant="info"
      />

      {/* Categories */}
      {categories.map((category) => {
        const Icon = category.icon;
        const items = commitments[category.key];

        return (
          <View
            key={category.key}
            style={styles.categorySection}
            accessibilityRole="list"
            accessibilityLabel={category.title}
          >
            <View style={styles.categoryHeader}>
              <Icon color={colors.primary} size={20} />
              <View style={styles.categoryHeaderText}>
                <Text style={styles.categoryTitle}>{category.title}</Text>
                <Text style={styles.categorySubtitle}>
                  {category.subtitle}
                </Text>
              </View>
            </View>

            <View style={styles.itemsList}>
              {items.map((item, index) => (
                <View
                  key={`${category.key}-${index}`}
                  style={styles.itemRow}
                  accessibilityRole="none"
                >
                  <TextInput
                    style={styles.itemInput}
                    value={item}
                    onChangeText={(text) =>
                      updateItem(category.key, index, text)
                    }
                    placeholder="Enter an action..."
                    placeholderTextColor={colors.textFaint}
                    multiline
                    accessibilityLabel={`${category.title} action ${index + 1}`}
                  />
                  <TouchableOpacity
                    onPress={() => removeItem(category.key, index)}
                    style={styles.removeButton}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove action ${index + 1}`}
                  >
                    <X color={colors.textFaint} size={18} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            <TouchableOpacity
              onPress={() => addItem(category.key)}
              style={styles.addButton}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`Add action to ${category.title}`}
            >
              <Plus color={colors.primary} size={16} />
              <Text style={styles.addButtonText}>Add action</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      {/* Submit */}
      <View style={styles.submitSection}>
        <ActionButton
          label="Submit Action Plan"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={!hasContent}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  introSection: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginTop: spacing.xs,
  },
  categorySection: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  categoryHeaderText: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  categorySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  itemsList: {
    gap: spacing.sm,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  itemInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    backgroundColor: colors.background,
    minHeight: 44,
  },
  removeButton: {
    padding: spacing.sm,
    marginLeft: spacing.xs,
    marginTop: spacing.xs,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.primary,
  },
  submitSection: {
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
});
