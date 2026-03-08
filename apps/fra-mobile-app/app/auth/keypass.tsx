import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Key, Mail } from 'lucide-react-native';
import colors from '@/constants/colors';

export default function KeyPassScreen() {
  const router = useRouter();
  const { signInWithKeyPass } = useAuth();
  const [email, setEmail] = useState('');
  const [keyPassCode, setKeyPassCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleKeyPassSignIn = async () => {
    if (!email.trim()) {
      Alert.alert('Missing Information', 'Please enter your work email address');
      return;
    }

    if (!keyPassCode.trim()) {
      Alert.alert('Missing Information', 'Please enter your company access code');
      return;
    }

    setIsLoading(true);
    try {
      const result = await signInWithKeyPass(email.trim().toLowerCase(), keyPassCode.trim().toUpperCase());
      if (result.success) {
        router.replace('/');
      } else {
        Alert.alert('Access Code Invalid', result.error || 'The access code you entered is not valid or has already been used.');
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
          <View style={styles.iconContainer}>
            <Key size={40} color={colors.govBlue} />
          </View>
          <Text style={styles.title} accessibilityRole="header">Use company access code</Text>
          <Text style={styles.subtitle}>
            If your organisation has purchased an FRA package, you can use the access code provided by your employer
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Your work email</Text>
            <View style={styles.inputContainer}>
              <Mail size={20} color={colors.govGrey3} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@yourcompany.com"
                placeholderTextColor={colors.govGrey3}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Your work email"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Company access code</Text>
            <View style={styles.inputContainer}>
              <Key size={20} color={colors.govGrey3} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={keyPassCode}
                onChangeText={(text) => setKeyPassCode(text.toUpperCase())}
                placeholder="FRA-XXXXXXXX"
                placeholderTextColor={colors.govGrey3}
                autoCapitalize="characters"
                autoCorrect={false}
                accessibilityLabel="Company access code"
              />
            </View>
            <Text style={styles.hint}>
              This code should have been provided by your organisation administrator
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.continueButton, isLoading && styles.continueButtonDisabled]}
            onPress={handleKeyPassSignIn}
            disabled={isLoading}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Continue"
          >
            {isLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.continueButtonText}>Continue</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>What is a company access code?</Text>
          <Text style={styles.infoText}>
            When your organisation purchases an FRA package, it includes free access passes for employees. 
            Your administrator can provide you with an access code to create your account without payment.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Back to sign in"
        >
          <Text style={styles.backButtonText}>Back to sign in</Text>
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
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: colors.govGrey1,
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  subtitle: {
    fontSize: 15,
    color: colors.govGrey2,
    textAlign: 'center' as const,
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
  hint: {
    fontSize: 13,
    color: colors.govGrey2,
    marginTop: 4,
    fontStyle: 'italic' as const,
  },
  continueButton: {
    backgroundColor: colors.govBlue,
    borderRadius: 4,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: colors.white,
  },
  infoBox: {
    backgroundColor: colors.lightBlue,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.govBlue,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.govGrey1,
    lineHeight: 20,
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  backButtonText: {
    fontSize: 15,
    color: colors.govBlue,
  },
});
