import React from 'react';
import { useAssessment } from '@/contexts/AssessmentContext';
import { AssessmentScreen, QuestionGroup, TextArea, QuestionOption, ScaleQuestion, CurrencyQuestion, YesNoQuestion } from '@/components/ui';
import type { Frequency, ScaleValue } from '@/types/assessment';

export default function ITSystemsScreen() {
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
      title="IT systems and data"
      nextRoute="/people-culture"
      previousRoute="/revenue"
      hidePrevious={false}
      progress={{ current: 7, total: 13 }}
    >
      <ScaleQuestion
        question="How would you rate your organisation's cybersecurity maturity?"
        minLabel="Basic"
        maxLabel="Advanced"
        value={assessment.itSystems.cybersecurityMaturity}
        onChange={(value) =>
          updateAssessment({ itSystems: { ...assessment.itSystems, cybersecurityMaturity: value } })
        }
      />

      <CurrencyQuestion
        question="How many cybersecurity incidents have you experienced in the last 12 months?"
        hint="Include breaches, malware, unauthorized access, etc."
        value={assessment.itSystems.securityIncidentsCount}
        onChange={(value) =>
          updateAssessment({ itSystems: { ...assessment.itSystems, securityIncidentsCount: value } })
        }
      />

      <YesNoQuestion
        question="Do you have critical systems that could cause significant business disruption if compromised?"
        value={assessment.itSystems.hasCriticalSystems}
        onChange={(value) =>
          updateAssessment({ itSystems: { ...assessment.itSystems, hasCriticalSystems: value } })
        }
        followUpQuestion="Please describe your critical systems and their importance to business operations"
        followUpValue={assessment.itSystems.criticalSystemsDescription}
        onFollowUpChange={(text) =>
          updateAssessment({ itSystems: { ...assessment.itSystems, criticalSystemsDescription: text } })
        }
      />

      <ScaleQuestion
        question="How frequently are your data backups tested and verified?"
        minLabel="Never tested"
        maxLabel="Continuously"
        value={assessment.itSystems.backupTestingFrequency}
        onChange={(value) =>
          updateAssessment({ itSystems: { ...assessment.itSystems, backupTestingFrequency: value } })
        }
      />

      <ScaleQuestion
        question="What percentage of your users have multi-factor authentication enabled?"
        minLabel="None"
        maxLabel="All users"
        value={assessment.itSystems.mfaAdoption}
        onChange={(value) =>
          updateAssessment({ itSystems: { ...assessment.itSystems, mfaAdoption: value } })
        }
      />

      <QuestionGroup
        question="Are user access rights reviewed regularly?"
        options={frequencyOptions}
        value={assessment.itSystems.q1}
        onChange={(value) =>
          updateAssessment({ itSystems: { ...assessment.itSystems, q1: value } })
        }
      />

      <QuestionGroup
        question="Are system logs and activity monitored?"
        options={frequencyOptions}
        value={assessment.itSystems.q2}
        onChange={(value) =>
          updateAssessment({ itSystems: { ...assessment.itSystems, q2: value } })
        }
      />

      <TextArea
        label="Anything we should know about this area?"
        hint="Issues, incidents, or worries"
        value={assessment.itSystems.notes}
        onChangeText={(text) =>
          updateAssessment({ itSystems: { ...assessment.itSystems, notes: text } })
        }
        placeholder="Optional – add any relevant details"
        numberOfLines={4}
      />
    </AssessmentScreen>
  );
}
