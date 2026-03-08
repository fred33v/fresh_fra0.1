import type { ActionPlanTemplates } from '@stopfra/types';

export const actionPlanTemplates: ActionPlanTemplates = {
  immediate: [
    'Review current authorisation limits and approval processes',
    'Verify whistleblowing channels are accessible and promoted',
    'Ensure all staff have completed fraud awareness training',
  ],
  thirtyDays: [
    'Complete the Fraud Risk Self-Assessment',
    'Document key fraud risks and existing controls',
    'Identify gaps in segregation of duties',
  ],
  ninetyDays: [
    'Implement priority control improvements',
    'Establish regular fraud risk reporting to governance',
    'Review and update fraud response plan',
  ],
};
