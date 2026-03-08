import { useLocalSearchParams, useRouter } from 'expo-router';
import { CreditCard, CheckCircle, ArrowLeft, Shield } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import ScreenContainer from '@/components/ScreenContainer';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';
import { apiService } from '@/services/api.service';
import { API_CONFIG } from '@/constants/api';

const PACKAGE_ID_MAP: Record<string, string> = {
  Professional: 'pkg_training',
  Enterprise: 'pkg_full',
  Starter: 'pkg_basic',
};

export default function PaymentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ package: string; price: string }>();

  const packageName = params.package ?? 'Professional';
  const priceRaw = Number(params.price ?? '1799');
  const priceFormatted = priceRaw.toLocaleString();
  const vatAmount = Math.round(priceRaw * 0.2);
  const totalAmount = priceRaw + vatAmount;

  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const formatCardNumber = (text: string) => {
    const cleaned = text.replace(/\s/g, '');
    const chunks = cleaned.match(/.{1,4}/g);
    return chunks ? chunks.join(' ') : cleaned;
  };

  const formatExpiry = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return cleaned.slice(0, 2) + '/' + cleaned.slice(2, 4);
    }
    return cleaned;
  };

  const handleCardNumberChange = (text: string) => {
    const cleaned = text.replace(/\s/g, '');
    if (cleaned.length <= 16) {
      setCardNumber(formatCardNumber(cleaned));
    }
  };

  const handleExpiryChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 4) {
      setExpiry(formatExpiry(cleaned));
    }
  };

  const handleCvcChange = (text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length <= 3) {
      setCvc(cleaned);
    }
  };

  const handlePayment = async () => {
    const cleanedCard = cardNumber.replace(/\s/g, '');
    if (!cleanedCard || !expiry || !cvc || !cardholderName.trim()) {
      Alert.alert('Missing Information', 'Please fill in all card details before continuing.');
      return;
    }
    if (cleanedCard.length < 13) {
      Alert.alert('Invalid Card', 'Please enter a valid card number.');
      return;
    }
    if (cvc.length < 3) {
      Alert.alert('Invalid CVC', 'CVC must be 3 digits.');
      return;
    }
    const [mm] = expiry.split('/');
    const month = parseInt(mm, 10);
    if (!month || month < 1 || month > 12) {
      Alert.alert('Invalid Expiry', 'Please enter a valid expiry date (MM/YY).');
      return;
    }

    setIsProcessing(true);
    try {
      const packageId = PACKAGE_ID_MAP[packageName] ?? 'pkg_basic';

      const purchase = await apiService.post<{ purchaseId: string; paymentIntentId: string }>(
        API_CONFIG.ENDPOINTS.PURCHASES.CREATE,
        { packageId },
        { requiresAuth: true },
      );

      if (!purchase.success || !purchase.data?.purchaseId) {
        throw new Error(purchase.error?.message || 'Failed to create purchase');
      }

      const confirmed = await apiService.post<{ status: string }>(
        API_CONFIG.ENDPOINTS.PURCHASES.CONFIRM(purchase.data.purchaseId),
        { paymentIntentId: purchase.data.paymentIntentId },
        { requiresAuth: true },
      );

      if (!confirmed.success) {
        throw new Error(confirmed.error?.message || 'Failed to confirm purchase');
      }

      setIsSuccess(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('TIMEOUT') || message.includes('timed out')) {
        Alert.alert('Request Timed Out', 'The payment request timed out. Please check your connection and try again.');
      } else if (message.includes('NETWORK') || message.includes('Network')) {
        Alert.alert('Network Error', 'Please check your internet connection and try again.');
      } else {
        Alert.alert('Payment Failed', 'There was an issue processing your payment. Please try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // ---- Success state ----
  if (isSuccess) {
    return (
      <ScreenContainer>
        <View style={styles.successContainer}>
          <View style={styles.successIconCircle}>
            <CheckCircle color={colors.success} size={64} />
          </View>
          <Text style={styles.successTitle}>Payment Successful</Text>
          <Text style={styles.successSubtitle}>
            Your {packageName} package is now active. A confirmation email has been sent to your registered address.
          </Text>

          <View style={styles.successSummary}>
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>Package</Text>
              <Text style={styles.successValue}>{packageName}</Text>
            </View>
            <View style={styles.successDivider} />
            <View style={styles.successRow}>
              <Text style={styles.successLabel}>Amount paid</Text>
              <Text style={styles.successValue}>{'\u00A3'}{totalAmount.toLocaleString()}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.backHomeButton}
            onPress={() => router.push('/legal')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Start your training"
          >
            <Text style={styles.backHomeButtonText}>Start Your Training</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/')}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Back to Home"
          >
            <ArrowLeft size={18} color={colors.primary} />
            <Text style={styles.secondaryButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // ---- Payment form ----
  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenContainer>
        {/* Back button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={20} color={colors.primary} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Checkout</Text>
          <View style={styles.securityBadge}>
            <Shield size={14} color={colors.success} />
            <Text style={styles.securityBadgeText}>Secure payment</Text>
          </View>
        </View>

        {/* Order summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Order Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{packageName} Package</Text>
            <Text style={styles.summaryValue}>{'\u00A3'}{priceFormatted}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>VAT (20%)</Text>
            <Text style={styles.summaryValue}>{'\u00A3'}{vatAmount.toLocaleString()}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>{'\u00A3'}{totalAmount.toLocaleString()}</Text>
          </View>
        </View>

        {/* Card form */}
        <View style={styles.formSection}>
          <View style={styles.formHeader}>
            <CreditCard size={20} color={colors.primary} />
            <Text style={styles.formHeaderText}>Card Details</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Card number</Text>
            <TextInput
              style={styles.input}
              value={cardNumber}
              onChangeText={handleCardNumberChange}
              placeholder="1234 5678 9012 3456"
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              maxLength={19}
              accessibilityLabel="Card number"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.field, styles.halfField]}>
              <Text style={styles.label}>Expiry date</Text>
              <TextInput
                style={styles.input}
                value={expiry}
                onChangeText={handleExpiryChange}
                placeholder="MM/YY"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                maxLength={5}
                accessibilityLabel="Expiry date"
              />
            </View>
            <View style={[styles.field, styles.halfField]}>
              <Text style={styles.label}>CVC</Text>
              <TextInput
                style={styles.input}
                value={cvc}
                onChangeText={handleCvcChange}
                placeholder="123"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                maxLength={3}
                secureTextEntry
                accessibilityLabel="CVC"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Cardholder name</Text>
            <TextInput
              style={styles.input}
              value={cardholderName}
              onChangeText={setCardholderName}
              placeholder="Name as it appears on card"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="words"
              accessibilityLabel="Cardholder name"
            />
          </View>
        </View>

        {/* Pay button */}
        <TouchableOpacity
          style={[styles.payButton, isProcessing && styles.payButtonDisabled]}
          onPress={handlePayment}
          disabled={isProcessing}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={isProcessing ? 'Processing payment' : `Pay ${totalAmount} pounds`}
        >
          {isProcessing ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.payButtonText}>Pay Now {'\u2014'} {'\u00A3'}{totalAmount.toLocaleString()}</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Payments are processed securely. Your card details are not stored.
        </Text>
      </ScreenContainer>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },

  // Back button
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.successLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
  },
  securityBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.successDarker,
  },

  // Order summary
  summaryCard: {
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  summaryLabel: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.primaryBorder,
    marginVertical: spacing.sm,
  },
  totalLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.primary,
  },

  // Form
  formSection: {
    marginBottom: spacing.lg,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  formHeaderText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  field: {
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  halfField: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs + 2,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },

  // Pay button
  payButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    ...shadows.md,
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.surface,
  },

  // Disclaimer
  disclaimer: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: spacing.lg,
  },

  // Success state
  successContainer: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
  },
  successIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  successSubtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  successSummary: {
    width: '100%',
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  successRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  successLabel: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  successValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  successDivider: {
    height: 1,
    backgroundColor: colors.primaryBorder,
    marginVertical: spacing.sm,
  },
  backHomeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    ...shadows.md,
  },
  backHomeButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.surface,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    marginTop: spacing.sm,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.primary,
  },
});
