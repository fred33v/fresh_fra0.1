import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Alert, Clipboard } from 'react-native';
import { Link2, Copy, Users, Share2 } from 'lucide-react-native';
import colors from '@/constants/colors';

interface EmployeeAccessCardProps {
  organisationId: string;
  keyPassesAllocated: number;
  keyPassesUsed: number;
  onShareError: (error: unknown) => void;
}

export default function EmployeeAccessCard({
  organisationId,
  keyPassesAllocated,
  keyPassesUsed,
  onShareError,
}: EmployeeAccessCardProps) {
  const baseUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://rork.app';
  const accessLink = `${baseUrl}/employee-access/${organisationId}`;
  const availablePasses = keyPassesAllocated - keyPassesUsed;

  const handleCopyLink = () => {
    Clipboard.setString(accessLink);
    Alert.alert('Copied!', 'Link copied to clipboard');
  };

  const handleShareLink = async () => {
    try {
      await Share.share({
        message: `You've been granted access to fraud risk awareness training. Visit this link to get started: ${accessLink}`,
        title: 'Fraud Risk Awareness Training Access',
      });
    } catch (error: unknown) {
      onShareError(error);
    }
  };

  return (
    <View style={styles.employeeAccessCard}>
      <View style={styles.employeeAccessHeader}>
        <Link2 size={24} color={colors.govBlue} />
        <Text style={styles.employeeAccessTitle}>Employee Access Link</Text>
      </View>
      <Text style={styles.employeeAccessDescription}>
        Share this link with your employees to give them access to fraud awareness training and materials.
      </Text>

      <View style={styles.linkContainer}>
        <Text style={styles.linkText} numberOfLines={1}>
          {accessLink}
        </Text>
        <TouchableOpacity
          style={styles.copyButton}
          onPress={handleCopyLink}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Copy employee access link"
        >
          <Copy size={18} color={colors.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.keyPassInfo}>
        <Users size={16} color={colors.govGrey2} />
        <Text style={styles.keyPassInfoText}>
          {availablePasses} of {keyPassesAllocated} access passes available
        </Text>
      </View>

      <TouchableOpacity
        style={styles.shareButton}
        onPress={handleShareLink}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Share Link with Employees"
      >
        <Share2 size={18} color={colors.govBlue} />
        <Text style={styles.shareButtonText}>Share Link with Employees</Text>
      </TouchableOpacity>

      <Text style={styles.employeeAccessNote}>
        Employees will need to enter their email address to access the materials. Each access uses one key-pass.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  employeeAccessCard: {
    backgroundColor: colors.lightBlue,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: colors.govBlue,
  },
  employeeAccessHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  employeeAccessTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.govGrey1,
  },
  employeeAccessDescription: {
    fontSize: 14,
    color: colors.govGrey2,
    lineHeight: 20,
    marginBottom: 16,
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  linkText: {
    flex: 1,
    fontSize: 14,
    color: colors.govBlue,
    fontWeight: '500' as const,
  },
  copyButton: {
    backgroundColor: colors.govBlue,
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPassInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  keyPassInfoText: {
    fontSize: 13,
    color: colors.govGrey2,
    fontWeight: '600' as const,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.govBlue,
    borderRadius: 8,
    padding: 14,
    gap: 8,
    marginBottom: 12,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.govBlue,
  },
  employeeAccessNote: {
    fontSize: 12,
    color: colors.govGrey2,
    lineHeight: 16,
    fontStyle: 'italic' as const,
  },
});
