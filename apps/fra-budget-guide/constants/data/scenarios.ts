export interface Scenario {
  id: string;
  title: string;
  howItWorks: string;
  redFlags: string[];
  whatToDo: string[];
  controls: string[];
  example: string;
  decision?: {
    prompt: string;
    options: {
      text: string;
      correct: boolean;
      feedback: string;
    }[];
  };
}

export const scenarioData: Record<string, Scenario[]> = {
  procurement: [
    {
      id: 'fake-supplier',
      title: 'Fake Supplier Invoice',
      howItWorks:
        'Fraudster creates fake supplier identity, submits invoice for goods/services never provided. Invoice appears legitimate with professional branding and VAT number. Payment processed to fraudulent bank account.',
      redFlags: [
        'New supplier with no prior relationship',
        'Sole trader/individual rather than established company',
        'Generic email (Gmail, Hotmail vs. corporate domain)',
        'No physical address or vague location',
        'Payment urgency ("Pay immediately to avoid penalties")',
        'Round numbers (£5,000.00 vs. £4,847.23)',
      ],
      whatToDo: [
        'Verify ALL new suppliers before first payment',
        'Check Companies House registration (UK)',
        'Call supplier using independently verified phone number',
        'Require purchase order before invoice submission',
      ],
      controls: [
        'Three quotes for purchases above threshold',
        'New supplier verification checklist',
        'Segregation of duties (requisitioner ≠ approver)',
      ],
      example:
        'Finance team received £8,500 invoice from "IT Solutions Ltd" for software licenses. Checked Companies House—company dissolved 2 years ago. Avoided £8,500 loss.',
      decision: {
        prompt: 'A new supplier submits an invoice for £4,950 with urgent payment requested. What do you do?',
        options: [
          {
            text: 'Pay immediately to avoid penalties',
            correct: false,
            feedback:
              'Wrong. Urgency is a major red flag. Always verify new suppliers before any payment.',
          },
          {
            text: 'Verify supplier through Companies House and independent phone call',
            correct: true,
            feedback:
              'Correct! Always verify new suppliers using independent sources before processing any payment.',
          },
          {
            text: 'Ask colleague if they recognize the supplier',
            correct: false,
            feedback:
              'Insufficient. Rely on documented verification, not verbal confirmation.',
          },
        ],
      },
    },
  ],
  'invoice-payment': [
    {
      id: 'email-impersonation',
      title: 'Email Impersonation (Business Email Compromise)',
      howItWorks:
        'Fraudster impersonates supplier via spoofed email stating "We\'ve changed bank details—please update for future payments." Email looks identical to legitimate supplier communication. Often timed when key person on leave.',
      redFlags: [
        'Unexpected bank detail change request',
        'Urgency language ("Update immediately")',
        'Slight misspelling in sender email (supp1ier vs. supplier)',
        'Generic greeting ("Dear Customer" vs. your name)',
        'Request sent outside normal business hours',
      ],
      whatToDo: [
        'NEVER update bank details via email alone',
        'Call supplier using phone number from contract/invoice (not email)',
        'Verbal confirmation with two authorized signatories',
        'Test payment (£1) before full amount',
      ],
      controls: [
        'Flag all bank changes for senior approval',
        'Email security (SPF, DKIM, DMARC checks)',
        'Mandatory phone verification policy',
      ],
      example:
        'NHS trust received email from "construction supplier" requesting bank change. Verified by phone—supplier had not sent email. Avoided £127,000 fraud.',
      decision: {
        prompt: 'You receive an email from a regular supplier requesting updated bank details. What do you do?',
        options: [
          {
            text: 'Update the details immediately',
            correct: false,
            feedback: 'Wrong. Email is not secure for bank detail changes.',
          },
          {
            text: 'Call supplier using contact details from the original contract',
            correct: true,
            feedback:
              'Correct! Always verify bank changes by phone using independently sourced contact information.',
          },
          {
            text: 'Reply to the email asking for confirmation',
            correct: false,
            feedback:
              'Wrong. If the email is fraudulent, the reply goes to the fraudster.',
          },
        ],
      },
    },
  ],
  payroll: [
    {
      id: 'ghost-employees',
      title: 'Ghost Employees',
      howItWorks:
        'Fictitious employee added to payroll system. Salary payments made to fraudulent bank account. Employee "works" in department with poor headcount oversight. May be former employee not removed from system.',
      redFlags: [
        'Employees with no personnel file',
        'Same bank account for multiple employees',
        'Employees never taking leave',
        'No emergency contact information',
        'Employee unreachable or never seen in office',
      ],
      whatToDo: [
        'Monthly headcount reconciliation (payroll vs. actual staff)',
        'Starter/leaver verification by HR and department',
        'Random personnel file audits',
      ],
      controls: [
        'Bank account uniqueness checks',
        'Mandatory annual leave (fraud detection opportunity)',
        'Segregation of duties in payroll processing',
      ],
      example:
        'Council payroll audit found 3 "employees" paid for 18 months. Total loss: £87,000. Fraudster was payroll clerk with weak oversight.',
    },
  ],
  expenses: [
    {
      id: 'false-expenses',
      title: 'False Expense Claims',
      howItWorks:
        'Personal expenses claimed as business (meals, travel, accommodation). Receipts fabricated or altered using Photoshop or online generators. Same receipt submitted multiple times to different approvers.',
      redFlags: [
        'Receipts from unusual sources (handwritten, poor quality)',
        'Mileage claims inconsistent with diary/meetings',
        'High-value claims with vague descriptions',
        'Weekend/holiday expenses for "business" activities',
        'Receipts in employee name (hotels should show organisation)',
      ],
      whatToDo: [
        'Require original itemized receipts (not credit card slips)',
        'Cross-check mileage vs. calendar appointments',
        'Sample verification (call hotel/restaurant to confirm)',
      ],
      controls: [
        'Expense policy with clear examples',
        'Random audit of expense claims',
        'Digital receipt submission (harder to alter)',
      ],
      example:
        'Employee claimed £8,000 in "client entertainment" over 6 months. Audit revealed receipts from family birthday parties, personal dining. Dismissed for gross misconduct.',
    },
  ],
  contracts: [
    {
      id: 'contract-splitting',
      title: 'Contract Splitting',
      howItWorks:
        'Large contract artificially divided into smaller contracts. Each below competitive tender threshold. Avoids procurement scrutiny. May involve kickbacks from supplier.',
      redFlags: [
        'Multiple small contracts with same supplier for similar services',
        'Contracts start/end on consecutive dates',
        'Total value would exceed tender threshold',
        'Services could reasonably be consolidated',
      ],
      whatToDo: [
        'Aggregate spending review per supplier annually',
        'Contracts board review all awards',
        'Require business justification for multiple contracts',
      ],
      controls: [
        'Procurement oversight of contract patterns',
        'Automated alerts for supplier spending concentration',
        'Annual conflict of interest declarations',
      ],
      example:
        'Department had 5 contracts totaling £120,000 with one IT supplier, each below £25,000 tender threshold. Investigation revealed manager receiving "consulting fees."',
    },
  ],
};
