// Operational recovery only: use a trusted administrative terminal after independent identity checks.
import '../src/env.ts';
import { closeDbPool } from '../src/db.ts';
import { withTransaction } from '../src/db/transaction.ts';
import { dbDeleteAllRefreshTokensForUser } from '../src/db/tokens.ts';
const [userId, actorId, reason, execute] = process.argv.slice(2);
if (
  !/^[0-9a-f-]{36}$/i.test(userId ?? '') ||
  !/^[0-9a-f-]{36}$/i.test(actorId ?? '') ||
  userId.toLowerCase() === actorId.toLowerCase() ||
  !reason ||
  reason.length < 20 ||
  reason.length > 2000
)
  throw new Error(
    'Usage: node --import tsx scripts/mfa-recover.mjs USER_UUID INDEPENDENT_ADMIN_UUID "Identity-check case reference and reason" [--execute]'
  );
try {
  await withTransaction(async (db) => {
    const {
      rows: [admin],
    } = await db.query(
      "SELECT id FROM users WHERE id=$1 AND role='admin' AND organisation_id::text=$2 AND email_verified_at IS NOT NULL FOR SHARE",
      [actorId, process.env.PROVIDER_REVIEW_ORGANISATION_ID ?? '']
    );
    if (!admin) throw new Error('Independent verified operator administrator required');
    const existing = (
      await db.query('SELECT user_id FROM user_mfa WHERE user_id=$1 FOR UPDATE', [userId])
    ).rows[0];
    if (!existing) throw new Error('MFA record not found');
    if (execute !== '--execute') {
      console.log('DRY RUN: no changes. Complete independent identity checks before --execute.');
      return;
    }
    // Keep an enabled tombstone: old access/refresh tokens remain invalid until fresh enrollment.
    await db.query(
      "UPDATE user_mfa SET enabled=false,secret='{}',version=version+1,last_counter=-1,pending_until=now()-interval '1 second',attempts=0,locked_until=NULL WHERE user_id=$1",
      [userId]
    );
    await dbDeleteAllRefreshTokensForUser(userId, db);
    await db.query(
      'INSERT INTO security_role_events(user_id,actor_id,action,reason) VALUES($1,$2,$3,$4)',
      [userId, actorId, 'mfa_recovery', reason]
    );
    console.log('Recovery recorded; sessions revoked. User must enroll a new authenticator.');
  });
} finally {
  await closeDbPool();
}
