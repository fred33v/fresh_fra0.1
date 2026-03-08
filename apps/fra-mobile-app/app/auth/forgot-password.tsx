import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react-native';
import colors from '@/constants/colors';
import { apiService } from '@/services/api.service';
import { API_CONFIG } from '@/constants/api';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) return;

    setIsLoading(true);
    try {
      await apiService.post(API_CONFIG.ENDPOINTS.AUTH.FORGOT_PASSWORD, {
        email: email.trim().toLowerCase(),
      });
    } catch {
      // Always show success to prevent email enumeration
    }
    setSent(true);
    setIsLoading(false);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={20} color={colors.govBlue} />
          <Text style={styles.backText}>Back to sign in</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">Reset your password</Text>
          <Text style={styles.subtitle}>
            Enter your email address and we&apos;ll send you instructions to reset your password.
          </Text>
        </View>

        {sent ? (
          <View style={styles.successContainer}>
            <CheckCircle size={48} color={colors.govGreen} />
            <Text style={styles.successTitle}>Check your email</Text>
            <Text style={styles.successText}>
              If an account with that email exists, we&apos;ve sent password reset instructions. Please check your inbox.
            </Text>
            <TouchableOpacity
              style={styles.backToSignInButton}
              onPress={() => router.back()}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Back to sign in"
            >
              <Text style={styles.backToSignInText}>Back to Sign In</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Email address</Text>
              <View style={styles.inputContainer}>
                <Mail size={20} color={colors.govGrey3} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.govGrey3}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  accessibilityLabel="Email address"
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, (isLoading || !email.trim()) && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={isLoading || !email.trim()}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Send reset link"
            >
              {isLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.submitButtonText}>Send Reset Link</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
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
    flexGrow: 1,
    padding: 20,
    paddingTop: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backText: {
    fontSize: 15,
    color: colors.govBlue,
    marginLeft: 8,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.govGrey1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.govGrey2,
    lineHeight: 22,
  },
  form: {
    marginBottom: 24,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.govGrey1,
    borderRadius: 4,
    backgroundColor: colors.white,
  },
  inputIcon: {
    marginLeft: 12,
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: colors.govGrey1,
  },
  submitButton: {
    backgroundColor: colors.govBlue,
    borderRadius: 4,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.white,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: colors.govGrey1,
    marginTop: 16,
    marginBottom: 8,
  },
  successText: {
    fontSize: 15,
    color: colors.govGrey2,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  backToSignInButton: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.govBlue,
    borderRadius: 4,
    padding: 16,
    alignItems: 'center',
    width: '100%',
  },
  backToSignInText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.govBlue,
  },
});
