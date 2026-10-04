import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Share, Alert, Clipboard } from 'react-native';
import { KeyRound, Copy, Users, Share2 } from 'lucide-react-native';
import colors from '@/constants/colors';

interface EmployeeAccessCardProps {
  /** Key-pass codes allocated to this organisation (each lets one employee join). */
  codes: string[];
  keyPassesAllocated: number;
  keyPassesUsed: number;
  onShareError: (error: unknown) => void;
}

// Employees join by entering a key-pass in the app ("Use company access code"), so share the
// codes themselves with instructions; there is no web join link.
export function buildAccessMessage(codes: string[]): string {
  const list = codes.map((c) => `• ${c}`).join('\n');
  return [
    'You have been invited to complete a fraud risk assessment for your organisation.',
    '',
    'Open the FRAUD-RISK.CO.UK app, tap "Sign In", then "Use company access code", and enter your code:',
    list,
    '',
    'Each code can be used once.',
  ].join('\n');
}

export default function EmployeeAccessCard({
  codes,
  keyPassesAllocated,
  keyPassesUsed,
  onShareError,
}: EmployeeAccessCardProps) {
  const availablePasses = keyPassesAllocated - keyPassesUsed;
  const shown = codes.slice(0, 5);

  const handleCopyCodes = () => {
    Clipboard.setString(codes.join('\n'));
    Alert.alert('Copied', codes.length === 1 ? 'Access code copied' : `${codes.length} access codes copied`);
  };

  const handleShareCodes = async () => {
    try {
      await Share.share({
        message: buildAccessMessage(codes),
        title: 'Your fraud risk assessment access code',
      });
    } catch (error: unknown) {
      onShareError(error);
    }
  };

  return (
    <View style={styles.employeeAccessCard}>
      <View style={styles.employeeAccessHeader}>
        <KeyRound size={24} color={colors.govBlue} />
        <Text style={styles.employeeAccessTitle}>Employee Access Codes</Text>
      </View>
      <Text style={styles.employeeAccessDescription}>
        Give each employee one code. They enter it in the app under “Use company access code” to complete their own assessment.
      </Text>

      {codes.length > 0 ? (
        <View style={styles.linkContainer}>
          <View style={styles.codeList}>
            {shown.map((code) => (
              <Text key={code} style={styles.linkText} selectable accessibilityLabel={`Access code ${code.split('').join(' ')}`}>
                {code}
              </Text>
            ))}
            {codes.length > shown.length && (
              <Text style={styles.moreCodes}>and {codes.length - shown.length} more</Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.copyButton}
            onPress={handleCopyCodes}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={codes.length === 1 ? 'Copy access code' : 'Copy all access codes'}
          >
            <Copy size={18} color={colors.white} />
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.employeeAccessNote}>Your codes are being prepared. You can also manage them from the dashboard.</Text>
      )}

      <View style={styles.keyPassInfo}>
        <Users size={16} color={colors.govGrey2} />
        <Text style={styles.keyPassInfoText}>
          {availablePasses} of {keyPassesAllocated} access {keyPassesAllocated === 1 ? 'pass' : 'passes'} available
        </Text>
      </View>

      {codes.length > 0 && (
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleShareCodes}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Share access codes with employees"
        >
          <Share2 size={18} color={colors.govBlue} />
          <Text style={styles.shareButtonText}>Share Codes with Employees</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.employeeAccessNote}>
        Each code works once and expires after 90 days.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  codeList: {
    flex: 1,
    gap: 4,
  },
  moreCodes: {
    fontSize: 13,
    color: colors.govGrey2,
  },
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
