import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAssessment } from '@/contexts/AssessmentContext';
import { useAuth } from '@/contexts/AuthContext';
import { CreditCard, Lock } from 'lucide-react-native';
import colors from '@/constants/colors';

export default function PaymentScreen() {
  const router = useRouter();
  const { assessment, processPayment } = useAssessment();
  const { allocateKeyPasses } = useAuth();
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef(false);

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
    if (processingRef.current) return;
    if (!cardNumber || !expiry || !cvc || !cardholderName) {
      Alert.alert('Missing Information', 'Please fill in all card details');
      return;
    }

    processingRef.current = true;
    setIsProcessing(true);
    try {
      await processPayment({
        number: cardNumber.replace(/\s/g, ''),
        expiry,
        cvc,
        name: cardholderName,
      });

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
      if (message.includes('TIMEOUT') || message.includes('timed out')) {
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
            <Text style={styles.sectionTitle} accessibilityRole="header">Card Details</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Card number</Text>
            <TextInput
              style={styles.input}
              value={cardNumber}
              onChangeText={handleCardNumberChange}
              placeholder="1234 5678 9012 3456"
              placeholderTextColor={colors.govGrey3}
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
                placeholderTextColor={colors.govGrey3}
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
                placeholderTextColor={colors.govGrey3}
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
              placeholderTextColor={colors.govGrey3}
              autoCapitalize="words"
              accessibilityLabel="Cardholder name"
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.payButton, isProcessing && styles.payButtonDisabled]}
          onPress={handlePayment}
          disabled={isProcessing}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={isProcessing ? 'Processing payment' : `Pay ${assessment.payment.price.toLocaleString()} pounds`}
        >
          {isProcessing ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.payButtonText}>Pay £{assessment.payment.price.toLocaleString()}</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          Payments are processed securely. Your card details are not stored in the app.
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
