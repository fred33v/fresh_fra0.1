import type { Context } from 'hono';
import { getDbPool } from '../db.js';
import type { DbExecutor } from '../db/transaction.js';
import { jsonError, requireAuth } from '../helpers.js';
import type { ProviderStatus } from './policy.js';
export interface Actor {
  id: string;
  email: string;
  role: string;
  organisation_id: string;
  email_verified_at: Date | null;
}
export interface Application {
  id: string;
  user_id: string;
  organisation_id: string;
  contact_email: string;
  profile: unknown;
  status: ProviderStatus;
  version: number;
  commission_basis_points: number;
  terms_version: string;
  acknowledged_at: Date;
  submitted_at: Date;
  updated_at: Date;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  review_message: string | null;
}
export async function actor(
  c: Context,
  db: DbExecutor = getDbPool(),
  lock = false
): Promise<Actor | Response> {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (c.get('apiKeyAuth' as never))
    return jsonError(c, 403, 'FORBIDDEN', 'Sign in with your user account');
  const user = (
    await db.query<Actor>(
      `SELECT id,email,role,organisation_id,email_verified_at FROM public.users WHERE id=$1${lock ? ' FOR SHARE' : ''}`,
      [auth.userId]
    )
  ).rows[0];
  if (!user || user.organisation_id !== auth.organisationId)
    return jsonError(c, 403, 'FORBIDDEN', 'Current account access required');
  if (!user.email_verified_at)
    return jsonError(
      c,
      403,
      'EMAIL_VERIFICATION_REQUIRED',
      'Confirm your account email before applying or reviewing'
    );
  return user;
}
export function programmeReviewer(user: Actor): boolean {
  const reviewers = (process.env.PROVIDER_REVIEWER_IDS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return user.role === 'admin' && reviewers.includes(user.id.toLowerCase());
}
export async function administrator(
  c: Context,
  db: DbExecutor = getDbPool(),
  lock = false
): Promise<Actor | Response> {
  const user = await actor(c, db, lock);
  return user instanceof Response
    ? user
    : programmeReviewer(user)
      ? user
      : jsonError(c, 403, 'FORBIDDEN', 'Current appointed programme reviewer authority required');
}
