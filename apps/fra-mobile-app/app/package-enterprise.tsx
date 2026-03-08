import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Shield, ArrowRight, LayoutDashboard, Users, BarChart3, Key, Headphones, FileText, CheckCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAssessment } from '@/contexts/AssessmentContext';
import colors from '@/constants/colors';

export default function PackageEnterpriseScreen() {
  const router = useRouter();
  const { selectPackage } = useAssessment();

  const handleSelectPackage = () => {
    selectPackage('with-dashboard', 4995);
    router.push('/payment');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <LinearGradient
        colors={[colors.govBlue, colors.govBlueDark]}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.heroBadge}>
            <Shield size={16} color={colors.white} />
            <Text style={styles.heroBadgeText}>GovS-013 & ECCTA 2023 Compliant</Text>
          </View>

          <Text style={styles.heroTitle} accessibilityRole="header">Enterprise</Text>
          <Text style={styles.heroTitleAccent} accessibilityRole="header">Full Dashboard</Text>

          <Text style={styles.heroSubtitle}>
            The complete fraud risk management solution. Real-time monitoring dashboard, unlimited employee key-passes, and full compliance reporting.
          </Text>

          <View style={styles.priceCard}>
            <Text style={styles.priceLabel}>Enterprise Package</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceAmount}>£4,995</Text>
              <Text style={styles.pricePeriod}>/year + VAT</Text>
            </View>
            <Text style={styles.priceNote}>Annual subscription — unlimited access</Text>
          </View>

          <View style={styles.ctaRow}>
            <TouchableOpacity style={styles.ctaPrimary} onPress={handleSelectPackage} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Choose Enterprise Package">
              <Text style={styles.ctaPrimaryText}>Choose Enterprise</Text>
              <ArrowRight size={18} color={colors.govBlue} />
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
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle} accessibilityRole="header">Everything in Professional</Text>
            <View style={styles.featureItem}>
              <CheckCircle size={18} color={colors.white} />
              <Text style={styles.featureText}>Fraud risk assessment across 13 key areas</Text>
            </View>
            <View style={styles.featureItem}>
              <CheckCircle size={18} color={colors.white} />
              <Text style={styles.featureText}>Staff awareness training modules</Text>
            </View>
            <View style={styles.featureItem}>
              <CheckCircle size={18} color={colors.white} />
              <Text style={styles.featureText}>Quarterly reassessment and email support</Text>
            </View>
          </View>

          <View style={styles.sectionCardHighlight}>
            <Text style={styles.sectionTitle} accessibilityRole="header">Plus Enterprise Features</Text>
            <View style={styles.featureItem}>
              <LayoutDashboard size={18} color={colors.white} />
              <Text style={styles.featureText}>Real-time monitoring dashboard — live view of assessments, risk scores, and compliance status across your organisation</Text>
            </View>
            <View style={styles.featureItem}>
              <Users size={18} color={colors.white} />
              <Text style={styles.featureText}>Unlimited employee key-passes — no cap on how many staff can complete assessments</Text>
            </View>
            <View style={styles.featureItem}>
              <BarChart3 size={18} color={colors.white} />
              <Text style={styles.featureText}>Risk register and action tracking — inherent/residual scoring with priority bands and progress monitoring</Text>
            </View>
            <View style={styles.featureItem}>
              <Key size={18} color={colors.white} />
              <Text style={styles.featureText}>API access — integrate fraud risk data with your existing systems</Text>
            </View>
            <View style={styles.featureItem}>
              <Headphones size={18} color={colors.white} />
              <Text style={styles.featureText}>Priority support — dedicated assistance with onboarding and compliance</Text>
            </View>
            <View style={styles.featureItem}>
              <FileText size={18} color={colors.white} />
              <Text style={styles.featureText}>GovS-013 and ECCTA 2023 compliance reports — ready for auditors and regulators</Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle} accessibilityRole="header">Ideal for</Text>
            <View style={styles.featureItem}>
              <CheckCircle size={18} color={colors.white} />
              <Text style={styles.featureText}>Large organisations with 100+ employees</Text>
            </View>
            <View style={styles.featureItem}>
              <CheckCircle size={18} color={colors.white} />
              <Text style={styles.featureText}>Public sector and NHS bodies</Text>
            </View>
            <View style={styles.featureItem}>
              <CheckCircle size={18} color={colors.white} />
              <Text style={styles.featureText}>Organisations requiring real-time compliance oversight</Text>
            </View>
            <View style={styles.featureItem}>
              <CheckCircle size={18} color={colors.white} />
              <Text style={styles.featureText}>Teams needing API integration with existing GRC tools</Text>
            </View>
          </View>
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.govBlue,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 48,
    paddingBottom: 60,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    marginBottom: 18,
  },
  heroBadgeText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  heroTitle: {
    fontSize: 40,
    fontWeight: '800' as const,
    color: colors.white,
    letterSpacing: -0.5,
  },
  heroTitleAccent: {
    fontSize: 40,
    fontWeight: '800' as const,
    color: '#b38b2e',
    letterSpacing: -0.5,
    marginBottom: 14,
  },
  heroSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 20,
  },
  priceCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: 'rgba(255, 255, 255, 0.9)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  priceAmount: {
    fontSize: 42,
    fontWeight: '800' as const,
    color: '#b38b2e',
  },
  pricePeriod: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  priceNote: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 4,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
    flexWrap: 'wrap',
  },
  ctaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: colors.white,
    minWidth: 160,
  },
  ctaPrimaryText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.govBlue,
  },
  ctaSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    minWidth: 160,
  },
  ctaSecondaryText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: colors.white,
  },
  sectionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
  },
  sectionCardHighlight: {
    backgroundColor: 'rgba(179, 139, 46, 0.2)',
    borderRadius: 14,
    padding: 18,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: 'rgba(179, 139, 46, 0.4)',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: colors.white,
    marginBottom: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.white,
  },
});
