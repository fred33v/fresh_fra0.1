// Budget-holder guide content, brought over from the budget-holder guide app
// (apps/fra-budget-guide) so the website covers everything the apps did.

export interface GuideStep {
  slug: string;
  title: string;
  summary: string;
}

/** The guide in reading order, as in the app. */
export const GUIDE_STEPS: GuideStep[] = [
  { slug: 'legal', title: 'Your legal duties', summary: 'What the law expects of you and your organisation' },
  { slug: 'fraud-basics', title: 'How fraud happens', summary: 'The fraud triangle, and the part you control' },
  { slug: 'scenarios', title: 'Fraud scenarios', summary: 'Real-world examples with red flags and what to do' },
  { slug: 'red-flags', title: 'Red flags', summary: 'Warning signs in people and transactions' },
  { slug: 'checklists', title: 'Approval checklists', summary: 'What to check before you approve' },
  { slug: 'authority', title: 'Know your limits', summary: 'Spending authority and golden rules' },
  { slug: 'reporting', title: 'Stop. Protect. Report.', summary: 'What to do if you suspect fraud' },
  { slug: 'whistleblowing', title: 'You are protected', summary: 'Legal protection for raising concerns' },
  { slug: 'myths', title: 'Fraud myths', summary: 'Common beliefs, and the reality' },
  { slug: 'pledge', title: 'Your pledge', summary: 'Commit to your responsibilities as a budget-holder' },
  { slug: 'resources', title: 'Resources & support', summary: 'Contacts and tools to help you' },
];

export interface LegalBlock {
  id: string;
  title: string;
  summary: string;
  points: string[];
  intro?: string;
}

export const legalBlocks: LegalBlock[] = [
  {
    id: 'organisational',
    title: 'Organisational liability',
    summary: 'Under the Economic Crime and Corporate Transparency Act 2023 (in force from September 2025)',
    intro:
      "If fraud is committed for the organisation's benefit and you failed to prevent it through reasonable procedures, the organisation can face:",
    points: ['Unlimited fines', 'Director disqualification', 'Criminal conviction'],
  },
  {
    id: 'personal',
    title: 'Personal liability',
    summary: 'If you knowingly take part in or help fraud',
    points: [
      'Criminal prosecution (Fraud Act 2006)',
      'Dismissal for gross misconduct',
      'Civil recovery of losses',
      'Professional disqualification',
    ],
  },
  {
    id: 'ethical',
    title: 'Ethical and fiduciary duty',
    summary: 'Your role as a steward of organisational resources',
    points: [
      'Stewardship: you manage stakeholder resources (taxpayer money, donor funds, shareholder capital). This is a position of trust.',
      'Role modelling: your team watches your behaviour. Shortcuts you take signal "acceptable" conduct.',
      "Fiduciary duty: act in the organisation's best interests, not personal convenience.",
    ],
  },
];

export const fraudTriangle = [
  { key: 'pressure', title: 'Pressure', text: 'Financial difficulties, unrealistic performance targets, or personal problems', yoursToControl: false },
  { key: 'opportunity', title: 'Opportunity', text: 'Weak internal controls, lack of oversight, or trust without verification', yoursToControl: true },
  { key: 'rationalisation', title: 'Rationalisation', text: 'Justifying dishonest behaviour to themselves', yoursToControl: false },
];

export type BudgetRole = 'procurement' | 'invoices' | 'payroll' | 'expenses' | 'contracts';

export const roleOptions: { id: BudgetRole; title: string; description: string }[] = [
  { id: 'procurement', title: 'Procurement & suppliers', description: 'Managing suppliers, purchase orders and procurement decisions' },
  { id: 'invoices', title: 'Invoices & payments', description: 'Approving invoices and authorising payments' },
  { id: 'payroll', title: 'Payroll & timesheets', description: 'Managing payroll, approving timesheets and HR functions' },
  { id: 'expenses', title: 'Expenses', description: 'Reviewing and approving employee expense claims' },
  { id: 'contracts', title: 'Contracts', description: 'Managing and approving contracts with third parties' },
];

export const scenarioCategories: { id: string; title: string; description: string; relevantRoles: BudgetRole[] }[] = [
  { id: 'procurement', title: 'Procurement fraud', description: 'Fake suppliers, inflated pricing, kickbacks and split purchases', relevantRoles: ['procurement', 'invoices'] },
  { id: 'invoice-payment', title: 'Invoice & payment fraud', description: 'Email impersonation, duplicate payments and bank fraud', relevantRoles: ['invoices'] },
  { id: 'payroll', title: 'Payroll & HR fraud', description: 'Ghost employees, timesheet fraud and payroll manipulation', relevantRoles: ['payroll'] },
  { id: 'expenses', title: 'Expense fraud', description: 'False claims, mileage fraud and fabricated receipts', relevantRoles: ['expenses'] },
  { id: 'contracts', title: 'Contract fraud', description: 'Contract splitting and revenue manipulation', relevantRoles: ['contracts'] },
];

export const redFlags: { id: string; category: 'people' | 'transactions'; text: string }[] = [
  { id: 'people-1', category: 'people', text: 'Employee discussing money problems or debt' },
  { id: 'people-2', category: 'people', text: 'Sudden lifestyle changes inconsistent with salary' },
  { id: 'people-3', category: 'people', text: 'Reluctance to take leave or share responsibilities' },
  { id: 'people-4', category: 'people', text: 'Working unusual hours alone' },
  { id: 'people-5', category: 'people', text: 'Defensive when questioned about transactions' },
  { id: 'people-6', category: 'people', text: 'Overly close relationships with suppliers or contractors' },
  { id: 'people-7', category: 'people', text: "Control issues: won't delegate or share access" },
  { id: 'people-8', category: 'people', text: 'Disgruntlement with employer or an entitlement mentality' },
  { id: 'trans-1', category: 'transactions', text: 'New suppliers with generic email addresses (Gmail, Hotmail)' },
  { id: 'trans-2', category: 'transactions', text: 'Round numbers on invoices (£5,000.00 vs £4,847.23)' },
  { id: 'trans-3', category: 'transactions', text: 'Invoices just below approval thresholds' },
  { id: 'trans-4', category: 'transactions', text: 'Urgent payment demands without justification' },
  { id: 'trans-5', category: 'transactions', text: 'Vague invoice descriptions ("Miscellaneous services")' },
  { id: 'trans-6', category: 'transactions', text: 'Same supplier used repeatedly without competition' },
  { id: 'trans-7', category: 'transactions', text: 'Bank detail change requests by email' },
  { id: 'trans-8', category: 'transactions', text: 'Missing or photocopied receipts' },
  { id: 'trans-9', category: 'transactions', text: 'Sequential invoice numbers across different suppliers' },
  { id: 'trans-10', category: 'transactions', text: 'Supplier with no online presence or Companies House record' },
];

export const checklists: { id: string; title: string; items: { id: string; text: string }[] }[] = [
  {
    id: 'payments',
    title: 'Before approving payments',
    items: [
      { id: 'p1', text: 'Verify goods or services were actually received (three-way match)' },
      { id: 'p2', text: 'Confirm the supplier is legitimate (if new or unusual)' },
      { id: 'p3', text: 'Check the invoice amount matches the agreement or quote' },
      { id: 'p4', text: 'Make sure proper authorisation was obtained' },
      { id: 'p5', text: 'Verify bank details if paying a new account' },
      { id: 'p6', text: 'Question anything unusual or urgent' },
    ],
  },
  {
    id: 'timesheets',
    title: 'Before approving timesheets',
    items: [
      { id: 't1', text: 'Verify hours are reasonable and consistent with the work' },
      { id: 't2', text: 'Check the employee was scheduled to work the days claimed' },
      { id: 't3', text: 'Confirm overtime was authorised in advance' },
      { id: 't4', text: 'Cross-check against project deliverables' },
      { id: 't5', text: 'Question unusual patterns, or maximum hours every week' },
    ],
  },
  {
    id: 'expenses',
    title: 'Before approving expenses',
    items: [
      { id: 'e1', text: 'Check receipts are original, itemised and dated' },
      { id: 'e2', text: 'Verify the business purpose is legitimate and clear' },
      { id: 'e3', text: 'Cross-check dates (the employee was travelling or working)' },
      { id: 'e4', text: 'Confirm expenses are within policy limits' },
      { id: 'e5', text: 'Question weekend and holiday expenses' },
      { id: 'e6', text: 'Verify mileage claims against the calendar' },
    ],
  },
  {
    id: 'suppliers',
    title: 'Before approving new suppliers',
    items: [
      { id: 's1', text: 'Check Companies House registration (UK)' },
      { id: 's2', text: 'Verify the business address is real (not only a P.O. box)' },
      { id: 's3', text: 'Call the supplier on an independently verified phone number' },
      { id: 's4', text: 'Check their online presence (website, reviews)' },
      { id: 's5', text: 'Ask for business references' },
      { id: 's6', text: 'Verify VAT registration if VAT is charged' },
    ],
  },
  {
    id: 'bank-changes',
    title: 'Before changing bank details',
    items: [
      { id: 'b1', text: 'NEVER update bank details by email alone' },
      { id: 'b2', text: 'Call the supplier using contact details from the original contract' },
      { id: 'b3', text: 'Get verbal confirmation from two authorised signatories' },
      { id: 'b4', text: 'Make a test payment (£1) before the full amount' },
      { id: 'b5', text: 'Flag the change for senior management approval' },
      { id: 'b6', text: 'Record every verification step taken' },
    ],
  },
];

export const authorityBands = ['Up to £1k', '£1k–£5k', '£5k–£25k', '£25k+'] as const;

export const authorityMatrix: { type: string; approvers: [string, string, string, string] }[] = [
  { type: 'Procurement', approvers: ['Team Leader', 'Budget Holder', 'Senior Manager', 'Director + CFO'] },
  { type: 'Expenses', approvers: ['Line Manager', 'Budget Holder', 'Director', 'CEO'] },
  { type: 'Payroll changes', approvers: ['HR Officer', 'HR Manager', 'HR Director', 'CEO'] },
  { type: 'Contract awards', approvers: ['N/A', 'Budget Holder', 'Director + Procurement', 'Board'] },
  { type: 'New suppliers', approvers: ['N/A', 'Budget Holder', 'Senior Manager', 'CFO'] },
];

export const goldenRules = [
  'Never exceed your authority (even "just this once")',
  'Never approve your own transactions',
  'Never approve for family or friends without declaring it',
  'If in doubt, escalate upwards',
];

export const reportingSteps = [
  { id: 1, tone: 'danger' as const, title: 'Do not confront', text: 'Never confront the individual. It may lead to evidence being destroyed, intimidation, or personal risk.' },
  { id: 2, tone: 'warning' as const, title: 'Preserve evidence', text: 'Copy suspicious documents. Save emails. Note dates, times and people involved. Do not remove originals.' },
  { id: 3, tone: 'success' as const, title: 'Report through proper channels', text: 'Use the internal channels below. Your report will be handled confidentially and professionally.' },
];

export type ContactKey = 'fraudRiskOwner' | 'whistleblowingHotline' | 'internalAudit' | 'hrDepartment';

export const internalContacts: { key: ContactKey; role: string; bestFor: string }[] = [
  { key: 'fraudRiskOwner', role: 'Fraud Risk Owner', bestFor: 'General or complex fraud concerns, or concerns about your manager' },
  { key: 'whistleblowingHotline', role: 'Whistleblowing hotline', bestFor: 'Sensitive concerns, or when you prefer to stay anonymous' },
  { key: 'internalAudit', role: 'Internal Audit', bestFor: 'Systemic control weaknesses or process issues' },
  { key: 'hrDepartment', role: 'HR department', bestFor: 'Employment fraud (timesheets, expenses, payroll)' },
];

export const externalContacts = [
  { name: 'Action Fraud', contact: '0300 123 2040', detail: 'www.actionfraud.police.uk', href: 'https://www.actionfraud.police.uk' },
  { name: 'Serious Fraud Office', contact: 'www.sfo.gov.uk', detail: 'Major or complex fraud cases', href: 'https://www.sfo.gov.uk' },
  { name: 'HMRC fraud hotline', contact: '0800 788 887', detail: 'Tax-related fraud', href: 'https://www.gov.uk/government/organisations/hm-revenue-customs/contact/reporting-tax-evasion' },
];

export const trainingResources = [
  { name: 'ACFE resources', contact: 'www.acfe.com', detail: 'Global fraud statistics and training', href: 'https://www.acfe.com' },
  { name: 'CIPFA guidance', contact: 'www.cipfa.org', detail: 'Public sector fraud prevention', href: 'https://www.cipfa.org' },
];

export const whistleblowerProtections = [
  {
    title: 'Legal protection',
    items: [
      'Protected from dismissal if you report in good faith',
      'Protected from disciplinary action or demotion',
      'Protected from harassment or victimisation',
      'Protected under the Public Interest Disclosure Act 1998 (UK)',
    ],
  },
  {
    title: 'What makes a qualifying disclosure',
    items: [
      'You report in good faith',
      'You reasonably believe the information is true',
      'You report to the appropriate person or body',
      'The disclosure is in the public interest',
    ],
  },
  {
    title: 'Your responsibilities',
    items: [
      'Report through proper channels first (internal before external)',
      'Do not make malicious or false allegations',
      'Do not disclose for personal gain',
      'Co-operate with any investigation',
    ],
  },
];

export const pledgeItems = [
  'Understand and comply with all financial policies',
  'Exercise delegated authority responsibly and within limits',
  'Apply controls consistently (no shortcuts, no exceptions)',
  'Question unusual, urgent or suspicious requests',
  'Verify suppliers, invoices and bank details before approval',
  'Never approve my own transactions',
  'Declare all conflicts of interest',
  'Report fraud concerns immediately through proper channels',
  'Set the tone for my team (ethical behaviour, speak-up culture)',
  'Complete mandatory fraud awareness training every year',
  'Support fraud investigations with full co-operation',
  'Protect whistleblowers from retaliation',
];
