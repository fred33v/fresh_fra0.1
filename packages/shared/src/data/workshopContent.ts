import type { WorkshopSection, SectionData } from '@stopfra/types';

export const workshopSections: WorkshopSection[] = [
  {
    id: 0,
    title: 'Welcome & Introduction',
    duration: '2 min',
    icon: 'Presentation',
  },
  {
    id: 1,
    title: 'Regulatory Landscape',
    duration: '5 min',
    icon: 'Scale',
  },
  {
    id: 2,
    title: 'Types of Fraud Risks',
    duration: '5 min',
    icon: 'ShieldAlert',
  },
  {
    id: 3,
    title: 'Defence Strategies',
    duration: '5 min',
    icon: 'Shield',
  },
  {
    id: 4,
    title: 'Organisational Impact',
    duration: '5 min',
    icon: 'Building2',
  },
  {
    id: 5,
    title: 'Case Study & Scenarios',
    duration: '5 min',
    icon: 'FileText',
  },
  {
    id: 6,
    title: 'Action Planning',
    duration: '3 min',
    icon: 'Target',
  },
];

export const sectionContent: Record<number, SectionData> = {
  0: {
    title: 'Welcome to Fraud Risk Awareness',
    subtitle: 'Building a Culture of Vigilance and Compliance',
    keyPoints: [
      'This 30-minute workshop is designed for Trustees, Executive Leadership, and Budget-Holders',
      'We will cover the current regulatory landscape and emerging fraud threats',
      'You will learn practical defence strategies and develop an action plan',
      'Interactive elements will help reinforce key concepts throughout',
    ],
    discussionPrompt: 'What fraud risks are you most concerned about in your organisation?',
  },
  1: {
    title: 'The Regulatory Landscape',
    subtitle: 'Understanding Your Compliance Obligations',
    keyPoints: [
      'The Economic Crime and Corporate Transparency Act 2023 introduces new "failure to prevent fraud" offence',
      'Organisations can be held liable for fraud committed by employees for the organisation\'s benefit',
      'The only defence is proving "reasonable procedures" were in place',
      'Regulators expect proactive fraud risk assessments and controls',
      'Senior leaders have personal accountability for fraud prevention culture',
    ],
    discussionPrompt: 'How prepared is your organisation for the new "failure to prevent fraud" legislation?',
  },
  2: {
    title: 'Types of Fraud Risks',
    subtitle: 'Recognising Common Fraud Schemes',
    keyPoints: [
      'Internal fraud: expense fraud, payroll fraud, procurement fraud, asset misappropriation',
      'External fraud: invoice fraud, CEO fraud, vendor impersonation, cyber fraud',
      'Financial statement fraud: revenue recognition manipulation, expense capitalisation',
      'Grant and funding fraud: misuse of restricted funds, false reporting',
      'Cyber-enabled fraud: phishing, business email compromise, ransomware',
    ],
    discussionPrompt: 'Which of these fraud types do you believe poses the greatest risk to your organisation?',
  },
  3: {
    title: 'Defence Strategies',
    subtitle: 'Building Robust Fraud Prevention Controls',
    keyPoints: [
      'Segregation of duties: No single person should control an entire transaction',
      'Authorisation limits: Clear approval thresholds and dual authorisation for high-value transactions',
      'Verification procedures: Independent confirmation of bank details, supplier changes',
      'Whistleblowing: Confidential reporting channels with anti-retaliation policies',
      'Regular audits: Surprise audits and continuous monitoring of high-risk areas',
    ],
    discussionPrompt: 'Which defence strategy would have the biggest impact if implemented in your area?',
  },
  4: {
    title: 'Organisational Impact',
    subtitle: 'The True Cost of Fraud',
    keyPoints: [
      'Financial losses: Average fraud loss is 5% of annual revenue (ACFE Report)',
      'Reputational damage: Loss of stakeholder trust, media scrutiny, donor withdrawal',
      'Legal consequences: Fines, prosecution, personal liability for directors',
      'Operational disruption: Investigation costs, staff time, service delivery impact',
      'Cultural impact: Decreased morale, increased turnover, damaged trust',
    ],
    discussionPrompt: 'Beyond financial loss, what impact would a fraud incident have on your organisation?',
  },
  5: {
    title: 'Case Study & Scenarios',
    subtitle: 'Learning from Real-World Examples',
    keyPoints: [
      'Analyse sector-specific case studies to identify red flags',
      'Practise responding to realistic fraud scenarios',
      'Understand the decision points that can prevent or enable fraud',
      'Learn from both failures and successful fraud prevention',
      'Apply lessons to your own organisational context',
    ],
    discussionPrompt: 'What early warning signs should we look for in our own organisation?',
  },
  6: {
    title: 'Your Action Plan',
    subtitle: 'Committing to Fraud Prevention',
    keyPoints: [
      'Complete the Fraud Risk Self-Assessment within 30 days',
      'Review and update authorisation limits and segregation of duties',
      'Ensure whistleblowing channels are accessible and promoted',
      'Schedule fraud awareness training for your teams',
      'Establish regular fraud risk reporting to governance bodies',
    ],
    discussionPrompt: 'What is the first action you will take after this workshop?',
  },
};
