import { z } from 'zod';
const text = (max: number) => z.string().trim().min(2).max(max);
export const PROVIDER_ENGAGEMENT_MODEL = 'independent_no_minimum';
export const PROVIDER_ENGAGEMENT_VERSION = 'independent-engagement-2026-11-v1';
const answer = z.enum(['yes', 'no', 'not_sure']);
export const independentEngagementSchema = z
  .object({
    model: z.literal(PROVIDER_ENGAGEMENT_MODEL).default(PROVIDER_ENGAGEMENT_MODEL),
    formVersion: z.literal(PROVIDER_ENGAGEMENT_VERSION).default(PROVIDER_ENGAGEMENT_VERSION),
    legalStructure: z.enum([
      'sole_trader',
      'limited_company',
      'partnership',
      'limited_liability_partnership',
    ]),
    companyNumber: z.string().trim().max(32).default(''),
    businessAddress: z
      .object({
        line1: text(160),
        line2: z.string().trim().max(160).default(''),
        city: text(120),
        postalCode: z.string().trim().max(24).default(''),
      })
      .strict(),
    vatRegistered: z.enum(['yes', 'no']),
    vatNumber: z.string().trim().max(32).default(''),
    availability: z.string().trim().min(10).max(1000),
    declineAssignments: answer,
    deliveryControl: z.enum(['self', 'client', 'shared', 'not_sure']),
    otherClients: answer,
    personalService: z.enum(['required', 'substitution_by_agreement', 'not_sure']),
    declarationName: text(120),
    noMinimumAccepted: z.literal(true),
    commissionAccepted: z.literal(true),
    informationAccurate: z.literal(true),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      ['limited_company', 'limited_liability_partnership'].includes(value.legalStructure) &&
      value.companyNumber.length < 2
    )
      ctx.addIssue({
        code: 'custom',
        path: ['companyNumber'],
        message: 'Enter the company or LLP registration number',
      });
    if (value.vatRegistered === 'yes' && value.vatNumber.length < 4)
      ctx.addIssue({
        code: 'custom',
        path: ['vatNumber'],
        message: 'Enter your declared VAT registration number',
      });
    if (value.vatRegistered === 'no' && value.vatNumber !== '')
      ctx.addIssue({
        code: 'custom',
        path: ['vatNumber'],
        message: 'Clear the VAT number when not VAT registered',
      });
  });
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
    engagement: independentEngagementSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const normalise = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB');
    if (normalise(value.fullName) !== normalise(value.engagement.declarationName))
      ctx.addIssue({
        code: 'custom',
        path: ['engagement', 'declarationName'],
        message: 'Type the same full name as in your application',
      });
    if (value.country === 'GB' && !value.engagement.businessAddress.postalCode)
      ctx.addIssue({
        code: 'custom',
        path: ['engagement', 'businessAddress', 'postalCode'],
        message: 'Enter your business postcode',
      });
  });

export type CandidateProfile = z.infer<typeof providerProfileSchema>;
