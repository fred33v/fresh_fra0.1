import { useRouter } from 'expo-router';
import { Shield, LayoutDashboard, Users, BarChart3, Key, Headphones, FileText, ArrowRight, CheckCircle } from 'lucide-react-native';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import ScreenContainer from '@/components/ScreenContainer';
import { colors, spacing, borderRadius } from '@/constants/theme';

export default function PackageEnterpriseScreen() {
  const router = useRouter();

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={styles.badgeRow}>
          <View style={styles.enterpriseBadge}>
            <Text style={styles.enterpriseBadgeText}>ENTERPRISE</Text>
          </View>
        </View>
        <View style={styles.iconContainer}>
          <Shield color={colors.primary} size={48} />
        </View>
        <Text style={styles.title}>Enterprise Package</Text>
        <Text style={styles.subtitle}>
          Full Dashboard + Unlimited Access
        </Text>
      </View>

      <View style={styles.priceCard}>
        <Text style={styles.priceAmount}>£4,995</Text>
        <Text style={styles.pricePeriod}>/year + VAT</Text>
        <Text style={styles.priceNote}>Annual subscription — unlimited access</Text>
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Enterprise Features</Text>

        <View style={styles.featureCard}>
          <View style={styles.featureIconCircle}>
            <LayoutDashboard color={colors.surface} size={20} />
          </View>
          <View style={styles.featureTextContainer}>
            <Text style={styles.featureTitle}>Real-Time Monitoring Dashboard</Text>
            <Text style={styles.featureDescription}>
              Live view of assessments, risk scores, and compliance status across your entire organisation
            </Text>
          </View>
        </View>

        <View style={styles.featureCard}>
          <View style={styles.featureIconCircle}>
            <Users color={colors.surface} size={20} />
          </View>
          <View style={styles.featureTextContainer}>
            <Text style={styles.featureTitle}>Unlimited Employee Key-Passes</Text>
            <Text style={styles.featureDescription}>
              No cap on how many staff can complete assessments — scale fraud awareness across every department
            </Text>
          </View>
        </View>

        <View style={styles.featureCard}>
          <View style={styles.featureIconCircle}>
            <BarChart3 color={colors.surface} size={20} />
          </View>
          <View style={styles.featureTextContainer}>
            <Text style={styles.featureTitle}>Risk Register & Action Tracking</Text>
            <Text style={styles.featureDescription}>
              Inherent and residual risk scoring with priority bands, owner assignment, and progress monitoring
            </Text>
          </View>
        </View>

        <View style={styles.featureCard}>
          <View style={styles.featureIconCircle}>
            <Key color={colors.surface} size={20} />
          </View>
          <View style={styles.featureTextContainer}>
            <Text style={styles.featureTitle}>API Access</Text>
            <Text style={styles.featureDescription}>
              Integrate fraud risk data with your existing GRC tools, SIEM platforms, or internal dashboards
            </Text>
          </View>
        </View>

        <View style={styles.featureCard}>
          <View style={styles.featureIconCircle}>
            <Headphones color={colors.surface} size={20} />
          </View>
          <View style={styles.featureTextContainer}>
            <Text style={styles.featureTitle}>Priority Support</Text>
            <Text style={styles.featureDescription}>
              Dedicated assistance with onboarding, compliance queries, and ongoing platform support
            </Text>
          </View>
        </View>

        <View style={styles.featureCard}>
          <View style={styles.featureIconCircle}>
            <FileText color={colors.surface} size={20} />
          </View>
          <View style={styles.featureTextContainer}>
            <Text style={styles.featureTitle}>Compliance Reports</Text>
            <Text style={styles.featureDescription}>
              GovS-013 and ECCTA 2023 compliance reports ready for auditors and regulators
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Plus everything in Professional</Text>
        <View style={styles.starterList}>
          {[
            'Fraud risk assessment across 13 key areas',
            'Staff awareness training with certificates',
            '50 employee key-passes (upgraded to unlimited)',
            'Quarterly reassessment and email support',
          ].map((item) => (
            <View key={item} style={styles.starterItem}>
              <CheckCircle size={16} color={colors.primary} />
              <Text style={styles.starterItemText}>{item}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.complianceCard}>
        <Text style={styles.complianceTitle}>Ideal for</Text>
        <Text style={styles.complianceBody}>
          Large organisations with 100+ employees, public sector and NHS bodies, and teams requiring real-time compliance oversight with API integration for existing GRC tools.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.ctaPrimary}
        onPress={() => router.push('/payment?package=Enterprise&price=4995' as any)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Choose Enterprise Package"
      >
        <Text style={styles.ctaPrimaryText}>Choose Enterprise</Text>
        <ArrowRight size={18} color={colors.surface} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.ctaSecondary}
        onPress={() => router.back()}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Compare All Packages"
      >
        <Text style={styles.ctaSecondaryText}>Compare Packages</Text>
      </TouchableOpacity>

      <Text style={styles.footerNote}>
        Need a smaller team solution? The Professional package starts at £1,995/year for up to 50 employees.
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
  enterpriseBadge: {
    backgroundColor: '#92400e',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
  },
  enterpriseBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fef3c7',
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
    backgroundColor: '#fef3c7',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: '#92400e',
  },
  priceAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: '#92400e',
  },
  pricePeriod: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400e',
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
    backgroundColor: '#fef3c7',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: '#92400e',
  },
  complianceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400e',
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
    backgroundColor: '#92400e',
    marginBottom: 12,
  },
  ctaPrimaryText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fef3c7',
  },
  ctaSecondary: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.primary,
    marginBottom: spacing.md,
  },
  ctaSecondaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  footerNote: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
});
