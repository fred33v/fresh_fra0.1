// Web versions of the self-assessment checklist and the 90-day roadmap.
// Same wording as public/resources/*.pdf, which stay downloadable for anyone who wants paper.

export interface ChecklistItem {
  id: string;
  text: string;
  /** Shown as "Suggested owner" on the roadmap */
  owner?: string;
}

export interface ChecklistGroup {
  id: string;
  title: string;
  items: ChecklistItem[];
}

export const SELF_ASSESSMENT_CHECKLIST: ChecklistGroup[] = [
  {
    id: 'commitment', title: '1. Top-level commitment', items: [
      { id: 'c1', text: 'A named board member or senior manager is accountable for fraud prevention.' },
      { id: 'c2', text: 'The board has approved a fraud prevention policy and reviewed it in the last 12 months.' },
      { id: 'c3', text: 'Senior leaders have communicated that fraud, including fraud that would benefit the organisation, is not tolerated.' },
      { id: 'c4', text: 'Fraud risk is a standing item for the board or audit committee at least once a year.' },
    ],
  },
  {
    id: 'risk', title: '2. Risk assessment', items: [
      { id: 'r1', text: 'A documented fraud risk assessment has been completed in the last 12 months.' },
      { id: 'r2', text: 'It covers procurement, payments, payroll, expenses, income, IT systems and anyone who acts on your behalf.' },
      { id: 'r3', text: 'Each risk has an inherent score, the controls that reduce it, and a residual score.' },
      { id: 'r4', text: 'Each significant risk has a named owner on a risk register.' },
      { id: 'r5', text: 'The assessment is repeated after significant change, such as a new system, service or restructure.' },
    ],
  },
  {
    id: 'prevention', title: '3. Proportionate prevention procedures', items: [
      { id: 'p1', text: 'No single person can raise, approve and pay a transaction (segregation of duties).' },
      { id: 'p2', text: 'Approval limits are written down, and high-value payments need two approvers.' },
      { id: 'p3', text: 'Changes to supplier or staff bank details are confirmed by calling a number already on file.' },
      { id: 'p4', text: 'Bank accounts and budgets are reconciled monthly by someone independent of the payments.' },
      { id: 'p5', text: 'Every high residual risk has an action plan with a deadline.' },
    ],
  },
  {
    id: 'diligence', title: '4. Due diligence', items: [
      { id: 'd1', text: 'New suppliers are checked before first payment (company registration, ownership, bank account).' },
      { id: 'd2', text: 'Agents, contractors and others who act on your behalf are identified and checked in proportion to risk.' },
      { id: 'd3', text: 'Staff in high-risk roles are vetted on appointment.' },
      { id: 'd4', text: 'Conflicts of interest and gifts or hospitality are declared and recorded in registers.' },
    ],
  },
  {
    id: 'communication', title: '5. Communication, including training', items: [
      { id: 't1', text: 'All staff have completed fraud awareness training in the last 12 months.' },
      { id: 't2', text: 'Staff in finance, procurement and other high-risk roles have had role-specific training.' },
      { id: 't3', text: 'There is a confidential way to report concerns, including anonymously, and staff know about it.' },
      { id: 't4', text: 'Contractors and members of the public can also report concerns.' },
    ],
  },
  {
    id: 'monitoring', title: '6. Monitoring and review', items: [
      { id: 'm1', text: 'The risk register is reviewed at least every quarter.' },
      { id: 'm2', text: 'Suspected fraud is recorded in an incident log with the action taken and the outcome.' },
      { id: 'm3', text: 'Losses and recoveries are recorded.' },
      { id: 'm4', text: 'Controls in the highest-risk areas are tested, for example by audit sampling or data matching.' },
      { id: 'm5', text: 'Lessons from incidents lead to changes in controls or training.' },
    ],
  },
];

export const NINETY_DAY_ROADMAP: ChecklistGroup[] = [
  {
    id: 'days-1-30', title: 'Days 1–30: Mobilise and assess', items: [
      { id: 'a1', text: 'Name the board-level person accountable for fraud prevention.', owner: 'Board / Chair' },
      { id: 'a2', text: 'Agree the scope: business areas, subsidiaries, and the agents and contractors who act for you.', owner: 'Accountable person' },
      { id: 'a3', text: 'Complete the fraud risk assessment and record each risk with an owner.', owner: 'Finance lead' },
      { id: 'a4', text: 'Make sure staff, contractors and the public can report concerns, including anonymously.', owner: 'HR / Governance' },
      { id: 'a5', text: 'Start a log of suspected fraud incidents and their outcomes.', owner: 'Counter fraud lead' },
    ],
  },
  {
    id: 'days-31-60', title: 'Days 31–60: Design and implement', items: [
      { id: 'b1', text: 'Agree an action plan for every high residual risk, with deadlines.', owner: 'Risk owners' },
      { id: 'b2', text: 'Approve the counter fraud policy and response plan, and the gifts, hospitality and conflicts of interest policies.', owner: 'Board' },
      { id: 'b3', text: 'Tighten core controls: segregation of duties, approval limits, call-back checks on bank detail changes.', owner: 'Finance lead' },
      { id: 'b4', text: 'Introduce proportionate due diligence for new suppliers and other associated persons.', owner: 'Procurement lead' },
      { id: 'b5', text: 'Start fraud awareness training for all staff, beginning with high-risk roles.', owner: 'HR / Training' },
    ],
  },
  {
    id: 'days-61-90', title: 'Days 61–90: Monitor and report', items: [
      { id: 'e1', text: 'Run one detection exercise in the highest-risk area, such as data matching on payroll or suppliers.', owner: 'Counter fraud lead' },
      { id: 'e2', text: 'Bring training completion to at least 80% of staff.', owner: 'HR / Training' },
      { id: 'e3', text: 'Review the risk register and progress on each action plan.', owner: 'Accountable person' },
      { id: 'e4', text: 'Report to the board: risks, actions, training, incidents, losses and recoveries.', owner: 'Accountable person' },
      { id: 'e5', text: 'Set the cycle: quarterly register reviews and a full reassessment at least every year.', owner: 'Board' },
    ],
  },
];
