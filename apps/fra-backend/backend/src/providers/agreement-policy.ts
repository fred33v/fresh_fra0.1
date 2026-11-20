import { z } from 'zod';
const text = (max: number, min = 10) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .regex(/^[\x20-\x7e\u00a0-\u00ff\r\n]+$/, 'Use printable Latin characters for the PDF');
export const agreementTermsSchema = z
  .object({
    operatorName: text(160, 2),
    operatorAddress: text(500),
    signatoryName: text(120, 2),
    signatoryEmail: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((s) => s.toLowerCase()),
    scope: text(4000),
    paymentTerms: text(2000),
    expenses: text(2000),
    confidentiality: text(3000),
    dataHandling: text(3000),
    termination: text(2000),
    governingLaw: text(500),
    arrangementsReview: text(2000),
  })
  .strict();
export const prepareAgreementSchema = z
  .object({
    version: z.number().int().positive(),
    previousAgreementId: z.uuid().nullable(),
    terms: agreementTermsSchema,
    termsReviewed: z.literal(true),
    statusReviewed: z.literal(true),
  })
  .strict();
export const engagementReadySchema = z
  .object({
    version: z.number().int().positive(),
    agreementId: z.uuid(),
    reviewNote: text(2000),
    contractReviewed: z.literal(true),
    statusReviewed: z.literal(true),
  })
  .strict();
export type AgreementTerms = z.infer<typeof agreementTermsSchema>;
