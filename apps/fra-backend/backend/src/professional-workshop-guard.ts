import type { Context } from 'hono';
import { getDbPool } from './db.js';
import { hasDatabase, jsonError } from './helpers.js';
import { professionalSessionAuthority } from './professional-authority.js';
import { RecruitmentError } from './provider-recruitment.js';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
/** Guard existing workshop paths when (and only when) their resource belongs to a professional session. */
export async function professionalWorkshopGuard(c: Context) {
  if (!hasDatabase()) return null;
  const db = getDbPool(),
    path = c.req.path.split('/workshop')[1] ?? c.req.path;
  let sessionId: string | undefined;
  const direct = path.match(/^\/sessions\/([a-f0-9-]{36})(?:\/|$)/i);
  if (direct) sessionId = direct[1];
  const code = path.match(/^\/sessions\/code\/([^/]+)$/);
  if (code) {
    const clean = code[1]
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 10);
    sessionId = (
      await db.query('SELECT id FROM public.workshop_sessions WHERE session_code=$1', [clean])
    ).rows[0]?.id;
  }
  const resource = path.match(
    /^\/(progress|polls|questions|action-plans)\/([a-f0-9-]{36})(?:\/|$)/i
  );
  if (resource) {
    const tables: Record<string, string> = {
      progress: 'workshop_progress',
      polls: 'polls',
      questions: 'questions',
      'action-plans': 'action_plans',
    };
    const expression =
      resource[1] === 'progress' ? 'COALESCE(provider_session_id,session_id)' : 'session_id';
    sessionId = (
      await db.query(
        `SELECT ${expression} AS session_id FROM public.${tables[resource[1]]} WHERE id=$1`,
        [resource[2]]
      )
    ).rows[0]?.session_id;
  }
  if (
    !sessionId &&
    ['POST', 'PUT', 'PATCH'].includes(c.req.method) &&
    c.req.header('content-type')?.includes('application/json')
  ) {
    const body = await c.req.json().catch(() => null);
    if (typeof body?.sessionId === 'string' && uuid.test(body.sessionId))
      sessionId = body.sessionId;
  }
  const query = c.req.query('sessionId');
  if (!sessionId && query && uuid.test(query)) sessionId = query;
  if (!sessionId || !uuid.test(sessionId)) return null;
  try {
    await professionalSessionAuthority(db, sessionId, 'deliver');
    return null;
  } catch (e) {
    if (e instanceof RecruitmentError)
      return jsonError(c, e.status, 'PROFESSIONAL_AUTHORITY', e.message);
    throw e;
  }
}
