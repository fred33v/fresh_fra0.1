// ============================================================
// Budget holder programme (Enterprise): the Budget Guide content for staff
// who approve spending, in the order it is taught:
//   A Understand  (legal duties, fraud basics, myths)
//   B Recognise   (red flags, scenarios)
//   C Apply       (checklists, delegated authority)
//   D Report      (reporting, whistleblower protection)
//   E Commit      (commitment) + resources
//
// The server mirrors the part ids, scenario answer key and pass mark in
// apps/fra-backend/backend/src/budget-holder-rules.ts; a backend test fails
// if the two drift apart.
// ============================================================

export type BudgetHolderGroup = 'understand' | 'recognise' | 'apply' | 'report' | 'commit';

export interface BudgetHolderBlock {
  heading?: string;
  text?: string;
  bullets?: string[];
  /** Shown highlighted: the one thing to remember from the block */
  keyPoint?: string;
}

export interface BudgetHolderPart {
  id: string;
  group: BudgetHolderGroup;
  title: string;
  summary: string;
  minutes: number;
  /** Plain reading content. Parts with interactive content (scenarios, checklists…) also use the exports below. */
  blocks: BudgetHolderBlock[];
}

export interface BudgetHolderScenario {
  id: string;
  title: string;
  area: string;
  howItWorks: string;
  redFlags: string[];
  whatToDo: string[];
  controls: string[];
  example: string;
  question: string;
  options: string[];
  /** Index in options of the right answer */
  correct: number;
  /** One line of feedback per option */
  feedback: string[];
}

export interface BudgetHolderChecklist {
  id: string;
  title: string;
  items: string[];
}

export interface ApprovalLimits {
  bands: string[];
  rows: { type: string; approvers: string[] }[];
}

export type ReportContactKey = 'fraudRiskOwner' | 'whistleblowingHotline' | 'internalAudit' | 'hrDepartment';

export const BUDGET_HOLDER_GROUPS: { id: BudgetHolderGroup; label: string }[] = [
  { id: 'understand', label: 'Understand' },
  { id: 'recognise', label: 'Recognise' },
  { id: 'apply', label: 'Apply' },
  { id: 'report', label: 'Report' },
  { id: 'commit', label: 'Commit' },
];

/** Share of scenario questions to answer correctly to complete the programme. */
export const BUDGET_HOLDER_PASS_MARK = 80;
/** The programme is renewed every year. */
export const BUDGET_HOLDER_RENEWAL_MONTHS = 12;

export const budgetHolderParts: BudgetHolderPart[] = [
  {
    id: 'legal',
    group: 'understand',
    title: 'Legal and ethical duties',
    summary: 'What the law expects of the organisation and of you, including ECCTA 2023.',
    minutes: 5,
    blocks: [
      {
        heading: 'The organisation: failure to prevent fraud (ECCTA 2023)',
        text: 'Since 1 September 2025, a large organisation commits a criminal offence if an employee, agent or other associated person commits fraud intending to benefit it, and it did not have reasonable fraud prevention procedures in place.',
        bullets: [
          'The organisation can be prosecuted and face an unlimited fine.',
          'It is no defence that senior managers did not know about the fraud.',
          'The only defence is to show reasonable prevention procedures: risk assessment, proportionate controls, training, monitoring and review.',
          'The offence covers large organisations (two of: more than 250 staff, more than £36m turnover, more than £18m assets). Smaller organisations are still harmed by the same frauds, and the people involved still commit crimes.',
        ],
        keyPoint: 'Your approvals are part of the "reasonable procedures" the organisation relies on.',
      },
      {
        heading: 'You personally',
        text: 'If you knowingly take part in or help a fraud, you face:',
        bullets: [
          'Criminal prosecution under the Fraud Act 2006 (up to 10 years in prison).',
          'Dismissal for gross misconduct.',
          'Civil action to recover the losses.',
          'Loss of professional membership, and disqualification as a director where it applies.',
        ],
      },
      {
        heading: 'Your ethical and fiduciary duty',
        bullets: [
          'Stewardship: you manage money that belongs to others (taxpayers, donors, shareholders). That is a position of trust.',
          'Role model: your team watches what you do. A shortcut you take tells them it is acceptable.',
          'Fiduciary duty: act in the organisation\'s best interests, not for your own convenience.',
        ],
      },
    ],
  },
  {
    id: 'basics',
    group: 'understand',
    title: 'Fraud basics',
    summary: 'How fraud happens: the fraud triangle, and the part you control.',
    minutes: 3,
    blocks: [
      {
        heading: 'The fraud triangle',
        text: 'Fraud happens when three things come together:',
        bullets: [
          'Pressure: money worries, debt, unrealistic targets, addiction.',
          'Opportunity: weak controls, little oversight, one person doing everything.',
          'Rationalisation: "everyone does it", "I deserve this", "I will pay it back".',
        ],
      },
      {
        heading: 'Your control point',
        text: 'You cannot control the pressure people are under or how they justify it to themselves. You can remove the opportunity, with controls applied every time.',
        keyPoint: 'Budget holders control opportunity. That is where fraud is stopped.',
      },
    ],
  },
  {
    id: 'myths',
    group: 'understand',
    title: 'Myths and reality',
    summary: 'Five beliefs that let fraud go unnoticed.',
    minutes: 3,
    blocks: [
      {
        heading: 'Myth: fraud only happens in large organisations',
        text: 'Reality: small organisations often lose proportionally more, because they have fewer controls, more trust between colleagues and less separation of duties.',
      },
      {
        heading: 'Myth: trusted, long-serving staff will not commit fraud',
        text: 'Reality: international fraud studies (ACFE) find that people with longer service cause bigger losses on average. Trust brings access and less checking. Pressure can affect anyone.',
      },
      {
        heading: 'Myth: we have an audit, so fraud would be found',
        text: 'Reality: audits check samples, not every transaction, and auditors are not fraud investigators. Most frauds are found through tips from staff, suppliers and customers (about 4 in 10 in the ACFE studies). External audit finds only a few per cent.',
      },
      {
        heading: 'Myth: fraud prevention is Finance\'s job',
        text: 'Reality: you approve the day-to-day spending. Finance checks afterwards. You are the first line of defence.',
      },
      {
        heading: 'Myth: small amounts do not matter',
        text: 'Reality: small frauds grow as the person grows bolder, and they show others that controls are weak. £100 a week is £5,200 a year.',
      },
    ],
  },
  {
    id: 'red-flags',
    group: 'recognise',
    title: 'Red flags radar',
    summary: 'Warning signs in people and in transactions.',
    minutes: 4,
    blocks: [
      {
        heading: 'People',
        bullets: [
          'Talks about money problems or debt',
          'Sudden lifestyle changes that do not match their salary',
          'Will not take leave or share their work',
          'Works unusual hours alone',
          'Defensive when asked about transactions',
          'Very close to a supplier or contractor',
          'Will not delegate or share access',
          'Resentful of the employer, or feels owed',
        ],
      },
      {
        heading: 'Transactions',
        bullets: [
          'New supplier with a personal email address (Gmail, Hotmail)',
          'Round numbers on invoices (£5,000.00 rather than £4,847.23)',
          'Invoices just below an approval limit',
          'Pressure to pay urgently, with no good reason',
          'Vague descriptions ("miscellaneous services")',
          'The same supplier used again and again without competition',
          'Bank detail changes requested by email',
          'Missing or photocopied receipts',
          'Invoice numbers in sequence across different suppliers',
          'Supplier with no website or Companies House record',
          'A call or video from a senior person asking for a secret, urgent payment',
        ],
      },
      {
        keyPoint: 'A red flag is a reason to check, not proof. Report your concern: do not investigate it yourself.',
      },
    ],
  },
  {
    id: 'scenarios',
    group: 'recognise',
    title: 'Fraud scenarios',
    summary: 'Seven real cases. For each one, decide what you would do.',
    minutes: 12,
    blocks: [
      { text: 'Read each case, then answer its question. You need 80% to complete the programme, and you can try again.' },
    ],
  },
  {
    id: 'checklists',
    group: 'apply',
    title: 'Approval checklists',
    summary: 'What to check before you approve.',
    minutes: 4,
    blocks: [
      { text: 'Use these lists every time you approve. Ticking them here does not save anything: they are for you to keep to hand.' },
    ],
  },
  {
    id: 'authority',
    group: 'apply',
    title: 'Delegated authority',
    summary: 'Who can approve what, in your organisation, and the golden rules.',
    minutes: 3,
    blocks: [
      {
        heading: 'Golden rules',
        bullets: [
          'Never go over your limit, even "just this once".',
          'Never approve your own claims or transactions.',
          'Never approve for family or friends without declaring it first.',
          'Never split a purchase to keep it under a limit.',
          'If in doubt, escalate.',
        ],
      },
    ],
  },
  {
    id: 'reporting',
    group: 'report',
    title: 'Report fraud',
    summary: 'What to do when something looks wrong, and who to tell.',
    minutes: 3,
    blocks: [
      {
        heading: '1. Do not confront',
        text: 'Never confront the person. It can lead to evidence being destroyed, intimidation or risk to you.',
      },
      {
        heading: '2. Keep the evidence',
        text: 'Keep copies of documents and emails. Note dates, times and the people involved. Do not remove originals.',
      },
      {
        heading: '3. Report through the right channel',
        text: 'Use your organisation\'s contacts below, or the confidential speak-up channel. Your report is handled in confidence.',
      },
    ],
  },
  {
    id: 'whistleblowing',
    group: 'report',
    title: 'Whistleblower protection',
    summary: 'The law protects you when you raise a concern.',
    minutes: 3,
    blocks: [
      {
        heading: 'You are protected',
        text: 'Under the Public Interest Disclosure Act 1998, a worker who makes a protected disclosure must not be dismissed or treated badly for it.',
        bullets: [
          'Protection from dismissal, demotion and disciplinary action.',
          'Protection from harassment or victimisation by colleagues.',
        ],
      },
      {
        heading: 'When a disclosure is protected',
        bullets: [
          'You reasonably believe the information shows wrongdoing, such as fraud or another crime.',
          'You reasonably believe that reporting it is in the public interest.',
          'You report it to your employer, or to a prescribed body such as the Serious Fraud Office or HMRC.',
          'You do not need proof, and you do not need to be right: a reasonable belief is enough.',
        ],
      },
      {
        heading: 'Your responsibilities',
        bullets: [
          'Use internal channels first where you can.',
          'Do not make allegations you know are false.',
          'Do not seek personal gain from the report.',
          'Help any investigation.',
        ],
      },
      {
        heading: 'If you face retaliation',
        text: 'Write down what happened and tell HR or the fraud risk owner. Free, confidential advice is available from the charity Protect.',
      },
    ],
  },
  {
    id: 'commitment',
    group: 'commit',
    title: 'Your commitment',
    summary: 'Declare any conflict of interest and sign your budget holder commitment.',
    minutes: 3,
    blocks: [
      { text: 'Your employer keeps your signed commitment and declaration as evidence that budget holders know their duties.' },
    ],
  },
  {
    id: 'resources',
    group: 'commit',
    title: 'Resources and support',
    summary: 'Contacts inside and outside your organisation.',
    minutes: 2,
    blocks: [
      {
        heading: 'Outside your organisation',
        bullets: [
          'Action Fraud, the UK police reporting service: 0300 123 2040, actionfraud.police.uk',
          'Serious Fraud Office, for serious or complex fraud: sfo.gov.uk',
          'HMRC fraud reporting, for tax fraud: gov.uk/report-fraud-hmrc',
          'Protect, free whistleblowing advice: protect-advice.org.uk',
        ],
      },
      {
        heading: 'To learn more',
        bullets: [
          'ACFE (Association of Certified Fraud Examiners): acfe.com',
          'CIPFA counter-fraud guidance for the public sector: cipfa.org',
          'Home Office guidance on the failure to prevent fraud offence: gov.uk',
        ],
      },
    ],
  },
];

export const budgetHolderScenarios: BudgetHolderScenario[] = [
  {
    id: 'fake-supplier',
    title: 'Fake supplier invoice',
    area: 'Procurement',
    howItWorks: 'A fraudster invents a supplier and sends an invoice for goods or services that were never provided. It looks real, with a logo and a VAT number. The payment goes to the fraudster\'s account.',
    redFlags: ['New supplier with no history', 'Personal email address', 'No real address', 'Pressure to pay now', 'Round amount'],
    whatToDo: ['Check every new supplier before the first payment', 'Look it up on Companies House', 'Call it on a number you found yourself', 'Require a purchase order before any invoice'],
    controls: ['Three quotes above the threshold', 'New supplier checklist', 'The person who orders does not approve'],
    example: 'A finance team received an £8,500 invoice from "IT Solutions Ltd" for software licences. Companies House showed the company had been dissolved two years earlier. The payment was stopped.',
    question: 'A new supplier sends a £4,950 invoice and asks for urgent payment. What do you do?',
    options: ['Pay now to avoid late fees', 'Check the supplier on Companies House and call it on a number you found yourself', 'Ask a colleague whether they know the supplier'],
    correct: 1,
    feedback: [
      'No. Urgency is a classic warning sign. Always check a new supplier before paying.',
      'Right. Check new suppliers through independent sources before any payment.',
      'Not enough. Rely on documented checks, not a colleague\'s memory.',
    ],
  },
  {
    id: 'email-impersonation',
    title: 'Email impersonation of a supplier',
    area: 'Invoices and payments',
    howItWorks: 'A fraudster sends an email that looks exactly like one from a real supplier: "We have changed bank, please update your records." It often arrives when the usual contact is on leave.',
    redFlags: ['Unexpected bank change', '"Update immediately"', 'Sender address slightly wrong (supp1ier)', 'Generic greeting', 'Sent out of hours'],
    whatToDo: ['Never change bank details on the strength of an email', 'Call the supplier on the number in your contract or records', 'Two authorised people confirm', 'Send a small test payment first'],
    controls: ['Senior approval for every bank change', 'Email security checks (SPF, DKIM, DMARC)', 'Phone verification policy'],
    example: 'An NHS trust received an email from a "construction supplier" asking to change bank. A phone call showed the supplier had not sent it. £127,000 was saved.',
    question: 'A regular supplier emails you new bank details. What do you do?',
    options: ['Update them straight away', 'Call the supplier on the number from your contract or records', 'Reply to the email to ask for confirmation'],
    correct: 1,
    feedback: [
      'No. Email is not a safe way to change bank details.',
      'Right. Confirm bank changes by phone, on contact details you already hold.',
      'No. If the email is fake, your reply goes to the fraudster.',
    ],
  },
  {
    id: 'bank-detail-change',
    title: 'Bank details changed by letter and phone call',
    area: 'Invoices and payments',
    howItWorks: 'A letter on the supplier\'s headed paper announces new bank details and gives a phone number "for any questions". When you call it, a friendly person confirms the change. The letter, the paper and the number all come from the fraudster.',
    redFlags: ['Contact details given in the request itself', 'Headed paper that is easy to copy', 'Change just before a large payment is due', 'Pressure not to delay the payment'],
    whatToDo: ['Only use contact details already in your records', 'Call a person you have dealt with before', 'Have a second person approve the change', 'Check the first payment to the new account has arrived'],
    controls: ['Bank changes made only by a named team, never by the budget holder alone', 'Change log reviewed every month', 'Hold period before the first payment to new details'],
    example: 'A school received a letter from its building contractor with new bank details and a "direct line". The bursar called the number in the original contract instead: the contractor had never sent the letter. The £64,000 stage payment was saved.',
    question: 'A letter on a supplier\'s headed paper gives new bank details and a phone number to confirm them. What do you do?',
    options: ['Call the number in the letter to confirm', 'Accept it: headed paper is official', 'Call the supplier on the number already in your records, and have the change approved by a second person'],
    correct: 2,
    feedback: [
      'No. The number in the letter may belong to the fraudster.',
      'No. Headed paper is easy to fake.',
      'Right. Use details you already hold, and never make a bank change alone.',
    ],
  },
  {
    id: 'deepfake-executive',
    title: 'Deepfake call from a senior manager',
    area: 'Payments',
    howItWorks: 'You get a video or phone call that looks and sounds like your chief executive or finance director. They ask for an urgent, confidential payment, for a deal "nobody can know about yet". The face and voice are made with AI.',
    redFlags: ['Secrecy: "do not tell anyone"', 'Urgency and pressure', 'A request outside the normal process', 'New account or overseas payee', 'Call from an unknown number or a new meeting link'],
    whatToDo: ['Stop. Do not pay during the call', 'Call the person back on a number you already know', 'Follow the normal approval process, whoever is asking', 'Report the attempt'],
    controls: ['No payment instruction is valid without the normal approval, even from the top', 'Call-back rule for unusual requests', 'Agreed code word or second approver for urgent payments'],
    example: 'In 2024 an employee of an international engineering firm in Hong Kong paid about £20m after a video call in which every other "colleague", including the finance director, was a deepfake.',
    question: 'On a video call, your finance director asks you to make an urgent, confidential payment to a new account today. What do you do?',
    options: ['Pay: you can see and hear them', 'End the call, call them back on a number you already know, and follow the normal approval process', 'Ask them to send the request by email instead'],
    correct: 1,
    feedback: [
      'No. Faces and voices can now be faked. Secrecy and urgency are the warning signs.',
      'Right. Confirm through a channel you trust, and never skip the normal process.',
      'Not enough. An email can come from the same fraudster.',
    ],
  },
  {
    id: 'ghost-employees',
    title: 'Ghost employees',
    area: 'Payroll',
    howItWorks: 'A made-up person is added to the payroll, or a leaver is never removed. The salary goes to the fraudster\'s account. It works best in teams where nobody checks the headcount.',
    redFlags: ['No personnel file', 'Several staff paid into one bank account', 'Never takes leave', 'No emergency contact', 'Nobody has met them'],
    whatToDo: ['Check payroll against your real team every month', 'Starters and leavers confirmed by HR and the manager', 'Spot-check personnel files'],
    controls: ['Duplicate bank account checks', 'Compulsory annual leave', 'Payroll set-up and payment done by different people'],
    example: 'A council payroll audit found three "employees" paid for 18 months: £87,000. The fraudster was a payroll clerk with little oversight.',
    question: 'Your monthly payroll report shows a name you do not recognise in your team. What do you do?',
    options: ['Approve it: HR must have added them', 'Ask HR to show the starter paperwork and confirm the person, and do not sign off until it is clear', 'Remove the person from payroll yourself'],
    correct: 1,
    feedback: [
      'No. Signing off a report you cannot explain is how ghost employees survive.',
      'Right. You know your team: check before you sign, and report it if it is not explained.',
      'No. Do not act alone or alert a possible fraudster. Ask, and report if needed.',
    ],
  },
  {
    id: 'false-expenses',
    title: 'False expense claims',
    area: 'Expenses',
    howItWorks: 'Personal spending is claimed as business. Receipts are made up with online tools or edited, or the same receipt is sent to two approvers.',
    redFlags: ['Poor quality or handwritten receipts', 'Mileage that does not match the diary', 'Large claims with vague descriptions', 'Weekend or holiday "business" spending'],
    whatToDo: ['Ask for original itemised receipts', 'Compare mileage with the calendar', 'Spot-check with the hotel or restaurant'],
    controls: ['Clear expenses policy with examples', 'Random audit of claims', 'Digital receipts'],
    example: 'An employee claimed £8,000 of "client entertainment" over six months. The receipts were from family birthday meals. They were dismissed for gross misconduct.',
    question: 'A team member claims £340 for a "client dinner" on a Saturday with a card slip but no itemised receipt. What do you do?',
    options: ['Approve it: the card slip shows it was paid', 'Ask for the itemised receipt and the names of the clients before approving', 'Approve it this once and remind them next time'],
    correct: 1,
    feedback: [
      'No. A card slip shows a payment, not what was bought or for whom.',
      'Right. Business purpose and an itemised receipt come first.',
      'No. "Just this once" is how false claims become normal.',
    ],
  },
  {
    id: 'contract-splitting',
    title: 'Contract splitting',
    area: 'Contracts',
    howItWorks: 'A large contract is split into smaller ones, each below the tender threshold, to avoid competition and scrutiny. It often hides a kickback from the supplier.',
    redFlags: ['Several small contracts with one supplier for similar work', 'Contracts that follow each other', 'Total above the tender threshold', 'Work that could have been one contract'],
    whatToDo: ['Review total spend per supplier every year', 'Ask why there are several contracts', 'Declare any link with a supplier'],
    controls: ['Procurement oversight of contract patterns', 'Alerts when spend with one supplier builds up', 'Annual conflict of interest declarations'],
    example: 'A department had five contracts worth £120,000 in total with one IT supplier, each below the £25,000 tender threshold. The manager was receiving "consulting fees" from the supplier.',
    question: 'A manager asks you to approve three £9,000 orders with the same supplier this month. The tender threshold is £25,000. What do you do?',
    options: ['Approve them: each one is within your limit', 'Treat them as one £27,000 purchase, ask why they were split, and send it to procurement', 'Approve two now and one next month'],
    correct: 1,
    feedback: [
      'No. Splitting a purchase to stay under a limit breaks the rules, even if each part looks fine.',
      'Right. Look at the total, and follow the tender process.',
      'No. Spreading the orders over time is still splitting.',
    ],
  },
];

export const budgetHolderChecklists: BudgetHolderChecklist[] = [
  {
    id: 'payments',
    title: 'Before approving a payment',
    items: [
      'The goods or services were really received (order, delivery and invoice match)',
      'The supplier is genuine (if new or unusual)',
      'The amount matches the order or quote',
      'The approval is within my limit',
      'Bank details were checked if the account is new',
      'Anything unusual or urgent has been questioned',
    ],
  },
  {
    id: 'timesheets',
    title: 'Before approving timesheets',
    items: [
      'The hours are reasonable for the work',
      'The person was scheduled on those days',
      'Overtime was agreed in advance',
      'The hours match what was delivered',
      'Unusual patterns (maximum hours every week) have been questioned',
    ],
  },
  {
    id: 'expenses',
    title: 'Before approving expenses',
    items: [
      'Receipts are original, itemised and dated',
      'The business purpose is clear and genuine',
      'The dates match travel or work',
      'The claim is within policy limits',
      'Weekend or holiday spending has been questioned',
      'Mileage matches the calendar',
    ],
  },
  {
    id: 'suppliers',
    title: 'Before approving a new supplier',
    items: [
      'Registered on Companies House (UK)',
      'A real business address, not only a PO box',
      'Called on a number I found myself',
      'Has a website or other online presence',
      'References requested',
      'VAT number checked if VAT is charged',
      'Nobody involved has a personal link with the supplier, or it has been declared',
    ],
  },
  {
    id: 'bank-changes',
    title: 'Before changing bank details',
    items: [
      'Never on the strength of an email or letter alone',
      'Called the supplier on the number in our records',
      'Confirmed by two authorised people',
      'Small test payment made first',
      'Change approved by a senior manager',
      'Every check written down',
    ],
  },
];

/** Example limits, replaced by the employer's own in settings. */
export const DEFAULT_APPROVAL_LIMITS: ApprovalLimits = {
  bands: ['Up to £1k', '£1k to £5k', '£5k to £25k', 'Over £25k'],
  rows: [
    { type: 'Purchases', approvers: ['Team leader', 'Budget holder', 'Senior manager', 'Director and finance director'] },
    { type: 'Expenses', approvers: ['Line manager', 'Budget holder', 'Director', 'Chief executive'] },
    { type: 'Payroll changes', approvers: ['HR officer', 'HR manager', 'HR director', 'Chief executive'] },
    { type: 'Contract awards', approvers: ['Not applicable', 'Budget holder', 'Director and procurement', 'Board'] },
    { type: 'New suppliers', approvers: ['Not applicable', 'Budget holder', 'Senior manager', 'Finance director'] },
  ],
};

export const REPORT_CONTACTS: { key: ReportContactKey; role: string; bestFor: string }[] = [
  { key: 'fraudRiskOwner', role: 'Fraud risk owner', bestFor: 'Any fraud concern, complex cases, or a concern about your own manager' },
  { key: 'whistleblowingHotline', role: 'Whistleblowing line', bestFor: 'Sensitive concerns, or when you want to stay anonymous' },
  { key: 'internalAudit', role: 'Internal audit', bestFor: 'Weak controls or processes' },
  { key: 'hrDepartment', role: 'HR', bestFor: 'Timesheets, expenses, payroll and conduct' },
];

export const budgetHolderPledgeItems: string[] = [
  'Understand and follow all financial policies',
  'Use my delegated authority responsibly and within my limits',
  'Apply controls every time: no shortcuts, no exceptions',
  'Question unusual, urgent or suspicious requests',
  'Check suppliers, invoices and bank details before approving',
  'Never approve my own transactions',
  'Declare every conflict of interest, now and when one arises',
  'Report fraud concerns straight away through the right channel',
  'Set the tone for my team: honest behaviour and a speak-up culture',
  'Complete this programme again every year',
  'Cooperate fully with any investigation',
  'Protect anyone who raises a concern from retaliation',
];

export const CONFLICT_OF_INTEREST_PROMPT =
  'Do you, or a close family member or friend, have any financial or personal interest in a supplier, contractor, customer or member of staff that you approve spending for?';
