import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { RadioOption } from './RadioOption';
import type { ScaleValue } from '@/types/assessment';

export interface ScaleQuestionProps {
  question: string;
  minLabel: string;
  maxLabel: string;
  value: ScaleValue | null;
  onChange: (value: ScaleValue) => void;
}

export function ScaleQuestion({ question, minLabel, maxLabel, value, onChange }: ScaleQuestionProps) {
  const scaleOptions: { value: ScaleValue; label: string }[] = [
    { value: 1, label: '1' },
    { value: 2, label: '2' },
    { value: 3, label: '3' },
    { value: 4, label: '4' },
    { value: 5, label: '5' },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.question}>{question}</Text>

      {/* Circles span the width; the end labels sit underneath so long labels wrap at word breaks */}
      <View style={styles.scaleContainer}>
        <View style={styles.scaleOptions}>
          {scaleOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.scaleButton,
                value === option.value && styles.scaleButtonSelected,
              ]}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: value === option.value }}
              accessibilityLabel={`${option.label} of 5${option.value === 1 ? `, ${minLabel}` : option.value === 5 ? `, ${maxLabel}` : ''}`}
            >
              <Text
                style={[
                  styles.scaleButtonText,
                  value === option.value && styles.scaleButtonTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.scaleLabels}>
          <Text style={[styles.scaleLabel, styles.scaleLabelStart]}>{minLabel}</Text>
          <Text style={[styles.scaleLabel, styles.scaleLabelEnd]}>{maxLabel}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  question: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
    lineHeight: 22,
  },
  scaleContainer: {
    paddingHorizontal: 4,
  },
  scaleOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 16,
  },
  scaleLabel: {
    fontSize: 13,
    color: '#595959',
    fontWeight: '500',
    maxWidth: '45%',
    lineHeight: 18,
  },
  scaleLabelStart: {
    textAlign: 'left',
  },
  scaleLabelEnd: {
    textAlign: 'right',
  },
  scaleButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#e1e5e9',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleButtonSelected: {
    borderColor: '#1e40af',
    backgroundColor: '#1e40af',
  },
  scaleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  scaleButtonTextSelected: {
    color: '#fff',
  },
});