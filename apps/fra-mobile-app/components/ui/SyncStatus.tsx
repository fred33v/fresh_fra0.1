/**
 * SyncStatus Component
 *
 * Displays the current sync state and provides visual feedback
 * for offline-first architecture with backend synchronization
 */

import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Cloud, CloudOff, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react-native';
import colors from '@/constants/colors';

export interface SyncStatusProps {
  /** Current sync state */
  state: 'synced' | 'syncing' | 'pending' | 'error';
  /** Last successful sync time */
  lastSync: Date | null;
  /** Is device online */
  isOnline: boolean;
  /** Number of items in sync queue */
  queueCount?: number;
  /** Error message if state is 'error' */
  errorMessage?: string;
  /** Compact mode for toolbar */
  compact?: boolean;
}

export function SyncStatus({
  state,
  lastSync,
  isOnline,
  queueCount = 0,
  errorMessage,
  compact = false,
}: SyncStatusProps) {
  const getStatusIcon = () => {
    const iconSize = compact ? 16 : 20;
    const iconColor = colors.govGrey2;

    if (!isOnline) {
      return <CloudOff size={iconSize} color={colors.govRed} />;
    }

    switch (state) {
      case 'syncing':
        return <ActivityIndicator size="small" color={colors.govBlue} />;
      case 'synced':
        return <CheckCircle size={iconSize} color={colors.govGreen} />;
      case 'pending':
        return <RefreshCw size={iconSize} color={colors.govOrange} />;
      case 'error':
        return <AlertCircle size={iconSize} color={colors.govRed} />;
      default:
        return <Cloud size={iconSize} color={iconColor} />;
    }
  };

  const getStatusText = () => {
    if (!isOnline) {
      return queueCount > 0
        ? `Offline - ${queueCount} pending`
        : 'Offline';
    }

    switch (state) {
      case 'syncing':
        return 'Syncing...';
      case 'synced':
        return lastSync
          ? `Synced ${formatLastSync(lastSync)}`
          : 'Synced';
      case 'pending':
        return queueCount > 0
          ? `${queueCount} pending sync`
          : 'Pending sync';
      case 'error':
        return 'Sync failed';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = () => {
    if (!isOnline) return colors.govRed;

    switch (state) {
      case 'syncing':
        return colors.govBlue;
      case 'synced':
        return colors.govGreen;
      case 'pending':
        return colors.govOrange;
      case 'error':
        return colors.govRed;
      default:
        return colors.govGrey2;
    }
  };

  const formatLastSync = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins === 1) return '1 min ago';
    if (diffMins < 60) return `${diffMins} mins ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;

    return 'over 1 day ago';
  };

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        {getStatusIcon()}
        <Text style={[styles.compactText, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {getStatusIcon()}
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>
      </View>

      {state === 'error' && errorMessage && (
        <Text style={styles.errorMessage}>{errorMessage}</Text>
      )}

      {!isOnline && queueCount > 0 && (
        <Text style={styles.queueInfo}>
          {queueCount} {queueCount === 1 ? 'change' : 'changes'} will sync when online
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.govLightGrey,
    borderRadius: 6,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  errorMessage: {
    fontSize: 12,
    color: colors.govRed,
    marginTop: 4,
    marginLeft: 28,
  },
  queueInfo: {
    fontSize: 12,
    color: colors.govGrey2,
    marginTop: 4,
    marginLeft: 28,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  compactText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
});
