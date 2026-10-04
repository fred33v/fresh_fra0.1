// ============================================================
// Counter-fraud records for the GovS 013 components that are not
// derived from assessments: counter fraud strategy (2), identified
// loss (8), investigator access (9), detection activity (10), and
// gifts, hospitality and conflict of interest registers with their
// policies (12). One table holds every kind; each kind validates
// its own fields.
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

export const RECORD_SCHEMAS = {
  strategy,
  loss,
  investigator,
  detection,
  gift_hospitality: giftHospitality,
  conflict_of_interest: conflictOfInterest,
  policy,
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
