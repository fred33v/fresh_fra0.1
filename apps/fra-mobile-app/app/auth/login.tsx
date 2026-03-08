import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Lock, Mail } from 'lucide-react-native';
import colors from '@/constants/colors';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing Information', 'Please enter your email and password');
      return;
    }

    setIsLoading(true);
    try {
      const result = await signIn(email.trim().toLowerCase(), password);
      if (result.success) {
        router.replace('/');
      } else {
        Alert.alert('Sign In Failed', result.error || 'Invalid credentials');
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
          <Text style={styles.title} accessibilityRole="header">Sign in to your account</Text>
          <Text style={styles.subtitle}>Access your fraud risk assessments</Text>
        </View>

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
                accessibilityLabel="Email address"
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
                placeholder="Enter your password"
                placeholderTextColor={colors.govGrey3}
                secureTextEntry
                accessibilityLabel="Password"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[styles.signInButton, isLoading && styles.signInButtonDisabled]}
            onPress={handleSignIn}
            disabled={isLoading}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Sign In"
          >
            {isLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.signInButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.forgotPasswordButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Forgot password"
            onPress={() => router.push('/auth/forgot-password')}
          >
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.createAccountButton}
          onPress={() => router.push('/auth/signup')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Create new account"
        >
          <Text style={styles.createAccountText}>Create new account</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.keyPassButton}
          onPress={() => router.push('/auth/keypass')}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Use company access code"
        >
          <Text style={styles.keyPassText}>Use company access code</Text>
        </TouchableOpacity>
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
  signInButton: {
    backgroundColor: colors.govBlue,
    borderRadius: 4,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  signInButtonDisabled: {
    opacity: 0.6,
  },
  signInButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.white,
  },
  forgotPasswordButton: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotPasswordText: {
    fontSize: 15,
    color: colors.govBlue,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.govGrey3,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: colors.govGrey2,
    fontWeight: '600' as const,
  },
  createAccountButton: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.govBlue,
    borderRadius: 4,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  createAccountText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.govBlue,
  },
  keyPassButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  keyPassText: {
    fontSize: 15,
    color: colors.govGrey2,
    textDecorationLine: 'underline' as const,
  },
});
