import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Shield, ArrowRight, Users, BookOpen, RefreshCw, Mail, CheckCircle, ClipboardCheck, FileText } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAssessment } from '@/contexts/AssessmentContext';
import colors from '@/constants/colors';

export default function PackageProfessionalScreen() {
  const router = useRouter();
  const { selectPackage } = useAssessment();

  const handleSelectPackage = () => {
    selectPackage('with-awareness', 1799);
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

          <Text style={styles.heroTitle} accessibilityRole="header">Professional</Text>
          <Text style={styles.heroTitleAccent}>FRA + Training</Text>

          <Text style={styles.heroSubtitle}>
            Everything in Starter, plus staff awareness training modules and up to 50 employee key-passes.{"\n"}
            Ideal for SMEs with 10–100 employees building a fraud-aware culture.
          </Text>

          <View style={styles.priceCard}>
            <View style={styles.popularBadge}>
              <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
            </View>
            <Text style={styles.priceLabel}>Professional Package</Text>
            <View style={styles.priceRow}>
              <Text style={styles.priceAmount}>£1,799</Text>
              <Text style={styles.pricePeriod}>/year + VAT</Text>
            </View>
            <Text style={styles.priceNote}>Annual subscription — cancel anytime</Text>
          </View>

          <View style={styles.ctaRow}>
            <TouchableOpacity style={styles.ctaPrimary} onPress={handleSelectPackage} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Choose Professional Package">
              <Text style={styles.ctaPrimaryText}>Choose Professional</Text>
              <ArrowRight size={18} color={colors.govBlue} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.ctaSecondary}
              onPress={() => router.push('/packages')}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Compare All Packages"
            >
              <Text style={styles.ctaSecondaryText}>Compare Packages</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle} accessibilityRole="header">Everything in Starter</Text>
            <View style={styles.featureItem}>
              <ClipboardCheck size={18} color={colors.white} />
              <Text style={styles.featureText}>Single fraud risk assessment across 13 key areas</Text>
            </View>
            <View style={styles.featureItem}>
              <FileText size={18} color={colors.white} />
              <Text style={styles.featureText}>Professional PDF health check report</Text>
            </View>
            <View style={styles.featureItem}>
              <Shield size={18} color={colors.white} />
              <Text style={styles.featureText}>ECCTA 2023 compliance snapshot</Text>
            </View>
          </View>

          <View style={styles.sectionCardHighlight}>
            <Text style={styles.sectionTitle} accessibilityRole="header">Plus Professional Features</Text>
            <View style={styles.featureItem}>
              <BookOpen size={18} color={colors.white} />
              <Text style={styles.featureText}>Staff fraud awareness training modules — interactive 30-minute workshop for your team</Text>
            </View>
            <View style={styles.featureItem}>
              <Users size={18} color={colors.white} />
              <Text style={styles.featureText}>Up to 50 employee key-passes — distribute assessments across your workforce</Text>
            </View>
            <View style={styles.featureItem}>
              <RefreshCw size={18} color={colors.white} />
              <Text style={styles.featureText}>Quarterly reassessment — keep your risk profile current throughout the year</Text>
            </View>
            <View style={styles.featureItem}>
              <Mail size={18} color={colors.white} />
              <Text style={styles.featureText}>Email support — dedicated help with your assessment and training</Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle} accessibilityRole="header">Why upgrade to Professional?</Text>
            <Text style={styles.sectionBody}>
              Under the ECCTA 2023 &ldquo;failure to prevent fraud&rdquo; offence, organisations must demonstrate &ldquo;reasonable procedures&rdquo; — including staff training. The Professional package provides the training evidence auditors and regulators expect, plus key-passes so employees can complete their own fraud risk assessments.
            </Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle} accessibilityRole="header">Ideal for</Text>
            <View style={styles.featureItem}>
              <CheckCircle size={18} color={colors.white} />
              <Text style={styles.featureText}>SMEs with 10–100 employees</Text>
            </View>
            <View style={styles.featureItem}>
              <CheckCircle size={18} color={colors.white} />
              <Text style={styles.featureText}>Organisations needing staff training evidence</Text>
            </View>
            <View style={styles.featureItem}>
              <CheckCircle size={18} color={colors.white} />
              <Text style={styles.featureText}>Charities and public-sector teams with compliance obligations</Text>
            </View>
            <View style={styles.featureItem}>
              <CheckCircle size={18} color={colors.white} />
              <Text style={styles.featureText}>Budget-holders seeking quarterly fraud risk updates</Text>
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
    opacity: 0.9,
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
    color: colors.white,
    opacity: 0.85,
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
  popularBadge: {
    backgroundColor: colors.govGreen,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 10,
  },
  popularBadgeText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: colors.white,
    letterSpacing: 1,
  },
  priceLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.white,
    opacity: 0.8,
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
    color: colors.white,
    opacity: 0.75,
  },
  priceNote: {
    fontSize: 13,
    color: colors.white,
    opacity: 0.65,
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
  sectionBody: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.white,
    opacity: 0.85,
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
    opacity: 0.9,
  },
});
