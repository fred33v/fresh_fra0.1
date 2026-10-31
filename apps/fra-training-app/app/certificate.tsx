import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle, Shield } from 'lucide-react-native';
import ActionButton from '@/components/ActionButton';
import { colors, spacing, borderRadius } from '@/constants/theme';
import { type CertificateResult, useTraining } from '@/contexts/TrainingContext';

const FAILURE_MESSAGES: Record<Exclude<CertificateResult, { ok: true }>['reason'], string> = {
  offline: 'You are offline. Connect to the internet and try again to get your certificate.',
  locked: 'Training is not included in your organisation\'s package, so a certificate cannot be issued.',
  'not-completed': 'Some sections or quiz questions are not finished yet. Complete them, then try again.',
  'quiz-not-passed': 'The certificate needs 80% of the quiz questions right. Open the quizzes you missed, answer them again, then try again.',
  error: 'Your certificate could not be issued just now. Please try again.',
};

function formatDate(dateString: string | null): string {
  if (!dateString) {
    return new Date().toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function CertificateScreen() {
  const router = useRouter();
  const { completedAt, certificateNumber, certificateIssuedAt, issueCertificate, isComplete } =
    useTraining();

  // The certificate is issued by the server, which checks the training was really completed,
  // so it counts as training evidence for the organisation
  const [issuing, setIssuing] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const requestCertificate = useCallback(async () => {
    setIssuing(true);
    setFailure(null);
    const result = await issueCertificate();
    if (!result.ok) setFailure(FAILURE_MESSAGES[result.reason]);
    setIssuing(false);
  }, [issueCertificate]);

  useEffect(() => {
    if (isComplete && !certificateNumber) requestCertificate();
    // Ask once when the screen opens; "Try again" asks again
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBackToHome = () => {
    router.navigate('/home');
  };

  if (!certificateNumber) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          {issuing ? (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.subheading}>Issuing your certificate…</Text>
            </>
          ) : (
            <>
              <Shield color={colors.primary} size={48} />
              <Text style={styles.heading}>Certificate not issued yet</Text>
              <Text style={styles.subheading} accessibilityRole="alert">
                {failure ?? FAILURE_MESSAGES['not-completed']}
              </Text>
              <View style={styles.buttonContainer}>
                {isComplete && <ActionButton label="Try again" onPress={requestCertificate} />}
                <ActionButton label="Back to Home" onPress={handleBackToHome} variant="outline" />
              </View>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Success icon */}
        <View
          style={styles.iconCircle}
          accessibilityRole="image"
          accessibilityLabel="Completion checkmark"
        >
          <CheckCircle color={colors.success} size={64} />
        </View>

        {/* Heading */}
        <Text style={styles.heading}>Congratulations!</Text>
        <Text style={styles.subheading}>
          You have completed the Fraud Risk Awareness Training
        </Text>

        {/* Certificate details card */}
        <View style={styles.certificateCard}>
          <View style={styles.certificateHeader}>
            <Shield color={colors.primary} size={24} />
            <Text style={styles.certificateTitle}>
              Certificate of Completion
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Certificate Number</Text>
            <Text
              style={styles.detailValue}
              accessibilityLabel={`Certificate number: ${certificateNumber}`}
              selectable
            >
              {certificateNumber}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Date of Completion</Text>
            <Text style={styles.detailValue}>
              {formatDate(completedAt ?? certificateIssuedAt)}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Course</Text>
            <Text style={styles.detailValue}>
              Fraud Risk Awareness Workshop
            </Text>
          </View>
        </View>

        {/* Compliance badge */}
        <View style={styles.complianceBadge}>
          <Text style={styles.complianceText}>
            Built for GovS 013 &amp; ECCTA 2023
          </Text>
        </View>

        {/* Back button */}
        <View style={styles.buttonContainer}>
          <ActionButton
            label="Back to Home"
            onPress={handleBackToHome}
            variant="outline"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  heading: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
  },
  subheading: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  certificateCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    marginBottom: spacing.lg,
  },
  certificateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  certificateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.primary,
  },
  detailRow: {
    paddingVertical: spacing.sm,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  complianceBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  complianceText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    gap: spacing.sm,
  },
});
