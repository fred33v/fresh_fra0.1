import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, Mail, Lock, Check } from 'lucide-react-native';
import colors from '@/constants/colors';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [orgName, setOrgName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignUp = async () => {
    if (!orgName.trim()) {
      Alert.alert('Missing Information', 'Please enter your organisation name');
      return;
    }

    if (!email.trim()) {
      Alert.alert('Missing Information', 'Please enter your email address');
      return;
    }

    // Validate password requirements (must match backend)
    if (!password || password.length < 12) {
      Alert.alert('Weak Password', 'Password must be at least 12 characters');
      return;
    }

    if (!/[a-z]/.test(password)) {
      Alert.alert('Weak Password', 'Password must contain at least one lowercase letter');
      return;
    }

    if (!/[A-Z]/.test(password)) {
      Alert.alert('Weak Password', 'Password must contain at least one uppercase letter');
      return;
    }

    if (!/[0-9]/.test(password)) {
      Alert.alert('Weak Password', 'Password must contain at least one number');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match');
      return;
    }

    if (!acceptTerms) {
      Alert.alert('Terms Required', 'Please accept the terms and privacy policy');
      return;
    }

    setIsLoading(true);
    try {
      const result = await signUp(email.trim().toLowerCase(), password, orgName.trim());
      if (result.success) {
        router.replace('/');
      } else {
        Alert.alert('Sign Up Failed', result.error || 'Could not create account');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">Create your account</Text>
          <Text style={styles.subtitle}>Start managing fraud risk today</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Organisation name</Text>
            <View style={styles.inputContainer}>
              <Building2 size={20} color={colors.govGrey3} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={orgName}
                onChangeText={setOrgName}
                placeholder="Your organisation"
                placeholderTextColor={colors.govGrey3}
                accessibilityLabel="Organisation name"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Work email address</Text>
            <View style={styles.inputContainer}>
              <Mail size={20} color={colors.govGrey3} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@yourorg.com"
                placeholderTextColor={colors.govGrey3}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Work email address"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputContainer}>
              <Lock size={20} color={colors.govGrey3} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Min 12 chars, uppercase, lowercase, number"
                placeholderTextColor={colors.govGrey3}
                secureTextEntry
                accessibilityLabel="Password"
              />
            </View>
            {password.length > 0 && (
              <View style={styles.passwordRequirements}>
                <Text style={[styles.requirement, password.length >= 12 && styles.requirementMet]}>
                  ✓ At least 12 characters
                </Text>
                <Text style={[styles.requirement, /[a-z]/.test(password) && styles.requirementMet]}>
                  ✓ One lowercase letter
                </Text>
                <Text style={[styles.requirement, /[A-Z]/.test(password) && styles.requirementMet]}>
                  ✓ One uppercase letter
                </Text>
                <Text style={[styles.requirement, /[0-9]/.test(password) && styles.requirementMet]}>
                  ✓ One number
                </Text>
              </View>
            )}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Confirm password</Text>
            <View style={styles.inputContainer}>
              <Lock size={20} color={colors.govGrey3} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter password"
                placeholderTextColor={colors.govGrey3}
                secureTextEntry
                accessibilityLabel="Confirm password"
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.termsRow}
            onPress={() => setAcceptTerms(!acceptTerms)}
            activeOpacity={0.7}
            accessibilityRole="checkbox"
            accessibilityLabel="I accept the terms and conditions and privacy policy"
            accessibilityState={{ checked: acceptTerms }}
          >
            <View style={[styles.checkbox, acceptTerms && styles.checkboxChecked]}>
              {acceptTerms && <Check size={16} color={colors.white} strokeWidth={3} />}
            </View>
            <Text style={styles.termsText}>
              I accept the terms & conditions and privacy policy
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.signUpButton, isLoading && styles.signUpButtonDisabled]}
            onPress={handleSignUp}
            disabled={isLoading}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Create Account"
          >
            {isLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.signUpButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Sign in">
            <Text style={styles.footerLink}>Sign in</Text>
          </TouchableOpacity>
        </View>
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
    paddingTop: 40,
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
  hint: {
    fontSize: 13,
    color: colors.warningOrange,
    marginTop: 4,
  },
  passwordRequirements: {
    marginTop: 8,
    gap: 4,
  },
  requirement: {
    fontSize: 12,
    color: colors.govGrey3,
  },
  requirementMet: {
    color: colors.govGreen,
    fontWeight: '600' as const,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.govGrey1,
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.govBlue,
    borderColor: colors.govBlue,
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: colors.govGrey1,
  },
  signUpButton: {
    backgroundColor: colors.govGreen,
    borderRadius: 4,
    padding: 16,
    alignItems: 'center',
  },
  signUpButtonDisabled: {
    opacity: 0.6,
  },
  signUpButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.white,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 15,
    color: colors.govGrey2,
  },
  footerLink: {
    fontSize: 15,
    color: colors.govBlue,
    fontWeight: '600' as const,
  },
});
