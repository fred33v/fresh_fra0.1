// Read-only deployment preflight. Never grants roles or prints connection secrets.
import './env.js';
import { getDbPool, closeDbPool } from './db.js';
import { z } from 'zod';
try {
  if(!process.env.DATABASE_URL)throw new Error('Configure DATABASE_URL in the deployment environment');
  const id=z.string().uuid().safeParse(process.env.PROVIDER_REVIEW_ORGANISATION_ID);
  if(!id.success)throw new Error('Configure PROVIDER_REVIEW_ORGANISATION_ID with the operator organisation UUID');
  const db=getDbPool();
  const {rows}=await db.query(`SELECT version FROM public.schema_migrations WHERE version IN
    ('037_provider_applications.sql','038_provider_recruitment.sql','039_provider_commissions.sql')`);
  if(rows.length!==3)throw new Error('Apply migrations 037, 038 and 039 through the normal migration runner');
  const {rows:[reviewers]}=await db.query(`SELECT count(*)::integer AS count FROM public.users
    WHERE organisation_id=$1 AND role='admin' AND email_verified_at IS NOT NULL`,[id.data]);
  const minimum=process.env.PROVIDER_PAYOUTS_ENABLED==='true'?2:1;
  if(reviewers.count<minimum)throw new Error(`Operator organisation requires at least ${minimum} verified administrator accounts`);
  if(process.env.PROVIDER_PAYOUTS_ENABLED==='true' && (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET))
    throw new Error('Payout review requires configured Stripe payment reconciliation and signed webhooks');
  console.log(`PASS: recruitment migrations and ${reviewers.count} verified operator reviewers; payout recording ${process.env.PROVIDER_PAYOUTS_ENABLED==='true'?'enabled':'disabled'}`);
  console.log('Read-only check: no roles changed, no payments sent. Bank references are staff attestations, not bank API confirmations.');
}catch(e){console.error(e instanceof Error ? e.message : 'Provider setup check failed');process.exitCode=1;}finally{await closeDbPool();}
