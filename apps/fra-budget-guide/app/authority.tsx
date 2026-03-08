import { useRouter } from 'expo-router';
import { Shield } from 'lucide-react-native';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
} from 'react-native';
import ScreenContainer from '@/components/ScreenContainer';
import ActionButton from '@/components/ActionButton';
import InfoBanner from '@/components/InfoBanner';
import { colors, spacing, borderRadius } from '@/constants/theme';

interface AuthorityLevel {
  type: string;
  upTo1k: string;
  upTo5k: string;
  upTo25k: string;
  over25k: string;
}

const authorityMatrix: AuthorityLevel[] = [
  {
    type: 'Procurement',
    upTo1k: 'Team Leader',
    upTo5k: 'Budget Holder',
    upTo25k: 'Senior Manager',
    over25k: 'Director + CFO',
  },
  {
    type: 'Expenses',
    upTo1k: 'Line Manager',
    upTo5k: 'Budget Holder',
    upTo25k: 'Director',
    over25k: 'CEO',
  },
  {
    type: 'Payroll Changes',
    upTo1k: 'HR Officer',
    upTo5k: 'HR Manager',
    upTo25k: 'HR Director',
    over25k: 'CEO',
  },
  {
    type: 'Contract Awards',
    upTo1k: 'N/A',
    upTo5k: 'Budget Holder',
    upTo25k: 'Director + Proc.',
    over25k: 'Board',
  },
  {
    type: 'New Suppliers',
    upTo1k: 'N/A',
    upTo5k: 'Budget Holder',
    upTo25k: 'Senior Manager',
    over25k: 'CFO',
  },
];

const goldenRules = [
  'Never exceed your authority (even "just this once")',
  'Never approve your own transactions',
  'Never approve for family/friends without disclosure',
  'If in doubt, escalate upward',
];

export default function AuthorityScreen() {
  const router = useRouter();

  return (
    <ScreenContainer screenId="authority">
      <View style={styles.header}>
        <Shield color={colors.primary} size={40} />
        <Text style={styles.title}>Know Your Limits</Text>
        <Text style={styles.subtitle}>
          Authority limits protect you and the organisation
        </Text>
      </View>

      <View style={styles.rulesCard}>
        <Text style={styles.rulesTitle}>Golden Rules</Text>
        {goldenRules.map((rule) => (
          <View key={rule} style={styles.ruleItem}>
            <View style={styles.ruleBullet} />
            <Text style={styles.ruleText}>{rule}</Text>
          </View>
        ))}
      </View>

      <View style={styles.matrixCard}>
        <Text style={styles.matrixTitle}>Authority Matrix (Example)</Text>
        <Text style={styles.matrixNote}>
          This is an example. Check your organisation&apos;s specific limits.
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <View style={[styles.tableCell, styles.tableHeaderCell, styles.cellType]}>
                <Text style={styles.tableHeaderText}>Type</Text>
              </View>
              <View style={[styles.tableCell, styles.tableHeaderCell, styles.cellAmount]}>
                <Text style={styles.tableHeaderText}>Up to £1k</Text>
              </View>
              <View style={[styles.tableCell, styles.tableHeaderCell, styles.cellAmount]}>
                <Text style={styles.tableHeaderText}>£1k-£5k</Text>
              </View>
              <View style={[styles.tableCell, styles.tableHeaderCell, styles.cellAmount]}>
                <Text style={styles.tableHeaderText}>£5k-£25k</Text>
              </View>
              <View style={[styles.tableCell, styles.tableHeaderCell, styles.cellAmount]}>
                <Text style={styles.tableHeaderText}>£25k+</Text>
              </View>
            </View>

            {authorityMatrix.map((row, index) => (
              <View
                key={row.type}
                style={[styles.tableRow, index % 2 === 0 && styles.tableRowAlt]}
              >
                <View style={[styles.tableCell, styles.cellType]}>
                  <Text style={styles.tableCellTextBold}>{row.type}</Text>
                </View>
                <View style={[styles.tableCell, styles.cellAmount]}>
                  <Text style={styles.tableCellText}>{row.upTo1k}</Text>
                </View>
                <View style={[styles.tableCell, styles.cellAmount]}>
                  <Text style={styles.tableCellText}>{row.upTo5k}</Text>
                </View>
                <View style={[styles.tableCell, styles.cellAmount]}>
                  <Text style={styles.tableCellText}>{row.upTo25k}</Text>
                </View>
                <View style={[styles.tableCell, styles.cellAmount]}>
                  <Text style={styles.tableCellText}>{row.over25k}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={styles.infoCardContainer}>
        <InfoBanner
          message="Delegation limits ensure appropriate oversight and prevent single-person fraud. They also protect you from unwitting involvement in fraudulent activities."
          variant="info"
        />
      </View>

      <ActionButton
        label="Report Fraud Guidance"
        onPress={() => router.push('/reporting')}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
  },
  rulesCard: {
    backgroundColor: colors.danger,
    borderRadius: borderRadius.md,
    padding: 20,
    marginBottom: spacing.lg,
  },
  rulesTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.surface,
    marginBottom: spacing.md,
  },
  ruleItem: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  ruleBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surface,
    marginTop: 7,
    marginRight: 12,
  },
  ruleText: {
    flex: 1,
    fontSize: 15,
    color: colors.surface,
    lineHeight: 21,
  },
  matrixCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  matrixTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  matrixNote: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.md,
    fontStyle: 'italic',
  },
  table: {
    minWidth: 600,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderTopLeftRadius: borderRadius.sm,
    borderTopRightRadius: borderRadius.sm,
  },
  tableHeaderCell: {
    padding: 12,
  },
  tableHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.surface,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRowAlt: {
    backgroundColor: colors.background,
  },
  tableCell: {
    padding: 12,
    justifyContent: 'center',
  },
  cellType: {
    width: 140,
  },
  cellAmount: {
    width: 115,
  },
  tableCellText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  tableCellTextBold: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  infoCardContainer: {
    marginBottom: spacing.lg,
  },
});
