import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { colors, spacing, borderRadius } from '@/constants/theme';

interface ScenarioOptionProps {
  text: string;
  feedback: string;
  isCorrect: boolean;
  selected: boolean;
  revealed: boolean;
  onPress: () => void;
}

export default function ScenarioOption({
  text,
  feedback,
  isCorrect,
  selected,
  revealed,
  onPress,
}: ScenarioOptionProps) {
  const getBorderColor = () => {
    if (!selected) return colors.border;
    if (!revealed) return colors.primary;
    return isCorrect ? colors.success : colors.danger;
  };

  const getBackgroundColor = () => {
    if (!selected) return colors.surface;
    if (!revealed) return colors.primaryLight;
    return isCorrect ? colors.successLight : colors.dangerLight;
  };

  const getTextColor = () => {
    if (!selected) return colors.text;
    if (!revealed) return colors.primary;
    return isCorrect ? colors.successDarker : colors.danger;
  };

  const showFeedback = selected && revealed;

  return (
    <TouchableOpacity
      style={[
        styles.option,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
        },
      ]}
      onPress={onPress}
      disabled={revealed}
      activeOpacity={0.7}
      accessibilityRole="radio"
      accessibilityLabel={text}
      accessibilityState={{ selected }}
    >
      <View style={styles.header}>
        <Text style={[styles.text, { color: getTextColor() }]}>{text}</Text>
        {selected && revealed && (
          <View style={styles.iconContainer}>
            {isCorrect ? (
              <Check color={colors.success} size={20} />
            ) : (
              <X color={colors.danger} size={20} />
            )}
          </View>
        )}
      </View>
      {showFeedback && (
        <Text style={[styles.feedback, { color: getTextColor() }]}>
          {feedback}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  option: {
    borderWidth: 2,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 21,
  },
  iconContainer: {
    marginLeft: spacing.sm,
  },
  feedback: {
    marginTop: spacing.sm,
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});
