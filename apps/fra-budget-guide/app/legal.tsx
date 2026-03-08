import { useRouter } from 'expo-router';
import { Scale, AlertCircle, User, ChevronRight } from 'lucide-react-native';
import React, { useState } from 'react';
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

interface ContentBlock {
  id: string;
  title: string;
  icon: React.ComponentType<{ color: string; size: number }>;
  summary: string;
  details: string[];
}

const contentBlocks: ContentBlock[] = [
  {
    id: 'organisational',
    title: 'Organisational Liability',
    icon: Scale,
    summary: 'Under the Economic Crime & Corporate Transparency Act 2023 (effective September 2025)',
    details: [
      'If fraud is committed for the organisation\'s benefit and you failed to prevent it through reasonable procedures, the organisation can face:',
      '\u2022 Unlimited fines',
      '\u2022 Director disqualification',
      '\u2022 Criminal conviction',
    ],
  },
  {
    id: 'personal',
    title: 'Personal Liability',
    icon: AlertCircle,
    summary: 'If you knowingly participate in or facilitate fraud',
    details: [
      '\u2022 Criminal prosecution (Fraud Act 2006)',
      '\u2022 Dismissal for gross misconduct',
      '\u2022 Civil recovery of losses',
      '\u2022 Professional disqualification',
    ],
  },
  {
    id: 'ethical',
    title: 'Ethical & Fiduciary Duty',
    icon: User,
    summary: 'Your role as a steward of organisational resources',
    details: [
      'Stewardship: You manage stakeholder resources (taxpayer money, donor funds, shareholder capital). This is a position of trust.',
      'Role Modeling: Your team watches your behavior. Shortcuts you take signal "acceptable" conduct.',
      'Fiduciary Duty: Act in the organisation\'s best interests, not personal convenience.',
    ],
  },
];

export default function LegalScreen() {
  const router = useRouter();
  const [expandedBlocks, setExpandedBlocks] = useState<string[]>([]);

  const toggleBlock = (id: string) => {
    setExpandedBlocks((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );
  };

  return (
    <ScreenContainer screenId="legal">
      <InfoBanner
        message="Fraud prevention is a leadership responsibility, not optional compliance."
        variant="danger"
      />

      <View style={styles.blocksContainer}>
        {contentBlocks.map((block) => {
          const isExpanded = expandedBlocks.includes(block.id);
          const Icon = block.icon;

          return (
            <View key={block.id} style={styles.card}>
              <TouchableOpacity
                style={styles.cardHeader}
                onPress={() => toggleBlock(block.id)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${block.title}: ${block.summary}. Tap to ${isExpanded ? 'collapse' : 'expand'} details.`}
              >
                <View style={styles.iconCircle}>
                  <Icon color={colors.danger} size={24} />
                </View>
                <View style={styles.cardHeaderText}>
                  <Text style={styles.cardTitle}>{block.title}</Text>
                  <Text style={styles.cardSummary}>{block.summary}</Text>
                </View>
                <ChevronRight
                  color={colors.textMuted}
                  size={20}
                  style={[
                    styles.chevron,
                    isExpanded && styles.chevronExpanded,
                  ]}
                />
              </TouchableOpacity>

              {isExpanded && (
                <View style={styles.cardDetails}>
                  {block.details.map((detail) => (
                    <Text key={detail} style={styles.detailText}>
                      {detail}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>

      <ActionButton
        label="Continue to Fraud Basics"
        onPress={() => router.push('/fraud-basics')}
      />
      <View style={styles.buttonSpacer} />
      <ActionButton
        label="Back to Role Selection"
        onPress={() => router.back()}
        variant="text"
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  blocksContainer: {
    gap: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.dangerLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  cardSummary: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 18,
  },
  chevron: {
    marginLeft: spacing.sm,
  },
  chevronExpanded: {
    transform: [{ rotate: '90deg' }],
  },
  cardDetails: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: 12,
  },
  detailText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  buttonSpacer: {
    marginBottom: spacing.xs,
  },
});
