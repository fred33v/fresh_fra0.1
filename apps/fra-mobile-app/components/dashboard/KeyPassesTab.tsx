import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal, FlatList, ActivityIndicator, Share } from 'react-native';
import { Key, FileText, X, Copy, Share2, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import colors from '@/constants/colors';
import { apiService } from '@/services/api.service';
import { API_CONFIG } from '@/constants/api';

interface KeypassItem {
  code: string;
  organisationId: string;
  status: 'available' | 'used' | 'revoked' | 'expired';
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
}

interface KeyPassesTabProps {
  usedKeyPasses: number;
  totalKeyPasses: number;
  remainingKeyPasses: number;
  organisationId: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; Icon: typeof CheckCircle }> = {
  available: { label: 'Available', color: colors.govGreen, Icon: CheckCircle },
  used: { label: 'Used', color: colors.govBlue, Icon: Clock },
  revoked: { label: 'Revoked', color: colors.errorRed, Icon: XCircle },
  expired: { label: 'Expired', color: colors.warningOrange, Icon: AlertTriangle },
};

export default function KeyPassesTab({
  usedKeyPasses,
  totalKeyPasses,
  remainingKeyPasses,
  organisationId,
}: KeyPassesTabProps) {
  const [showCodesModal, setShowCodesModal] = useState(false);
  const [keypasses, setKeypasses] = useState<KeypassItem[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [codesError, setCodesError] = useState<string | null>(null);

  const usagePct = totalKeyPasses > 0 ? (usedKeyPasses / totalKeyPasses) * 100 : 0;

  const fetchKeypasses = useCallback(async () => {
    setCodesLoading(true);
    setCodesError(null);
    try {
      const response = await apiService.get<KeypassItem[]>(
        API_CONFIG.ENDPOINTS.KEYPASSES.BY_ORG(organisationId)
      );
      if (response.success && response.data) {
        setKeypasses(response.data);
      } else {
        setCodesError('Failed to load key-pass codes.');
      }
    } catch {
      setCodesError('Unable to load key-pass codes. Please try again.');
    }
    setCodesLoading(false);
  }, [organisationId]);

  const handleViewCodes = useCallback(async () => {
    setShowCodesModal(true);
    await fetchKeypasses();
  }, [fetchKeypasses]);

  const handleGenerateInvite = useCallback(async () => {
    if (remainingKeyPasses <= 0) {
      Alert.alert('No Codes Available', 'All key-passes have been used. Please purchase additional key-passes to invite more employees.');
      return;
    }

    setShareLoading(true);
    try {
      // Fetch available codes
      const response = await apiService.get<KeypassItem[]>(
        `${API_CONFIG.ENDPOINTS.KEYPASSES.BY_ORG(organisationId)}?status=available&pageSize=1`
      );

      if (response.success && response.data && response.data.length > 0) {
        const code = response.data[0].code;
        const message = `You've been invited to complete a Fraud Risk Assessment.\n\nYour access code: ${code}\n\nDownload the app and enter this code to get started.`;

        await Share.share({ message, title: 'FRA Access Code' });
      } else {
        Alert.alert('No Available Codes', 'There are no available key-pass codes to share. All codes may have been distributed already.');
      }
    } catch {
      Alert.alert('Error', 'Unable to retrieve an access code. Please try again.');
    }
    setShareLoading(false);
  }, [organisationId, remainingKeyPasses]);

  const copyCode = useCallback(async (code: string) => {
    await Clipboard.setStringAsync(code);
    Alert.alert('Copied', `Code ${code} copied to clipboard.`);
  }, []);

  const renderKeypassItem = useCallback(({ item }: { item: KeypassItem }) => {
    const config = STATUS_CONFIG[item.status] || STATUS_CONFIG.available;
    const StatusIcon = config.Icon;

    return (
      <View style={styles.codeRow}>
        <View style={styles.codeLeft}>
          <Text style={styles.codeText}>{item.code}</Text>
          <View style={[styles.statusPill, { backgroundColor: config.color }]}>
            <StatusIcon size={12} color={colors.white} />
            <Text style={styles.statusPillText}>{config.label}</Text>
          </View>
        </View>
        {item.status === 'available' && (
          <TouchableOpacity
            onPress={() => copyCode(item.code)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Copy code ${item.code}`}
          >
            <Copy size={20} color={colors.govBlue} />
          </TouchableOpacity>
        )}
      </View>
    );
  }, [copyCode]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Key-Pass Management</Text>

      <View style={styles.keyPassCard}>
        <Text style={styles.cardTitle}>Usage Overview</Text>
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${usagePct}%` }]} />
          </View>
          <Text style={styles.progressText}>{usedKeyPasses} of {totalKeyPasses} used</Text>
        </View>
        <Text style={styles.progressSubtext}>{remainingKeyPasses} access passes remaining</Text>
      </View>

      <View style={styles.actionsCard}>
        <TouchableOpacity
          style={[styles.actionButton, shareLoading && styles.actionButtonDisabled]}
          onPress={handleGenerateInvite}
          disabled={shareLoading}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Generate invite link"
        >
          {shareLoading ? (
            <ActivityIndicator size="small" color={colors.govBlue} />
          ) : (
            <Share2 size={20} color={colors.govBlue} />
          )}
          <Text style={styles.actionButtonText}>Share Invite Code</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleViewCodes}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="View key-pass codes"
        >
          <FileText size={20} color={colors.govBlue} />
          <Text style={styles.actionButtonText}>View Key-Pass Codes</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={showCodesModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCodesModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Key-Pass Codes</Text>
            <TouchableOpacity
              onPress={() => setShowCodesModal(false)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={24} color={colors.govGrey1} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalStats}>
            <View style={styles.statChip}>
              <Text style={styles.statChipLabel}>Available</Text>
              <Text style={[styles.statChipValue, { color: colors.govGreen }]}>
                {keypasses.filter(k => k.status === 'available').length}
              </Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statChipLabel}>Used</Text>
              <Text style={[styles.statChipValue, { color: colors.govBlue }]}>
                {keypasses.filter(k => k.status === 'used').length}
              </Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statChipLabel}>Revoked</Text>
              <Text style={[styles.statChipValue, { color: colors.errorRed }]}>
                {keypasses.filter(k => k.status === 'revoked').length}
              </Text>
            </View>
          </View>

          {codesLoading ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" color={colors.govBlue} />
              <Text style={styles.modalLoadingText}>Loading codes...</Text>
            </View>
          ) : codesError ? (
            <View style={styles.modalError}>
              <Text style={styles.modalErrorText}>{codesError}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={fetchKeypasses} activeOpacity={0.7}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : keypasses.length === 0 ? (
            <View style={styles.modalEmpty}>
              <Key size={48} color={colors.govGrey3} />
              <Text style={styles.modalEmptyText}>No key-pass codes found.</Text>
            </View>
          ) : (
            <FlatList
              data={keypasses}
              keyExtractor={(item) => item.code}
              renderItem={renderKeypassItem}
              contentContainerStyle={styles.codesList}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 16,
    letterSpacing: -0.2,
    lineHeight: 26,
  },
  keyPassCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    marginBottom: 12,
    letterSpacing: -0.16,
    lineHeight: 20.8,
  },
  progressBarContainer: {
    marginBottom: 8,
  },
  progressBar: {
    height: 12,
    backgroundColor: colors.govGrey4,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.govBlue,
    borderRadius: 6,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.govGrey1,
  },
  progressSubtext: {
    fontSize: 13,
    color: colors.govGrey2,
  },
  actionsCard: {
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: colors.lightBlue,
    borderRadius: 6,
    marginTop: 10,
    gap: 12,
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.govBlue,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.govGrey4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.govGrey1,
  },
  modalStats: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  statChip: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  statChipLabel: {
    fontSize: 12,
    color: colors.govGrey2,
    marginBottom: 4,
  },
  statChipValue: {
    fontSize: 20,
    fontWeight: '700' as const,
  },
  modalLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  modalLoadingText: {
    fontSize: 14,
    color: colors.govGrey2,
  },
  modalError: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 16,
  },
  modalErrorText: {
    fontSize: 14,
    color: colors.errorRed,
    textAlign: 'center' as const,
  },
  retryButton: {
    backgroundColor: colors.govBlue,
    borderRadius: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.white,
  },
  modalEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  modalEmptyText: {
    fontSize: 15,
    color: colors.govGrey2,
  },
  codesList: {
    padding: 16,
    gap: 10,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: 8,
    padding: 14,
  },
  codeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  codeText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.govGrey1,
    fontFamily: 'monospace',
    letterSpacing: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: colors.white,
  },
});
