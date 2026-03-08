import { useRouter } from 'expo-router';
import { Shield, BookOpen, Users, RefreshCw, Mail, ArrowRight, CheckCircle } from 'lucide-react-native';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import ScreenContainer from '@/components/ScreenContainer';
import { colors, spacing, borderRadius } from '@/constants/theme';

export default function PackageInfoScreen() {
  const router = useRouter();

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <View style={styles.popularBadge}>
            <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
          </View>
        </View>
        <View style={styles.iconContainer}>
          <Shield color={colors.primary} size={48} />
        </View>
        <Text style={styles.title}>Professional Package</Text>
        <Text style={styles.subtitle}>
          FRA Health Check + Staff Awareness Training
        </Text>
      </View>

      <View style={styles.priceCard}>
        <Text style={styles.priceAmount}>£1,799</Text>
        <Text style={styles.pricePeriod}>/year + VAT</Text>
        <Text style={styles.priceNote}>Annual subscription — up to 50 employees</Text>
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>What&apos;s included</Text>

        <View style={styles.featureCard}>
          <View style={styles.featureIconCircle}>
            <BookOpen color={colors.surface} size={20} />
          </View>
          <View style={styles.featureTextContainer}>
            <Text style={styles.featureTitle}>Staff Awareness Training</Text>
            <Text style={styles.featureDescription}>
              Interactive 30-minute fraud awareness workshop with quizzes, real-world scenarios, and completion certificates
            </Text>
          </View>
        </View>

        <View style={styles.featureCard}>
          <View style={styles.featureIconCircle}>
            <Users color={colors.surface} size={20} />
          </View>
          <View style={styles.featureTextContainer}>
            <Text style={styles.featureTitle}>50 Employee Key-Passes</Text>
            <Text style={styles.featureDescription}>
              Distribute assessments across your workforce so every team member completes their own fraud risk review
            </Text>
          </View>
        </View>

        <View style={styles.featureCard}>
          <View style={styles.featureIconCircle}>
            <RefreshCw color={colors.surface} size={20} />
          </View>
          <View style={styles.featureTextContainer}>
            <Text style={styles.featureTitle}>Quarterly Reassessment</Text>
            <Text style={styles.featureDescription}>
              Automated reminders every quarter to keep your risk profile current
            </Text>
          </View>
        </View>

        <View style={styles.featureCard}>
          <View style={styles.featureIconCircle}>
            <Mail color={colors.surface} size={20} />
          </View>
          <View style={styles.featureTextContainer}>
            <Text style={styles.featureTitle}>Email Support</Text>
            <Text style={styles.featureDescription}>
              Dedicated help with your assessment, training rollout, and compliance questions
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Plus everything in Starter</Text>
        <View style={styles.starterList}>
          {[
            'Single fraud risk assessment across 13 key areas',
            'Professional PDF health check report',
            'ECCTA 2023 compliance snapshot',
            'Risk register with priority bands',
          ].map((item) => (
            <View key={item} style={styles.starterItem}>
              <CheckCircle size={16} color={colors.primary} />
              <Text style={styles.starterItemText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.complianceCard}>
        <Text style={styles.complianceTitle}>Why training matters</Text>
        <Text style={styles.complianceBody}>
          Under the ECCTA 2023 &ldquo;failure to prevent fraud&rdquo; offence, organisations must demonstrate &ldquo;reasonable procedures&rdquo; — including staff training. This package provides the evidence auditors and regulators expect.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.ctaPrimary}
        onPress={() => router.push('/payment?package=Professional&price=1799' as any)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Choose Professional"
      >
        <Text style={styles.ctaPrimaryText}>Choose Professional</Text>
        <ArrowRight size={18} color={colors.surface} />
      </TouchableOpacity>

      <Text style={styles.footerNote}>
        This training module is part of the Professional package. Your organisation administrator distributes key-passes for employee access.
      </Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  badgeRow: {
    marginBottom: spacing.sm,
  },
  popularBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.surface,
    letterSpacing: 1,
  },
  iconContainer: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  priceCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  priceAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary,
  },
  pricePeriod: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
    opacity: 0.8,
  },
  priceNote: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  sectionContainer: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  featureCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  starterList: {
    gap: 10,
  },
  starterItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  starterItemText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  complianceCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  complianceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 6,
  },
  complianceBody: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  ctaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    marginBottom: spacing.md,
  },
  ctaPrimaryText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.surface,
  },
  footerNote: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
});
