import { z } from 'zod';
export const PROVIDER_TERMS_VERSION = 'provider-programme-2026-11';
export const PROVIDER_COMMISSION_BPS = 1700;
export const PROVIDER_STATUSES = [
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'suspended',
] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];
const text = (max: number) => z.string().trim().min(2).max(max);
export const providerProfileSchema = z
  .object({
    fullName: text(120),
    businessName: text(160),
    country: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, 'Use a two-letter country code'),
    kind: z.enum(['professional', 'referrer', 'both']),
    website: z
      .union([
        z.literal(''),
        z
          .url()
          .max(2048)
          .refine((value) => {
            try {
              const url = new URL(value);
              return url.protocol === 'https:' && !url.username && !url.password;
            } catch {
              return false;
            }
          }, 'Use an HTTPS website without embedded credentials'),
      ])
      .default(''),
    expertise: z
      .array(z.enum(['fraud_prevention', 'risk_assessment', 'training', 'investigation']))
      .min(1)
      .max(4)
      .refine((values) => new Set(values).size === values.length, 'Choose each area once'),
    experience: z.string().trim().min(30).max(3000),
  })
  .strict();
export const providerSubmissionSchema = z
  .object({
    version: z.number().int().min(0).max(2147483646),
    profile: providerProfileSchema,
    acknowledged: z.literal(true),
  })
  .strict();
export const providerReviewSchema = z
  .object({
    version: z.number().int().min(1).max(2147483646),
    status: z.enum(['under_review', 'approved', 'rejected', 'suspended']),
    message: z.string().trim().min(3).max(2000),
  })
  .strict();
export const reviewTransitions: Record<ProviderStatus, readonly ProviderStatus[]> = {
  submitted: ['under_review', 'approved', 'rejected'],
  under_review: ['approved', 'rejected'],
  approved: ['suspended'],
  rejected: [],
  suspended: ['under_review', 'approved', 'rejected'],
};
