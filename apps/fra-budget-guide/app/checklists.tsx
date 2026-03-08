import { useRouter } from 'expo-router';
import { CheckSquare, CreditCard, FileSignature, Users, DollarSign } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '@/contexts/AppContext';
import ActionButton from '@/components/ActionButton';
import InfoBanner from '@/components/InfoBanner';
import ProgressHeader from '@/components/ProgressHeader';
import { colors, spacing, borderRadius } from '@/constants/theme';

interface ChecklistItem {
  id: string;
  text: string;
}

interface Checklist {
  id: string;
  title: string;
  icon: React.ComponentType<{ color: string; size: number }>;
  items: ChecklistItem[];
}

const checklists: Checklist[] = [
  {
    id: 'payments',
    title: 'Before Approving Payments',
    icon: CreditCard,
    items: [
      { id: 'p1', text: 'Verify goods/services actually received (three-way match)' },
      { id: 'p2', text: 'Confirm supplier is legitimate (if new/unusual)' },
      { id: 'p3', text: 'Check invoice amount matches agreement/quote' },
      { id: 'p4', text: 'Ensure proper authorization obtained' },
      { id: 'p5', text: 'Verify bank details if payment to new account' },
      { id: 'p6', text: 'Question anything unusual or urgent' },
    ],
  },
  {
    id: 'timesheets',
    title: 'Before Approving Timesheets',
    icon: Users,
    items: [
      { id: 't1', text: 'Verify hours are reasonable and consistent with work' },
      { id: 't2', text: 'Check employee was scheduled to work claimed days' },
      { id: 't3', text: 'Confirm overtime was pre-authorized' },
      { id: 't4', text: 'Cross-check against project deliverables' },
      { id: 't5', text: 'Question unusual patterns or maximum hours every week' },
    ],
  },
  {
    id: 'expenses',
    title: 'Before Approving Expenses',
    icon: FileSignature,
    items: [
      { id: 'e1', text: 'Check receipts are original, itemized, and dated' },
      { id: 'e2', text: 'Verify business purpose is legitimate and clear' },
      { id: 'e3', text: 'Cross-check dates (employee was traveling/working)' },
      { id: 'e4', text: 'Confirm expenses comply with policy limits' },
      { id: 'e5', text: 'Question weekend/holiday expenses' },
      { id: 'e6', text: 'Verify mileage claims against calendar' },
    ],
  },
  {
    id: 'suppliers',
    title: 'Before Approving New Suppliers',
    icon: CheckSquare,
    items: [
      { id: 's1', text: 'Check Companies House registration (UK)' },
      { id: 's2', text: 'Verify business address is legitimate (not P.O. box only)' },
      { id: 's3', text: 'Call supplier using independently verified phone number' },
      { id: 's4', text: 'Check online presence (website, reviews)' },
      { id: 's5', text: 'Request business references' },
      { id: 's6', text: 'Verify VAT registration if VAT charged' },
    ],
  },
  {
    id: 'bank-changes',
    title: 'Before Changing Bank Details',
    icon: DollarSign,
    items: [
      { id: 'b1', text: 'NEVER update bank details via email alone' },
      { id: 'b2', text: 'Call supplier using contact details from original contract' },
      { id: 'b3', text: 'Obtain verbal confirmation from two authorized signatories' },
      { id: 'b4', text: 'Make test payment (£1) before full amount' },
      { id: 'b5', text: 'Flag change for senior management approval' },
      { id: 'b6', text: 'Document all verification steps taken' },
    ],
  },
];

export default function ChecklistsScreen() {
  const router = useRouter();
  const { completedChannels } = useApp();
  const [selectedChecklist, setSelectedChecklist] = useState<string | null>('payments');

  const activeChecklist = checklists.find((c) => c.id === selectedChecklist);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <ProgressHeader
          completedScreens={completedChannels.map((c) => c.channelId)}
          currentScreen="checklists"
        />
      </View>
      <View style={styles.selectorContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.selectorContent}>
          {checklists.map((checklist) => {
            const Icon = checklist.icon;
            const isActive = selectedChecklist === checklist.id;

            return (
              <TouchableOpacity
                key={checklist.id}
                style={[styles.selectorButton, isActive && styles.selectorButtonActive]}
                onPress={() => setSelectedChecklist(checklist.id)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`Select checklist: ${checklist.title}`}
              >
                <Icon color={isActive ? colors.surface : colors.primary} size={20} />
                <Text style={[styles.selectorText, isActive && styles.selectorTextActive]}>
                  {checklist.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.contentContainer}>
        {activeChecklist && (
          <>
            <InfoBanner
              message="Never change bank details based on email alone."
              variant="danger"
            />

            <View style={styles.checklistCard}>
              <View style={styles.checklistHeader}>
                <View style={styles.iconCircle}>
                  {React.createElement(activeChecklist.icon, { color: colors.primary, size: 28 })}
                </View>
                <Text style={styles.checklistTitle}>{activeChecklist.title}</Text>
              </View>

              <View style={styles.itemsContainer}>
                {activeChecklist.items.map((item, index) => (
                  <View key={item.id} style={styles.checklistItem}>
                    <View style={styles.checkboxCircle}>
                      <Text style={styles.checkboxNumber}>{index + 1}</Text>
                    </View>
                    <Text style={styles.itemText}>{item.text}</Text>
                  </View>
                ))}
              </View>
            </View>

            <InfoBanner
              message="Use these checklists daily at the point of approval to ensure consistent fraud prevention."
              variant="info"
            />
          </>
        )}

        <View style={styles.buttonContainer}>
          <ActionButton
            label="View Authority Limits"
            onPress={() => router.push('/authority')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  selectorContainer: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  selectorContent: {
    padding: spacing.md,
    gap: 12,
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.sm,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  selectorButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  selectorText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  selectorTextActive: {
    color: colors.surface,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  checklistCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    marginTop: spacing.md,
    marginBottom: 20,
  },
  checklistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checklistTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  itemsContainer: {
    gap: spacing.md,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkboxCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxNumber: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.surface,
  },
  itemText: {
    flex: 1,
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 21,
  },
  buttonContainer: {
    marginTop: spacing.md,
  },
});
