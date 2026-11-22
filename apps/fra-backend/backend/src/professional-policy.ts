import { z } from 'zod';
export const PROFESSIONAL_ACTIONS = ['deliver', 'assess', 'issue_completion'] as const;
export type ProfessionalAction = (typeof PROFESSIONAL_ACTIONS)[number];
const actions = z
  .array(z.enum(PROFESSIONAL_ACTIONS))
  .min(1)
  .max(3)
  .refine(
    (v) => new Set(v).size === v.length && v.includes('deliver'),
    'Delivery must be explicit; duplicate rights are not allowed'
  );
export const scopeRequestSchema = z.strictObject({
  subjectId: z.string().min(1).max(100),
  subjectVersion: z.string().min(1).max(100),
  revision: z.number().int().min(0).max(2147483646),
  actions,
  evidence: z.string().trim().min(20).max(4000),
});
export const scopeReviewSchema = z
  .strictObject({
    revision: z.number().int().positive().max(2147483646),
    status: z.enum(['approved', 'declined', 'suspended', 'revoked']),
    reason: z.string().trim().min(10).max(2000),
    actions: actions.optional(),
    validFrom: z.iso.datetime({ offset: true }).optional(),
    validUntil: z.iso.datetime({ offset: true }).optional(),
    qualificationCheck: z.string().trim().min(10).max(4000).optional(),
    demonstrationCheck: z.string().trim().min(10).max(4000).optional(),
    checksConfirmed: z.literal(true).optional(),
  })
  .superRefine((v, c) => {
    if (
      v.status === 'approved' &&
      (!v.actions ||
        !v.validFrom ||
        !v.validUntil ||
        Date.parse(v.validUntil) <= Math.max(Date.now(), Date.parse(v.validFrom)) ||
        !v.qualificationCheck ||
        !v.demonstrationCheck ||
        !v.checksConfirmed)
    )
      c.addIssue({
        code: 'custom',
        message: 'Approval requires verified checks, explicit rights and a valid dated period',
      });
    if (v.actions?.includes('issue_completion') && !v.actions.includes('assess'))
      c.addIssue({
        code: 'custom',
        message: 'Completion issuance also requires explicit assessment authority',
      });
  });
export const professionalSessionSchema = z.strictObject({
  scopeId: z.uuid(),
  scopeRevision: z.number().int().positive(),
  assignmentId: z.uuid(),
  title: z.string().trim().min(2).max(200),
});
export const completionReviewSchema = z.strictObject({
  learnerId: z.uuid(),
  revision: z.number().int().nonnegative().max(2147483646),
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().trim().min(10).max(2000),
});
