import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Modal,
} from 'react-native';
import { colors, spacing, borderRadius } from '@/constants/theme';

interface EditContactModalProps {
  visible: boolean;
  label: string;
  currentValue: string;
  placeholder?: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}

export default function EditContactModal({
  visible,
  label,
  currentValue,
  placeholder = 'Enter contact details (name, email, phone)',
  onSave,
  onCancel,
}: EditContactModalProps) {
  const [inputValue, setInputValue] = useState(currentValue);

  useEffect(() => {
    if (visible) {
      setInputValue(currentValue);
    }
  }, [visible, currentValue]);

  const handleSave = () => {
    if (inputValue.trim()) {
      onSave(inputValue.trim());
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Edit Contact Details</Text>
          <Text style={styles.modalSubtitle}>{label}</Text>
          <TextInput
            style={styles.modalInput}
            value={inputValue}
            onChangeText={setInputValue}
            placeholder={placeholder}
            placeholderTextColor={colors.textFaint}
            multiline
            autoFocus
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonCancel]}
              onPress={onCancel}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Cancel editing contact"
            >
              <Text style={styles.modalButtonTextCancel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.modalButtonSave]}
              onPress={handleSave}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Save contact details"
            >
              <Text style={styles.modalButtonTextSave}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: borderRadius.sm,
    padding: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: colors.backgroundAlt,
  },
  modalButtonSave: {
    backgroundColor: colors.primary,
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#475569',
  },
  modalButtonTextSave: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.surface,
  },
});
