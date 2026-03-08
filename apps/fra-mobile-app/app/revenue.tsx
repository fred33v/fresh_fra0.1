import React from 'react';
import { useAssessment } from '@/contexts/AssessmentContext';
import { AssessmentScreen, QuestionGroup, TextArea, QuestionOption, ScaleQuestion, CurrencyQuestion, YesNoQuestion } from '@/components/ui';
import type { Frequency, ScaleValue } from '@/types/assessment';

export default function RevenueScreen() {
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
      title="Revenue and income"
      nextRoute="/it-systems"
      previousRoute="/payroll-hr"
      hidePrevious={false}
      progress={{ current: 6, total: 13 }}
    >
      <CurrencyQuestion
        question="What is your average monthly revenue?"
        hint="Total monthly invoiced amounts"
        value={assessment.revenue.monthlyRevenueVolume}
        onChange={(value) =>
          updateAssessment({ revenue: { ...assessment.revenue, monthlyRevenueVolume: value } })
        }
      />

      <CurrencyQuestion
        question="What percentage of invoices are typically unpaid after 60 days?"
        hint="As a percentage (0-100)"
        value={assessment.revenue.unpaidInvoicesPercentage}
        onChange={(value) =>
          updateAssessment({ revenue: { ...assessment.revenue, unpaidInvoicesPercentage: value } })
        }
      />

      <YesNoQuestion
        question="Have you written off any significant bad debts in the last 2 years?"
        value={assessment.revenue.writeOffsOccurred}
        onChange={(value) =>
          updateAssessment({ revenue: { ...assessment.revenue, writeOffsOccurred: value } })
        }
        followUpQuestion="Please describe the write-offs and the circumstances indicating fraud risk"
        followUpValue={assessment.revenue.writeOffDescription}
        onFollowUpChange={(text) =>
          updateAssessment({ revenue: { ...assessment.revenue, writeOffDescription: text } })
        }
      />

      <ScaleQuestion
        question="How effective is your debt collection and revenue recognition process?"
        minLabel="Weak"
        maxLabel="Strong"
        value={assessment.revenue.collectionEffectiveness}
        onChange={(value) =>
          updateAssessment({ revenue: { ...assessment.revenue, collectionEffectiveness: value } })
        }
      />

      <QuestionGroup
        question="Are invoices raised promptly and accurately?"
        options={frequencyOptions}
        value={assessment.revenue.q1}
        onChange={(value) =>
          updateAssessment({ revenue: { ...assessment.revenue, q1: value } })
        }
      />

      <QuestionGroup
        question="Are debts and receivables monitored?"
        options={frequencyOptions}
        value={assessment.revenue.q2}
        onChange={(value) =>
          updateAssessment({ revenue: { ...assessment.revenue, q2: value } })
        }
      />

      <TextArea
        label="Anything we should know about this area?"
        hint="Issues, incidents, or worries"
        value={assessment.revenue.notes}
        onChangeText={(text) =>
          updateAssessment({ revenue: { ...assessment.revenue, notes: text } })
        }
        placeholder="Optional – add any relevant details"
        numberOfLines={4}
      />
    </AssessmentScreen>
  );
}
