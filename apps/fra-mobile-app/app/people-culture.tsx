import React from 'react';
import { useAssessment } from '@/contexts/AssessmentContext';
import { AssessmentScreen, QuestionGroup, QuestionOption, ScaleQuestion, YesNoQuestion } from '@/components/ui';
import type { Frequency, WhistleblowingRoute, LeadershipMessage, ScaleValue } from '@/types/assessment';

export default function PeopleCultureScreen() {
  const { assessment, updateAssessment } = useAssessment();

  const frequencyOptions: QuestionOption<Frequency>[] = [
    { value: 'always', label: 'Always' },
    { value: 'usually', label: 'Usually' },
    { value: 'sometimes', label: 'Sometimes' },
    { value: 'rarely', label: 'Rarely' },
    { value: 'never', label: 'Never' },
  ];

  const whistleblowingOptions: QuestionOption<WhistleblowingRoute>[] = [
    { value: 'well-communicated', label: 'Well-communicated' },
    { value: 'exists-not-known', label: 'Exists but not well known' },
    { value: 'no-formal', label: 'No formal route' },
  ];

  const leadershipOptions: QuestionOption<LeadershipMessage>[] = [
    { value: 'very-clear', label: 'Very clear' },
    { value: 'quite-clear', label: 'Quite clear' },
    { value: 'occasionally', label: 'Occasionally mentioned' },
    { value: 'not-discussed', label: 'Not really discussed' },
  ];

  return (
    <AssessmentScreen
      title="People and culture"
      nextRoute="/controls-technology"
      previousRoute="/it-systems"
      hidePrevious={false}
      progress={{ current: 8, total: 13 }}
    >
      <ScaleQuestion
        question="How thorough are your background and vetting checks on new staff?"
        minLabel="Basic name check only"
        maxLabel="Comprehensive multi-layer checks"
        value={assessment.peopleCulture.staffCheckMaturity}
        onChange={(value) =>
          updateAssessment({ peopleCulture: { ...assessment.peopleCulture, staffCheckMaturity: value } })
        }
      />

      <QuestionGroup
        question="How often are vetting checks performed?"
        options={frequencyOptions}
        value={assessment.peopleCulture.staffChecks}
        onChange={(value) =>
          updateAssessment({ peopleCulture: { ...assessment.peopleCulture, staffChecks: value } })
        }
      />

      <YesNoQuestion
        question="Has your whistleblowing route been used to report fraud concerns in the last 2 years?"
        value={assessment.peopleCulture.whistleblowingUsed}
        onChange={(value) =>
          updateAssessment({ peopleCulture: { ...assessment.peopleCulture, whistleblowingUsed: value } })
        }
        followUpQuestion="Please describe the cases and how they were handled"
        followUpValue={assessment.peopleCulture.whistleblowingDetails}
        onFollowUpChange={(text) =>
          updateAssessment({ peopleCulture: { ...assessment.peopleCulture, whistleblowingDetails: text } })
        }
      />

      <QuestionGroup
        question="Whistleblowing or speak-up route"
        options={whistleblowingOptions}
        value={assessment.peopleCulture.whistleblowing}
        onChange={(value) =>
          updateAssessment({ peopleCulture: { ...assessment.peopleCulture, whistleblowing: value } })
        }
      />

      <ScaleQuestion
        question="How frequently and clearly does leadership communicate expectations about fraud prevention?"
        minLabel="Rarely addressed"
        maxLabel="Regular, clear, consistent messaging"
        value={assessment.peopleCulture.leadershipMessagingIntensity}
        onChange={(value) =>
          updateAssessment({ peopleCulture: { ...assessment.peopleCulture, leadershipMessagingIntensity: value } })
        }
      />

      <QuestionGroup
        question="Leadership message on fraud"
        options={leadershipOptions}
        value={assessment.peopleCulture.leadershipMessage}
        onChange={(value) =>
          updateAssessment({ peopleCulture: { ...assessment.peopleCulture, leadershipMessage: value } })
        }
      />
    </AssessmentScreen>
  );
}
