import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import type { CurrencyValue } from '@/types/assessment';

export interface CurrencyQuestionProps {
  question: string;
  hint?: string;
  value: CurrencyValue | null;
  onChange: (value: CurrencyValue | null) => void;
}

export function CurrencyQuestion({ question, hint, value, onChange }: CurrencyQuestionProps) {
  const [inputValue, setInputValue] = useState(value?.toString() || '');

  const handleChangeText = (text: string) => {
    // Remove any non-numeric characters except decimal point
    const cleanText = text.replace(/[^0-9.]/g, '');

    // Ensure only one decimal point
    const parts = cleanText.split('.');
    const sanitizedText = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleanText;

    setInputValue(sanitizedText);

    // Convert to number for onChange
    const numericValue = sanitizedText === '' ? null : parseFloat(sanitizedText);
    if (numericValue !== null && !isNaN(numericValue)) {
      onChange(numericValue);
    } else if (sanitizedText === '') {
      onChange(null);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.question}>{question}</Text>

      {hint && <Text style={styles.hint}>{hint}</Text>}

      <View style={styles.inputContainer}>
        <Text style={styles.currencySymbol}>£</Text>
        <TextInput
          style={styles.input}
          value={inputValue}
          onChangeText={handleChangeText}
          placeholder="0.00"
          keyboardType="decimal-pad"
          placeholderTextColor="#999"
        />
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
    marginBottom: 8,
    lineHeight: 22,
  },
  hint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
    padding: 0,
  },
});