import { useRouter } from 'expo-router';
import { ShieldCheck } from 'lucide-react-native';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';

import ScreenContainer from '@/components/ScreenContainer';
import ActionButton from '@/components/ActionButton';
import InfoBanner from '@/components/InfoBanner';
import { colors, spacing, borderRadius } from '@/constants/theme';

const protections = [
  {
    title: 'Legal Protection',
    items: [
      'Protected from dismissal if you report in good faith',
      'Protected from disciplinary action or demotion',
      'Protected from harassment or victimization',
      'Protected under Public Interest Disclosure Act 1998 (UK)',
    ],
  },
  {
    title: 'Qualifying Disclosure Requirements',
    items: [
      'You report in good faith',
      'You reasonably believe the information is true',
      'You report to the appropriate person or body',
      'The disclosure is in the public interest',
    ],
  },
  {
    title: 'Your Responsibilities',
    items: [
      'Report through proper channels first (internal before external)',
      'Do not make malicious or false allegations',
      'Do not disclose for personal gain',
      'Cooperate with any investigation',
    ],
  },
];

export default function WhistleblowerScreen() {
  const router = useRouter();

  return (
    <ScreenContainer screenId="whistleblower">
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <ShieldCheck color={colors.success} size={48} />
        </View>
        <Text style={styles.title}>You Are Protected</Text>
        <Text style={styles.subtitle}>
          Legal protections for raising concerns about fraud
        </Text>
      </View>

      <View style={styles.bannerWrapper}>
        <InfoBanner
          message="If you report fraud concerns in good faith, you are protected by law from retaliation."
          variant="success"
        />
      </View>

      <View style={styles.sectionsContainer}>
        {protections.map((section) => (
          <View key={section.title} style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.itemsContainer}>
              {section.items.map((item) => (
                <View key={item} style={styles.item}>
                  <View style={styles.itemBullet} />
                  <Text style={styles.itemText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.retaliationCard}>
        <Text style={styles.retaliationTitle}>If You Face Retaliation</Text>
        <Text style={styles.retaliationText}>
          Contact HR or Legal immediately. Retaliation against whistleblowers is illegal and grounds for employment tribunal claim.
        </Text>
        <Text style={styles.retaliationContact}>
          [Insert HR/Legal Contact Details]
        </Text>
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.noteText}>
          Whistleblower protection exists to encourage honest reporting. The organisation values your courage in speaking up.
        </Text>
      </View>

      <ActionButton
        label="Common Fraud Myths"
        onPress={() => router.push('/myths')}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconContainer: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  bannerWrapper: {
    marginBottom: spacing.lg,
  },
  sectionsContainer: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  itemsContainer: {
    gap: spacing.md - 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  itemBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
    marginTop: 7,
    marginRight: spacing.md - 4,
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  retaliationCard: {
    backgroundColor: colors.dangerLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  retaliationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.dangerDark,
    marginBottom: spacing.sm,
  },
  retaliationText: {
    fontSize: 14,
    color: colors.dangerDarkest,
    lineHeight: 20,
    marginBottom: spacing.md - 4,
  },
  retaliationContact: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.danger,
  },
  noteCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  noteText: {
    fontSize: 14,
    color: colors.primary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
