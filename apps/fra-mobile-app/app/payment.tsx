import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useAuth } from '@/contexts/AuthContext';
import { CreditCard, Lock } from 'lucide-react-native';
import colors from '@/constants/colors';

export default function PaymentScreen() {
  const router = useRouter();
  const { assessment, processPayment } = useAssessment();
  const { allocateKeyPasses, isAuthenticated } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef(false);

  const handlePayment = async () => {
    if (processingRef.current) return;
    // Purchases belong to an organisation account, so ask for one before taking card details further
    if (!isAuthenticated) {
      Alert.alert(
        'Sign in to continue',
        'Your purchase is linked to your organisation account. Sign in or create an account, then you will return here to pay.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Create account', onPress: () => router.push('/auth/signup?returnTo=%2Fpayment') },
          { text: 'Sign in', onPress: () => router.push('/auth/login?returnTo=%2Fpayment') },
        ]
      );
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);
    try {
      await processPayment();

      if (assessment.payment.packageType) {
        const keyPassResult = await allocateKeyPasses(assessment.payment.packageType, assessment.organisation.employeeCount);
        if (keyPassResult && !keyPassResult.success) {
          Alert.alert(
            'Payment Successful',
            'Your payment was processed but employee access codes could not be allocated. Please contact support to resolve this.',
            [{ text: 'Continue', onPress: () => router.push('/confirmation') }]
          );
          return;
        }
      }

      router.push('/confirmation');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      const code = (error as { code?: string } | null)?.code ?? '';
      if (code === 'PAYMENT_CANCELLED' || code === 'PAYMENT_NOT_COMPLETED') {
        Alert.alert('Payment not completed', 'You have not been charged. You can try again when you are ready.');
      } else if (code === 'PAYMENT_PENDING') {
        Alert.alert('Payment still processing', 'Stripe has not confirmed your payment yet. Your package will switch on automatically when it does, so you do not need to pay again.');
      } else if (code === 'DUPLICATE_PURCHASE') {
        Alert.alert('Already purchased', 'Your organisation already has this package.');
      } else if (message.includes('TIMEOUT') || message.includes('timed out')) {
        Alert.alert('Request Timed Out', 'The payment request timed out. Please check your connection and try again.');
      } else if (message.includes('NETWORK') || message.includes('Network')) {
        Alert.alert('Network Error', 'Please check your internet connection and try again.');
      } else {
        Alert.alert('Payment Failed', 'There was an issue processing your payment. Please try again.');
      }
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  };

  const packageName = assessment.payment.packageType === 'health-check'
    ? 'Starter'
    : assessment.payment.packageType === 'with-awareness'
    ? 'Professional'
    : 'Enterprise';

  const billingPeriod = assessment.payment.packageType === 'health-check'
    ? '(one-time)'
    : '/year';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.securityBanner}>
          <Lock size={16} color={colors.govGreen} />
          <Text style={styles.securityText}>Secure payment</Text>
        </View>

        {!isAuthenticated && (
          <TouchableOpacity
            style={styles.signInNotice}
            onPress={() => router.push('/auth/login?returnTo=%2Fpayment')}
            accessibilityRole="button"
            accessibilityLabel="Sign in to your organisation account before paying"
          >
            <Text style={styles.signInNoticeText}>
              You need to sign in before paying. <Text style={styles.signInNoticeLink}>Sign in or create an account</Text>
            </Text>
          </TouchableOpacity>
        )}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Order Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{packageName} Package {billingPeriod}</Text>
            <Text style={styles.summaryValue}>£{assessment.payment.price.toLocaleString()}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>£{assessment.payment.price.toLocaleString()}{billingPeriod !== '(one-time)' ? billingPeriod : ''}</Text>
          </View>
          <Text style={styles.vatNote}>+ 20% VAT for UK businesses</Text>
        </View>

        <View style={styles.formSection}>
          <View style={styles.sectionHeader}>
            <CreditCard size={20} color={colors.govBlue} />
            <Text style={styles.sectionTitle} accessibilityRole="header">Pay by card</Text>
          </View>
          <Text style={styles.stripeNote}>
            You will enter your card details on Stripe’s secure page, then come back to the app.
            We never see or store your card number. You will get a receipt by email.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.payButton, isProcessing && styles.payButtonDisabled]}
          onPress={handlePayment}
          disabled={isProcessing}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={isProcessing ? 'Waiting for payment' : 'Continue to secure payment'}
        >
          {isProcessing ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.payButtonText}>Continue to secure payment</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Payments are processed securely by Stripe. Your card details never pass through the app.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  securityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: colors.lightBlue,
    borderRadius: 4,
    marginBottom: 20,
    gap: 8,
  },
  securityText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.govGreen,
  },
  stripeNote: {
    fontSize: 15,
    color: colors.govGrey1,
    lineHeight: 21,
  },
  signInNotice: {
    borderLeftWidth: 4,
    borderLeftColor: colors.govBlue,
    backgroundColor: colors.lightBlue,
    padding: 12,
    marginBottom: 20,
  },
  signInNoticeText: {
    fontSize: 15,
    color: colors.govGrey1,
    lineHeight: 21,
  },
  signInNoticeLink: {
    color: colors.govBlue,
    fontWeight: '600' as const,
    textDecorationLine: 'underline',
  },
  summaryCard: {
    backgroundColor: colors.govGrey4,
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 15,
    color: colors.govGrey1,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.govGrey1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.govGrey3,
    marginVertical: 12,
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: colors.govGrey1,
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: colors.govBlue,
  },
  vatNote: {
    fontSize: 12,
    color: colors.govGrey2,
    textAlign: 'right' as const,
    marginTop: 4,
  },
  formSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.govGrey1,
  },
  field: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 6,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.govGrey1,
    borderRadius: 4,
    padding: 12,
    fontSize: 16,
    color: colors.govGrey1,
    backgroundColor: colors.white,
  },
  payButton: {
    backgroundColor: colors.govGreen,
    borderRadius: 4,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.white,
  },
  disclaimer: {
    fontSize: 12,
    color: colors.govGrey2,
    textAlign: 'center' as const,
    fontStyle: 'italic' as const,
  },
});
