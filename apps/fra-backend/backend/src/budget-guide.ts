// ============================================================
// Stop FRA - Budget Guide Routes
// Mounted at /api/v1/budget-guide in index.ts
// ============================================================

import { Hono } from 'hono';
import { z } from 'zod';
import { getDbPool } from './db.js';
import { hasDatabase, jsonError, requireAuth } from './helpers.js';
import { requireUUIDParam, RATE_LIMITS } from './types.js';
import { rateLimit } from './middleware.js';

// ── Budget Guide Hono App ────────────────────────────────────

const budgetGuide = new Hono();

// ── Progress ─────────────────────────────────────────────────

// GET /progress — Get user's budget guide progress
budgetGuide.get('/progress', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (!hasDatabase()) return jsonError(c, 503, 'NO_DB', 'Database not configured');

  const pool = getDbPool();
  const res = await pool.query(
    'SELECT * FROM budget_guide_progress WHERE user_id = $1 LIMIT 1',
    [auth.userId]
  );

  return c.json({ success: true, data: res.rows[0] ?? null });
});

// POST /progress — Create initial progress record
budgetGuide.post('/progress', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (!hasDatabase()) return jsonError(c, 503, 'NO_DB', 'Database not configured');

  const body = await c.req.json().catch(() => null);
  const schema = z.object({
    selectedRoles: z.array(z.string().max(200)).max(50).optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION', 'Invalid request body');

  const pool = getDbPool();
  const res = await pool.query(
    `INSERT INTO budget_guide_progress (user_id, selected_roles)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET
       selected_roles = EXCLUDED.selected_roles,
       updated_at = now()
     RETURNING *`,
    [auth.userId, parsed.data.selectedRoles ?? []]
  );

  return c.json({ success: true, data: res.rows[0] }, 201);
});

// PATCH /progress — Update progress
budgetGuide.patch('/progress', async (c) => {
  const limited = await rateLimit('budget-guide:progress', { windowMs: RATE_LIMITS.WORKSHOP_WRITE_WINDOW_MS, max: RATE_LIMITS.WORKSHOP_WRITE_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (!hasDatabase()) return jsonError(c, 503, 'NO_DB', 'Database not configured');

  const body = await c.req.json().catch(() => null);
  const schema = z.object({
    selectedRoles: z.array(z.string().max(200)).max(50).optional(),
    completedScreens: z.array(z.string().max(200)).max(100).optional(),
    watchItems: z.record(z.string(), z.unknown()).refine(
      (v) => JSON.stringify(v).length <= 100_000,
      'watchItems payload too large (max 100KB)'
    ).optional(),
    contactDetails: z.record(z.string(), z.unknown()).refine(
      (v) => JSON.stringify(v).length <= 100_000,
      'contactDetails payload too large (max 100KB)'
    ).optional(),
    currentScreen: z.string().max(200).optional(),
    completedAt: z.string().datetime({ message: 'completedAt must be a valid ISO 8601 datetime' }).nullable().optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION', 'Invalid request body');

  const updates: string[] = ['updated_at = now()'];
  const values: unknown[] = [auth.userId];
  let paramIndex = 2;

  if (parsed.data.selectedRoles !== undefined) {
    updates.push(`selected_roles = $${paramIndex++}`);
    values.push(parsed.data.selectedRoles);
  }
  if (parsed.data.completedScreens !== undefined) {
    updates.push(`completed_screens = $${paramIndex++}`);
    values.push(parsed.data.completedScreens);
  }
  if (parsed.data.watchItems !== undefined) {
    updates.push(`watch_items = $${paramIndex++}`);
    values.push(JSON.stringify(parsed.data.watchItems));
  }
  if (parsed.data.contactDetails !== undefined) {
    updates.push(`contact_details = $${paramIndex++}`);
    values.push(JSON.stringify(parsed.data.contactDetails));
  }
  if (parsed.data.currentScreen !== undefined) {
    updates.push(`current_screen = $${paramIndex++}`);
    values.push(parsed.data.currentScreen);
  }
  if (parsed.data.completedAt !== undefined) {
    updates.push(`completed_at = $${paramIndex++}`);
    values.push(parsed.data.completedAt);
  }

  const pool = getDbPool();
  const res = await pool.query(
    `UPDATE budget_guide_progress SET ${updates.join(', ')} WHERE user_id = $1 RETURNING *`,
    values
  );

  if (res.rows.length === 0) return jsonError(c, 404, 'NOT_FOUND', 'Progress record not found');
  return c.json({ success: true, data: res.rows[0] });
});

// ── Pledge ───────────────────────────────────────────────────

// GET /pledge — Get user's pledge
budgetGuide.get('/pledge', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (!hasDatabase()) return jsonError(c, 503, 'NO_DB', 'Database not configured');

  const pool = getDbPool();
  const res = await pool.query(
    'SELECT * FROM budget_guide_pledges WHERE user_id = $1 LIMIT 1',
    [auth.userId]
  );

  return c.json({ success: true, data: res.rows[0] ?? null });
});

// POST /pledge — Save pledge with signature
budgetGuide.post('/pledge', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (!hasDatabase()) return jsonError(c, 503, 'NO_DB', 'Database not configured');

  const body = await c.req.json().catch(() => null);
  const schema = z.object({
    signature: z.string().min(1, 'Signature is required').max(500_000, 'Signature too large'),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION', 'Invalid pledge payload');

  const pool = getDbPool();
  const res = await pool.query(
    `INSERT INTO budget_guide_pledges (user_id, signature)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET
       signature = EXCLUDED.signature,
       pledged_at = now()
     RETURNING *`,
    [auth.userId, parsed.data.signature]
  );

  return c.json({ success: true, data: res.rows[0] }, 201);
});

// ── Analytics ────────────────────────────────────────────────

// GET /analytics — Get user's analytics
budgetGuide.get('/analytics', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (!hasDatabase()) return jsonError(c, 503, 'NO_DB', 'Database not configured');

  const pool = getDbPool();
  const res = await pool.query(
    'SELECT * FROM budget_guide_analytics WHERE user_id = $1 LIMIT 1',
    [auth.userId]
  );

  return c.json({ success: true, data: res.rows[0] ?? null });
});

// POST /analytics — Create or update analytics
budgetGuide.post('/analytics', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (!hasDatabase()) return jsonError(c, 503, 'NO_DB', 'Database not configured');

  const body = await c.req.json().catch(() => null);
  const schema = z.object({
    quizScores: z.record(z.string(), z.unknown()).refine(
      (v) => JSON.stringify(v).length <= 100_000,
      'quizScores payload too large (max 100KB)'
    ).optional(),
    timeSpentSeconds: z.number().int().min(0).optional(),
    screensVisited: z.array(z.string().max(200)).max(500).optional(),
    completed: z.boolean().optional(),
  });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION', 'Invalid request body');

  const pool = getDbPool();
  const res = await pool.query(
    `INSERT INTO budget_guide_analytics (user_id, organisation_id, quiz_scores, time_spent_seconds, screens_visited, completed)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id) DO UPDATE SET
       quiz_scores = COALESCE(EXCLUDED.quiz_scores, budget_guide_analytics.quiz_scores),
       time_spent_seconds = COALESCE(EXCLUDED.time_spent_seconds, budget_guide_analytics.time_spent_seconds),
       screens_visited = COALESCE(EXCLUDED.screens_visited, budget_guide_analytics.screens_visited),
       completed = COALESCE(EXCLUDED.completed, budget_guide_analytics.completed),
       updated_at = now()
     RETURNING *`,
    [
      auth.userId,
      auth.organisationId || null,
      JSON.stringify(parsed.data.quizScores ?? {}),
      parsed.data.timeSpentSeconds ?? 0,
      parsed.data.screensVisited ?? [],
      parsed.data.completed ?? false,
    ]
  );

  return c.json({ success: true, data: res.rows[0] }, 201);
});

// GET /analytics/org/:orgId — Get org-wide analytics (admin only)
budgetGuide.get('/analytics/org/:orgId', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;
  if (!hasDatabase()) return jsonError(c, 503, 'NO_DB', 'Database not configured');

  // Only admins or employers in the same org can view org analytics
  const orgId = requireUUIDParam(c, 'orgId');
  if (orgId instanceof Response) return orgId;
  if (auth.role !== 'admin' && auth.role !== 'employer') {
    return jsonError(c, 403, 'FORBIDDEN', 'Requires employer or admin role');
  }
  if (auth.role !== 'admin' && auth.organisationId !== orgId) {
    return jsonError(c, 403, 'FORBIDDEN', 'Not authorised to view this organisation');
  }

  const pool = getDbPool();
  const res = await pool.query(
    `SELECT
       COUNT(*) as total_users,
       COUNT(*) FILTER (WHERE completed = true) as completed_users,
       AVG(time_spent_seconds) as avg_time_seconds,
       jsonb_agg(
         jsonb_build_object(
           'userId', user_id,
           'completed', completed,
           'timeSpent', time_spent_seconds,
           'screensVisited', screens_visited
         )
       ) as users
     FROM budget_guide_analytics
     WHERE organisation_id = $1`,
    [orgId]
  );

  return c.json({ success: true, data: res.rows[0] });
});

export default budgetGuide;
