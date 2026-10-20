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
  Pressable,
} from 'react-native';
import ScreenContainer from '@/components/ScreenContainer';
import ActionButton from '@/components/ActionButton';
import InfoBanner from '@/components/InfoBanner';
import IconBadge from '@/components/IconBadge';
import { colors, spacing, borderRadius, shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

export default function KeyPassEntryScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, loginWithKeyPass, loginWithPassword } = useAuth();

  // 'join' redeems a key-pass (first visit); 'signin' uses the password chosen when joining
  const [mode, setMode] = useState<'join' | 'signin'>('join');
  const [code, setCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const isJoining = mode === 'join';
  const canSubmit = !!email.trim() && !!password && (!isJoining || !!code.trim());

  const switchMode = () => {
    setMode(isJoining ? 'signin' : 'join');
    setError(null);
  };

  const handleStartTraining = async () => {
    const trimmed = code.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (isJoining && !trimmed) {
      setError('Please enter your key-pass code');
      return;
    }
    if (!trimmedEmail || !password) {
      setError('Please enter your email and password');
      return;
    }
    // Same rules as the backend
    if (isJoining && (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password))) {
      setError('Use at least 12 characters, with an uppercase letter, a lowercase letter and a number');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    const result = isJoining
      ? await loginWithKeyPass(trimmed.toUpperCase(), trimmedEmail, password)
      : await loginWithPassword(trimmedEmail, password);

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
            <Text style={styles.formLabel}>{isJoining ? 'Join with your key-pass' : 'Sign in'}</Text>
            <Text style={styles.formHint}>
              {isJoining
                ? 'Your code was provided by your organisation administrator. It works once, so choose a password for next time.'
                : 'Use the email and password you chose when you joined.'}
            </Text>

            {isJoining && (
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
                returnKeyType="next"
                editable={!isSubmitting}
                accessibilityLabel="Key-pass code"
                accessibilityHint="Enter the key-pass code provided by your organisation"
              />
            )}

            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (error) setError(null);
              }}
              placeholder="Work email"
              placeholderTextColor={colors.textFaint}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
              editable={!isSubmitting}
              accessibilityLabel="Work email"
            />

            <TextInput
              style={styles.input}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (error) setError(null);
              }}
              placeholder={isJoining ? 'Create a password (12+ characters)' : 'Password'}
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType={isJoining ? 'newPassword' : 'password'}
              returnKeyType="go"
              onSubmitEditing={handleStartTraining}
              editable={!isSubmitting}
              accessibilityLabel={isJoining ? 'Create a password' : 'Password'}
            />

            {error && (
              <InfoBanner message={error} variant="danger" />
            )}

            <View style={styles.buttonContainer}>
              <ActionButton
                label={isJoining ? 'Start Training' : 'Sign in'}
                onPress={handleStartTraining}
                loading={isSubmitting}
                disabled={!canSubmit}
              />
            </View>

            <Pressable
              onPress={switchMode}
              style={styles.switchMode}
              accessibilityRole="button"
            >
              <Text style={styles.switchModeText}>
                {isJoining ? 'Already joined? Sign in with your password' : 'First time? Join with a key-pass'}
              </Text>
            </Pressable>
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
  switchMode: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  switchModeText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
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
