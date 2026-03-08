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

      <View style={styles.scaleContainer}>
        <Text style={styles.scaleLabel}>{minLabel}</Text>

        <View style={styles.scaleOptions}>
          {scaleOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.scaleButton,
                value === option.value && styles.scaleButtonSelected,
              ]}
              onPress={() => onChange(option.value)}
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

        <Text style={styles.scaleLabel}>{maxLabel}</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  scaleLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    flex: 1,
    textAlign: 'center',
  },
  scaleOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 3,
    gap: 8,
  },
  scaleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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