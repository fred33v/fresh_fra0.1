import React from 'react';
import { useAssessment } from '@/contexts/AssessmentContext';
import { AssessmentScreen, QuestionGroup, QuestionOption, ScaleQuestion, CurrencyQuestion } from '@/components/ui';
import type { Pressure, ControlStrength, SpeakUpCulture, ScaleValue, CurrencyValue } from '@/types/assessment';

export default function FraudTriangleScreen() {
  const { assessment, updateAssessment } = useAssessment();

  const pressureOptions: QuestionOption<Pressure>[] = [
    { value: 'very-high', label: 'Very high' },
    { value: 'high', label: 'High' },
    { value: 'moderate', label: 'Moderate' },
    { value: 'low', label: 'Low' },
  ];

  const controlOptions: QuestionOption<ControlStrength>[] = [
    { value: 'very-strong', label: 'Very strong' },
    { value: 'reasonably-strong', label: 'Reasonably strong' },
    { value: 'some-gaps', label: 'Some gaps' },
    { value: 'weak', label: 'Weak or unclear' },
  ];

  const cultureOptions: QuestionOption<SpeakUpCulture>[] = [
    { value: 'very-confident', label: 'Very confident' },
    { value: 'quite-confident', label: 'Quite confident' },
    { value: 'not-sure', label: 'Not sure' },
    { value: 'not-confident', label: 'Not confident' },
  ];

  return (
    <AssessmentScreen
      title="Quick check on pressures and opportunities"
      nextRoute="/procurement"
      previousRoute="/risk-appetite"
      hidePrevious={false}
      progress={{ current: 2, total: 13 }}
    >
      <CurrencyQuestion
        question="If fraud occurred undetected, what is your estimate of potential annual loss?"
        hint="This helps quantify the impact of opportunity and pressure combined"
        value={assessment.fraudTriangle.estimatedLossExposure}
        onChange={(value) =>
          updateAssessment({ fraudTriangle: { ...assessment.fraudTriangle, estimatedLossExposure: value } })
        }
      />

      <ScaleQuestion
        question="How would you rate the cultural likelihood that staff would rationalize fraudulent behaviour?"
        minLabel="Culture actively discourages"
        maxLabel="Culture could enable rationalization"
        value={assessment.fraudTriangle.rationalizationRisk}
        onChange={(value) =>
          updateAssessment({ fraudTriangle: { ...assessment.fraudTriangle, rationalizationRisk: value } })
        }
      />

      <QuestionGroup
        question="Overall financial or operational pressure on the organisation"
        options={pressureOptions}
        value={assessment.fraudTriangle.pressure}
        onChange={(value) =>
          updateAssessment({ fraudTriangle: { ...assessment.fraudTriangle, pressure: value } })
        }
      />

      <QuestionGroup
        question="Strength of your fraud prevention controls"
        options={controlOptions}
        value={assessment.fraudTriangle.controlStrength}
        onChange={(value) =>
          updateAssessment({ fraudTriangle: { ...assessment.fraudTriangle, controlStrength: value } })
        }
      />

      <QuestionGroup
        question="Confidence that staff would speak up if they saw something wrong"
        options={cultureOptions}
        value={assessment.fraudTriangle.speakUpCulture}
        onChange={(value) =>
          updateAssessment({ fraudTriangle: { ...assessment.fraudTriangle, speakUpCulture: value } })
        }
      />
    </AssessmentScreen>
  );
}
