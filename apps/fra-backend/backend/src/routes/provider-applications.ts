import {validProfessionalScope} from '../professional-authority.js';
import { providerProfileSchema } from '../provider-candidate.js';
import { recordCandidateRevision, candidateDossier } from '../provider-candidate-dossier.js';
import { providerBalance, refreshProviderPayments } from '../provider-commissions.js';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { withTransaction } from '../db/transaction.js';
import { recruitmentIdentity, recruitmentAudit, reviewProvider, RecruitmentError } from '../provider-recruitment.js';
import { getDbPool } from '../db.js';
import { hasDatabase, jsonError, requireAuth } from '../helpers.js';

const routes: Hono = new Hono();

const applicationSchema = z
  .strictObject({
    companyName: z.string().trim().min(2).max(160),
    serviceInterest: z.enum(['sales', 'training', 'both']),
    trainingExperience: z.string().trim().min(10).max(4000).optional(),
    candidateProfile: providerProfileSchema.optional(),
  })
  .refine(
    (application) => application.serviceInterest === 'sales' || application.trainingExperience,
    { message: 'Describe your training experience', path: ['trainingExperience'] }
  ).refine(a => !a.candidateProfile || a.candidateProfile.businessName === a.companyName, {message:'Candidate business name must match the application company name',path:['candidateProfile','businessName']});

const applicantView = `id, company_name AS "companyName", service_interest AS "serviceInterest",
  training_experience AS "trainingExperience", status, revision, review_reason AS "reviewReason",
  provider_code AS "providerCode", submitted_at AS "submittedAt", candidate_profile AS "candidateProfile"`;

async function applicant(c: Context) {
  c.header('Cache-Control', 'no-store');
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (c.get('apiKeyAuth' as never)) {
    return jsonError(c, 403, 'FORBIDDEN', 'A personal account is required');
  }
  if (!hasDatabase()) {
    return jsonError(
      c,
      503,
      'SERVICE_UNAVAILABLE',
      'Provider applications are temporarily unavailable'
    );
  }

  const { rows } = await getDbPool().query(
    `SELECT 1 FROM public.users
     WHERE id = $1 AND organisation_id = $2 AND email_verified_at IS NOT NULL`,
    [auth.userId, auth.organisationId]
  );
  if (!rows[0]) {
    return jsonError(
      c,
      403,
      'FORBIDDEN',
      'A verified account in your current organisation is required'
    );
  }
  return auth;
}

routes.get('/me', async (c) => {
  const auth = await applicant(c);
  if (auth instanceof Response) return auth;

  const { rows } = await getDbPool().query(
    `SELECT ${applicantView} FROM public.provider_applications
     WHERE applicant_id = $1 AND organisation_id = $2`,
    [auth.userId, auth.organisationId]
  );
  return c.json({ success: true, data: rows[0] ?? null });
});

routes.post('/me', async (c) => {
  const auth = await applicant(c);
  if (auth instanceof Response) return auth;

  const parsed = applicationSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return jsonError(
      c,
      400,
      'VALIDATION_ERROR',
      parsed.error.issues[0]?.message ?? 'Invalid application'
    );
  }
  const { companyName, serviceInterest, trainingExperience, candidateProfile } = parsed.data;
  return recruitmentResponse(c,()=>withTransaction(async db=>{
    await recruitmentIdentity(db,auth);
    const {rows:[saved]}=await db.query(`INSERT INTO public.provider_applications
      (applicant_id,organisation_id,applicant_name,applicant_email,company_name,service_interest,training_experience,candidate_profile)
      SELECT id,organisation_id,name,email,$3,$4,$5,$6 FROM public.users WHERE id=$1 AND organisation_id=$2 AND email_verified_at IS NOT NULL
      ON CONFLICT(applicant_id,organisation_id) DO NOTHING RETURNING *`,
      [auth.userId,auth.organisationId,companyName,serviceInterest,trainingExperience??null,candidateProfile??null]);
    if(!saved)throw new RecruitmentError(409,'An application already exists or your account changed');
    await recordCandidateRevision(db,saved,auth.userId,'application.submitted');
    return (await db.query(`SELECT ${applicantView} FROM public.provider_applications WHERE id=$1`,[saved.id])).rows[0];
  }),201);
});

export default routes;

// Reviewer authority is deliberately restricted to a configured operator organisation.
// Being an administrator of an applicant's company is not recruitment authority.
const reviewSchema = z.strictObject({
  revision: z.number().int().nonnegative(),
  status: z.enum(['approved', 'declined', 'suspended', 'submitted']), // 'submitted' reopens a declined application
  reason: z.string().trim().min(10).max(2000),
  qualificationEvidence: z.string().trim().min(10).max(4000).optional(),
  agreementDocumentId: z.string().uuid().optional(),
});
const assignmentSchema = z.strictObject({
  packageId: z.string().min(1).max(100), reference: z.string().trim().min(2).max(160),
  service: z.enum(['sales', 'training']),
  scopeId: z.uuid().optional(),
});

routes.get('/review', async (c) => {
  const auth = await applicant(c);
  if (auth instanceof Response) return auth;
  const page = z.coerce.number().int().min(0).max(100000).safeParse(c.req.query('page') ?? 0);
  if (!page.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid page');
  return recruitmentResponse(c, async () => withTransaction(async (db) => {
    await recruitmentIdentity(db, auth, true);
    const { rows } = await db.query(`SELECT ${applicantView}, applicant_name AS "applicantName",
      applicant_email AS "applicantEmail", qualification_evidence AS "qualificationEvidence",
      agreement_document_id AS "agreementDocumentId" FROM public.provider_applications
      ORDER BY submitted_at DESC,id LIMIT 50 OFFSET $1`, [page.data * 50]);
    return rows;
  }));
});

routes.post('/:id/review', async (c) => {
  const auth = await applicant(c);
  if (auth instanceof Response) return auth;
  const parsed = reviewSchema.safeParse(await c.req.json().catch(() => null));
  if (!z.string().uuid().safeParse(c.req.param('id')).success || !parsed.success)
    return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid review');
  return recruitmentResponse(c, () => withTransaction(async (db) => {
    await reviewProvider(db, auth, c.req.param('id'), parsed.data);
    return (await db.query(`SELECT ${applicantView} FROM public.provider_applications WHERE id=$1`, [c.req.param('id')])).rows[0];
  }));
});

routes.get('/me/assignments', async (c) => {
  const auth = await applicant(c);
  if (auth instanceof Response) return auth;
  return recruitmentResponse(c, () => withTransaction(async (db) => {
    await recruitmentIdentity(db, auth);
    return (await db.query(`SELECT s.id,s.package_id AS "packageId",p.name AS "packageName",s.reference,
      s.service,s.status,s.professional_scope_id AS "scopeId",s.professional_scope_revision AS "scopeRevision",s.created_at AS "createdAt" FROM public.provider_assignments s
      JOIN public.provider_applications a ON a.id=s.application_id
      JOIN public.packages p ON p.id=s.package_id
      WHERE a.applicant_id=$1 AND a.organisation_id=$2 ORDER BY s.created_at DESC LIMIT 200`,
    [auth.userId, auth.organisationId])).rows;
  }));
});

routes.post('/:id/assignments', async (c) => {
  const auth = await applicant(c);
  if (auth instanceof Response) return auth;
  const parsed = assignmentSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success || !z.string().uuid().safeParse(c.req.param('id')).success)
    return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid package assignment');
  return recruitmentResponse(c, () => withTransaction(async (db) => {
    await recruitmentIdentity(db, auth, true);
    const { rows: [a] } = await db.query('SELECT * FROM public.provider_applications WHERE id=$1 FOR UPDATE', [c.req.param('id')]);
    if (!a) throw new RecruitmentError(404, 'Application not found');
    if (a.applicant_id === auth.userId) throw new RecruitmentError(403, 'You cannot assign work to yourself');
    if (a.status !== 'approved' || (a.service_interest !== 'both' && a.service_interest !== parsed.data.service))
      throw new RecruitmentError(409, 'Provider is not approved for this service');
    let scopeRevision:number|null=null;
    if(parsed.data.scopeId){
      const scope=await validProfessionalScope(db,parsed.data.scopeId,'deliver',true);
      if(parsed.data.service!=='training'||scope.application.id!==a.id)throw new RecruitmentError(403,'Scope must belong to this provider and training service');
      scopeRevision=scope.scope.revision;
    }
    const { rows: [saved] } = await db.query(`INSERT INTO public.provider_assignments
      (application_id,package_id,reference,service,assigned_by,professional_scope_id,professional_scope_revision)
      SELECT $1,id,$3,$4,$5,$6,$7 FROM public.packages WHERE id=$2 AND is_active
      ON CONFLICT(application_id,reference) DO NOTHING RETURNING id,status`,
    [a.id, parsed.data.packageId, parsed.data.reference, parsed.data.service, auth.userId,parsed.data.scopeId??null,scopeRevision]);
    if (!saved) throw new RecruitmentError(409, 'Package unavailable or assignment reference already used');
    await recruitmentAudit(db, a.id, auth.userId, 'assignment.offered', { ...parsed.data, id: saved.id });
    return saved;
  }));
});

routes.post('/me/assignments/:id/decision', async (c) => {
  const auth = await applicant(c);
  if (auth instanceof Response) return auth;
  const parsed = z.strictObject({ status: z.enum(['accepted', 'refused']) }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success || !z.string().uuid().safeParse(c.req.param('id')).success)
    return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid assignment decision');
  return recruitmentResponse(c, () => withTransaction(async (db) => {
    await recruitmentIdentity(db, auth);
    // Lock application before assignment, the same order as suspension and assignment creation.
    const { rows: [a] } = await db.query(`SELECT * FROM public.provider_applications
      WHERE applicant_id=$1 AND organisation_id=$2 FOR UPDATE`, [auth.userId, auth.organisationId]);
    if (!a || a.status !== 'approved') throw new RecruitmentError(403, 'An approved provider account is required');
    const { rows: [saved] } = await db.query(`UPDATE public.provider_assignments SET status=$3,decided_at=now()
      WHERE id=$1 AND application_id=$2 AND status='offered' RETURNING id,status`,
    [c.req.param('id'), a.id, parsed.data.status]);
    if (!saved) throw new RecruitmentError(409, 'Assignment unavailable or already decided');
    await recruitmentAudit(db, a.id, auth.userId, `assignment.${parsed.data.status}`, { id: saved.id });
    return saved;
  }));
});

routes.get('/:id/audit', async (c) => {
  const auth = await applicant(c);
  if (auth instanceof Response) return auth;
  if (!z.string().uuid().safeParse(c.req.param('id')).success)
    return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid application');
  return recruitmentResponse(c, () => withTransaction(async (db) => {
    await recruitmentIdentity(db, auth, true);
    return (await db.query(`SELECT event,actor_id AS "actorId",details,occurred_at AS "occurredAt"
      FROM public.provider_recruitment_audit WHERE application_id=$1 ORDER BY id LIMIT 500`, [c.req.param('id')])).rows;
  }));
});

async function recruitmentResponse(c: Context, action: () => Promise<unknown>,status:200|201=200) {
  try { return c.json({ success: true, data: await action() },status); }
  catch (error) {
    if (error instanceof RecruitmentError) return jsonError(c, error.status, 'RECRUITMENT_ERROR', error.message);
    throw error; // Global handler logs internal details and returns a safe error.
  }
}


routes.get('/:id/assignments', async (c) => {
  const auth = await applicant(c);
  if (auth instanceof Response) return auth;
  if (!z.string().uuid().safeParse(c.req.param('id')).success)
    return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid application');
  return recruitmentResponse(c, () => withTransaction(async (db) => {
    await recruitmentIdentity(db, auth, true);
    return (await db.query(`SELECT s.id,s.reference,s.service,s.status,s.professional_scope_id AS "scopeId",s.professional_scope_revision AS "scopeRevision",p.name AS "packageName"
      FROM public.provider_assignments s JOIN public.packages p ON p.id=s.package_id
      WHERE s.application_id=$1 ORDER BY s.created_at DESC LIMIT 200`,[c.req.param('id')])).rows;
  }));
});

routes.post('/:id/assignments/:assignmentId/close', async (c) => {
  const auth = await applicant(c);
  if (auth instanceof Response) return auth;
  const input = z.strictObject({ status: z.enum(['cancelled','completed']), reason: z.string().trim().min(10).max(2000) })
    .safeParse(await c.req.json().catch(() => null));
  if (!input.success || !z.string().uuid().safeParse(c.req.param('id')).success ||
      !z.string().uuid().safeParse(c.req.param('assignmentId')).success)
    return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid assignment closure');
  return recruitmentResponse(c, () => withTransaction(async (db) => {
    await recruitmentIdentity(db, auth, true);
    const { rows: [a] } = await db.query('SELECT * FROM public.provider_applications WHERE id=$1 FOR UPDATE',[c.req.param('id')]);
    if (!a) throw new RecruitmentError(404,'Application not found');
    if (a.applicant_id === auth.userId) throw new RecruitmentError(403,'You cannot close your own work assignment');
    const { rows: [saved] } = await db.query(`UPDATE public.provider_assignments SET status=$3,decided_at=now()
      WHERE id=$1 AND application_id=$2 AND
      ((status='accepted' AND $3='completed' AND $4='approved') OR (status IN ('offered','accepted') AND $3='cancelled'))
      RETURNING id,status`,[c.req.param('assignmentId'),a.id,input.data.status,a.status]);
    if (!saved) throw new RecruitmentError(409,'Assignment cannot be closed in its current state');
    await recruitmentAudit(db,a.id,auth.userId,`assignment.${input.data.status}`,{id:saved.id,reason:input.data.reason});
    return saved;
  }));
});

/**
 * A statement only reads. One snapshot keeps its balances, entries and payouts consistent without locking the
 * provider row, which payment reconciliation and checkout also take. Must be the transaction's first statement.
 */
async function snapshotRead(db: { query: (sql: string) => Promise<unknown> }) {
  await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
}

async function commissionStatement(db: Parameters<typeof providerBalance>[0], id: string, forReviewer: boolean) {
  const currencies = (await db.query(`SELECT DISTINCT currency FROM public.provider_commission_entries WHERE application_id=$1
    UNION SELECT currency FROM public.provider_payouts WHERE application_id=$1`,[id])).rows;
  const balances = [];
  for (const {currency} of currencies) balances.push({currency,...await providerBalance(db,id,currency)});
  const entries = (await db.query(`SELECT id,delta_cents AS "deltaCents",target_cents AS "targetCents",currency,reason,created_at AS "createdAt"
    FROM public.provider_commission_entries WHERE application_id=$1 ORDER BY id DESC LIMIT 200`,[id])).rows;
  const payouts = (await db.query(`SELECT id,amount_cents AS "amountCents",currency,status,settlement_reference AS "settlementReference",
    created_at AS "createdAt",prepared_by AS "preparedBy",approved_by AS "approvedBy" FROM public.provider_payouts WHERE application_id=$1 ORDER BY created_at DESC LIMIT 200`,[id])).rows;
  // Operator staff identifiers are internal: only reviewers see who prepared or approved a payout.
  if (!forReviewer) for (const payout of payouts) { delete payout.preparedBy; delete payout.approvedBy; }
  return {balances,entries,payouts};
}

routes.get('/me/statement', async c => {
  const auth = await applicant(c);
  if (auth instanceof Response) return auth;
  return recruitmentResponse(c,()=>withTransaction(async db=>{
    await snapshotRead(db);
    await recruitmentIdentity(db,auth);
    const {rows:[a]}=await db.query(`SELECT id FROM public.provider_applications WHERE applicant_id=$1 AND organisation_id=$2`,[auth.userId,auth.organisationId]);
    if (!a) throw new RecruitmentError(404,'Application not found');
    return commissionStatement(db,a.id,false);
  }));
});
routes.get('/:id/statement', async c => {
  const auth = await applicant(c);
  if (auth instanceof Response) return auth;
  if(!z.string().uuid().safeParse(c.req.param('id')).success) return jsonError(c,400,'VALIDATION_ERROR','Invalid provider');
  return recruitmentResponse(c,()=>withTransaction(async db=>{
    await snapshotRead(db);
    await recruitmentIdentity(db,auth,true);
    const {rows:[a]}=await db.query('SELECT id FROM public.provider_applications WHERE id=$1',[c.req.param('id')]);
    if(!a) throw new RecruitmentError(404,'Application not found');
    return commissionStatement(db,a.id,true);
  }));
});

routes.post('/:id/payouts', async c => {
  const auth = await applicant(c);
  if(auth instanceof Response) return auth;
  if(process.env.PROVIDER_PAYOUTS_ENABLED!=='true') return jsonError(c,503,'PAYOUTS_DISABLED','Payout preparation is not enabled');
  const parsed=z.strictObject({requestKey:z.string().uuid(),currency:z.literal('gbp'),amountCents:z.number().int().positive().max(100000000),reason:z.string().trim().min(10).max(2000)})
    .safeParse(await c.req.json().catch(()=>null));
  if(!parsed.success || !z.string().uuid().safeParse(c.req.param('id')).success) return jsonError(c,400,'VALIDATION_ERROR','Invalid payout');
  return recruitmentResponse(c,async()=>{
    await refreshProviderPayments(auth,c.req.param('id'));
    return withTransaction(async db=>{
    await recruitmentIdentity(db,auth,true);
    const {rows:[a]}=await db.query('SELECT * FROM public.provider_applications WHERE id=$1 FOR UPDATE',[c.req.param('id')]);
    if(!a) throw new RecruitmentError(404,'Application not found');
    if(a.applicant_id===auth.userId) throw new RecruitmentError(403,'You cannot prepare your own payout');
    const {rows:[previous]}=await db.query('SELECT * FROM public.provider_payouts WHERE request_key=$1',[parsed.data.requestKey]);
    if(previous){
      if(previous.application_id!==a.id || previous.currency!==parsed.data.currency || previous.amount_cents!==parsed.data.amountCents || previous.prepared_by!==auth.userId)
        throw new RecruitmentError(409,'Payout request key is already used');
      return {id:previous.id,status:previous.status};
    }
    if(a.status!=='approved') throw new RecruitmentError(409,'Provider approval is required');
    const b=await providerBalance(db,a.id,parsed.data.currency);
    if(parsed.data.amountCents>b.available) throw new RecruitmentError(409,'Amount exceeds the unreserved commission balance');
    const {rows:[p]}=await db.query(`INSERT INTO public.provider_payouts(application_id,currency,amount_cents,request_key,prepared_by,reason)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING id,status`,[a.id,parsed.data.currency,parsed.data.amountCents,parsed.data.requestKey,auth.userId,parsed.data.reason]);
    await recruitmentAudit(db,a.id,auth.userId,'payout.prepared',{...parsed.data,id:p.id});
    return p;
    });
  });
});

routes.post('/payouts/:id/action', async c => {
  const auth=await applicant(c);
  if(auth instanceof Response)return auth;
  if(process.env.PROVIDER_PAYOUTS_ENABLED!=='true') return jsonError(c,503,'PAYOUTS_DISABLED','Payout operations are not enabled');
  const parsed=z.strictObject({action:z.enum(['approve','record','cancel']),reason:z.string().trim().min(10).max(2000),
    settlementReference:z.string().trim().min(6).max(160).optional()}).safeParse(await c.req.json().catch(()=>null));
  if(!parsed.success || !z.string().uuid().safeParse(c.req.param('id')).success) return jsonError(c,400,'VALIDATION_ERROR','Invalid payout action');
  return recruitmentResponse(c,async()=>{
    if(parsed.data.action!=='cancel') {
      const lookup=await withTransaction(async db=>{
        await recruitmentIdentity(db,auth,true);
        return (await db.query('SELECT application_id FROM public.provider_payouts WHERE id=$1',[c.req.param('id')])).rows[0];
      });
      if(!lookup)throw new RecruitmentError(404,'Payout not found');
      await refreshProviderPayments(auth,lookup.application_id);
    }
    return withTransaction(async db=>{
    await recruitmentIdentity(db,auth,true);
    const {rows:[lookup]}=await db.query('SELECT application_id FROM public.provider_payouts WHERE id=$1',[c.req.param('id')]);
    if(!lookup)throw new RecruitmentError(404,'Payout not found');
    const {rows:[a]}=await db.query('SELECT * FROM public.provider_applications WHERE id=$1 FOR UPDATE',[lookup.application_id]);
    const {rows:[p]}=await db.query('SELECT * FROM public.provider_payouts WHERE id=$1 FOR UPDATE',[c.req.param('id')]);
    const {action,reason,settlementReference}=parsed.data;
    if(a.applicant_id===auth.userId)throw new RecruitmentError(403,'You cannot authorise your own payout');
    if(action==='record' && p.status==='recorded' && p.settlement_reference===settlementReference) return {id:p.id,status:p.status};
    if(action==='cancel'){
      if(!['prepared','approved'].includes(p.status))throw new RecruitmentError(409,'Only unsettled payouts can be cancelled');
      await db.query("UPDATE public.provider_payouts SET status='cancelled' WHERE id=$1",[p.id]);
    }else{
      if(a.status!=='approved')throw new RecruitmentError(409,'Provider approval is required');
      if(p.prepared_by===auth.userId)throw new RecruitmentError(403,'A second reviewer must approve and record settlement');
      if((await providerBalance(db,a.id,p.currency)).available<0)throw new RecruitmentError(409,'Refunds or disputes reduced this balance; cancel and prepare a corrected payout');
      if(action==='approve'){
        if(p.status!=='prepared')throw new RecruitmentError(409,'Payout is not awaiting approval');
        await db.query("UPDATE public.provider_payouts SET status='approved',approved_by=$2,approved_at=now() WHERE id=$1",[p.id,auth.userId]);
      }else{
        if(p.status!=='approved' || !settlementReference)throw new RecruitmentError(409,'An independently approved payout and bank settlement reference are required');
        const duplicate=(await db.query('SELECT id FROM public.provider_payouts WHERE settlement_reference=$1',[settlementReference])).rows[0];
        if(duplicate)throw new RecruitmentError(409,'Settlement reference is already recorded');
        await db.query("UPDATE public.provider_payouts SET status='recorded',recorded_by=$2,recorded_at=now(),settlement_reference=$3 WHERE id=$1",[p.id,auth.userId,settlementReference]);
      }
    }
    await recruitmentAudit(db,a.id,auth.userId,`payout.${action}`,{id:p.id,reason,settlementReference:settlementReference??null});
    return {id:p.id,status:action==='approve'?'approved':action==='record'?'recorded':'cancelled'};
    });
  });
});


routes.post('/me/amend', async c=>{
 const auth=await applicant(c);if(auth instanceof Response)return auth;
 const raw=await c.req.json().catch(()=>null);
 const revision=z.number().int().nonnegative().max(2147483646).safeParse(raw?.revision);
 const input=applicationSchema.safeParse(raw && typeof raw==='object'?Object.fromEntries(Object.entries(raw).filter(([key])=>key!=='revision')):null);
 if(!revision.success||!input.success)return jsonError(c,400,'VALIDATION_ERROR','Complete the amendment and its current revision');
 return recruitmentResponse(c,()=>withTransaction(async db=>{
  const current=await recruitmentIdentity(db,auth);
  const row=(await db.query('SELECT * FROM public.provider_applications WHERE applicant_id=$1 AND organisation_id=$2 FOR UPDATE',[auth.userId,auth.organisationId])).rows[0];
  if(!row)throw new RecruitmentError(404,'Application not found');
  if(row.revision!==revision.data || !['submitted','declined'].includes(row.status))throw new RecruitmentError(409,'Reload: only submitted or declined applications can be amended');
  if(row.candidate_profile && !input.data.candidateProfile)throw new RecruitmentError(400,'Keep and reaffirm the independent candidate declaration when amending this application');
  await recordCandidateRevision(db,row,auth.userId,'application.baseline');
  const p=input.data;
  const saved=(await db.query(`UPDATE public.provider_applications SET company_name=$2,service_interest=$3,training_experience=$4,
    candidate_profile=$5,applicant_name=$6,applicant_email=$7,status='submitted',revision=revision+1,
    review_reason=NULL,qualification_evidence=NULL,agreement_document_id=NULL,reviewed_by=NULL,reviewed_at=NULL
    WHERE id=$1 RETURNING *`,[row.id,p.companyName,p.serviceInterest,p.trainingExperience??null,p.candidateProfile??null,
    (await db.query('SELECT name FROM public.users WHERE id=$1',[auth.userId])).rows[0].name,current.email])).rows[0];
  await recordCandidateRevision(db,saved,auth.userId,'application.amended');
  await recruitmentAudit(db,row.id,auth.userId,'application.amended',{revision:saved.revision,previousRevision:row.revision,previousStatus:row.status});
  return (await db.query(`SELECT ${applicantView} FROM public.provider_applications WHERE id=$1`,[row.id])).rows[0];
 }));
});
async function candidateFile(c:Context,reviewer:boolean,dossier:boolean){
 const auth=await applicant(c);if(auth instanceof Response)return auth;
 if(reviewer && !z.string().uuid().safeParse(c.req.param('id')).success)return jsonError(c,404,'NOT_FOUND','Application not found');
 return withTransaction(async db=>{
  try {
   await recruitmentIdentity(db,auth,reviewer);
   const row=(await db.query(reviewer?'SELECT * FROM public.provider_applications WHERE id=$1':'SELECT * FROM public.provider_applications WHERE applicant_id=$1 AND organisation_id=$2',reviewer?[c.req.param('id')]:[auth.userId,auth.organisationId])).rows[0];
   if(!row)throw new RecruitmentError(404,'Application not found');
   const history=(await db.query('SELECT revision,snapshot,event,recorded_at FROM public.provider_application_revisions WHERE application_id=$1 AND revision<=$2 ORDER BY revision',[row.id,row.revision])).rows;
   if(!dossier)return c.json({success:true,data:history.map(h=>({revision:h.revision,profile:h.snapshot.candidate_profile,companyName:h.snapshot.company_name,serviceInterest:h.snapshot.service_interest,trainingExperience:h.snapshot.training_experience,event:h.event,recordedAt:h.recorded_at}))});
   c.header('Content-Type','text/plain; charset=utf-8');c.header('Content-Disposition',`attachment; filename="provider-${row.id}-revision-${row.revision}-dossier.txt"`);
   const safeHistory=history.map(h=>({...h,snapshot:Object.fromEntries(['applicant_name','applicant_email','company_name','service_interest','training_experience','candidate_profile','status','revision','review_reason','submitted_at'].map(key=>[key,h.snapshot[key]]))}));
   return c.body(candidateDossier(row,safeHistory));
  }catch(error){if(error instanceof RecruitmentError)return jsonError(c,error.status,'RECRUITMENT_ERROR',error.message);throw error;}
 });
}
routes.get('/me/revisions',c=>candidateFile(c,false,false));
routes.get('/:id/revisions',c=>candidateFile(c,true,false));
routes.get('/me/dossier',c=>candidateFile(c,false,true));
routes.get('/:id/dossier',c=>candidateFile(c,true,true));
