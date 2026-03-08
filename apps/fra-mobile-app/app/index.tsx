import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Shield, FileText, BookOpen, LayoutDashboard, ArrowRight, CheckCircle, User } from 'lucide-react-native';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useAuth } from '@/contexts/AuthContext';
import colors from '@/constants/colors';

const GOLD_ACCENT = '#b38b2e';
const GOLD_LIGHT = '#fdf8ed';
const BG_LIGHT = '#F7F8FA';
const PRO_CARD_BG = '#f0f5ff';

export default function HomeScreen() {
  const router = useRouter();
  const { startNewAssessment, selectPackage } = useAssessment();
  const { isAuthenticated } = useAuth();

  const handlePackage1 = () => {
    startNewAssessment();
    selectPackage('health-check', 795);
    router.push('/organisation');
  };

  const handlePackage2 = () => {
    router.push('/package-professional');
  };

  const handlePackage3 = () => {
    router.push('/package-enterprise');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => router.push(isAuthenticated ? '/profile' : '/auth/login')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={isAuthenticated ? 'View profile' : 'Sign in'}
        >
          <User size={20} color={colors.govBlue} />
          <Text style={styles.profileButtonText}>{isAuthenticated ? 'Profile' : 'Sign In'}</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <View
            style={styles.compliancePill}
            accessibilityRole="text"
            accessibilityLabel="GovS-013 and ECCTA 2023 Compliant"
          >
            <Text style={styles.compliancePillText}>GovS-013 & ECCTA 2023 Compliant</Text>
          </View>
          <Shield size={32} color={colors.govBlue} />
          <Text style={styles.welcome} accessibilityRole="header">WELCOME</Text>
          <Text style={styles.brand} accessibilityRole="header">FRAUD-RISK.CO.UK</Text>
          <Text style={styles.tagline}>Protect your organisation from fraud</Text>
        </View>

        <View style={styles.cardsContainer}>
          {/* Package 1 — Starter */}
          <TouchableOpacity
            style={styles.card1}
            onPress={handlePackage1}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Package 1: Starter — No features included, 799 pounds per year - upgrade required"
            accessibilityHint="Starts a new fraud risk health check assessment"
          >
            <View style={styles.cardInner}>
              <View style={styles.cardIconCircle}>
                <FileText size={28} color={colors.white} />
              </View>
              <View style={styles.packageBadge}>
                <Text style={styles.packageBadgeText}>PACKAGE 1</Text>
              </View>
              <Text style={styles.cardTitle}>Starter</Text>
              <Text style={styles.cardSubtitle}>No Features Included</Text>
              <View style={styles.priceBlock}>
                <Text style={styles.cardPrice}>£799</Text>
                <Text style={styles.cardPriceNote}>per year + VAT</Text>
              </View>
              <View style={styles.featureDivider} />
              <View style={styles.cardFeatures}>
                <FeatureBullet text="No features available" color={colors.govBlue} />
                <FeatureBullet text="Must upgrade to access functionality" color={colors.govBlue} />
              </View>
              <View style={styles.ctaDivider} />
              <View style={styles.ctaOutlineBlue}>
                <Text style={styles.ctaTextBlue}>Start Assessment</Text>
                <ArrowRight size={16} color={colors.govBlue} />
              </View>
            </View>
          </TouchableOpacity>

          {/* Package 2 — Professional */}
          <TouchableOpacity
            style={styles.card2}
            onPress={handlePackage2}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Package 2: Professional — FRA plus Training, 1799 pounds per year. Most popular option"
            accessibilityHint="Opens the Professional package details page"
          >
            <View style={styles.popularTag}>
              <Text style={styles.popularTagText}>MOST POPULAR</Text>
            </View>
            <View style={styles.cardInner}>
              <View style={styles.cardIconCirclePopular}>
                <BookOpen size={28} color={colors.white} />
              </View>
              <View style={styles.packageBadgePopular}>
                <Text style={styles.packageBadgeTextPopular}>PACKAGE 2</Text>
              </View>
              <Text style={styles.cardTitle}>Professional</Text>
              <Text style={styles.cardSubtitle}>FRA + Training</Text>
              <View style={styles.priceBlock}>
                <Text style={styles.cardPrice}>£1,995</Text>
                <Text style={styles.cardPriceNote}>/year + VAT</Text>
              </View>
              <View style={styles.featureDivider} />
              <View style={styles.cardFeatures}>
                <FeatureBullet text="Everything in Starter" color={colors.govBlue} />
                <FeatureBullet text="Staff awareness training" color={colors.govBlue} />
                <FeatureBullet text="50 employee key-passes" color={colors.govBlue} />
                <FeatureBullet text="Quarterly reassessment" color={colors.govBlue} />
                <FeatureBullet text="Email support" color={colors.govBlue} />
              </View>
              <View style={styles.ctaDivider} />
              <View style={styles.ctaFilledBlue}>
                <Text style={styles.ctaTextWhite}>View Package</Text>
                <ArrowRight size={16} color={colors.white} />
              </View>
            </View>
          </TouchableOpacity>

          {/* Package 3 — Enterprise */}
          <TouchableOpacity
            style={styles.card3}
            onPress={handlePackage3}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Package 3: Enterprise — Full Dashboard plus Unlimited, 4995 pounds per year"
            accessibilityHint="Opens the Enterprise package details page"
          >
            <View style={styles.cardInner}>
              <View style={styles.cardIconCircleGold}>
                <LayoutDashboard size={28} color={colors.white} />
              </View>
              <View style={styles.packageBadgeGold}>
                <Text style={styles.packageBadgeTextGold}>PACKAGE 3</Text>
              </View>
              <Text style={styles.cardTitle}>Enterprise</Text>
              <Text style={styles.cardSubtitle}>Full Dashboard + Unlimited</Text>
              <View style={styles.priceBlock}>
                <Text style={styles.cardPriceGold}>£4,995</Text>
                <Text style={styles.cardPriceNote}>/year + VAT</Text>
              </View>
              <View style={styles.featureDivider} />
              <View style={styles.cardFeatures}>
                <FeatureBullet text="Everything in Professional" color={GOLD_ACCENT} />
                <FeatureBullet text="Real-time dashboard" color={GOLD_ACCENT} />
                <FeatureBullet text="Unlimited key-passes" color={GOLD_ACCENT} />
                <FeatureBullet text="Risk register & tracking" color={GOLD_ACCENT} />
                <FeatureBullet text="API access" color={GOLD_ACCENT} />
                <FeatureBullet text="Priority support" color={GOLD_ACCENT} />
              </View>
              <View style={styles.ctaDivider} />
              <View style={styles.ctaOutlineGold}>
                <Text style={styles.ctaTextGold}>View Package</Text>
                <ArrowRight size={16} color={GOLD_ACCENT} />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerCopyright}>{'\u00A9'} 2026 FRAUD-RISK.CO.UK</Text>
          <TouchableOpacity
            onPress={() => router.push('/feedback')}
            activeOpacity={0.7}
            accessibilityRole="link"
            accessibilityLabel="Need help? Contact us"
            accessibilityHint="Opens the feedback and support page"
          >
            <Text style={styles.footerLink}>Need help? Contact us</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureBullet({ text, color }: { text: string; color: string }) {
  return (
    <View style={styles.featureRow} accessibilityRole="text" accessibilityLabel={text}>
      <CheckCircle size={18} color={color} style={styles.featureIcon} />
      <Text style={styles.featureText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 20,
    paddingBottom: 48,
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#e8f0fe',
    marginBottom: 20,
  },
  profileButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.govBlue,
  },

  /* ---- Header ---- */
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  compliancePill: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  compliancePillText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#2e7d32',
    letterSpacing: 0.3,
  },
  welcome: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.govGrey2,
    letterSpacing: 4,
    marginTop: 16,
    marginBottom: 4,
  },
  brand: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: colors.govBlue,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: colors.govGrey2,
    marginTop: 6,
    textAlign: 'center',
  },

  /* ---- Cards container ---- */
  cardsContainer: {
    gap: 28,
  },

  /* ---- Card base styles per package ---- */
  card1: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.govBlue,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  card2: {
    backgroundColor: PRO_CARD_BG,
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: colors.govBlue,
    shadowColor: colors.govBlue,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 6,
    overflow: 'visible',
  },
  card3: {
    backgroundColor: GOLD_LIGHT,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: GOLD_ACCENT,
    shadowColor: GOLD_ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 4,
  },

  cardInner: {
    padding: 28,
    paddingTop: 30,
    alignItems: 'center',
  },

  /* ---- Popular badge ---- */
  popularTag: {
    position: 'absolute',
    top: -14,
    alignSelf: 'center',
    zIndex: 1,
    backgroundColor: colors.govGreen,
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 14,
    shadowColor: colors.govGreen,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  popularTagText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: colors.white,
    letterSpacing: 1.2,
  },

  /* ---- Icon circles ---- */
  cardIconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.govBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  cardIconCirclePopular: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.govBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  cardIconCircleGold: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: GOLD_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  /* ---- Package number badges ---- */
  packageBadge: {
    backgroundColor: colors.govGrey4,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 10,
  },
  packageBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: colors.govGrey2,
    letterSpacing: 1.5,
  },
  packageBadgePopular: {
    backgroundColor: '#dce8ff',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 10,
  },
  packageBadgeTextPopular: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: colors.govBlue,
    letterSpacing: 1.5,
  },
  packageBadgeGold: {
    backgroundColor: '#f5ecd2',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 10,
  },
  packageBadgeTextGold: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: GOLD_ACCENT,
    letterSpacing: 1.5,
  },

  /* ---- Typography ---- */
  cardTitle: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: colors.govGrey1,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: colors.govGrey2,
    marginBottom: 14,
  },
  priceBlock: {
    alignItems: 'center',
    marginBottom: 18,
  },
  cardPrice: {
    fontSize: 40,
    fontWeight: '800' as const,
    color: colors.govBlue,
    lineHeight: 48,
  },
  /* cardPricePopular removed — identical to cardPrice, reuse cardPrice for Package 2 */
  cardPriceGold: {
    fontSize: 40,
    fontWeight: '800' as const,
    color: GOLD_ACCENT,
    lineHeight: 48,
  },
  cardPriceNote: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: colors.govGrey2,
    marginTop: 2,
  },

  /* ---- Dividers ---- */
  featureDivider: {
    height: 1,
    backgroundColor: colors.govGrey4,
    alignSelf: 'stretch',
    marginBottom: 18,
  },
  ctaDivider: {
    height: 1,
    backgroundColor: colors.govGrey4,
    alignSelf: 'stretch',
    marginTop: 6,
    marginBottom: 20,
  },

  /* ---- Feature bullets ---- */
  cardFeatures: {
    alignSelf: 'stretch',
    gap: 10,
    paddingHorizontal: 4,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  featureIcon: {
    flexShrink: 0,
  },
  featureText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: colors.govGrey1,
    lineHeight: 21,
    flex: 1,
  },

  /* ---- CTA Buttons ---- */
  ctaOutlineBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.govBlue,
    backgroundColor: 'transparent',
    alignSelf: 'stretch',
  },
  ctaFilledBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 28,
    borderRadius: 14,
    backgroundColor: colors.govBlue,
    alignSelf: 'stretch',
    shadowColor: colors.govBlue,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  ctaOutlineGold: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: GOLD_ACCENT,
    backgroundColor: 'transparent',
    alignSelf: 'stretch',
  },
  ctaTextBlue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.govBlue,
  },
  ctaTextWhite: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.white,
  },
  ctaTextGold: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: GOLD_ACCENT,
  },

  /* ---- Footer ---- */
  footer: {
    alignItems: 'center',
    marginTop: 36,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  footerCopyright: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: colors.govGrey2,
    marginBottom: 8,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.govBlue,
    textDecorationLine: 'underline',
  },
});
