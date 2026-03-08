import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '@/constants/colors';

interface PaymentSummaryCardProps {
  packageName: string;
  price: number;
  transactionId: string | null;
  date: string | null;
}

export default function PaymentSummaryCard({
  packageName,
  price,
  transactionId,
  date,
}: PaymentSummaryCardProps) {
  return (
    <View style={styles.detailsCard}>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Package</Text>
        <Text style={styles.detailValue}>{packageName}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Amount paid</Text>
        <Text style={styles.detailValue}>{'\u00A3'}{price.toLocaleString()}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Transaction ID</Text>
        <Text style={styles.detailValue}>{transactionId}</Text>
      </View>
      <View style={styles.detailRow}>
        <Text style={styles.detailLabel}>Date</Text>
        <Text style={styles.detailValue}>
          {new Date(date || '').toLocaleDateString('en-GB')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  detailsCard: {
    backgroundColor: colors.govGrey4,
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: colors.govGrey2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.govGrey1,
  },
});
