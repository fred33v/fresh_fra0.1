import React from 'react';
import { useAssessment } from '@/contexts/AssessmentContext';
import { AssessmentScreen, ScaleQuestion, CurrencyQuestion } from '@/components/ui';
import type { ScaleValue, CurrencyValue } from '@/types/assessment';

export default function FraudResponseScreen() {
  const { assessment, updateAssessment } = useAssessment();

  return (
    <AssessmentScreen
      title="Fraud Response Plan"
      nextRoute="/action-plan"
      previousRoute="/compliance-mapping"
      hidePrevious={false}
      progress={{ current: 13, total: 13 }}
    >
      <CurrencyQuestion
        question="Estimated fraud losses detected in the past 3 years"
        hint="Total value of fraud incidents identified before completion"
        value={assessment.fraudResponsePlan.detectedLossesValue}
        onChange={(value) =>
          updateAssessment({ fraudResponsePlan: { ...assessment.fraudResponsePlan, detectedLossesValue: value } })
        }
      />

      <ScaleQuestion
        question="How quickly does the organisation typically respond to suspected fraud?"
        minLabel="Response is slow or reactive"
        maxLabel="Rapid, proactive response"
        value={assessment.fraudResponsePlan.responseSpeed}
        onChange={(value) =>
          updateAssessment({ fraudResponsePlan: { ...assessment.fraudResponsePlan, responseSpeed: value } })
        }
      />
    </AssessmentScreen>
  );
}
