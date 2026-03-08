import { useRouter } from 'expo-router';
import { AlertOctagon, Edit3 } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { useApp } from '@/contexts/AppContext';
import ScreenContainer from '@/components/ScreenContainer';
import ActionButton from '@/components/ActionButton';
import InfoBanner from '@/components/InfoBanner';
import EditContactModal from '@/components/EditContactModal';
import { colors, spacing, borderRadius } from '@/constants/theme';
import { steps, contacts } from '@/constants/data/reporting';

type ContactKey = 'fraudRiskOwner' | 'whistleblowingHotline' | 'internalAudit' | 'hrDepartment' | 'stopFraPlatform';

export default function ReportingScreen() {
  const router = useRouter();
  const { contactDetails, updateContactDetail } = useApp();
  const [editingContactKey, setEditingContactKey] = useState<ContactKey | null>(null);
  const [editingContactLabel, setEditingContactLabel] = useState('');

  const handleEditContact = (key: ContactKey, label: string) => {
    setEditingContactKey(key);
    setEditingContactLabel(label);
  };

  return (
    <ScreenContainer screenId="reporting">
      <View style={styles.header}>
        <AlertOctagon color={colors.danger} size={48} />
        <Text style={styles.title}>Stop. Protect. Report.</Text>
        <Text style={styles.subtitle}>What to do if you suspect fraud</Text>
      </View>

      <InfoBanner
        message="Raising concerns is a responsibility — not an accusation."
        variant="success"
      />

      <View style={styles.stepsContainer}>
        {steps.map((step) => (
          <View key={step.id} style={styles.stepCard}>
            <View style={[styles.stepNumber, { backgroundColor: step.color }]}>
              <Text style={styles.stepNumberText}>{step.id}</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.stepDescription}>{step.description}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>Internal Reporting Channels</Text>

      <View style={styles.contactsContainer}>
        {contacts.map((contact, index) => {
          const Icon = contact.icon;
          const contactValue = contactDetails[contact.contactKey];
          const isEmpty = !contactValue;

          return (
            <View key={contact.contactKey} style={styles.contactCard}>
              <View style={styles.contactHeader}>
                <View style={styles.contactIconCircle}>
                  <Icon color={colors.primary} size={24} />
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactRole}>{contact.role}</Text>
                  <TouchableOpacity
                    onPress={() => handleEditContact(contact.contactKey, contact.role)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit contact details for ${contact.role}`}
                  >
                    <View style={styles.contactDetailsRow}>
                      <Text
                        style={[
                          styles.contactDetails,
                          isEmpty && styles.contactDetailsPlaceholder,
                        ]}
                      >
                        {contactValue || 'Tap to insert contact details'}
                      </Text>
                      <Edit3 color={isEmpty ? colors.textFaint : colors.primary} size={16} />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
              <Text style={styles.contactBestFor}>Best for: {contact.bestFor}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.externalCard}>
        <Text style={styles.externalTitle}>External Reporting (if internal channels fail)</Text>
        <View style={styles.externalItem}>
          <View style={styles.externalBullet} />
          <View style={styles.externalContent}>
            <Text style={styles.externalName}>Action Fraud</Text>
            <Text style={styles.externalContact}>0300 123 2040 | www.actionfraud.police.uk</Text>
          </View>
        </View>
        <View style={styles.externalItem}>
          <View style={styles.externalBullet} />
          <View style={styles.externalContent}>
            <Text style={styles.externalName}>Serious Fraud Office</Text>
            <Text style={styles.externalContact}>www.sfo.gov.uk</Text>
          </View>
        </View>
      </View>

      <ActionButton
        label="Whistleblower Protection"
        onPress={() => router.push('/whistleblower')}
      />

      <EditContactModal
        visible={editingContactKey !== null}
        label={editingContactLabel}
        currentValue={editingContactKey ? contactDetails[editingContactKey] : ''}
        placeholder="Enter contact details (name, email, phone)"
        onSave={(value) => {
          if (editingContactKey) updateContactDetail(editingContactKey, value);
          setEditingContactKey(null);
        }}
        onCancel={() => setEditingContactKey(null)}
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
    fontSize: 16,
    color: colors.textMuted,
    textAlign: 'center',
  },
  stepsContainer: {
    gap: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  stepNumberText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.surface,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  stepDescription: {
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  contactsContainer: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  contactCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  contactHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  contactIconCircle: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactRole: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  contactDetailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  contactDetails: {
    fontSize: 14,
    color: colors.primary,
    flex: 1,
  },
  contactDetailsPlaceholder: {
    color: colors.textFaint,
    fontStyle: 'italic',
  },
  contactBestFor: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
  externalCard: {
    backgroundColor: colors.warningLight,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
  },
  externalTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.warningDarker,
    marginBottom: 12,
  },
  externalItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  externalBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.warningDarker,
    marginTop: 7,
    marginRight: 12,
  },
  externalContent: {
    flex: 1,
  },
  externalName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.warningDarkest,
    marginBottom: 2,
  },
  externalContact: {
    fontSize: 13,
    color: colors.warningDarker,
  },
});
