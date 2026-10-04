// ============================================================
// Counter-fraud records for the GovS 013 components that are not
// derived from assessments: counter fraud strategy (2), identified
// loss (8), investigator access (9), detection activity (10), and
// gifts, hospitality and conflict of interest registers with their
// policies (12), the reporting routes (7) beside the speak-up intake,
// the associated persons whose due diligence ECCTA principle 4 expects, and
// the board minutes and tone-from-the-top statements behind principle 1.
// One table holds every kind; each kind validates its own fields.
// ============================================================

import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const gbp = z.number().min(0).max(10_000_000_000);
const text = (max: number) => z.string().trim().min(1).max(max);
const note = (max: number) => z.string().trim().max(max).optional();
// Shown as a link in the dashboard, so only https documents are accepted
const documentUrl = z.string().url().max(2000).refine((u) => u.startsWith('https://'), 'Use an https:// link').optional();

export const STRATEGY_STATUSES = ['draft', 'approved', 'submitted'] as const;
export const LOSS_CATEGORIES = ['fraud', 'bribery', 'corruption', 'error'] as const;
export const LOSS_TYPES = ['detected', 'prevented'] as const;
export const INVESTIGATOR_ARRANGEMENTS = ['in_house', 'contracted', 'shared_service'] as const;
export const DETECTION_METHODS = ['data_analytics', 'data_matching', 'audit_sample', 'loss_measurement', 'other'] as const;
export const DETECTION_STATUSES = ['planned', 'in_progress', 'completed'] as const;
export const INTEREST_TYPES = ['financial', 'non_financial_professional', 'non_financial_personal', 'indirect'] as const;
export const ROUTE_CHANNELS = ['online_form', 'phone', 'email', 'post', 'in_person', 'external'] as const;
export const ROUTE_AUDIENCES = ['staff', 'staff_and_contractors', 'everyone'] as const;
export const ASSOCIATE_TYPES = ['agent', 'contractor', 'supplier', 'subsidiary', 'intermediary', 'joint_venture', 'other'] as const;
export const ASSOCIATE_RISK_LEVELS = ['low', 'medium', 'high'] as const;
export type AssociateRisk = (typeof ASSOCIATE_RISK_LEVELS)[number];

/** Due-diligence checks, in the order they are shown. */
export const DUE_DILIGENCE_CHECKS = {
  identityVerified: 'Identity verified',
  ownershipChecked: 'Ownership and control checked',
  sanctionsScreened: 'Sanctions and adverse media screened',
  referencesChecked: 'References or track record checked',
  contractClauses: 'Anti-fraud clauses in the contract',
  trainingProvided: 'Fraud prevention expectations communicated or trained',
} as const;
export type DueDiligenceCheck = keyof typeof DUE_DILIGENCE_CHECKS;

/** Checks each risk level needs: proportionate, as the Home Office guidance expects. */
export const REQUIRED_CHECKS: Record<AssociateRisk, DueDiligenceCheck[]> = {
  low: ['identityVerified'],
  medium: ['identityVerified', 'ownershipChecked', 'sanctionsScreened', 'contractClauses'],
  high: ['identityVerified', 'ownershipChecked', 'sanctionsScreened', 'referencesChecked', 'contractClauses', 'trainingProvided'],
};

export const OVERSIGHT_BODIES = ['board', 'audit_committee', 'risk_committee', 'senior_leadership'] as const;
/** Bodies whose minutes show board-level oversight (senior leadership alone does not) */
export const BOARD_BODIES: readonly string[] = ['board', 'audit_committee', 'risk_committee'];
export const STATEMENT_AUDIENCES = ['all_staff', 'staff_and_associates', 'everyone'] as const;
export const STATEMENT_CHANNELS = ['email', 'intranet', 'staff_meeting', 'website', 'other'] as const;

export const POLICY_TYPES = ['counter_fraud', 'response_plan', 'gifts_hospitality', 'conflicts_of_interest', 'whistleblowing'] as const;

const strategy = z.object({
  title: text(200),
  periodStart: isoDate,
  periodEnd: isoDate,
  status: z.enum(STRATEGY_STATUSES),
  approvedBy: note(200),
  approvedAt: isoDate.optional(),
  submittedToCentreAt: isoDate.optional(),
  summary: note(5000),
  documentUrl,
}).strict()
  .refine((s) => s.periodEnd >= s.periodStart, { message: 'The period must end after it starts', path: ['periodEnd'] })
  .refine((s) => s.status === 'draft' || !!s.approvedAt, { message: 'Give the approval date', path: ['approvedAt'] })
  .refine((s) => s.status !== 'submitted' || !!s.submittedToCentreAt, { message: 'Give the date it was submitted', path: ['submittedToCentreAt'] });

const loss = z.object({
  category: z.enum(LOSS_CATEGORIES),
  lossType: z.enum(LOSS_TYPES),
  description: text(5000),
  identifiedAt: isoDate,
  amountGbp: gbp,
  recoveredGbp: gbp.default(0),
  incidentId: z.string().uuid().optional(),
  reportedToCentreAt: isoDate.optional(),
}).strict()
  .refine((l) => l.recoveredGbp <= l.amountGbp, { message: 'Recovered cannot exceed the amount', path: ['recoveredGbp'] });

const investigator = z.object({
  name: text(200),
  provider: note(200),
  accreditation: text(200),
  arrangement: z.enum(INVESTIGATOR_ARRANGEMENTS),
  contactEmail: z.string().email().max(254).optional(),
  agreementEndsAt: isoDate.optional(),
}).strict();

const detection = z.object({
  title: text(200),
  riskArea: note(100),
  method: z.enum(DETECTION_METHODS),
  plannedFor: isoDate,
  status: z.enum(DETECTION_STATUSES),
  completedAt: isoDate.optional(),
  findings: note(5000),
  issuesFound: z.number().int().min(0).max(1_000_000).optional(),
  lossIdentifiedGbp: gbp.optional(),
}).strict()
  .refine((d) => d.status !== 'completed' || !!d.completedAt, { message: 'Give the completion date', path: ['completedAt'] });

const giftHospitality = z.object({
  personName: text(200),
  direction: z.enum(['received', 'offered']),
  counterparty: text(200),
  description: text(2000),
  valueGbp: gbp,
  date: isoDate,
  decision: z.enum(['accepted', 'declined']),
  approvedBy: note(200),
}).strict();

const conflictOfInterest = z.object({
  personName: text(200),
  interestType: z.enum(INTEREST_TYPES),
  description: text(2000),
  declaredAt: isoDate,
  mitigation: note(2000),
  status: z.enum(['active', 'ended']),
  reviewedAt: isoDate.optional(),
}).strict();

const policy = z.object({
  policyType: z.enum(POLICY_TYPES),
  title: text(200),
  version: note(50),
  approvedBy: note(200),
  approvedAt: isoDate,
  reviewDue: isoDate,
  documentUrl,
}).strict()
  .refine((p) => p.reviewDue >= p.approvedAt, { message: 'The review date must follow approval', path: ['reviewDue'] });

const reportingRoute = z.object({
  name: text(200),
  channel: z.enum(ROUTE_CHANNELS),
  contact: text(500),
  audience: z.enum(ROUTE_AUDIENCES),
  anonymousAllowed: z.enum(['yes', 'no']),
  externalBody: note(200),
  publishedAt: isoDate.optional(),
}).strict();

const checkAnswer = z.enum(['yes', 'no', 'not_applicable']).default('no');

const associatedPerson = z.object({
  name: text(200),
  associateType: z.enum(ASSOCIATE_TYPES),
  servicesProvided: text(1000),
  riskLevel: z.enum(ASSOCIATE_RISK_LEVELS),
  identityVerified: checkAnswer,
  ownershipChecked: checkAnswer,
  sanctionsScreened: checkAnswer,
  referencesChecked: checkAnswer,
  contractClauses: checkAnswer,
  trainingProvided: checkAnswer,
  reviewedAt: isoDate.optional(),
  notes: note(2000),
}).strict();

const boardMinute = z.object({
  meetingDate: isoDate,
  body: z.enum(OVERSIGHT_BODIES),
  itemsDiscussed: text(2000),
  decisions: note(5000),
  minuteReference: note(100),
  documentUrl,
}).strict();

const toneStatement = z.object({
  title: text(200),
  issuedBy: text(200),
  issuedAt: isoDate,
  audience: z.enum(STATEMENT_AUDIENCES),
  channel: z.enum(STATEMENT_CHANNELS),
  statement: text(5000),
  documentUrl,
}).strict();

export const RECORD_SCHEMAS = {
  strategy,
  loss,
  investigator,
  detection,
  gift_hospitality: giftHospitality,
  conflict_of_interest: conflictOfInterest,
  policy,
  reporting_route: reportingRoute,
  associated_person: associatedPerson,
  board_minute: boardMinute,
  tone_statement: toneStatement,
} as const;

export type CounterFraudKind = keyof typeof RECORD_SCHEMAS;
export const COUNTER_FRAUD_KINDS = Object.keys(RECORD_SCHEMAS) as CounterFraudKind[];
export type RecordData<K extends CounterFraudKind> = z.infer<(typeof RECORD_SCHEMAS)[K]>;

export type CounterFraudRecord<K extends CounterFraudKind = CounterFraudKind> = {
  id: string;
  organisationId: string;
  kind: K;
  data: RecordData<K>;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export function isCounterFraudKind(value: string): value is CounterFraudKind {
  return (COUNTER_FRAUD_KINDS as string[]).includes(value);
}

/** Validates a record's fields for its kind; returns the cleaned data or the first problem. */
export function parseRecordData(kind: CounterFraudKind, data: unknown):
  { ok: true; data: RecordData<CounterFraudKind> } | { ok: false; message: string } {
  const parsed = RECORD_SCHEMAS[kind].safeParse(data);
  if (parsed.success) return { ok: true, data: parsed.data };
  const issue = parsed.error.issues[0];
  return { ok: false, message: issue ? `${issue.path.join('.') || kind}: ${issue.message}` : `Invalid ${kind} record` };
}

export function recordsOf<K extends CounterFraudKind>(records: CounterFraudRecord[], kind: K): CounterFraudRecord<K>[] {
  return records.filter((r): r is CounterFraudRecord<K> => r.kind === kind);
}

export type DueDiligenceStatus = {
  required: number;
  done: number;
  complete: boolean;
  /** Labels of the required checks not yet done */
  outstanding: string[];
};

/** How far an associated person's due diligence has got against what their risk level requires. */
export function dueDiligenceStatus(data: RecordData<'associated_person'>): DueDiligenceStatus {
  const required = REQUIRED_CHECKS[data.riskLevel];
  const outstanding = required.filter((c) => data[c] !== 'yes' && data[c] !== 'not_applicable');
  return {
    required: required.length,
    done: required.length - outstanding.length,
    complete: outstanding.length === 0,
    outstanding: outstanding.map((c) => DUE_DILIGENCE_CHECKS[c]),
  };
}
