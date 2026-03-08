import React from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { QuestionGroup } from './QuestionGroup';
import type { YesNoUnsure } from '@/types/assessment';
import type { QuestionOption } from './QuestionGroup';

export interface YesNoQuestionProps {
  question: string;
  followUp?: string;
  value: YesNoUnsure | null;
  followUpValue?: string;
  onChange: (value: YesNoUnsure, followUpValue?: string) => void;
}

export function YesNoQuestion({ question, followUp, value, followUpValue, onChange }: YesNoQuestionProps) {
  const yesNoOptions: QuestionOption<YesNoUnsure>[] = [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
    { value: 'not-sure', label: 'Not Sure' },
  ];

  const handleValueChange = (newValue: YesNoUnsure) => {
    onChange(newValue, followUpValue);
  };

  const handleFollowUpChange = (text: string) => {
    onChange(value!, text);
  };

  return (
    <View style={styles.container}>
      <QuestionGroup
        question={question}
        options={yesNoOptions}
        value={value}
        onChange={handleValueChange}
      />

      {value === 'yes' && followUp && (
        <View style={styles.followUpContainer}>
          <Text style={styles.followUpQuestion}>{followUp}</Text>
          <TextInput
            style={styles.followUpInput}
            value={followUpValue || ''}
            onChangeText={handleFollowUpChange}
            placeholder="Please provide details..."
            multiline
            numberOfLines={3}
            placeholderTextColor="#999"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  followUpContainer: {
    marginTop: 16,
    paddingLeft: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#e1e5e9',
  },
  followUpQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 8,
    lineHeight: 20,
  },
  followUpInput: {
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#1a1a1a',
    backgroundColor: '#fff',
    textAlignVertical: 'top',
    minHeight: 80,
  },
});