export interface Myth {
  id: string;
  myth: string;
  reality: string;
}

export const myths: Myth[] = [
  {
    id: '1',
    myth: 'Fraud only happens in large organisations',
    reality:
      'Small organisations suffer higher fraud losses (as % of revenue) due to fewer resources for controls, greater trust/familiarity, and lack of segregation of duties.',
  },
  {
    id: '2',
    myth: 'Trusted, long-serving employees won\'t commit fraud',
    reality:
      'Average fraudster tenure is 8+ years (ACFE). Trust creates opportunity. Pressure and rationalization can affect anyone, regardless of tenure.',
  },
  {
    id: '3',
    myth: 'We have an audit—fraud would be detected',
    reality:
      'Audits sample transactions (don\'t check 100%). Auditors aren\'t forensic investigators. Only 15% of fraud is detected by external audit vs. 40% by whistleblowing.',
  },
  {
    id: '4',
    myth: 'Fraud prevention is Finance\'s job',
    reality:
      'Budget-holders approve 85% of fraud transactions. YOU are the front line. Finance provides oversight, but you approve day-to-day spending.',
  },
  {
    id: '5',
    myth: 'Small amounts don\'t matter',
    reality:
      'Small frauds escalate as fraudster becomes emboldened. They signal weak controls and attract more fraud. £100/week = £5,200/year. Cultural impact: "if they get away with it, why can\'t I?"',
  },
];
