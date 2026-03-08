import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, TextInput, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { User, Building2, Mail, Shield, LogOut, ChevronRight, Key, Pencil } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/services/api.service';
import { API_CONFIG } from '@/constants/api';
import colors from '@/constants/colors';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, organisation, signOut } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/auth/login');
          },
        },
      ]
    );
  };

  const handleEditStart = () => {
    if (!user) return;
    setEditName(user.name);
    setEditDepartment(user.department ?? '');
    setIsEditing(true);
  };

  const handleEditSave = async () => {
    if (!user) return;
    const updates: Record<string, string> = {};
    if (editName.trim() && editName.trim() !== user.name) updates.name = editName.trim();
    if (editDepartment !== (user.department ?? '')) updates.department = editDepartment;

    if (Object.keys(updates).length === 0) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      const result = await apiService.patch(API_CONFIG.ENDPOINTS.AUTH.UPDATE_PROFILE, updates);
      if (result.success && result.data) {
        // Update local user state
        if (updates.name) user.name = updates.name;
        if (updates.department !== undefined) user.department = updates.department || undefined;
      } else {
        Alert.alert('Error', result.error?.message || 'Failed to update profile');
      }
    } catch {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
    setIsSaving(false);
    setIsEditing(false);
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Not signed in</Text>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => router.replace('/auth/login')}
            accessibilityRole="button"
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const roleBadge = user.role === 'employer' ? 'Employer' : user.role === 'admin' ? 'Admin' : 'Employee';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <User size={32} color={colors.white} />
        </View>
        <Text style={styles.userName}>{user.name}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{roleBadge}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Mail size={18} color={colors.govGrey2} />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Email</Text>
              <Text style={styles.rowValue}>{user.email}</Text>
            </View>
          </View>
          <View style={styles.separator} />
          <View style={styles.row}>
            <Shield size={18} color={colors.govGrey2} />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Role</Text>
              <Text style={styles.rowValue}>{roleBadge}</Text>
            </View>
          </View>
          <View style={styles.separator} />
          <View style={styles.row}>
            <User size={18} color={colors.govGrey2} />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Member since</Text>
              <Text style={styles.rowValue}>
                {new Date(user.createdAt).toLocaleDateString('en-GB', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {organisation && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Organisation</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Building2 size={18} color={colors.govGrey2} />
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>Name</Text>
                <Text style={styles.rowValue}>{organisation.name}</Text>
              </View>
            </View>
            {organisation.packageType && (
              <>
                <View style={styles.separator} />
                <View style={styles.row}>
                  <Key size={18} color={colors.govGrey2} />
                  <View style={styles.rowContent}>
                    <Text style={styles.rowLabel}>Package</Text>
                    <Text style={styles.rowValue}>{organisation.packageType}</Text>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      )}

      {isEditing ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Edit Profile</Text>
          <View style={styles.card}>
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Name</Text>
              <TextInput
                style={styles.editInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Your name"
                placeholderTextColor={colors.govGrey3}
                autoCapitalize="words"
                accessibilityLabel="Name"
              />
            </View>
            <View style={styles.separator} />
            <View style={styles.editField}>
              <Text style={styles.editLabel}>Department</Text>
              <TextInput
                style={styles.editInput}
                value={editDepartment}
                onChangeText={setEditDepartment}
                placeholder="e.g. Finance, HR, IT"
                placeholderTextColor={colors.govGrey3}
                autoCapitalize="words"
                accessibilityLabel="Department"
              />
            </View>
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setIsEditing(false)}
                disabled={isSaving}
                accessibilityRole="button"
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                onPress={handleEditSave}
                disabled={isSaving || !editName.trim()}
                accessibilityRole="button"
              >
                {isSaving ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={handleEditStart}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
          >
            <View style={styles.actionRow}>
              <Pencil size={18} color={colors.govBlue} />
              <Text style={styles.actionText}>Edit Profile</Text>
              <ChevronRight size={18} color={colors.govGrey3} />
            </View>
          </TouchableOpacity>
          {user.role === 'employer' && (
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => router.push('/dashboard')}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Go to employer dashboard"
            >
              <View style={styles.actionRow}>
                <Building2 size={18} color={colors.govBlue} />
                <Text style={styles.actionText}>Employer Dashboard</Text>
                <ChevronRight size={18} color={colors.govGrey3} />
              </View>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/feedback')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Send feedback"
          >
            <View style={styles.actionRow}>
              <Mail size={18} color={colors.govBlue} />
              <Text style={styles.actionText}>Send Feedback</Text>
              <ChevronRight size={18} color={colors.govGrey3} />
            </View>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={styles.signOutButton}
        onPress={handleSignOut}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <LogOut size={18} color="#d4351c" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.govBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: colors.govGrey1,
    marginBottom: 6,
  },
  roleBadge: {
    backgroundColor: '#e8f0fe',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  roleBadgeText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: colors.govBlue,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.govGrey2,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  rowContent: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 13,
    color: colors.govGrey2,
    marginBottom: 2,
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: colors.govGrey1,
  },
  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 8,
  },
  actionCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500' as const,
    color: colors.govGrey1,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
    marginTop: 8,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#d4351c',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.govGrey2,
    marginBottom: 16,
  },
  signInButton: {
    backgroundColor: colors.govBlue,
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.white,
  },
  editField: {
    paddingVertical: 4,
  },
  editLabel: {
    fontSize: 13,
    color: colors.govGrey2,
    marginBottom: 6,
  },
  editInput: {
    borderWidth: 2,
    borderColor: colors.govGrey1,
    borderRadius: 4,
    padding: 12,
    fontSize: 16,
    color: colors.govGrey1,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelButton: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.govGrey3,
    borderRadius: 4,
    padding: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.govGrey2,
  },
  saveButton: {
    flex: 1,
    backgroundColor: colors.govBlue,
    borderRadius: 4,
    padding: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: colors.white,
  },
});
