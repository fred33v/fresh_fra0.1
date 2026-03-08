import { useRouter } from 'expo-router';
import { BookOpen, Home, Edit3 } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useApp } from '@/contexts/AppContext';

import ScreenContainer from '@/components/ScreenContainer';
import ActionButton from '@/components/ActionButton';
import EditContactModal from '@/components/EditContactModal';
import { colors, spacing, borderRadius } from '@/constants/theme';
import { resources } from '@/constants/data/resources';

type ContactKey = 'fraudRiskOwner' | 'whistleblowingHotline' | 'internalAudit' | 'hrDepartment' | 'stopFraPlatform';

export default function ResourcesScreen() {
  const router = useRouter();
  const { contactDetails, updateContactDetail } = useApp();
  const [editingContactKey, setEditingContactKey] = useState<ContactKey | null>(null);
  const [editingContactLabel, setEditingContactLabel] = useState('');

  const handleLink = (url: string) => {
    if (url.startsWith('www.')) {
      Linking.openURL(`https://${url}`);
    }
  };

  const handleEditContact = (key: ContactKey, label: string) => {
    setEditingContactKey(key);
    setEditingContactLabel(label);
  };

  const getContactValue = (contact: string, editable?: boolean) => {
    if (editable && contact in contactDetails) {
      return contactDetails[contact as keyof typeof contactDetails] || 'Tap to insert contact details';
    }
    return contact;
  };

  const isContactEmpty = (contact: string, editable?: boolean) => {
    if (editable && contact in contactDetails) {
      return !contactDetails[contact as keyof typeof contactDetails];
    }
    return false;
  };

  return (
    <ScreenContainer screenId="resources">
      <View style={styles.header}>
        <BookOpen color={colors.primary} size={48} />
        <Text style={styles.title}>Resources & Support</Text>
        <Text style={styles.subtitle}>
          Contacts and tools to help you prevent fraud
        </Text>
      </View>

      <View style={styles.sectionsContainer}>
        {resources.map((resource, index) => {
          const Icon = resource.icon;

          return (
            <View key={resource.title} style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconCircle}>
                  <Icon color={colors.primary} size={24} />
                </View>
                <Text style={styles.sectionTitle}>{resource.title}</Text>
              </View>

              <View style={styles.itemsContainer}>
                {resource.items.map((item, itemIndex) => {
                  const contactValue = getContactValue(item.contact, item.editable);
                  const isEmpty = isContactEmpty(item.contact, item.editable);
                  const isLink = item.contact.startsWith('www.');

                  return (
                    <View key={itemIndex} style={styles.resourceCard}>
                      <Text style={styles.resourceName}>{item.name}</Text>
                      {item.editable ? (
                        <TouchableOpacity
                          onPress={() => handleEditContact(item.contact as keyof typeof contactDetails, item.name)}
                          activeOpacity={0.7}
                          accessibilityRole="button"
                          accessibilityLabel={`Edit contact details for ${item.name}`}
                        >
                          <View style={styles.contactEditRow}>
                            <Text
                              style={[
                                styles.resourceContact,
                                isEmpty && styles.resourceContactPlaceholder,
                              ]}
                            >
                              {contactValue}
                            </Text>
                            <Edit3 color={isEmpty ? colors.textFaint : colors.primary} size={14} />
                          </View>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          onPress={() => {
                            if (isLink) {
                              handleLink(item.contact);
                            }
                          }}
                          disabled={!isLink}
                          accessibilityRole={isLink ? 'link' : 'none'}
                          accessibilityLabel={isLink ? `Open ${item.name} website` : undefined}
                        >
                          <Text
                            style={[
                              styles.resourceContact,
                              isLink && styles.resourceContactLink,
                            ]}
                          >
                            {item.contact}
                          </Text>
                        </TouchableOpacity>
                      )}
                      {item.description && (
                        <Text style={styles.resourceDescription}>{item.description}</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.completionCard}>
        <Home color={colors.success} size={32} />
        <Text style={styles.completionTitle}>You have completed the guidance</Text>
        <Text style={styles.completionText}>
          You can return anytime to review scenarios, checklists, or take the pledge.
        </Text>
      </View>

      <ActionButton
        label="Return to Start"
        onPress={() => router.push('/')}
      />

      <EditContactModal
        visible={editingContactKey !== null}
        label={editingContactLabel}
        currentValue={editingContactKey ? contactDetails[editingContactKey] : ''}
        placeholder="Enter contact details (name, email, phone, URL)"
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
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.md - 4,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
  sectionsContainer: {
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md - 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  itemsContainer: {
    gap: spacing.md,
  },
  resourceCard: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.sm,
    padding: 14,
  },
  resourceName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
  },
  contactEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resourceContact: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    flex: 1,
  },
  resourceContactLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  resourceContactPlaceholder: {
    color: colors.textFaint,
    fontStyle: 'italic',
  },
  resourceDescription: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  completionCard: {
    backgroundColor: colors.successLight,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  completionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.successDarker,
    marginTop: spacing.md - 4,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  completionText: {
    fontSize: 14,
    color: colors.successDark,
    textAlign: 'center',
    lineHeight: 20,
  },
});
