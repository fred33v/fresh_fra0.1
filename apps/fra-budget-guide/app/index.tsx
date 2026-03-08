import { useRouter } from 'expo-router';
import {
  Shield,
  FileText,
  BookOpen,
  LayoutDashboard,
  CheckCircle,
} from 'lucide-react-native';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import ScreenContainer from '@/components/ScreenContainer';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';

// ---------------------------------------------------------------------------
// Package data
// ---------------------------------------------------------------------------

interface PackageFeature {
  label: string;
}

interface PackageOption {
  id: string;
  tier: string;
  title: string;
  price: string;
  priceSuffix: string;
  icon: React.ComponentType<{ color: string; size: number }>;
  features: PackageFeature[];
  popular?: boolean;
  enterprise?: boolean;
  route: string;
  ctaLabel: string;
  ctaVariant: 'outline' | 'filled' | 'accent';
}

const packages: PackageOption[] = [
  {
    id: 'starter',
    tier: 'PACKAGE 1',
    title: 'Starter',
    price: '£795',
    priceSuffix: 'one-time',
    icon: FileText,
    features: [
      { label: 'Fraud health check' },
      { label: 'PDF report' },
      { label: 'ECCTA snapshot' },
      { label: '1 key-pass included' },
    ],
    route: '/legal',
    ctaLabel: 'Get Started',
    ctaVariant: 'outline',
  },
  {
    id: 'professional',
    tier: 'PACKAGE 2',
    title: 'Professional',
    price: '£1,995',
    priceSuffix: '/year',
    icon: BookOpen,
    popular: true,
    features: [
      { label: 'Everything in Starter' },
      { label: 'Training programme' },
      { label: '50 key-passes' },
      { label: 'Quarterly reassessment' },
      { label: 'Email support' },
    ],
    route: '/package-info',
    ctaLabel: 'Choose Professional',
    ctaVariant: 'filled',
  },
  {
    id: 'enterprise',
    tier: 'PACKAGE 3',
    title: 'Enterprise',
    price: '£4,995',
    priceSuffix: '/year',
    icon: LayoutDashboard,
    enterprise: true,
    features: [
      { label: 'Everything in Professional' },
      { label: 'Live dashboard' },
      { label: 'Unlimited key-passes' },
      { label: 'Risk register' },
      { label: 'API access' },
      { label: 'Priority support' },
    ],
    route: '/package-enterprise',
    ctaLabel: 'Choose Enterprise',
    ctaVariant: 'accent',
  },
];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function PackageSelectionScreen() {
  const router = useRouter();

  const handleSelect = (route: string) => {
    router.push(route as any);
  };

  return (
    <ScreenContainer>
      {/* ---- Header ---- */}
      <View style={styles.header}>
        <View style={styles.headerIconContainer}>
          <Shield color={colors.primary} size={48} />
        </View>
        <Text
          style={styles.title}
          accessibilityRole="header"
        >
          FRAUD-RISK.CO.UK
        </Text>
        <Text style={styles.tagline}>
          Staff Fraud Awareness Training
        </Text>
        <Text style={styles.subtitle}>
          Choose the package that fits your organisation
        </Text>

        {/* Compliance pill */}
        <View style={styles.compliancePill}>
          <Text style={styles.compliancePillText}>
            GovS-013 & ECCTA 2023
          </Text>
        </View>
      </View>

      {/* ---- Package Cards ---- */}
      <View style={styles.cardsContainer}>
        {packages.map((pkg) => {
          const Icon = pkg.icon;
          const isPopular = !!pkg.popular;
          const isEnterprise = !!pkg.enterprise;

          return (
            <View
              key={pkg.id}
              style={[
                styles.card,
                isPopular && styles.cardPopular,
                isEnterprise && styles.cardEnterprise,
              ]}
            >
              {/* Popular badge */}
              {isPopular && (
                <View style={styles.popularBadge}>
                  <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                </View>
              )}

              {/* Tier badge */}
              <View style={[
                styles.tierBadgeRow,
                isPopular && styles.tierBadgeRowPopular,
              ]}>
                <View style={[
                  styles.tierBadge,
                  isEnterprise && styles.tierBadgeEnterprise,
                ]}>
                  <Text style={[
                    styles.tierBadgeText,
                    isEnterprise && styles.tierBadgeTextEnterprise,
                  ]}>
                    {pkg.tier}
                  </Text>
                </View>
              </View>

              {/* Icon circle */}
              <View style={[
                styles.iconCircle,
                isPopular && styles.iconCirclePopular,
                isEnterprise && styles.iconCircleEnterprise,
              ]}>
                <Icon
                  color={isPopular ? colors.surface : isEnterprise ? colors.warningDarkest : colors.primary}
                  size={28}
                />
              </View>

              {/* Title */}
              <Text style={[
                styles.packageTitle,
                isPopular && styles.packageTitlePopular,
                isEnterprise && styles.packageTitleEnterprise,
              ]}>
                {pkg.title}
              </Text>

              {/* Price */}
              <View style={styles.priceRow}>
                <Text style={[
                  styles.price,
                  isPopular && styles.pricePopular,
                  isEnterprise && styles.priceEnterprise,
                ]}>
                  {pkg.price}
                </Text>
                <Text style={styles.priceSuffix}>
                  {pkg.priceSuffix}
                </Text>
              </View>

              {/* Divider */}
              <View style={[
                styles.divider,
                isPopular && styles.dividerPopular,
                isEnterprise && styles.dividerEnterprise,
              ]} />

              {/* Features */}
              <View style={styles.featuresList}>
                {pkg.features.map((feat, idx) => (
                  <View key={feat.label} style={styles.featureRow}>
                    <CheckCircle
                      color={isEnterprise ? colors.warningDark : colors.success}
                      size={18}
                    />
                    <Text style={[
                      styles.featureText,
                      isPopular && styles.featureTextPopular,
                      isEnterprise && styles.featureTextEnterprise,
                    ]}>
                      {feat.label}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Divider */}
              <View style={[
                styles.divider,
                isPopular && styles.dividerPopular,
                isEnterprise && styles.dividerEnterprise,
              ]} />

              {/* CTA */}
              <TouchableOpacity
                style={[
                  styles.ctaBase,
                  pkg.ctaVariant === 'outline' && styles.ctaOutline,
                  pkg.ctaVariant === 'filled' && styles.ctaFilled,
                  pkg.ctaVariant === 'accent' && styles.ctaAccent,
                ]}
                onPress={() => handleSelect(pkg.route)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`${pkg.ctaLabel} — ${pkg.title} package at ${pkg.price} ${pkg.priceSuffix}`}
              >
                <Text
                  style={[
                    styles.ctaTextBase,
                    pkg.ctaVariant === 'outline' && styles.ctaTextOutline,
                    pkg.ctaVariant === 'filled' && styles.ctaTextFilled,
                    pkg.ctaVariant === 'accent' && styles.ctaTextAccent,
                  ]}
                >
                  {pkg.ctaLabel}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* ---- Footer ---- */}
      <Text style={styles.footerNote}>
        All packages include ECCTA-aligned fraud controls. Prices exclude VAT.
      </Text>
      <Text style={styles.footerCopyright}>
        {'\u00A9'} 2026 FRAUD-RISK.CO.UK
      </Text>
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Header
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headerIconContainer: {
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.md,
  },

  // Compliance pill
  compliancePill: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
  },
  compliancePillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    letterSpacing: 0.5,
  },

  // Cards container
  cardsContainer: {
    gap: spacing.xl,
    marginBottom: spacing.lg,
  },

  // Card
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    alignItems: 'center',
    ...shadows.md,
  },
  cardPopular: {
    borderColor: colors.primary,
    borderWidth: 2,
    paddingTop: spacing.lg + spacing.xs,
    ...shadows.lg,
  },
  cardEnterprise: {
    backgroundColor: colors.warningLight,
    borderColor: colors.warning,
    borderWidth: 2,
    ...shadows.lg,
  },

  // Popular badge
  popularBadge: {
    position: 'absolute',
    top: -13,
    alignSelf: 'center',
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
    borderRadius: borderRadius.full,
  },
  popularBadgeText: {
    color: colors.surface,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Tier badge
  tierBadgeRow: {
    marginBottom: spacing.md,
  },
  tierBadgeRowPopular: {
    marginTop: spacing.xs,
  },
  tierBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  /* tierBadgePopular removed — identical to tierBadge base */
  tierBadgeEnterprise: {
    backgroundColor: colors.warningLighter,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1,
  },
  /* tierBadgeTextPopular removed — identical to tierBadgeText base */
  tierBadgeTextEnterprise: {
    color: colors.warningDarker,
  },

  // Icon circle
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconCirclePopular: {
    backgroundColor: colors.primary,
  },
  iconCircleEnterprise: {
    backgroundColor: colors.warning,
  },

  // Package title
  packageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  packageTitlePopular: {
    color: colors.primary,
  },
  packageTitleEnterprise: {
    color: colors.warningDarkest,
  },

  // Price
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: spacing.md,
  },
  price: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
  },
  pricePopular: {
    color: colors.primary,
  },
  priceEnterprise: {
    color: colors.warningDarkest,
  },
  priceSuffix: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textMuted,
    marginLeft: spacing.xs,
  },

  // Divider
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  dividerPopular: {
    backgroundColor: colors.primaryBorder,
  },
  dividerEnterprise: {
    backgroundColor: colors.warning,
    opacity: 0.4,
  },

  // Features
  featuresList: {
    width: '100%',
    gap: spacing.sm + 2,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 15,
    color: colors.textSecondary,
    marginLeft: spacing.sm + 2,
    lineHeight: 20,
    flex: 1,
  },
  featureTextPopular: {
    color: colors.text,
    fontWeight: '500',
  },
  featureTextEnterprise: {
    color: colors.text,
    fontWeight: '500',
  },

  // CTA buttons
  ctaBase: {
    width: '100%',
    paddingVertical: spacing.md - 2,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  ctaFilled: {
    backgroundColor: colors.primary,
  },
  ctaAccent: {
    backgroundColor: colors.warning,
  },
  ctaTextBase: {
    fontSize: 16,
    fontWeight: '700',
  },
  ctaTextOutline: {
    color: colors.primary,
  },
  ctaTextFilled: {
    color: colors.surface,
  },
  ctaTextAccent: {
    color: colors.warningDarker,
  },

  // Footer
  footerNote: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  footerCopyright: {
    fontSize: 13,
    color: colors.textFaint,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.md,
    paddingBottom: spacing.md,
  },
});
