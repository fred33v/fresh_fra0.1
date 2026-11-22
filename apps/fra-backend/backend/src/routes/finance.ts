import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { randomUUID, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { rateLimit } from '../middleware.js';
import { hasDatabase, requireAuth, jsonError, type AuthContext } from '../helpers.js';
import { withTransaction } from '../db/transaction.js';
import { auditLog } from '../db/index.js';
import { recruitmentIdentity, RecruitmentError } from '../provider-recruitment.js';
import {
  financeReviewer,
  financeIdentity,
  currentPaymentProfile,
  eligibleFee,
  refreshFeePayment,
  lockFeeIncome,
} from '../finance-controls.js';
import {
  FinanceVaultUnavailable,
  financeVaultReady,
  sealBankDetails,
  openBankDetails,
} from '../finance-vault.js';
const routes = new Hono();
const uuid = z.uuid(),
  reason = z.string().trim().min(10).max(2000);
routes.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  if (!hasDatabase())
    return jsonError(c, 503, 'DATABASE_REQUIRED', 'Finance records require PostgreSQL');
  return next();
});
async function run(
  c: Context,
  fn: (auth: AuthContext) => Promise<unknown>,
  status: 200 | 201 = 200
) {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (c.get('apiKeyAuth' as never))
    return jsonError(c, 403, 'FORBIDDEN', 'A personal account is required');
  try {
    return c.json({ success: true, data: await fn(auth) }, status);
  } catch (e) {
    if (e instanceof FinanceVaultUnavailable)
      return jsonError(c, 503, 'FINANCE_VAULT_UNAVAILABLE', e.message);
    if (e instanceof RecruitmentError) return jsonError(c, e.status, 'FINANCE_CONTROL', e.message);
    if (e && typeof e === 'object' && 'code' in e && e.code === '23505')
      return jsonError(
        c,
        409,
        'FINANCE_CONFLICT',
        'A reference or live instruction already exists; refresh before retrying'
      );
    throw e;
  }
}
function id(value: string) {
  if (!uuid.safeParse(value).success) throw new RecruitmentError(400, 'Invalid finance reference');
}
function safeProfile(p: Record<string, unknown>) {
  return Object.fromEntries(
    [
      'id',
      'identifier_id',
      'version',
      'revision',
      'kind',
      'last4',
      'status',
      'verification_method',
      'verification_reference',
      'reason',
      'created_at',
      'reviewed_at',
    ].map((k) => [k, p[k]])
  );
}
routes.get('/config', (c) =>
  run(c, (auth) =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth);
      let finance = false;
      try {
        await financeReviewer(db, auth);
        finance = true;
      } catch (e) {
        if (!(e instanceof RecruitmentError)) throw e;
      }
      return {
        bankVaultReady: financeVaultReady(),
        financeAccess: finance,
        paymentExecution: false,
        payrollCalculation: false,
      };
    })
  )
);
routes.get('/identities', (c) =>
  run(c, (auth) =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth);
      const review = c.req.query('view') === 'review';
      if (review) await financeReviewer(db, auth);
      return (
        await db.query(
          `SELECT id,code,kind,user_id AS "userId",organisation_id AS "organisationId",application_id AS "applicationId",status FROM public.relationship_identifiers WHERE kind IN ('supplier','employee') AND ($1::boolean OR (user_id=$2 AND organisation_id=$3)) ORDER BY created_at DESC LIMIT 200`,
          [review, auth.userId, auth.organisationId]
        )
      ).rows;
    })
  )
);
routes.get('/profiles', (c) =>
  run(c, (auth) =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth);
      const review = c.req.query('view') === 'review';
      if (review) await financeReviewer(db, auth);
      return (
        await db.query(
          `SELECT p.* FROM public.finance_payment_profiles p JOIN public.relationship_identifiers i ON i.id=p.identifier_id WHERE ($1::boolean OR(i.user_id=$2 AND i.organisation_id=$3)) ORDER BY p.created_at DESC LIMIT 200`,
          [review, auth.userId, auth.organisationId]
        )
      ).rows.map(safeProfile);
    })
  )
);
const bankSchema = z.strictObject({
  identifierId: z.uuid(),
  expectedVersion: z.number().int().nonnegative(),
  accountHolder: z
    .string()
    .trim()
    .min(2)
    .max(160)
    .regex(/^[^\x00-\x1f\x7f]+$/),
  sortCode: z
    .string()
    .transform((v) => v.replace(/[ -]/g, ''))
    .pipe(z.string().regex(/^\d{6}$/)),
  accountNumber: z.string().regex(/^\d{8}$/),
  declaration: z.literal(true),
});
routes.post('/profiles', async (c) => {
  const input = bankSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success)
    return jsonError(
      c,
      400,
      'VALIDATION_ERROR',
      'Provide UK account-holder, six-digit sort code, eight-digit account number and ownership declaration'
    );
  return run(
    c,
    (auth) =>
      withTransaction(async (db) => {
        await recruitmentIdentity(db, auth);
        const p = input.data,
          i = await financeIdentity(db, p.identifierId, true);
        if (i.user_id !== auth.userId || i.organisation_id !== auth.organisationId)
          throw new RecruitmentError(403, 'Submit only your own beneficiary details');
        const version = Number(
          (
            await db.query(
              'SELECT COALESCE(max(version),0) AS version FROM public.finance_payment_profiles WHERE identifier_id=$1',
              [i.id]
            )
          ).rows[0].version
        );
        if (version !== p.expectedVersion)
          throw new RecruitmentError(409, 'Payment details changed; refresh before replacing');
        const profileId = randomUUID(),
          next = version + 1;
        const encrypted = sealBankDetails(
          {
            country: 'GB',
            accountHolder: p.accountHolder,
            sortCode: p.sortCode,
            accountNumber: p.accountNumber,
          },
          `${profileId}:${i.id}:${next}`
        );
        const row = (
          await db.query(
            "INSERT INTO public.finance_payment_profiles(id,identifier_id,version,kind,last4,encrypted_details,reason,submitted_by) VALUES($1,$2,$3,$4,$5,$6,'Beneficiary submitted bank details and ownership declaration',$7) RETURNING *",
            [
              profileId,
              i.id,
              next,
              i.kind === 'employee' ? 'payroll' : 'supplier',
              p.accountNumber.slice(-4),
              encrypted,
              auth.userId,
            ]
          )
        ).rows[0];
        return safeProfile(row);
      }),
    201
  );
});
const profileReview = z.strictObject({
  revision: z.number().int().positive(),
  status: z.enum(['approved', 'rejected', 'suspended']),
  reason,
  verificationReference: z.string().trim().min(6).max(160).optional(),
  evidenceChecked: z.literal(true).optional(),
});
routes.post('/profiles/:id/review', async (c) => {
  const input = profileReview.safeParse(await c.req.json().catch(() => null));
  if (!input.success)
    return jsonError(c, 400, 'VALIDATION_ERROR', 'Provide the profile review, reason and revision');
  return run(c, (auth) =>
    withTransaction(async (db) => {
      await financeReviewer(db, auth);
      id(c.req.param('id'));
      const link = (
        await db.query('SELECT identifier_id FROM public.finance_payment_profiles WHERE id=$1', [
          c.req.param('id'),
        ])
      ).rows[0];
      if (!link) throw new RecruitmentError(404, 'Payment profile not found');
      const i = await financeIdentity(db, link.identifier_id, true);
      if (i.user_id === auth.userId)
        throw new RecruitmentError(403, 'You cannot verify your own bank details');
      const p = (
          await db.query('SELECT * FROM public.finance_payment_profiles WHERE id=$1 FOR UPDATE', [
            c.req.param('id'),
          ])
        ).rows[0],
        q = input.data;
      const latest = (
        await db.query(
          'SELECT id FROM public.finance_payment_profiles WHERE identifier_id=$1 ORDER BY version DESC LIMIT 1',
          [i.id]
        )
      ).rows[0];
      if (
        latest.id !== p.id ||
        p.revision !== q.revision ||
        (q.status === 'suspended' ? p.status !== 'approved' : p.status !== 'submitted')
      )
        throw new RecruitmentError(
          409,
          'Review only the current pending profile; approved details can be suspended'
        );
      if (q.status === 'approved' && (!q.evidenceChecked || !q.verificationReference))
        throw new RecruitmentError(
          400,
          'Record independently checked beneficiary evidence; format validation alone is insufficient'
        );
      return safeProfile(
        (
          await db.query(
            `UPDATE public.finance_payment_profiles SET status=$2,revision=revision+1,reason=$3,verification_method=CASE WHEN $2='approved' THEN 'staff_evidence_review' ELSE verification_method END,verification_reference=COALESCE($4,verification_reference),reviewed_by=$5,reviewed_at=now() WHERE id=$1 RETURNING *`,
            [p.id, q.status, q.reason, q.verificationReference ?? null, auth.userId]
          )
        ).rows[0]
      );
    })
  );
});
const revealSchema = z.strictObject({ reason, password: z.string().min(1).max(200) });
routes.post('/profiles/:id/reveal', async (c) => {
  const claimed = requireAuth(c);
  if (claimed instanceof Response) return claimed;
  const limited = await rateLimit(`finance-reveal:${claimed.userId}`, { windowMs: 300000, max: 5 })(
    c
  );
  if (limited instanceof Response) return limited;
  const input = revealSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success)
    return jsonError(
      c,
      400,
      'VALIDATION_ERROR',
      'Re-enter your finance account password and state the verification purpose'
    );
  return run(c, (auth) =>
    withTransaction(async (db) => {
      await financeReviewer(db, auth);
      id(c.req.param('id'));
      const user = (
        await db.query('SELECT password_hash FROM public.users WHERE id=$1', [auth.userId])
      ).rows[0];
      if (!user || !(await bcrypt.compare(input.data.password, user.password_hash)))
        throw new RecruitmentError(403, 'Finance password confirmation failed');
      const link = (
        await db.query('SELECT identifier_id FROM public.finance_payment_profiles WHERE id=$1', [
          c.req.param('id'),
        ])
      ).rows[0];
      if (!link) throw new RecruitmentError(404, 'Payment profile not found');
      const i = await financeIdentity(db, link.identifier_id);
      const p = (
        await db.query('SELECT * FROM public.finance_payment_profiles WHERE id=$1 FOR SHARE', [
          c.req.param('id'),
        ])
      ).rows[0];
      if (i.user_id === auth.userId)
        throw new RecruitmentError(403, 'No self-review of beneficiary details');
      const latest = (
        await db.query(
          'SELECT id FROM public.finance_payment_profiles WHERE identifier_id=$1 ORDER BY version DESC LIMIT 1',
          [i.id]
        )
      ).rows[0];
      if (latest.id !== p.id || !['submitted', 'approved'].includes(p.status))
        throw new RecruitmentError(
          409,
          'Only current pending/approved beneficiary details may be inspected'
        );
      const details = openBankDetails(
        p.encrypted_details,
        `${p.id}:${p.identifier_id}:${p.version}`
      );
      await auditLog(
        {
          eventType: 'finance.bank_details_revealed',
          actorId: auth.userId,
          actorEmail: auth.email,
          organisationId: auth.organisationId,
          resourceType: 'payment_profile',
          resourceId: p.id,
          details: { reason: input.data.reason, version: p.version },
        },
        db
      );
      return details;
    })
  );
});
routes.get('/fee-options', (c) =>
  run(c, (auth) =>
    withTransaction(async (db) => {
      await financeReviewer(db, auth);
      const delivery = c.req.query('deliveryId');
      if (!delivery || !uuid.safeParse(delivery).success)
        throw new RecruitmentError(400, 'Select a delivery');
      const d = (
        await db.query(
          'SELECT d.*,a.package_id FROM public.service_deliveries d JOIN public.provider_assignments a ON a.id=d.assignment_id WHERE d.id=$1',
          [delivery]
        )
      ).rows[0];
      if (!d) throw new RecruitmentError(404, 'Delivery not found');
      const purchases = (
        await db.query(
          'SELECT id,status,amount_cents AS "netCents",payment_reconciled_at AS "verifiedAt" FROM public.purchases WHERE organisation_id=$1 AND package_id=$2 AND currency=\'gbp\' ORDER BY created_at DESC LIMIT 200',
          [d.customer_organisation_id, d.package_id]
        )
      ).rows;
      const version = Number(
        (
          await db.query(
            'SELECT COALESCE(max(version),0) AS version FROM public.finance_fee_agreements WHERE delivery_id=$1',
            [d.id]
          )
        ).rows[0].version
      );
      return { title: d.title, status: d.status, purchases, version };
    })
  )
);
const feeSchema = z
  .strictObject({
    deliveryId: z.uuid(),
    purchaseId: z.uuid(),
    expectedVersion: z.number().int().nonnegative(),
    netCents: z.number().int().positive().max(100000000),
    vatCents: z.number().int().nonnegative().max(100000000),
    terms: z.string().trim().min(20).max(4000),
  })
  .refine((v) => v.netCents + v.vatCents <= 100000000, 'Fee exceeds the instruction limit');
routes.get('/fees', (c) =>
  run(c, (auth) =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth);
      const review = c.req.query('view') === 'review';
      if (review) await financeReviewer(db, auth);
      return (
        await db.query(
          `SELECT f.* FROM public.finance_fee_agreements f JOIN public.relationship_identifiers i ON i.id=f.identifier_id WHERE ($1::boolean OR(i.user_id=$2 AND i.organisation_id=$3)) ORDER BY f.created_at DESC LIMIT 200`,
          [review, auth.userId, auth.organisationId]
        )
      ).rows.map((row) =>
        review
          ? row
          : Object.fromEntries(
              Object.entries(row).filter(([key]) => !['proposed_by', 'decided_by'].includes(key))
            )
      );
    })
  )
);
routes.post('/fees', async (c) => {
  const input = feeSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success)
    return jsonError(
      c,
      400,
      'VALIDATION_ERROR',
      'Provide a fixed fee in GBP minor units, explicit invoice VAT, terms and purchase reference'
    );
  return run(
    c,
    (auth) =>
      withTransaction(async (db) => {
        await financeReviewer(db, auth);
        const p = input.data;
        const lookup = (
          await db.query('SELECT application_id FROM public.service_deliveries WHERE id=$1', [
            p.deliveryId,
          ])
        ).rows[0];
        if (!lookup) throw new RecruitmentError(404, 'Delivery not found');
        await db.query('SELECT id FROM public.provider_applications WHERE id=$1 FOR UPDATE', [
          lookup.application_id,
        ]);
        const d = (
          await db.query('SELECT * FROM public.service_deliveries WHERE id=$1 FOR UPDATE', [
            p.deliveryId,
          ])
        ).rows[0];
        const key = (
          await db.query(
            "SELECT id FROM public.relationship_identifiers WHERE application_id=$1 AND kind='supplier'",
            [d.application_id]
          )
        ).rows[0];
        if (!key) throw new RecruitmentError(409, 'Supplier identifier required');
        const i = await financeIdentity(db, key.id, true);
        if (i.user_id === auth.userId)
          throw new RecruitmentError(403, 'You cannot propose your own service fee');
        if (d.status === 'cancelled')
          throw new RecruitmentError(409, 'Cancelled deliveries cannot earn new fees');
        if (
          (
            await db.query(
              "SELECT 1 FROM public.finance_instructions WHERE delivery_id=$1 AND status<>'cancelled'",
              [d.id]
            )
          ).rowCount
        )
          throw new RecruitmentError(
            409,
            'Cancel the outstanding instruction first; recorded fees cannot be replaced'
          );
        const purchase = (
          await db.query(
            "SELECT p.id FROM public.purchases p JOIN public.provider_assignments a ON a.id=$3 WHERE p.id=$1 AND p.organisation_id=$2 AND p.package_id=a.package_id AND p.currency='gbp'",
            [p.purchaseId, d.customer_organisation_id, d.assignment_id]
          )
        ).rows[0];
        if (!purchase)
          throw new RecruitmentError(
            400,
            'Purchase must match the delivery customer, package and GBP currency'
          );
        const version = Number(
          (
            await db.query(
              'SELECT COALESCE(max(version),0) AS version FROM public.finance_fee_agreements WHERE delivery_id=$1',
              [d.id]
            )
          ).rows[0].version
        );
        if (version !== p.expectedVersion)
          throw new RecruitmentError(409, 'Fee terms changed; refresh first');
        return (
          await db.query(
            'INSERT INTO public.finance_fee_agreements(delivery_id,purchase_id,identifier_id,version,net_cents,vat_cents,terms,proposed_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
            [d.id, p.purchaseId, i.id, version + 1, p.netCents, p.vatCents, p.terms, auth.userId]
          )
        ).rows[0];
      }),
    201
  );
});
routes.post('/fees/:id/decision', async (c) => {
  const input = z
    .strictObject({
      revision: z.number().int().positive(),
      status: z.enum(['accepted', 'refused']),
    })
    .safeParse(await c.req.json().catch(() => null));
  if (!input.success)
    return jsonError(c, 400, 'VALIDATION_ERROR', 'Accept or refuse the exact fee version');
  return run(c, (auth) =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth);
      id(c.req.param('id'));
      const lookup = (
        await db.query('SELECT identifier_id FROM public.finance_fee_agreements WHERE id=$1', [
          c.req.param('id'),
        ])
      ).rows[0];
      if (!lookup) throw new RecruitmentError(404, 'Fee not found');
      const i = await financeIdentity(db, lookup.identifier_id, true);
      if (i.user_id !== auth.userId || i.organisation_id !== auth.organisationId)
        throw new RecruitmentError(403, 'Only the supplier can accept its fee');
      const fee = (
        await db.query('SELECT * FROM public.finance_fee_agreements WHERE id=$1 FOR UPDATE', [
          c.req.param('id'),
        ])
      ).rows[0];
      const latest = (
        await db.query(
          'SELECT id FROM public.finance_fee_agreements WHERE delivery_id=$1 ORDER BY version DESC LIMIT 1',
          [fee.delivery_id]
        )
      ).rows[0];
      if (latest.id !== fee.id || fee.status !== 'proposed' || fee.revision !== input.data.revision)
        throw new RecruitmentError(409, 'Only the latest proposed fee can be decided');
      return (
        await db.query(
          'UPDATE public.finance_fee_agreements SET status=$2,revision=revision+1,decided_by=$3,decided_at=now() WHERE id=$1 RETURNING *',
          [fee.id, input.data.status, auth.userId]
        )
      ).rows[0];
    })
  );
});
const instructionSchema = z.strictObject({
  requestKey: z.uuid(),
  profileId: z.uuid(),
  kind: z.enum(['supplier_service_fee', 'payroll_gross']),
  feeId: z.uuid().optional(),
  grossCents: z.number().int().positive().max(100000000).optional(),
  periodFrom: z.iso.date().optional(),
  periodUntil: z.iso.date().optional(),
  reason,
});
routes.get('/instructions', (c) =>
  run(c, (auth) =>
    withTransaction(async (db) => {
      await recruitmentIdentity(db, auth);
      const review = c.req.query('view') === 'review';
      if (review) await financeReviewer(db, auth);
      return (
        await db.query(
          `SELECT p.* FROM public.finance_instructions p JOIN public.relationship_identifiers i ON i.id=p.identifier_id WHERE ($1::boolean OR(i.user_id=$2 AND i.organisation_id=$3)) ORDER BY p.created_at DESC LIMIT 200`,
          [review, auth.userId, auth.organisationId]
        )
      ).rows.map((row) =>
        review
          ? row
          : Object.fromEntries(
              Object.entries(row).filter(
                ([key]) =>
                  !['prepared_by', 'approved_by', 'recorded_by', 'last_action_by'].includes(key)
              )
            )
      );
    })
  )
);
routes.post('/instructions', async (c) => {
  const input = instructionSchema.safeParse(await c.req.json().catch(() => null));
  if (!input.success)
    return jsonError(
      c,
      400,
      'VALIDATION_ERROR',
      'Provide a reviewed beneficiary and explicit supplier-fee or gross-payroll instruction'
    );
  return run(
    c,
    async (auth) => {
      const p = input.data;
      await withTransaction((db) => financeReviewer(db, auth));
      if (p.kind === 'supplier_service_fee') {
        if (!p.feeId) throw new RecruitmentError(400, 'Agreed service fee required');
        await refreshFeePayment(auth, p.feeId);
      }
      return withTransaction(async (db) => {
        await financeReviewer(db, auth);
        if (p.kind === 'supplier_service_fee') await lockFeeIncome(db, p.feeId!);
        const link = (
          await db.query('SELECT identifier_id FROM public.finance_payment_profiles WHERE id=$1', [
            p.profileId,
          ])
        ).rows[0];
        if (!link) throw new RecruitmentError(404, 'Profile not found');
        const i = await financeIdentity(db, link.identifier_id, true);
        const { profile } = await currentPaymentProfile(db, p.profileId);
        if (i.user_id === auth.userId)
          throw new RecruitmentError(403, 'You cannot prepare your own payment');
        const previous = (
          await db.query(
            'SELECT *,period_from::text AS period_from,period_until::text AS period_until FROM public.finance_instructions WHERE request_key=$1',
            [p.requestKey]
          )
        ).rows[0];
        if (previous) {
          if (
            previous.prepared_by !== auth.userId ||
            previous.profile_id !== p.profileId ||
            previous.kind !== p.kind ||
            previous.fee_id !== (p.feeId ?? null) ||
            previous.reason !== p.reason ||
            (p.kind === 'payroll_gross' &&
              (previous.gross_cents !== p.grossCents ||
                String(previous.period_from).slice(0, 10) !== p.periodFrom ||
                String(previous.period_until).slice(0, 10) !== p.periodUntil))
          )
            throw new RecruitmentError(409, 'Instruction request key was reused');
          return previous;
        }
        let amount: number,
          deliveryId: string | null = null;
        if (p.kind === 'supplier_service_fee') {
          if (
            i.kind !== 'supplier' ||
            profile.kind !== 'supplier' ||
            p.grossCents !== undefined ||
            p.periodFrom ||
            p.periodUntil
          )
            throw new RecruitmentError(
              400,
              'Supplier fees cannot be payroll or have a client-overridden amount'
            );
          const { fee } = await eligibleFee(db, p.feeId!);
          if (fee.identifier_id !== i.id)
            throw new RecruitmentError(403, 'Fee beneficiary mismatch');
          amount = fee.total_cents;
          deliveryId = fee.delivery_id;
          if (
            (
              await db.query(
                "SELECT 1 FROM public.finance_instructions WHERE delivery_id=$1 AND status<>'cancelled'",
                [deliveryId]
              )
            ).rowCount
          )
            throw new RecruitmentError(
              409,
              'A live/recorded instruction already exists for this service'
            );
        } else {
          if (
            i.kind !== 'employee' ||
            profile.kind !== 'payroll' ||
            p.feeId ||
            !p.grossCents ||
            !p.periodFrom ||
            !p.periodUntil ||
            p.periodUntil <= p.periodFrom
          )
            throw new RecruitmentError(
              400,
              'Payroll requires an employee, gross amount and exclusive pay-period bounds'
            );
          if (
            (
              await db.query(
                "SELECT 1 FROM public.finance_instructions WHERE identifier_id=$1 AND kind='payroll_gross' AND status<>'cancelled' AND period_from<$3::date AND period_until>$2::date",
                [i.id, p.periodFrom, p.periodUntil]
              )
            ).rowCount
          )
            throw new RecruitmentError(
              409,
              'An overlapping payroll period is already prepared or recorded'
            );
          amount = p.grossCents;
        }
        return (
          await db.query(
            'INSERT INTO public.finance_instructions(request_key,kind,identifier_id,profile_id,fee_id,delivery_id,gross_cents,period_from,period_until,reason,prepared_by,last_action_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) RETURNING *',
            [
              p.requestKey,
              p.kind,
              i.id,
              p.profileId,
              p.feeId ?? null,
              deliveryId,
              amount,
              p.periodFrom ?? null,
              p.periodUntil ?? null,
              p.reason,
              auth.userId,
            ]
          )
        ).rows[0];
      });
    },
    201
  );
});
const instructionAction = z.strictObject({
  revision: z.number().int().positive(),
  action: z.enum(['approve', 'record', 'cancel']),
  reason,
  externalReference: z.string().trim().min(6).max(160).optional(),
  externalExecutionChecked: z.literal(true).optional(),
});
routes.post('/instructions/:id/action', async (c) => {
  const input = instructionAction.safeParse(await c.req.json().catch(() => null));
  if (!input.success)
    return jsonError(
      c,
      400,
      'VALIDATION_ERROR',
      'Provide the current instruction, independent finance decision and reason'
    );
  return run(c, async (auth) => {
    id(c.req.param('id'));
    const lookup = await withTransaction(async (db) => {
      await financeReviewer(db, auth);
      const row = (
        await db.query('SELECT * FROM public.finance_instructions WHERE id=$1', [c.req.param('id')])
      ).rows[0];
      if (!row) throw new RecruitmentError(404, 'Instruction not found');
      return row;
    });
    if (input.data.action !== 'cancel' && lookup.fee_id)
      await refreshFeePayment(auth, lookup.fee_id);
    return withTransaction(async (db) => {
      await financeReviewer(db, auth);
      if (input.data.action !== 'cancel' && lookup.fee_id) await lockFeeIncome(db, lookup.fee_id);
      const i = await financeIdentity(
        db,
        lookup.identifier_id,
        true,
        input.data.action === 'cancel'
      );
      const p = (
          await db.query('SELECT * FROM public.finance_instructions WHERE id=$1 FOR UPDATE', [
            lookup.id,
          ])
        ).rows[0],
        a = input.data;
      if (i.user_id === auth.userId)
        throw new RecruitmentError(403, 'You cannot authorise your own payment');
      if (p.revision !== a.revision || ['recorded', 'cancelled'].includes(p.status))
        throw new RecruitmentError(409, 'Instruction changed or is terminal');
      if (a.action === 'cancel')
        return (
          await db.query(
            "UPDATE public.finance_instructions SET status='cancelled',revision=revision+1,action_reason=$2,last_action_by=$3 WHERE id=$1 RETURNING *",
            [p.id, a.reason, auth.userId]
          )
        ).rows[0];
      if (p.prepared_by === auth.userId)
        throw new RecruitmentError(403, 'A second finance reviewer must approve and record');
      await currentPaymentProfile(db, p.profile_id);
      if (p.fee_id) await eligibleFee(db, p.fee_id);
      if (a.action === 'approve') {
        if (p.status !== 'prepared')
          throw new RecruitmentError(409, 'Instruction is not awaiting approval');
        return (
          await db.query(
            "UPDATE public.finance_instructions SET status='approved',revision=revision+1,approved_by=$2,approved_at=now(),action_reason=$3,last_action_by=$2 WHERE id=$1 RETURNING *",
            [p.id, auth.userId, a.reason]
          )
        ).rows[0];
      }
      if (p.status !== 'approved' || !a.externalReference || !a.externalExecutionChecked)
        throw new RecruitmentError(
          409,
          'An approved instruction and checked external bank/payroll execution reference are required'
        );
      if (
        (
          await db.query('SELECT 1 FROM public.finance_instructions WHERE external_reference=$1', [
            a.externalReference,
          ])
        ).rowCount
      )
        throw new RecruitmentError(409, 'External execution reference is already recorded');
      const result = (
        await db.query(
          "UPDATE public.finance_instructions SET status='recorded',revision=revision+1,recorded_by=$2,recorded_at=now(),external_reference=$3,recording_method=$4,action_reason=$5,last_action_by=$2 WHERE id=$1 RETURNING *",
          [
            p.id,
            auth.userId,
            a.externalReference,
            p.kind === 'payroll_gross' ? 'staff_payroll_run_attestation' : 'staff_bank_attestation',
            a.reason,
          ]
        )
      ).rows[0];
      await auditLog(
        {
          eventType: 'finance.instruction_recorded',
          actorId: auth.userId,
          actorEmail: auth.email,
          organisationId: auth.organisationId,
          resourceType: 'finance_instruction',
          resourceId: p.id,
          details: {
            reason: a.reason,
            kind: p.kind,
            confirmationReference: result.confirmation_reference,
            verificationMethod: result.recording_method,
          },
        },
        db
      );
      return result;
    });
  });
});
routes.get('/history/:kind/:id', (c) =>
  run(c, (auth) =>
    withTransaction(async (db) => {
      await financeReviewer(db, auth);
      id(c.req.param('id'));
      const tables: Record<string, string> = {
        profile: 'finance_payment_profiles',
        fee: 'finance_fee_agreements',
        instruction: 'finance_instructions',
      };
      const table = tables[c.req.param('kind')];
      if (!table) throw new RecruitmentError(400, 'Invalid finance history kind');
      const current = (
        await db.query(
          `SELECT to_jsonb(t)-'encrypted_details' AS snapshot,revision FROM public.${table} t WHERE id=$1 FOR SHARE`,
          [c.req.param('id')]
        )
      ).rows[0];
      if (!current) throw new RecruitmentError(404, 'Finance record not found');
      const events = (
        await db.query(
          'SELECT *,occurred_at::text AS occurred_at FROM public.finance_events WHERE aggregate_type=$1 AND aggregate_id=$2 ORDER BY revision',
          [table, c.req.param('id')]
        )
      ).rows;
      let previous = '0'.repeat(64);
      for (let n = 0; n < events.length; n++) {
        const e = events[n];
        const valid = (
          await db.query(
            `SELECT $1::jsonb=jsonb_build_array($2::text,$3::text,$4::int,$5::jsonb,($1::jsonb->>4),$6::text) AND ($1::jsonb->>4)::timestamptz=$7::timestamptz AS valid`,
            [
              e.canonical,
              e.aggregate_type,
              e.aggregate_id,
              e.revision,
              JSON.stringify(e.snapshot),
              e.previous_hash,
              e.occurred_at,
            ]
          )
        ).rows[0].valid;
        if (
          !valid ||
          e.revision !== n + 1 ||
          e.previous_hash !== previous ||
          createHash('sha256').update(e.canonical).digest('hex') !== e.hash
        )
          throw new Error('Finance audit integrity failure');
        previous = e.hash;
      }
      if (
        events.length !== current.revision ||
        (
          await db.query('SELECT $1::jsonb=$2::jsonb AS valid', [
            JSON.stringify(events.at(-1)?.snapshot),
            JSON.stringify(current.snapshot),
          ])
        ).rows[0].valid !== true
      )
        throw new Error('Finance audit head mismatch');
      return { events, head: previous, verified: true };
    })
  )
);
export default routes;
