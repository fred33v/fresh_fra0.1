import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import colors from '@/constants/colors';

interface ExpandableReportSectionProps {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  accessibilityLabel: string;
  children: React.ReactNode;
}

export default function ExpandableReportSection({
  title,
  icon,
  expanded,
  onToggle,
  accessibilityLabel,
  children,
}: ExpandableReportSectionProps) {
  return (
    <>
      <TouchableOpacity
        style={styles.expandableSection}
        onPress={onToggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded }}
      >
        <View style={styles.expandableHeader}>
          {icon}
          <Text style={styles.expandableTitle}>{title}</Text>
          {expanded ? <ChevronUp size={20} color={colors.govGrey2} /> : <ChevronDown size={20} color={colors.govGrey2} />}
        </View>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.expandedContent}>
          {children}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  expandableSection: {
    backgroundColor: colors.govGrey4,
    borderRadius: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  expandableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  expandableTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700' as const,
    color: colors.govGrey1,
  },
  expandedContent: {
    padding: 16,
    paddingTop: 0,
    backgroundColor: colors.white,
  },
});
