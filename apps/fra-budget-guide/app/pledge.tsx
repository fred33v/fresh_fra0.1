import { useApp } from '@/contexts/AppContext';
import { useRouter } from 'expo-router';
import { CheckCircle, PenTool } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';

import ScreenContainer from '@/components/ScreenContainer';
import ActionButton from '@/components/ActionButton';
import { colors, spacing, borderRadius } from '@/constants/theme';

const pledgeItems = [
  'Understand and comply with all financial policies',
  'Exercise delegated authority responsibly and within limits',
  'Apply controls consistently (no shortcuts, no exceptions)',
  'Question unusual, urgent, or suspicious requests',
  'Verify suppliers, invoices, and bank details before approval',
  'Never approve my own transactions',
  'Declare all conflicts of interest',
  'Report fraud concerns immediately through proper channels',
  'Set the tone for my team (ethical behavior, speak-up culture)',
  'Complete mandatory fraud awareness training annually',
  'Support fraud investigations with full cooperation',
  'Protect whistleblowers from retaliation',
];

export default function PledgeScreen() {
  const { pledge, savePledge } = useApp();
  const router = useRouter();
  const [signature, setSignature] = useState('');
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});

  const allChecked = pledgeItems.every((_, index) => checkedItems[index]);

  const toggleItem = (index: number) => {
    setCheckedItems((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const handleSubmit = async () => {
    if (!allChecked) {
      Alert.alert('Incomplete', 'Please check all commitment items.');
      return;
    }

    if (!signature.trim()) {
      Alert.alert('Signature Required', 'Please enter your name to sign the pledge.');
      return;
    }

    await savePledge(signature.trim());
    Alert.alert(
      'Pledge Recorded',
      'Your commitment has been saved. Thank you for your dedication to fraud prevention.',
      [
        {
          text: 'Continue',
          onPress: () => router.push('/resources'),
        },
      ]
    );
  };

  return (
    <ScreenContainer screenId="pledge">
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <CheckCircle color={colors.success} size={48} />
        </View>
        <Text style={styles.title}>Your Commitment as a Budget-Holder</Text>
        <Text style={styles.subtitle}>
          Confirm your understanding and commitment to fraud prevention
        </Text>
      </View>

      {pledge ? (
        <View style={styles.completedCard}>
          <CheckCircle color={colors.success} size={32} />
          <Text style={styles.completedTitle}>Pledge Already Recorded</Text>
          <Text style={styles.completedText}>
            Signed by: {pledge.signature}
          </Text>
          <Text style={styles.completedDate}>
            Date: {new Date(pledge.timestamp).toLocaleDateString()}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.pledgeCard}>
            <Text style={styles.pledgeTitle}>As a budget-holder, I commit to:</Text>
            <View style={styles.itemsContainer}>
              {pledgeItems.map((item, index) => (
                <TouchableOpacity
                  key={item}
                  style={styles.pledgeItem}
                  onPress={() => toggleItem(index)}
                  activeOpacity={0.7}
                  accessibilityRole="checkbox"
                  accessibilityLabel={item}
                  accessibilityState={{ checked: !!checkedItems[index] }}
                >
                  <View style={[styles.checkbox, checkedItems[index] && styles.checkboxChecked]}>
                    {checkedItems[index] && <View style={styles.checkboxInner} />}
                  </View>
                  <Text style={styles.pledgeItemText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.signatureCard}>
            <View style={styles.signatureHeader}>
              <PenTool color={colors.primary} size={24} />
              <Text style={styles.signatureTitle}>Your Signature</Text>
            </View>
            <TextInput
              style={styles.signatureInput}
              placeholder="Enter your full name"
              placeholderTextColor={colors.textFaint}
              value={signature}
              onChangeText={setSignature}
              autoCapitalize="words"
            />
            <Text style={styles.signatureNote}>
              By signing, you acknowledge your understanding and commitment to these responsibilities.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, (!allChecked || !signature.trim()) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!allChecked || !signature.trim()}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={
              !allChecked
                ? 'Check all items to continue'
                : !signature.trim()
                ? 'Enter signature to submit'
                : 'Submit Pledge'
            }
            accessibilityState={{ disabled: !allChecked || !signature.trim() }}
          >
            <Text style={styles.submitButtonText}>
              {!allChecked
                ? 'Check all items to continue'
                : !signature.trim()
                ? 'Enter signature to submit'
                : 'Submit Pledge'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      <ActionButton
        label={pledge ? 'View Resources' : 'Skip for Now'}
        onPress={() => router.push('/resources')}
        variant="outline"
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconContainer: {
    marginBottom: spacing.md - 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
  completedCard: {
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.success,
  },
  completedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.successDarker,
    marginTop: spacing.md - 4,
    marginBottom: spacing.sm,
  },
  completedText: {
    fontSize: 15,
    color: colors.successDark,
    marginBottom: spacing.xs,
  },
  completedDate: {
    fontSize: 14,
    color: colors.success,
  },
  pledgeCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginBottom: 20,
  },
  pledgeTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  itemsContainer: {
    gap: 14,
  },
  pledgeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md - 4,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  checkboxInner: {
    width: 12,
    height: 12,
    borderRadius: 3,
    backgroundColor: colors.surface,
  },
  pledgeItemText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  signatureCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginBottom: 20,
  },
  signatureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  signatureTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    marginLeft: spacing.md - 4,
  },
  signatureInput: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: 14,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.md - 4,
  },
  signatureNote: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  submitButton: {
    backgroundColor: colors.success,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md - 4,
  },
  submitButtonDisabled: {
    backgroundColor: colors.borderLight,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.surface,
  },
});
