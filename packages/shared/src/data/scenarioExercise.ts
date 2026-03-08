import type { ScenarioExercise } from '@stopfra/types';

export const scenarioExercise: ScenarioExercise = {
  title: 'The Suspicious Invoice',
  introduction: 'You are a budget-holder reviewing invoices for approval. You notice an invoice from a new supplier that was set up by your direct report last week.',
  steps: [
    {
      id: 'step1',
      description: 'The invoice is for \u00a34,500 for "consultancy services" with minimal detail. Your approval limit is \u00a35,000. What do you do?',
      options: [
        {
          id: 'approve',
          text: 'Approve it - it\'s within my limit and was processed by my team',
          isCorrect: false,
          feedback: 'Risk: This is exactly what a fraudster expects. The amount is deliberately below your limit to avoid additional scrutiny.',
        },
        {
          id: 'investigate',
          text: 'Request more information about the supplier and services before approving',
          isCorrect: true,
          feedback: 'Correct! Requesting supporting documentation and verifying new suppliers is essential, especially for vague descriptions.',
        },
        {
          id: 'delegate',
          text: 'Ask your direct report who set up the supplier to approve it instead',
          isCorrect: false,
          feedback: 'Risk: This bypasses segregation of duties. The person who set up the supplier should not also approve their invoices.',
        },
      ],
    },
    {
      id: 'step2',
      description: 'Upon investigation, you discover the supplier\'s registered address is a residential property and there is no online presence. Your direct report says they were recommended by a contact.',
      options: [
        {
          id: 'proceed',
          text: 'Proceed if your report can provide the contact\'s details',
          isCorrect: false,
          feedback: 'Risk: Red flags are mounting. A legitimate consultancy would have a professional presence. Personal recommendations can be fabricated.',
        },
        {
          id: 'escalate',
          text: 'Escalate to your line manager and/or finance team for further investigation',
          isCorrect: true,
          feedback: 'Correct! Multiple red flags warrant escalation. This protects both you and the organisation.',
        },
        {
          id: 'reject',
          text: 'Reject the invoice and close the matter',
          isCorrect: false,
          feedback: 'Partial: While rejecting is appropriate, closing without escalation means potential fraud goes uninvestigated.',
        },
      ],
    },
  ],
};
