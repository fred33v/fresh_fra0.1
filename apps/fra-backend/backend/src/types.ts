import type { Context } from 'hono';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { jsonError } from './helpers.js';

// ── Domain types ────────────────────────────────────────────────

export type Role = 'employer' | 'employee' | 'admin';

export type User = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  organisationId: string;
  department?: string;
  createdAt: string;
};

export type AssessmentStatus = 'draft' | 'in_progress' | 'submitted' | 'completed';

export type Assessment = {
  id: string;
  organisationId: string;
  createdByUserId: string;
  title: string;
  status: AssessmentStatus;
  answers: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
};

export type Organisation = {
  id: string;
  name: string;
  createdByUserId: string;
  employeeCount?: string;
  region?: string;
  industry?: string;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseStatus = 'requires_confirmation' | 'succeeded' | 'failed' | 'refunded';

export type Purchase = {
  id: string;
  organisationId: string;
  userId: string;
  packageId: string;
  status: PurchaseStatus;
  paymentIntentId?: string;
  clientSecret?: string;
  amountCents: number;
  currency: string;
  createdAt: string;
  confirmedAt?: string;
};

export type Package = {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  currency: string;
  keypassAllowance: number;
  features: string[];
  isActive: boolean;
  sortOrder: number;
};

export type KeypassStatus = 'available' | 'used' | 'revoked' | 'expired';

export type Keypass = {
  code: string;
  organisationId: string;
  status: KeypassStatus;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
};

export type RateLimitConfig = {
  windowMs: number;
  max: number;
};

// ── DB row types ────────────────────────────────────────────────

export type DbAssessmentRow = {
  id: string;
  organisation_id: string;
  created_by_user_id: string;
  title: string;
  status: AssessmentStatus;
  answers: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
};

export type DbUserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  role: Role;
  organisation_id: string;
  department: string | null;
  created_at: string;
};

export type DbKeypassRow = {
  code: string;
  organisation_id: string;
  status: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  used_by_user_id: string | null;
};

export type DbEmployeeDashboardRow = {
  id: string;
  email: string;
  name: string;
  role: Role;
  organisation_id: string;
  department: string | null;
  created_at: string;
  assessment_id: string | null;
  assessment_status: AssessmentStatus | null;
  assessment_started: string | null;
  assessment_completed: string | null;
  answer_count: number;
};

export interface EmployeeDashboardRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  department: string | null;
  createdAt: string;
  assessmentId: string | null;
  assessmentStatus: AssessmentStatus | null;
  assessmentStarted: string | null;
  assessmentCompleted: string | null;
  answerCount: number;
}

// ── JWT config ──────────────────────────────────────────────────

export let usingDevRefreshSecret = false;

function resolveRefreshSecret(): jwt.Secret {
  if (process.env.JWT_REFRESH_SECRET) return process.env.JWT_REFRESH_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_REFRESH_SECRET environment variable must be set in production');
  }
  usingDevRefreshSecret = true;
  return require('crypto').randomBytes(64).toString('hex');
}

export const refreshSecret: jwt.Secret = resolveRefreshSecret();
export const accessTokenExpiry = (process.env.JWT_EXPIRES_IN ?? '30m') as jwt.SignOptions['expiresIn'];
export const refreshTokenExpiry = (process.env.JWT_REFRESH_EXPIRES_IN ?? '7d') as jwt.SignOptions['expiresIn'];

// ── UUID validation ─────────────────────────────────────────────

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function requireUUIDParam(c: Context, paramName: string): string | Response {
  const value = c.req.param(paramName);
  if (!isValidUUID(value)) {
    return jsonError(c, 400, 'INVALID_PARAM', `Invalid ${paramName} format`);
  }
  return value;
}

// ── Account lockout constants ───────────────────────────────────

export const LOCKOUT_PREFIX = 'lockout:';
export const LOCKOUT_MAX_ATTEMPTS = 5;
export const LOCKOUT_WINDOW_SECONDS = 15 * 60; // 15 minutes

// ── Security constants ──────────────────────────────────────────

export const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES ?? 1_048_576); // 1 MB default
export const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// ── Password reset constants ────────────────────────────────────

export const PASSWORD_RESET_PREFIX = 'pwreset:';
export const PASSWORD_RESET_TTL_SECONDS = 3600; // 1 hour

// ── Rate limit constants ────────────────────────────────────────

export const RATE_LIMITS = {
  AUTH_WINDOW_MS: 15 * 60 * 1000,  // 15 minutes
  SIGNUP_MAX: 10,
  LOGIN_MAX: 20,
  FORGOT_PASSWORD_MAX: 5,
  RESET_PASSWORD_MAX: 5,
  KEYPASS_WINDOW_MS: 60 * 1000,    // 1 minute
  KEYPASS_MAX: 3,
  PURCHASE_WINDOW_MS: 60 * 60 * 1000,   // 1 hour
  PURCHASE_MAX: 10,
  REPORT_WINDOW_MS: 60 * 60 * 1000,     // 1 hour
  REPORT_MAX: 5,
  KEYPASS_GENERATE_WINDOW_MS: 60 * 60 * 1000, // 1 hour
  KEYPASS_GENERATE_MAX: 10,
  REFRESH_WINDOW_MS: 60 * 1000,  // 1 minute
  REFRESH_MAX: 10,
  PAYMENT_INTENT_WINDOW_MS: 60 * 1000,  // 1 minute
  PAYMENT_INTENT_MAX: 10,
  S3_PRESIGN_WINDOW_MS: 60 * 1000,  // 1 minute
  S3_PRESIGN_MAX: 20,
  CERTIFICATE_WINDOW_MS: 60 * 1000,  // 1 minute
  CERTIFICATE_MAX: 5,
  WORKSHOP_WRITE_WINDOW_MS: 60 * 1000,  // 1 minute
  WORKSHOP_WRITE_MAX: 30,
  WORKSHOP_JOIN_WINDOW_MS: 60 * 1000,   // 1 minute
  WORKSHOP_JOIN_MAX: 10,
  WEBHOOK_WINDOW_MS: 60 * 1000,  // 1 minute
  WEBHOOK_MAX: 100,
} as const;

// ── Keypass grace period ────────────────────────────────────────

export const KEYPASS_GRACE_PERIOD_DAYS = 7;

// ── Package recommendation thresholds ──────────────────────────

export const RISK_THRESHOLDS = {
  HIGH_ANSWER_COUNT: 15,   // >= 15 answers → recommend enterprise (pkg_full)
  MEDIUM_ANSWER_COUNT: 5,  // >= 5 answers  → recommend professional (pkg_training)
} as const;

// ── Fallback packages ───────────────────────────────────────────

export const FALLBACK_PACKAGES: Package[] = [
  { id: 'pkg_basic', name: 'Starter', description: 'Fraud risk assessment with downloadable PDF report', priceCents: 79500, currency: 'gbp', keypassAllowance: 1, features: ['Single fraud risk assessment across 13 key areas', 'Downloadable PDF health check report', 'ECCTA 2023 compliance snapshot', '1 key-pass included'], isActive: true, sortOrder: 1 },
  { id: 'pkg_training', name: 'Professional', description: 'FRA health check + staff awareness training', priceCents: 179900, currency: 'gbp', keypassAllowance: 50, features: ['Everything in Starter', '50 employee key-passes', 'Staff awareness training with certificates', 'Quarterly reassessment', 'Email support'], isActive: true, sortOrder: 2 },
  { id: 'pkg_full', name: 'Enterprise', description: 'Complete fraud risk management suite with live dashboard', priceCents: 499500, currency: 'gbp', keypassAllowance: -1, features: ['Everything in Professional', 'Unlimited employee key-passes', 'Real-time monitoring dashboard', 'Risk register and action tracking', 'API access', 'Priority support', 'Compliance reports'], isActive: true, sortOrder: 3 },
];

// ── Pagination ─────────────────────────────────────────────────

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

export function parsePagination(query: Record<string, string | undefined>): { page: number; pageSize: number; offset: number } {
  const page = Math.max(1, Math.min(10_000_000, parseInt(query.page ?? '1', 10) || 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(query.pageSize ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function paginate<T>(items: T[], page: number, pageSize: number): { items: T[]; total: number; page: number; pageSize: number; totalPages: number } {
  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const offset = (page - 1) * pageSize;
  return { items: items.slice(offset, offset + pageSize), total, page, pageSize, totalPages };
}

// ── Zod schemas ─────────────────────────────────────────────────

export const passwordSchema = z.string().min(12).refine(
  (pw) => /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw),
  { message: 'Password must contain uppercase, lowercase, and a number' }
);

export const signupSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  name: z.string().min(1).max(200),
  organisationName: z.string().min(1).max(200).optional(),
  jobTitle: z.string().max(200).optional(),
  sector: z.enum(['public', 'charity', 'private']).optional(),
  workshopRole: z.enum(['facilitator', 'participant']).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordSchema,
});

const answersSchema = z.record(
  z.string().max(200),
  z.unknown(),
).optional().refine(
  (val) => !val || Object.keys(val).length <= 500,
  { message: 'Answers object exceeds 500 key limit' },
).refine(
  (val) => !val || JSON.stringify(val).length <= 100_000,
  { message: 'Answers payload exceeds 100 KB size limit' },
);

export const assessmentCreateSchema = z.object({
  title: z.string().min(1).max(200).default('Fraud Risk Assessment'),
  answers: answersSchema,
});

export const assessmentPatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  answers: answersSchema,
  status: z.enum(['draft', 'in_progress', 'submitted', 'completed']).optional(),
});

export const keypassGenerateSchema = z.object({
  quantity: z.number().int().min(1).max(500).default(1),
  expiresInDays: z.number().int().min(1).max(365).default(30),
});

const keypassCodeSchema = z.string().min(6).max(64).regex(/^[A-Z0-9]+$/, 'Code must be uppercase alphanumeric');

export const keypassValidateSchema = z.object({
  code: keypassCodeSchema,
});

export const keypassBulkSchema = z.object({
  codes: z.array(keypassCodeSchema).min(1).max(100),
});

export const keypassUseSchema = z.object({
  code: keypassCodeSchema,
  email: z.string().email().optional(),
  name: z.string().min(1).optional(),
});

const packageIdSchema = z.enum(['pkg_basic', 'pkg_training', 'pkg_full']);

export const paymentCreateIntentSchema = z.object({
  packageId: packageIdSchema,
  currency: z.string().min(3).max(3).default('gbp'),
});

export const purchasesCreateSchema = z.object({
  packageId: packageIdSchema,
});

export const purchasesConfirmSchema = z.object({
  paymentIntentId: z.string().min(1).optional(),
});

export const stripeWebhookSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  data: z.unknown().optional(),
});

export const s3PresignUploadSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1).max(255),
  sizeBytes: z.number().int().positive(),
});

export const s3PresignDownloadSchema = z.object({
  key: z.string().min(1).max(1024),
});

export const s3PromoteUploadSchema = z.object({
  sourceKey: z.string().min(1).max(1024),
  filename: z.string().min(1).max(255).optional(),
});

export const profileUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  department: z.string().max(255).optional(),
}).refine((data) => data.name !== undefined || data.department !== undefined, {
  message: 'At least one field must be provided',
});
