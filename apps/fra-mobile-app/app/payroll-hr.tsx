import React from 'react';
import { useAssessment } from '@/contexts/AssessmentContext';
import { AssessmentScreen, QuestionGroup, TextArea, QuestionOption, ScaleQuestion, CurrencyQuestion, YesNoQuestion } from '@/components/ui';
import type { Frequency, ScaleValue } from '@/types/assessment';

export default function PayrollHRScreen() {
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
      title="Payroll and HR"
      nextRoute="/revenue"
      previousRoute="/cash-banking"
      hidePrevious={false}
      progress={{ current: 5, total: 13 }}
    >
      <CurrencyQuestion
        question="What is your total number of employees on payroll?"
        hint="Include full-time, part-time, and contractors"
        value={assessment.payrollHR.totalEmployeeCount}
        onChange={(value) =>
          updateAssessment({ payrollHR: { ...assessment.payrollHR, totalEmployeeCount: value } })
        }
      />

      <QuestionGroup
        question="What is your payroll frequency?"
        options={frequencyOptions}
        value={assessment.payrollHR.payrollFrequency}
        onChange={(value) =>
          updateAssessment({ payrollHR: { ...assessment.payrollHR, payrollFrequency: value } })
        }
      />

      <YesNoQuestion
        question="Have you detected any unauthorized payroll changes (salary, bank details, etc.)?"
        value={assessment.payrollHR.unauthorizedChangesDetected}
        onChange={(value) =>
          updateAssessment({ payrollHR: { ...assessment.payrollHR, unauthorizedChangesDetected: value } })
        }
        followUpQuestion="Please describe the incidents detected and remediation actions taken"
        followUpValue={assessment.payrollHR.changeDescription}
        onFollowUpChange={(text) =>
          updateAssessment({ payrollHR: { ...assessment.payrollHR, changeDescription: text } })
        }
      />

      <ScaleQuestion
        question="How mature are your payroll controls and HR processes?"
        minLabel="Basic"
        maxLabel="Advanced"
        value={assessment.payrollHR.controlMaturity}
        onChange={(value) =>
          updateAssessment({ payrollHR: { ...assessment.payrollHR, controlMaturity: value } })
        }
      />

      <QuestionGroup
        question="Are payroll changes reviewed and approved?"
        options={frequencyOptions}
        value={assessment.payrollHR.q1}
        onChange={(value) =>
          updateAssessment({ payrollHR: { ...assessment.payrollHR, q1: value } })
        }
      />

      <QuestionGroup
        question="Are leavers removed from payroll promptly?"
        options={frequencyOptions}
        value={assessment.payrollHR.q2}
        onChange={(value) =>
          updateAssessment({ payrollHR: { ...assessment.payrollHR, q2: value } })
        }
      />

      <TextArea
        label="Anything we should know about this area?"
        hint="Issues, incidents, or worries"
        value={assessment.payrollHR.notes}
        onChangeText={(text) =>
          updateAssessment({ payrollHR: { ...assessment.payrollHR, notes: text } })
        }
        placeholder="Optional – add any relevant details"
        numberOfLines={4}
      />
    </AssessmentScreen>
  );
}
