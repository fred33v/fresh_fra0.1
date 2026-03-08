import React from 'react';
import { useAssessment } from '@/contexts/AssessmentContext';
import { AssessmentScreen, QuestionGroup, TextArea, QuestionOption, ScaleQuestion, CurrencyQuestion, YesNoQuestion } from '@/components/ui';
import type { Frequency, ScaleValue, CurrencyValue, YesNoUnsure } from '@/types/assessment';

export default function ProcurementScreen() {
  const { assessment, updateAssessment } = useAssessment();

  const frequencyOptions: QuestionOption<Frequency>[] = [
    { value: 'always', label: 'Always' },
    { value: 'usually', label: 'Usually' },
    { value: 'sometimes', label: 'Sometimes' },
    { value: 'rarely', label: 'Rarely' },
    { value: 'never', label: 'Never' },
  ];

  const scaleOptions: QuestionOption<ScaleValue>[] = [
    { value: 1, label: '1 - Very Weak' },
    { value: 2, label: '2 - Weak' },
    { value: 3, label: '3 - Moderate' },
    { value: 4, label: '4 - Strong' },
    { value: 5, label: '5 - Very Strong' },
  ];

  const yesNoOptions: QuestionOption<YesNoUnsure>[] = [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
    { value: 'not-sure', label: 'Not Sure' },
  ];

  return (
    <AssessmentScreen
      title="Buying, paying, and suppliers"
      nextRoute="/cash-banking"
      previousRoute="/fraud-triangle"
      hidePrevious={false}
      progress={{ current: 3, total: 13 }}
    >
      {/* Enhanced Question 1: Supplier Verification */}
      <QuestionGroup
        question="Do you check suppliers before engaging them?"
        options={frequencyOptions}
        value={assessment.procurement.q1}
        onChange={(value) =>
          updateAssessment({ procurement: { ...assessment.procurement, q1: value } })
        }
      />

      {/* New: Supplier Due Diligence Scale */}
      <ScaleQuestion
        question="How thorough is your supplier due diligence process?"
        minLabel="Basic checks only"
        maxLabel="Comprehensive verification"
        value={assessment.procurement.dueDiligenceLevel || null}
        onChange={(value) =>
          updateAssessment({ procurement: { ...assessment.procurement, dueDiligenceLevel: value } })
        }
      />

      {/* Enhanced Question 2: PO Matching */}
      <QuestionGroup
        question="Are purchase orders and invoices matched before payment?"
        options={frequencyOptions}
        value={assessment.procurement.q2}
        onChange={(value) =>
          updateAssessment({ procurement: { ...assessment.procurement, q2: value } })
        }
      />

      {/* New: Transaction Volume Context */}
      <CurrencyQuestion
        question="What is your average monthly procurement spend?"
        hint="Approximate total value of purchases per month"
        value={assessment.procurement.monthlySpend || null}
        onChange={(value) =>
          updateAssessment({ procurement: { ...assessment.procurement, monthlySpend: value } })
        }
      />

      {/* Enhanced Question 3: Contract Review */}
      <QuestionGroup
        question="Do you review supplier contracts regularly?"
        options={frequencyOptions}
        value={assessment.procurement.q3 || null}
        onChange={(value) =>
          updateAssessment({ procurement: { ...assessment.procurement, q3: value } })
        }
      />

      {/* New: Recent Fraud Experience */}
      <YesNoQuestion
        question="Have you experienced any procurement fraud in the last 2 years?"
        followUp="Please briefly describe the incident(s)"
        value={assessment.procurement.recentFraud || null}
        followUpValue={assessment.procurement.fraudDescription || ''}
        onChange={(value, followUpValue) =>
          updateAssessment({
            procurement: {
              ...assessment.procurement,
              recentFraud: value,
              fraudDescription: followUpValue || ''
            }
          })
        }
      />

      {/* New: Control Maturity Assessment */}
      <ScaleQuestion
        question="How mature are your procurement controls overall?"
        minLabel="Basic/manual processes"
        maxLabel="Automated with strong oversight"
        value={assessment.procurement.controlMaturity || null}
        onChange={(value) =>
          updateAssessment({ procurement: { ...assessment.procurement, controlMaturity: value } })
        }
      />

      <TextArea
        label="Anything we should know about this area?"
        hint="Issues, incidents, or worries"
        value={assessment.procurement.notes}
        onChangeText={(text) =>
          updateAssessment({ procurement: { ...assessment.procurement, notes: text } })
        }
        placeholder="Optional – add any relevant details"
        numberOfLines={4}
      />
    </AssessmentScreen>
  );
}
