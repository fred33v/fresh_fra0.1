import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import type { CurrencyValue } from '@/types/assessment';

/** What the number is: money in pounds (default), a whole-number count, or a percentage (0–100). */
export type NumberKind = 'currency' | 'count' | 'percent';

export interface CurrencyQuestionProps {
  question: string;
  hint?: string;
  value: CurrencyValue | null;
  onChange: (value: CurrencyValue | null) => void;
  kind?: NumberKind;
}

const KIND: Record<NumberKind, { prefix?: string; suffix?: string; placeholder: string; keyboard: 'decimal-pad' | 'number-pad'; decimals: boolean; max?: number }> = {
  currency: { prefix: '£', placeholder: '0.00', keyboard: 'decimal-pad', decimals: true },
  count: { placeholder: '0', keyboard: 'number-pad', decimals: false },
  percent: { suffix: '%', placeholder: '0', keyboard: 'decimal-pad', decimals: true, max: 100 },
};

export function CurrencyQuestion({ question, hint, value, onChange, kind = 'currency' }: CurrencyQuestionProps) {
  const k = KIND[kind];
  const [inputValue, setInputValue] = useState(value?.toString() || '');

  const handleChangeText = (text: string) => {
    // Keep digits (and one decimal point where the kind allows decimals)
    const cleanText = text.replace(k.decimals ? /[^0-9.]/g : /[^0-9]/g, '');
    const parts = cleanText.split('.');
    let sanitizedText = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleanText;
    // A percentage cannot exceed 100
    if (k.max !== undefined && parseFloat(sanitizedText) > k.max) sanitizedText = String(k.max);

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
        {k.prefix && <Text style={styles.currencySymbol}>{k.prefix}</Text>}
        <TextInput
          style={styles.input}
          value={inputValue}
          onChangeText={handleChangeText}
          placeholder={k.placeholder}
          keyboardType={k.keyboard}
          placeholderTextColor="#767676"
          accessibilityLabel={question}
        />
        {k.suffix && <Text style={styles.unitSuffix}>{k.suffix}</Text>}
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
  unitSuffix: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginLeft: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1a1a1a',
    padding: 0,
  },
});