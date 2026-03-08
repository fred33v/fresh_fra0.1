import { useRouter, Redirect } from 'expo-router';
import { Shield } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import ScreenContainer from '@/components/ScreenContainer';
import ActionButton from '@/components/ActionButton';
import InfoBanner from '@/components/InfoBanner';
import IconBadge from '@/components/IconBadge';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

export default function KeyPassEntryScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, loginWithKeyPass } = useAuth();

  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (authLoading) {
    return (
      <View style={styles.loadingContainer} accessibilityRole="progressbar">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Checking session...</Text>
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/home" />;
  }

  const handleStartTraining = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      setError('Please enter your key-pass code');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    const result = await loginWithKeyPass(trimmed);

    if (result.success) {
      router.replace('/home');
    } else {
      setError(result.error || 'Invalid key-pass code');
    }

    setIsSubmitting(false);
  };

  return (
    <ScreenContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Branding */}
          <View style={styles.brandingSection}>
            <IconBadge
              icon={Shield}
              size={40}
              circleSize={80}
              bgColor={colors.primaryLight}
              iconColor={colors.primary}
            />
            <Text style={styles.appTitle}>Fraud Risk Awareness</Text>
            <Text style={styles.appSubtitle}>Training Workshop</Text>
          </View>

          {/* Entry form */}
          <View style={styles.formCard}>
            <Text style={styles.formLabel}>Enter your key-pass code</Text>
            <Text style={styles.formHint}>
              Your code was provided by your organisation administrator
            </Text>

            <TextInput
              style={[styles.input, error ? styles.inputError : null]}
              value={code}
              onChangeText={(text) => {
                setCode(text);
                if (error) setError(null);
              }}
              placeholder="e.g. FRA-2024-ABCD"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={handleStartTraining}
              editable={!isSubmitting}
              accessibilityLabel="Key-pass code"
              accessibilityHint="Enter the key-pass code provided by your organisation"
            />

            {error && (
              <InfoBanner message={error} variant="danger" />
            )}

            <View style={styles.buttonContainer}>
              <ActionButton
                label="Start Training"
                onPress={handleStartTraining}
                loading={isSubmitting}
                disabled={!code.trim()}
              />
            </View>
          </View>

          {/* Compliance badge */}
          <View style={styles.complianceBadge}>
            <Text style={styles.complianceText}>
              GovS-013 &amp; ECCTA 2023
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textMuted,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  brandingSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  appSubtitle: {
    fontSize: 18,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  formCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  formHint: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
    marginBottom: spacing.md,
  },
  inputError: {
    borderColor: colors.danger,
  },
  buttonContainer: {
    marginTop: spacing.sm,
  },
  complianceBadge: {
    marginTop: spacing.xl,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  complianceText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
  },
});
