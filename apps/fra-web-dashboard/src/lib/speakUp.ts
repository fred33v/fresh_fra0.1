// Labels shared by the public speak-up pages and the case log (GovS 013 reporting routes)

export const CATEGORY_LABELS: Record<string, string> = {
  fraud: 'Fraud', bribery: 'Bribery', corruption: 'Corruption', theft: 'Theft', procurement: 'Procurement or supplier fraud',
  payroll: 'Payroll or expenses', cyber: 'Cyber-enabled fraud', conflict_of_interest: 'Undeclared conflict of interest', other: 'Something else',
};
export const RELATIONSHIP_LABELS: Record<string, string> = {
  employee: 'I work here', contractor: 'I am a contractor or agency worker', supplier: 'I work for a supplier',
  public: 'I am a member of the public', other: 'Other',
};

export const STATUS_LABELS: Record<string, string> = {
  new: 'New', triage: 'Triage', investigating: 'Investigating', referred: 'Referred', closed: 'Closed',
};
export const REFERRAL_LABELS: Record<string, string> = {
  investigator: 'Counter fraud investigator', police: 'Police', action_fraud: 'Report Fraud (Action Fraud)', nhscfa: 'NHS Counter Fraud Authority',
  regulator: 'Regulator', other: 'Other',
};
