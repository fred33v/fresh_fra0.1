import React from 'react';
import { useAssessment } from '@/contexts/AssessmentContext';
import { AssessmentScreen, QuestionGroup, TextArea, QuestionOption, ScaleQuestion, CurrencyQuestion, YesNoQuestion } from '@/components/ui';
import type { Frequency, ScaleValue } from '@/types/assessment';

export default function CashBankingScreen() {
  const { assessment, updateAssessment } = useAssessment();

  const frequencyOptions: QuestionOption<Frequency>[] = [
    { value: 'always', label: 'Always' },
    { value: 'usually', label: 'Usually' },
    { value: 'sometimes', label: 'Sometimes' },
    { value: 'rarely', label: 'Rarely' },
    { value: 'never', label: 'Never' },
  ];

  return (
    <AssessmentScreen
      title="Cash and banking"
      nextRoute="/payroll-hr"
      previousRoute="/procurement"
      hidePrevious={false}
      progress={{ current: 4, total: 13 }}
    >
      <CurrencyQuestion
        question="What is your estimated average daily cash volume?"
        hint="Total daily cash receipts and disbursements"
        value={assessment.cashBanking.dailyCashVolume}
        onChange={(value) =>
          updateAssessment({ cashBanking: { ...assessment.cashBanking, dailyCashVolume: value } })
        }
      />

      <CurrencyQuestion
        question="How many bank accounts does the organisation maintain?"
        hint="Include all operational, savings, and payroll accounts"
        value={assessment.cashBanking.bankAccountCount}
        onChange={(value) =>
          updateAssessment({ cashBanking: { ...assessment.cashBanking, bankAccountCount: value } })
        }
      />

      <YesNoQuestion
        question="Have you experienced any cash or banking fraud incidents in the past 2 years?"
        value={assessment.cashBanking.fraudIncidents}
        onChange={(value) =>
          updateAssessment({ cashBanking: { ...assessment.cashBanking, fraudIncidents: value } })
        }
        followUpQuestion="Please describe the incident(s) and what controls have been implemented since"
        followUpValue={assessment.cashBanking.fraudDescription}
        onFollowUpChange={(text) =>
          updateAssessment({ cashBanking: { ...assessment.cashBanking, fraudDescription: text } })
        }
      />

      <ScaleQuestion
        question="How would you rate the effectiveness of your cash and banking controls?"
        minLabel="Weak"
        maxLabel="Strong"
        value={assessment.cashBanking.controlEffectiveness}
        onChange={(value) =>
          updateAssessment({ cashBanking: { ...assessment.cashBanking, controlEffectiveness: value } })
        }
      />

      <QuestionGroup
        question="Are cash receipts recorded and banked promptly?"
        options={frequencyOptions}
        value={assessment.cashBanking.q1}
        onChange={(value) =>
          updateAssessment({ cashBanking: { ...assessment.cashBanking, q1: value } })
        }
      />

      <QuestionGroup
        question="Are bank reconciliations done regularly?"
        options={frequencyOptions}
        value={assessment.cashBanking.q2}
        onChange={(value) =>
          updateAssessment({ cashBanking: { ...assessment.cashBanking, q2: value } })
        }
      />

      <TextArea
        label="Anything we should know about this area?"
        hint="Issues, incidents, or worries"
        value={assessment.cashBanking.notes}
        onChangeText={(text) =>
          updateAssessment({ cashBanking: { ...assessment.cashBanking, notes: text } })
        }
        placeholder="Optional – add any relevant details"
        numberOfLines={4}
      />
    </AssessmentScreen>
  );
}
