import type { QuizQuestion } from '@stopfra/types';

export const quizQuestions: Record<number, QuizQuestion> = {
  1: {
    question: 'Under the Economic Crime and Corporate Transparency Act 2023, what is the only defence against the "failure to prevent fraud" offence?',
    options: [
      'Showing that employees acted without authorisation',
      'Proving that "reasonable procedures" were in place',
      'Demonstrating that the fraud was committed by external parties',
      'Providing evidence of financial controls',
    ],
    correctAnswer: 1,
    explanation: 'The only defence is proving that "reasonable procedures" were in place to prevent fraud. This means organisations must proactively implement and document their fraud prevention measures.',
  },
  2: {
    question: 'Which type of fraud involves an attacker impersonating a senior executive to request urgent payments?',
    options: [
      'Payroll fraud',
      'Procurement fraud',
      'CEO fraud (Business Email Compromise)',
      'Grant fraud',
    ],
    correctAnswer: 2,
    explanation: 'CEO fraud, also known as Business Email Compromise (BEC), involves criminals impersonating senior executives to trick employees into making urgent payments or sharing sensitive information.',
  },
  3: {
    question: 'What is the primary purpose of segregation of duties as a fraud control?',
    options: [
      'To reduce workload for individual employees',
      'To ensure no single person controls an entire transaction',
      'To improve efficiency in processing transactions',
      'To comply with data protection regulations',
    ],
    correctAnswer: 1,
    explanation: 'Segregation of duties ensures that no single person has complete control over a transaction from start to finish, requiring collusion between multiple people to commit fraud.',
  },
  4: {
    question: 'According to the ACFE Report, what is the average fraud loss as a percentage of annual revenue?',
    options: [
      '1%',
      '3%',
      '5%',
      '10%',
    ],
    correctAnswer: 2,
    explanation: 'The Association of Certified Fraud Examiners (ACFE) reports that the typical organisation loses 5% of revenue to fraud annually, making fraud prevention a significant financial priority.',
  },
};
