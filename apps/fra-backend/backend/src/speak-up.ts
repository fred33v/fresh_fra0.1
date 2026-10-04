// ============================================================
// Speak-up (whistleblowing) intake — GovS 013 component 7, reporting routes.
// Anyone with an organisation's intake link can report suspected fraud,
// bribery or corruption, anonymously if they choose. They receive a case
// reference and a one-time access key to follow the case and exchange
// messages with the people handling it; only a hash of the key is stored.
// ============================================================

import crypto from 'node:crypto';
import { z } from 'zod';

export const REPORT_CATEGORIES = [
  'fraud', 'bribery', 'corruption', 'theft', 'procurement', 'payroll', 'cyber', 'conflict_of_interest', 'other',
] as const;
export const REPORTER_RELATIONSHIPS = ['employee', 'contractor', 'supplier', 'public', 'other'] as const;
export const REPORT_STATUSES = ['new', 'triage', 'investigating', 'referred', 'closed'] as const;
export const REFERRAL_TARGETS = ['investigator', 'police', 'action_fraud', 'nhscfa', 'regulator', 'other'] as const;

export type ReportStatus = (typeof REPORT_STATUSES)[number];

/** What the reporter sees: the case is moving without revealing internal detail. */
export const PUBLIC_STATUS: Record<ReportStatus, string> = {
  new: 'Received',
  triage: 'Being reviewed',
  investigating: 'Under investigation',
  referred: 'Referred to an appropriate body',
  closed: 'Closed',
};

/** A new report must be reviewed within this many days. */
export const TRIAGE_DAYS = 7;

const optionalText = (max: number) => z.string().trim().max(max).optional().transform((v) => (v ? v : undefined));

export const reportSubmissionSchema = z.object({
  category: z.enum(REPORT_CATEGORIES),
  description: z.string().trim().min(20, 'Describe what happened in at least 20 characters').max(10_000),
  occurredWhen: optionalText(200),
  location: optionalText(200),
  peopleInvolved: optionalText(2000),
  amountGbp: z.number().min(0).max(10_000_000_000).optional(),
  relationship: z.enum(REPORTER_RELATIONSHIPS),
  anonymous: z.boolean(),
  name: optionalText(200),
  email: z.string().trim().email().max(254).optional(),
  phone: optionalText(40),
}).strict();

export type ReportSubmission = z.infer<typeof reportSubmissionSchema>;

export const caseAccessSchema = z.object({
  reference: z.string().trim().toUpperCase().regex(/^SU-[A-Z0-9]{8}$/, 'Invalid case reference'),
  accessKey: z.string().trim().min(16).max(64),
}).strict();

export const messageBodySchema = z.string().trim().min(1).max(5000);

export const caseUpdateSchema = z.object({
  status: z.enum(REPORT_STATUSES).optional(),
  assignedUserId: z.string().uuid().nullable().optional(),
  referral: z.enum(REFERRAL_TARGETS).nullable().optional(),
  referralNotes: z.string().trim().max(5000).nullable().optional(),
  outcome: z.string().trim().max(10_000).nullable().optional(),
}).strict().refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Nothing to change' });

export const intakeSettingsSchema = z.object({
  enabled: z.boolean(),
  intro: z.string().trim().max(2000).optional(),
  regenerateLink: z.boolean().optional(),
}).strict();

export type SpeakUpIntake = {
  organisationId: string;
  token: string;
  enabled: boolean;
  intro?: string;
  createdAt: string;
  updatedAt: string;
};

export type SpeakUpReport = {
  id: string;
  organisationId: string;
  reference: string;
  accessKeyHash: string;
  category: (typeof REPORT_CATEGORIES)[number];
  description: string;
  occurredWhen?: string;
  location?: string;
  peopleInvolved?: string;
  amountGbp?: number;
  relationship: (typeof REPORTER_RELATIONSHIPS)[number];
  anonymous: boolean;
  reporterName?: string;
  reporterEmail?: string;
  reporterPhone?: string;
  status: ReportStatus;
  assignedUserId?: string;
  referral?: (typeof REFERRAL_TARGETS)[number];
  referralNotes?: string;
  outcome?: string;
  incidentId?: string;
  receivedAt: string;
  acknowledgedAt?: string;
  closedAt?: string;
  updatedAt: string;
};

export type SpeakUpMessage = {
  id: string;
  reportId: string;
  author: 'reporter' | 'handler';
  authorUserId?: string;
  body: string;
  createdAt: string;
};

// Unambiguous characters only: no 0/O or 1/I/L, so references can be read out over the phone
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomCode(length: number): string {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export const newCaseReference = () => `SU-${randomCode(8)}`;
/** 20 characters from a 31-symbol alphabet: about 99 bits, shown once to the reporter. */
export const newAccessKey = () => randomCode(20);
/** The organisation's intake link token: 32 url-safe characters. */
export const newIntakeToken = () => crypto.randomBytes(24).toString('base64url');

export const hashAccessKey = (key: string) => crypto.createHash('sha256').update(key.trim().toUpperCase()).digest('hex');

export function accessKeyMatches(key: string, storedHash: string): boolean {
  const given = Buffer.from(hashAccessKey(key), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  return given.length === stored.length && crypto.timingSafeEqual(given, stored);
}

/** Builds a new case from a validated submission; anonymous reports keep no contact details. */
export function buildReport(orgId: string, s: ReportSubmission, now = new Date().toISOString()):
  { report: SpeakUpReport; accessKey: string } {
  const accessKey = newAccessKey();
  return {
    accessKey,
    report: {
      id: crypto.randomUUID(), organisationId: orgId, reference: newCaseReference(), accessKeyHash: hashAccessKey(accessKey),
      category: s.category, description: s.description, occurredWhen: s.occurredWhen, location: s.location,
      peopleInvolved: s.peopleInvolved, amountGbp: s.amountGbp, relationship: s.relationship, anonymous: s.anonymous,
      reporterName: s.anonymous ? undefined : s.name,
      reporterEmail: s.anonymous ? undefined : s.email,
      reporterPhone: s.anonymous ? undefined : s.phone,
      status: 'new', receivedAt: now, updatedAt: now,
    },
  };
}

/** The case as handlers see it: everything except the access key hash. */
export function handlerView(r: SpeakUpReport) {
  const { accessKeyHash: _hash, ...rest } = r;
  return rest;
}

/** The case as the reporter sees it. */
export function reporterView(r: SpeakUpReport, messages: SpeakUpMessage[]) {
  return {
    reference: r.reference,
    status: PUBLIC_STATUS[r.status],
    receivedAt: r.receivedAt,
    updatedAt: r.updatedAt,
    messages: messages.map((m) => ({ author: m.author, body: m.body, createdAt: m.createdAt })),
  };
}
