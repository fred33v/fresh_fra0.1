import { useApp } from '@/contexts/AppContext';
import { useRouter } from 'expo-router';
import { Eye, User } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ActionButton from '@/components/ActionButton';
import InfoBanner from '@/components/InfoBanner';
import ProgressHeader from '@/components/ProgressHeader';
import { colors, spacing } from '@/constants/theme';

interface RedFlag {
  id: string;
  category: 'people' | 'transactions';
  text: string;
}

const redFlags: RedFlag[] = [
  {
    id: 'people-1',
    category: 'people',
    text: 'Employee discussing money problems or debt',
  },
  {
    id: 'people-2',
    category: 'people',
    text: 'Sudden lifestyle changes inconsistent with salary',
  },
  {
    id: 'people-3',
    category: 'people',
    text: 'Reluctance to take leave or share responsibilities',
  },
  {
    id: 'people-4',
    category: 'people',
    text: 'Working unusual hours alone',
  },
  {
    id: 'people-5',
    category: 'people',
    text: 'Defensive when questioned about transactions',
  },
  {
    id: 'people-6',
    category: 'people',
    text: 'Overly close relationships with suppliers/contractors',
  },
  {
    id: 'people-7',
    category: 'people',
    text: 'Control issues - won\'t delegate or share passwords',
  },
  {
    id: 'people-8',
    category: 'people',
    text: 'Disgruntlement with employer or entitlement mentality',
  },
  {
    id: 'trans-1',
    category: 'transactions',
    text: 'New suppliers with generic email addresses (Gmail, Hotmail)',
  },
  {
    id: 'trans-2',
    category: 'transactions',
    text: 'Round numbers on invoices (£5,000.00 vs £4,847.23)',
  },
  {
    id: 'trans-3',
    category: 'transactions',
    text: 'Invoices just below approval thresholds',
  },
  {
    id: 'trans-4',
    category: 'transactions',
    text: 'Urgent payment demands without justification',
  },
  {
    id: 'trans-5',
    category: 'transactions',
    text: 'Vague invoice descriptions (Miscellaneous services)',
  },
  {
    id: 'trans-6',
    category: 'transactions',
    text: 'Same supplier used repeatedly without competition',
  },
  {
    id: 'trans-7',
    category: 'transactions',
    text: 'Bank detail change requests via email',
  },
  {
    id: 'trans-8',
    category: 'transactions',
    text: 'Missing or photocopied receipts',
  },
  {
    id: 'trans-9',
    category: 'transactions',
    text: 'Sequential invoice numbers across different vendors',
  },
  {
    id: 'trans-10',
    category: 'transactions',
    text: 'Supplier with no online presence or Companies House record',
  },
];

export default function RedFlagsScreen() {
  const router = useRouter();
  const { isWatched, toggleWatchItem, completedChannels } = useApp();
  const [activeTab, setActiveTab] = useState<'people' | 'transactions'>('people');

  const filteredFlags = redFlags.filter((flag) => flag.category === activeTab);

  const handleToggleWatch = (flag: RedFlag) => {
    toggleWatchItem(flag);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <ProgressHeader
          completedScreens={completedChannels.map((c) => c.channelId)}
          currentScreen="red-flags"
        />
      </View>
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'people' && styles.tabActive]}
          onPress={() => setActiveTab('people')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="People and Behaviour tab"
        >
          <User color={activeTab === 'people' ? colors.primary : colors.textMuted} size={20} />
          <Text style={[styles.tabText, activeTab === 'people' && styles.tabTextActive]}>
            People & Behaviour
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'transactions' && styles.tabActive]}
          onPress={() => setActiveTab('transactions')}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Transactions tab"
        >
          <Eye color={activeTab === 'transactions' ? colors.primary : colors.textMuted} size={20} />
          <Text style={[styles.tabText, activeTab === 'transactions' && styles.tabTextActive]}>
            Transactions
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        <InfoBanner
          message="Red flags are indicators, not proof. Report concerns — do not investigate."
          variant="warning"
        />

        <View style={styles.flagsContainer}>
          {filteredFlags.map((flag) => {
            const watched = isWatched(flag.id);

            return (
              <TouchableOpacity
                key={flag.id}
                style={[styles.flagCard, watched && styles.flagCardWatched]}
                onPress={() => handleToggleWatch(flag)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${watched ? 'Unwatch' : 'Watch'} red flag: ${flag.text}`}
              >
                <Text style={[styles.flagText, watched && styles.flagTextWatched]}>
                  {flag.text}
                </Text>
                <View style={[styles.watchIndicator, watched && styles.watchIndicatorActive]}>
                  <Text style={styles.watchText}>{watched ? '\u2605' : '\u2606'}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <ActionButton
          label="View Approval Checklists"
          onPress={() => router.push('/checklists')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  flagsContainer: {
    gap: 12,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  flagCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  flagCardWatched: {
    borderColor: colors.warning,
    backgroundColor: colors.warningLighter,
  },
  flagText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  flagTextWatched: {
    fontWeight: '600',
    color: colors.text,
  },
  watchIndicator: {
    marginLeft: 12,
  },
  watchIndicatorActive: {
    transform: [{ scale: 1.2 }],
  },
  watchText: {
    fontSize: 24,
    color: colors.warning,
  },
});
