import React from 'react';
import { useAssessment } from '@/contexts/AssessmentContext';
import { AssessmentScreen, QuestionGroup, QuestionOption, ScaleQuestion, YesNoQuestion } from '@/components/ui';
import type { SegregationLevel, ConfidenceLevel, MonitoringLevel, ScaleValue } from '@/types/assessment';

export default function ControlsTechnologyScreen() {
  const { assessment, updateAssessment } = useAssessment();

  const segregationOptions: QuestionOption<SegregationLevel>[] = [
    { value: 'well-separated', label: 'Yes – well separated' },
    { value: 'partly', label: 'Partly' },
    { value: 'one-person', label: 'No – one person can do several steps' },
    { value: 'not-sure', label: 'Not sure' },
  ];

  const confidenceOptions: QuestionOption<ConfidenceLevel>[] = [
    { value: 'very-confident', label: 'Very confident' },
    { value: 'quite-confident', label: 'Quite confident' },
    { value: 'some-gaps', label: 'Some gaps' },
    { value: 'not-confident', label: 'Not confident' },
  ];

  const monitoringOptions: QuestionOption<MonitoringLevel>[] = [
    { value: 'regularly', label: 'Yes – regularly' },
    { value: 'some-basic', label: 'Some basic checks' },
    { value: 'very-limited', label: 'Very limited' },
    { value: 'none', label: 'None' },
  ];

  return (
    <AssessmentScreen
      title="Controls and systems"
      nextRoute="/priorities"
      previousRoute="/people-culture"
      hidePrevious={false}
      progress={{ current: 9, total: 13 }}
    >
      <ScaleQuestion
        question="How effectively are duties segregated in your financial processes?"
        minLabel="One person can perform end-to-end"
        maxLabel="Well-separated critical functions"
        value={assessment.controlsTechnology.segregationMaturity}
        onChange={(value) =>
          updateAssessment({ controlsTechnology: { ...assessment.controlsTechnology, segregationMaturity: value } })
        }
      />

      <QuestionGroup
        question="Segregation of duties"
        options={segregationOptions}
        value={assessment.controlsTechnology.segregation}
        onChange={(value) =>
          updateAssessment({ controlsTechnology: { ...assessment.controlsTechnology, segregation: value } })
        }
      />

      <ScaleQuestion
        question="How mature is your system access management and user provisioning process?"
        minLabel="Manual ad-hoc access"
        maxLabel="Automated role-based access control"
        value={assessment.controlsTechnology.accessMaturity}
        onChange={(value) =>
          updateAssessment({ controlsTechnology: { ...assessment.controlsTechnology, accessMaturity: value } })
        }
      />

      <QuestionGroup
        question="System access management"
        options={confidenceOptions}
        value={assessment.controlsTechnology.accessManagement}
        onChange={(value) =>
          updateAssessment({ controlsTechnology: { ...assessment.controlsTechnology, accessManagement: value } })
        }
      />

      <YesNoQuestion
        question="Do you have automated monitoring or exception reporting for unusual transactions?"
        value={assessment.controlsTechnology.automatedMonitoring}
        onChange={(value) =>
          updateAssessment({ controlsTechnology: { ...assessment.controlsTechnology, automatedMonitoring: value } })
        }
        followUpQuestion="Please describe your monitoring procedures and what thresholds trigger alerts"
        followUpValue={assessment.controlsTechnology.automatedMonitoringDetails}
        onFollowUpChange={(text) =>
          updateAssessment({ controlsTechnology: { ...assessment.controlsTechnology, automatedMonitoringDetails: text } })
        }
      />

      <QuestionGroup
        question="Monitoring and data checks"
        options={monitoringOptions}
        value={assessment.controlsTechnology.monitoring}
        onChange={(value) =>
          updateAssessment({ controlsTechnology: { ...assessment.controlsTechnology, monitoring: value } })
        }
      />
    </AssessmentScreen>
  );
}
