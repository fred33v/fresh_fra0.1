// ============================================================
// Stop FRA - Workshop Routes (migrated from Supabase)
// Mounted at /api/v1/workshop in index.ts
// ============================================================

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { Context } from 'hono';
import crypto from 'node:crypto';
import { z } from 'zod';
import { getDbPool } from './db.js';
import { type AuthContext, hasDatabase, jsonError, getAuth as getAuthBase, requireAuth } from './helpers.js';
import { createLogger } from './logger.js';
import { getRedis } from './redis.js';
import { rateLimit, getClientIp } from './middleware.js';
import { RATE_LIMITS, isValidUUID } from './types.js';
import { auditLog } from './db/index.js';
import { requirePackage } from './entitlements.js';
import { mergeQuizScores, missingForCompletion } from './workshop-quiz.js';
import {
  workshopProfiles, workshopSessions, sessionParticipants, workshopProgress, polls, pollResponses, questions,
  questionUpvotes, actionPlans, certificates, newId, nowIso, memSessionRole, memParticipantCount, memFindProgress,
  latestFirst, type SessionRow,
} from './workshop-store.js';

function requireUUID(c: Context, name: string): string | Response {
  const value = c.req.param(name);
  if (!isValidUUID(value)) {
    return jsonError(c, 400, 'INVALID_PARAM', `Invalid ${name} format`);
  }
  return value;
}

const logger = createLogger('workshop');

// ── Types ────────────────────────────────────────────────────

type SSEClient = {
  id: string;
  userId: string;
  write: (event: string, data: unknown) => void;
  close: () => void;
};

// ── SSE connection registry ──────────────────────────────────

const sseClients = new Map<string, Set<SSEClient>>();

export function broadcastToSession(sessionId: string, event: string, data: unknown) {
  const clients = sseClients.get(sessionId);
  if (!clients || clients.size === 0) return;
  for (const client of clients) {
    try {
      client.write(event, data);
    } catch (err: unknown) {
      logger.warn('SSE client write failed, removing client', { sessionId, clientId: client.id, error: String(err) });
      clients.delete(client);
    }
  }
}

// ── SSE token store (short-lived, single-use tokens for SSE auth) ──

const SSE_TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SSE_TOKEN_PREFIX = 'sse_token:';

type SseTokenEntry = {
  auth: AuthContext;
  expiresAt: number;
};

// In-memory fallback when Redis is not available
const sseTokenStore = new Map<string, SseTokenEntry>();

async function storeSseToken(token: string, auth: AuthContext): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(`${SSE_TOKEN_PREFIX}${token}`, JSON.stringify(auth), { ex: Math.ceil(SSE_TOKEN_TTL_MS / 1000) });
    return;
  }
  sseTokenStore.set(token, { auth, expiresAt: Date.now() + SSE_TOKEN_TTL_MS });

  // Lazy cleanup of expired tokens to prevent unbounded memory growth
  if (sseTokenStore.size > 1000) {
    const now = Date.now();
    for (const [key, entry] of sseTokenStore) {
      if (entry.expiresAt < now) sseTokenStore.delete(key);
    }
  }
}

async function consumeSseToken(token: string): Promise<AuthContext | null> {
  const redis = getRedis();
  if (redis) {
    const key = `${SSE_TOKEN_PREFIX}${token}`;
    const raw = await redis.get<string>(key);
    if (!raw) return null;
    // Single-use: delete immediately after retrieval
    await redis.del(key);
    try {
      return JSON.parse(raw) as AuthContext;
    } catch {
      return null;
    }
  }

  const entry = sseTokenStore.get(token);
  if (!entry) return null;
  // Single-use: delete immediately
  sseTokenStore.delete(token);
  if (entry.expiresAt < Date.now()) return null;
  return entry.auth;
}

// ── Helpers ──────────────────────────────────────────────────

// Workshop-specific auth that accepts a short-lived SSE token from query params.
// The SSE token is single-use and expires after 5 minutes, so even if it appears
// in logs or browser history, the exposure window is minimal.
async function getAuthWithSseToken(c: Context): Promise<AuthContext | null> {
  // Try standard header-based auth first
  const headerAuth = getAuthBase(c);
  if (headerAuth) return headerAuth;

  // Fall back to short-lived, single-use SSE token from query param
  const sseToken = c.req.query('sse_token');
  if (!sseToken) return null;

  return consumeSseToken(sseToken);
}

// ── Workshop Hono App ────────────────────────────────────────

const workshop = new Hono();

// ── Package gate: training is part of Professional and Enterprise ──
// Profile/roles stay open (used during onboarding); the SSE stream is covered
// because its token is only issued by the gated /sse-token route.
const UNGATED_WORKSHOP_PATHS = [/\/profile$/, /\/roles$/, /\/events$/];

workshop.use('/*', async (c, next) => {
  if (UNGATED_WORKSHOP_PATHS.some((re) => re.test(c.req.path))) return next();

  const auth = getAuthBase(c);
  if (!auth) return next(); // route handlers return 401

  // Admins and facilitators run the workshops, so they are not package-gated
  if (auth.role === 'admin') return next();
  if (hasDatabase()) {
    const roles = await getDbPool().query(
      "SELECT 1 FROM workshop_roles WHERE user_id = $1 AND role = 'facilitator' LIMIT 1",
      [auth.userId]
    );
    if (roles.rowCount) return next();
  }

  const denied = await requirePackage(c, auth, 'pkg_training');
  if (denied) return denied;
  return next();
});

// ── Profile endpoints ────────────────────────────────────────

workshop.get('/profile', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  if (!hasDatabase()) return c.json({ success: true, data: workshopProfiles.get(auth.userId) ?? null });

  const pool = getDbPool();
  const res = await pool.query(
    'SELECT id, user_id, full_name, organization_name, sector, job_title, created_at, updated_at FROM workshop_profiles WHERE user_id = $1 LIMIT 1',
    [auth.userId]
  );

  return c.json({ success: true, data: res.rows[0] ?? null });
});

workshop.put('/profile', async (c) => {
  const limited = await rateLimit('workshop:profile', { windowMs: RATE_LIMITS.WORKSHOP_WRITE_WINDOW_MS, max: RATE_LIMITS.WORKSHOP_WRITE_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const schema = z.object({
    fullName: z.string().min(1).max(200),
    organizationName: z.string().min(1).max(200),
    sector: z.enum(['public', 'charity', 'private']),
    jobTitle: z.string().max(200).optional(),
  });

  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid profile data');

  const { fullName, organizationName, sector, jobTitle } = parsed.data;

  if (!hasDatabase()) {
    const existing = workshopProfiles.get(auth.userId);
    const now = nowIso();
    const row = {
      id: existing?.id ?? newId(), user_id: auth.userId, full_name: fullName, organization_name: organizationName, sector,
      job_title: jobTitle ?? null, created_at: existing?.created_at ?? now, updated_at: now,
    };
    workshopProfiles.set(auth.userId, row);
    return c.json({ success: true, data: row });
  }

  const pool = getDbPool();

  const res = await pool.query(
    `INSERT INTO workshop_profiles (user_id, full_name, organization_name, sector, job_title, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (user_id) DO UPDATE SET full_name = $2, organization_name = $3, sector = $4, job_title = $5, updated_at = now()
     RETURNING *`,
    [auth.userId, fullName, organizationName, sector, jobTitle ?? null]
  );

  return c.json({ success: true, data: res.rows[0] });
});

// ── Roles endpoints ──────────────────────────────────────────

workshop.get('/roles', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  if (!hasDatabase()) return c.json({ success: true, data: [] });

  const pool = getDbPool();
  const res = await pool.query(
    'SELECT role FROM workshop_roles WHERE user_id = $1',
    [auth.userId]
  );

  return c.json({ success: true, data: res.rows.map((r: { role: string }) => r.role) });
});

// ── Session endpoints ────────────────────────────────────────

workshop.get('/sessions', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const isActiveParam = c.req.query('isActive');

  if (!hasDatabase()) {
    const rows = [...workshopSessions.values()].filter((sn) => sn.facilitator_id === auth.userId
      && (isActiveParam !== 'true' && isActiveParam !== 'false' ? true : sn.is_active === (isActiveParam === 'true')));
    return c.json({ success: true, data: latestFirst(rows, 'created_at') });
  }

  const pool = getDbPool();

  if (isActiveParam === 'true' || isActiveParam === 'false') {
    const isActive = isActiveParam === 'true';
    const res = await pool.query(
      'SELECT * FROM workshop_sessions WHERE facilitator_id = $1 AND is_active = $2 ORDER BY created_at DESC',
      [auth.userId, isActive]
    );
    return c.json({ success: true, data: res.rows });
  }

  const res = await pool.query(
    'SELECT * FROM workshop_sessions WHERE facilitator_id = $1 ORDER BY created_at DESC',
    [auth.userId]
  );

  return c.json({ success: true, data: res.rows });
});

workshop.post('/sessions', async (c) => {
  const limited = await rateLimit('workshop:sessions', { windowMs: RATE_LIMITS.WORKSHOP_WRITE_WINDOW_MS, max: RATE_LIMITS.WORKSHOP_WRITE_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const schema = z.object({ title: z.string().min(1).max(200) });
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Title is required');

  const sessionCode = crypto.randomBytes(4).toString('hex').toUpperCase().substring(0, 6);

  let res: { rows: SessionRow[] };
  if (hasDatabase()) {
    res = await getDbPool().query(
      `INSERT INTO workshop_sessions (facilitator_id, session_code, title, is_active, current_slide)
       VALUES ($1, $2, $3, true, 0) RETURNING *`,
      [auth.userId, sessionCode, parsed.data.title]
    );
  } else {
    const row: SessionRow = {
      id: newId(), facilitator_id: auth.userId, session_code: sessionCode, title: parsed.data.title,
      current_slide: 0, is_active: true, created_at: nowIso(), ended_at: null,
    };
    workshopSessions.set(row.id, row);
    res = { rows: [row] };
  }

  await auditLog({
    eventType: 'workshop.session_create', actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 'workshop_session', resourceId: res.rows[0].id,
    details: { title: parsed.data.title, sessionCode },
    ipAddress: getClientIp(c), userAgent: c.req.header('user-agent'),
  });

  return c.json({ success: true, data: res.rows[0] }, 201);
});

workshop.get('/sessions/:id', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const id = requireUUID(c, 'id');
  if (id instanceof Response) return id;

  if (!hasDatabase()) {
    const session = workshopSessions.get(id);
    if (!session) return jsonError(c, 404, 'NOT_FOUND', 'Session not found');
    if (!memSessionRole(id, auth.userId)) return jsonError(c, 403, 'FORBIDDEN', 'Not a member of this session');
    return c.json({ success: true, data: session });
  }

  const pool = getDbPool();
  const res = await pool.query('SELECT * FROM workshop_sessions WHERE id = $1 LIMIT 1', [id]);

  if (!res.rows[0]) return jsonError(c, 404, 'NOT_FOUND', 'Session not found');

  // Verify the user is the facilitator or a session participant
  if (res.rows[0].facilitator_id !== auth.userId) {
    const participantCheck = await pool.query(
      'SELECT 1 FROM session_participants WHERE session_id = $1 AND user_id = $2 LIMIT 1',
      [id, auth.userId]
    );
    if (!participantCheck.rows[0]) {
      return jsonError(c, 403, 'FORBIDDEN', 'Not a member of this session');
    }
  }

  return c.json({ success: true, data: res.rows[0] });
});

workshop.get('/sessions/code/:code', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const sanitisedCode = c.req.param('code').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  if (!sanitisedCode) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid session code');

  if (!hasDatabase()) {
    const session = [...workshopSessions.values()].find((sn) => sn.session_code === sanitisedCode);
    if (!session) return jsonError(c, 404, 'NOT_FOUND', 'Session not found');
    const { id, title, is_active, created_at } = session;
    return c.json({ success: true, data: { id, title, is_active, created_at } });
  }

  const pool = getDbPool();
  const res = await pool.query(
    'SELECT id, title, is_active, created_at FROM workshop_sessions WHERE session_code = $1 LIMIT 1',
    [sanitisedCode]
  );

  if (!res.rows[0]) return jsonError(c, 404, 'NOT_FOUND', 'Session not found');
  return c.json({ success: true, data: res.rows[0] });
});

workshop.patch('/sessions/:id', async (c) => {
  const limited = await rateLimit('workshop:sessions', { windowMs: RATE_LIMITS.WORKSHOP_WRITE_WINDOW_MS, max: RATE_LIMITS.WORKSHOP_WRITE_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const schema = z.object({
    currentSlide: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
    title: z.string().min(1).max(200).optional(),
  });
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid update data');

  const sessionId = requireUUID(c, 'id');
  if (sessionId instanceof Response) return sessionId;

  if (!hasDatabase()) {
    const session = workshopSessions.get(sessionId);
    if (!session) return jsonError(c, 404, 'NOT_FOUND', 'Session not found');
    if (session.facilitator_id !== auth.userId) return jsonError(c, 403, 'FORBIDDEN', 'Not your session');
    const { currentSlide, isActive, title } = parsed.data;
    if (currentSlide === undefined && isActive === undefined && title === undefined) {
      return jsonError(c, 400, 'VALIDATION_ERROR', 'No fields to update');
    }
    if (currentSlide !== undefined) session.current_slide = currentSlide;
    if (isActive !== undefined) session.is_active = isActive;
    if (title !== undefined) session.title = title;
    broadcastToSession(sessionId, 'session_update', session);
    return c.json({ success: true, data: session });
  }

  const pool = getDbPool();

  // Verify ownership
  const check = await pool.query('SELECT facilitator_id FROM workshop_sessions WHERE id = $1', [sessionId]);
  if (!check.rows[0]) return jsonError(c, 404, 'NOT_FOUND', 'Session not found');
  if (check.rows[0].facilitator_id !== auth.userId) return jsonError(c, 403, 'FORBIDDEN', 'Not your session');

  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (parsed.data.currentSlide !== undefined) { sets.push(`current_slide = $${idx++}`); vals.push(parsed.data.currentSlide); }
  if (parsed.data.isActive !== undefined) { sets.push(`is_active = $${idx++}`); vals.push(parsed.data.isActive); }
  if (parsed.data.title !== undefined) { sets.push(`title = $${idx++}`); vals.push(parsed.data.title); }

  if (sets.length === 0) return jsonError(c, 400, 'VALIDATION_ERROR', 'No fields to update');

  vals.push(sessionId);
  const res = await pool.query(
    `UPDATE workshop_sessions SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    vals
  );

  // Broadcast session update via SSE
  broadcastToSession(sessionId, 'session_update', res.rows[0]);

  return c.json({ success: true, data: res.rows[0] });
});

workshop.post('/sessions/:id/end', async (c) => {
  const limited = await rateLimit('workshop:sessions', { windowMs: RATE_LIMITS.WORKSHOP_WRITE_WINDOW_MS, max: RATE_LIMITS.WORKSHOP_WRITE_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const sessionId = requireUUID(c, 'id');
  if (sessionId instanceof Response) return sessionId;

  let res: { rows: SessionRow[] };
  if (hasDatabase()) {
    const pool = getDbPool();
    const check = await pool.query('SELECT facilitator_id FROM workshop_sessions WHERE id = $1', [sessionId]);
    if (!check.rows[0]) return jsonError(c, 404, 'NOT_FOUND', 'Session not found');
    if (check.rows[0].facilitator_id !== auth.userId) return jsonError(c, 403, 'FORBIDDEN', 'Not your session');

    res = await pool.query(
      'UPDATE workshop_sessions SET is_active = false, ended_at = now() WHERE id = $1 RETURNING *',
      [sessionId]
    );
  } else {
    const session = workshopSessions.get(sessionId);
    if (!session) return jsonError(c, 404, 'NOT_FOUND', 'Session not found');
    if (session.facilitator_id !== auth.userId) return jsonError(c, 403, 'FORBIDDEN', 'Not your session');
    session.is_active = false;
    session.ended_at = nowIso();
    res = { rows: [session] };
  }

  broadcastToSession(sessionId, 'session_update', res.rows[0]);

  await auditLog({
    eventType: 'workshop.session_end', actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 'workshop_session', resourceId: sessionId,
    ipAddress: getClientIp(c), userAgent: c.req.header('user-agent'),
  });

  return c.json({ success: true, data: res.rows[0] });
});

workshop.post('/sessions/:id/join', async (c) => {
  const limited = await rateLimit('workshop:join', { windowMs: RATE_LIMITS.WORKSHOP_JOIN_WINDOW_MS, max: RATE_LIMITS.WORKSHOP_JOIN_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const sessionId = requireUUID(c, 'id');
  if (sessionId instanceof Response) return sessionId;

  if (!hasDatabase()) {
    const session = workshopSessions.get(sessionId);
    if (!session) return jsonError(c, 404, 'NOT_FOUND', 'Session not found');
    if (!session.is_active) return jsonError(c, 400, 'SESSION_ENDED', 'Session is no longer active');
    if (!sessionParticipants.has(sessionId)) sessionParticipants.set(sessionId, new Map());
    const members = sessionParticipants.get(sessionId)!;
    if (!members.has(auth.userId)) members.set(auth.userId, nowIso());
    const participantCount = members.size;
    broadcastToSession(sessionId, 'participant_joined', { participantCount });
    return c.json({ success: true, data: { participantCount } });
  }

  const pool = getDbPool();

  // Verify session exists and is active
  const check = await pool.query('SELECT id, is_active FROM workshop_sessions WHERE id = $1', [sessionId]);
  if (!check.rows[0]) return jsonError(c, 404, 'NOT_FOUND', 'Session not found');
  if (!check.rows[0].is_active) return jsonError(c, 400, 'SESSION_ENDED', 'Session is no longer active');

  await pool.query(
    'INSERT INTO session_participants (session_id, user_id) VALUES ($1, $2) ON CONFLICT (session_id, user_id) DO NOTHING',
    [sessionId, auth.userId]
  );

  const countRes = await pool.query(
    'SELECT COUNT(*)::int AS count FROM session_participants WHERE session_id = $1',
    [sessionId]
  );
  const participantCount = countRes.rows[0]?.count ?? 0;

  broadcastToSession(sessionId, 'participant_joined', { participantCount });

  return c.json({ success: true, data: { participantCount } });
});

workshop.get('/sessions/:id/participants', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const id = requireUUID(c, 'id');
  if (id instanceof Response) return id;

  if (!hasDatabase()) {
    if (!workshopSessions.has(id)) return jsonError(c, 404, 'NOT_FOUND', 'Session not found');
    if (!memSessionRole(id, auth.userId)) return jsonError(c, 403, 'FORBIDDEN', 'Not a member of this session');
    return c.json({ success: true, data: { count: memParticipantCount(id) } });
  }

  const pool = getDbPool();

  // Verify the user is the facilitator or a session participant
  const sessionCheck = await pool.query(
    'SELECT facilitator_id FROM workshop_sessions WHERE id = $1',
    [id]
  );
  if (!sessionCheck.rows[0]) return jsonError(c, 404, 'NOT_FOUND', 'Session not found');
  if (sessionCheck.rows[0].facilitator_id !== auth.userId) {
    const partCheck = await pool.query(
      'SELECT 1 FROM session_participants WHERE session_id = $1 AND user_id = $2 LIMIT 1',
      [id, auth.userId]
    );
    if (!partCheck.rows[0]) {
      return jsonError(c, 403, 'FORBIDDEN', 'Not a member of this session');
    }
  }

  const res = await pool.query(
    'SELECT COUNT(*)::int AS count FROM session_participants WHERE session_id = $1',
    [id]
  );

  return c.json({ success: true, data: { count: res.rows[0]?.count ?? 0 } });
});

// ── Progress endpoints ───────────────────────────────────────

workshop.get('/progress', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const sessionId = c.req.query('sessionId');

  if (sessionId && !isValidUUID(sessionId)) {
    return jsonError(c, 400, 'INVALID_PARAM', 'Invalid sessionId format');
  }

  if (!hasDatabase()) return c.json({ success: true, data: memFindProgress(auth.userId, sessionId ?? null) ?? null });

  const pool = getDbPool();

  let res;
  if (sessionId) {
    res = await pool.query(
      'SELECT * FROM workshop_progress WHERE user_id = $1 AND session_id = $2 LIMIT 1',
      [auth.userId, sessionId]
    );
  } else {
    res = await pool.query(
      'SELECT * FROM workshop_progress WHERE user_id = $1 AND session_id IS NULL LIMIT 1',
      [auth.userId]
    );
  }

  return c.json({ success: true, data: res.rows[0] ?? null });
});

workshop.post('/progress', async (c) => {
  const limited = await rateLimit('workshop:progress', { windowMs: RATE_LIMITS.WORKSHOP_WRITE_WINDOW_MS, max: RATE_LIMITS.WORKSHOP_WRITE_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const schema = z.object({ sessionId: z.string().uuid().optional() });
  const parsed = schema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid data');

  if (!hasDatabase()) {
    const existing = memFindProgress(auth.userId, parsed.data.sessionId ?? null);
    if (existing) return c.json({ success: true, data: existing });
    const now = nowIso();
    const row = {
      id: newId(), user_id: auth.userId, session_id: parsed.data.sessionId ?? null, current_section: 0,
      completed_sections: [], quiz_scores: {}, scenario_choices: {}, completed_at: null, created_at: now, updated_at: now,
    };
    workshopProgress.set(row.id, row);
    return c.json({ success: true, data: row }, 201);
  }

  const pool = getDbPool();
  const res = await pool.query(
    `INSERT INTO workshop_progress (user_id, session_id, current_section, completed_sections, quiz_scores, scenario_choices)
     VALUES ($1, $2, 0, '{}', '{}'::jsonb, '{}'::jsonb)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [auth.userId, parsed.data.sessionId ?? null]
  );

  // If conflict (already exists), fetch existing
  if (res.rows.length === 0) {
    const existing = parsed.data.sessionId
      ? await pool.query('SELECT * FROM workshop_progress WHERE user_id = $1 AND session_id = $2 LIMIT 1', [auth.userId, parsed.data.sessionId])
      : await pool.query('SELECT * FROM workshop_progress WHERE user_id = $1 AND session_id IS NULL LIMIT 1', [auth.userId]);
    return c.json({ success: true, data: existing.rows[0] ?? null });
  }

  return c.json({ success: true, data: res.rows[0] }, 201);
});

workshop.patch('/progress/:id', async (c) => {
  const limited = await rateLimit('workshop:progress', { windowMs: RATE_LIMITS.WORKSHOP_WRITE_WINDOW_MS, max: RATE_LIMITS.WORKSHOP_WRITE_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const schema = z.object({
    currentSection: z.number().int().min(0).optional(),
    completedSections: z.array(z.number().int()).max(100).optional(),
    // The chosen option per quiz section ({ "1": 2 }); the server works out the score.
    // Scores sent by the client are ignored, so they cannot be faked.
    quizAnswers: z.record(z.string().regex(/^\d{1,3}$/), z.number().int().min(0).max(20))
      .refine((v) => Object.keys(v).length <= 50, 'Too many quiz answers').optional(),
    scenarioChoices: z.record(z.string().max(2000)).refine(
      (v) => JSON.stringify(v).length <= 100_000,
      'scenarioChoices payload too large (max 100KB)'
    ).optional(),
    // Asks to mark the workshop complete. The server checks every section and quiz is done
    // and records its own time; the value sent is not stored.
    completedAt: z.string().datetime({ message: 'completedAt must be a valid ISO 8601 datetime' }).optional(),
  });
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid progress data');

  const progressId = requireUUID(c, 'id');
  if (progressId instanceof Response) return progressId;

  const d = parsed.data;
  const pool = hasDatabase() ? getDbPool() : null;

  // Load the saved progress (and verify ownership)
  const current = pool
    ? (await pool.query('SELECT * FROM workshop_progress WHERE id = $1', [progressId])).rows[0]
    : workshopProgress.get(progressId);
  if (!current) return jsonError(c, 404, 'NOT_FOUND', 'Progress not found');
  if (current.user_id !== auth.userId) return jsonError(c, 403, 'FORBIDDEN', 'Not your progress');

  let quizScores: Record<string, number> | undefined;
  if (d.quizAnswers !== undefined) {
    const merged = mergeQuizScores(current.quiz_scores, d.quizAnswers);
    if (merged.invalid.length) return jsonError(c, 400, 'VALIDATION_ERROR', `No quiz for section(s) ${merged.invalid.join(', ')}`);
    quizScores = merged.scores;
  }

  let completedAt: string | undefined;
  if (d.completedAt !== undefined) {
    const missing = missingForCompletion(d.completedSections ?? current.completed_sections, quizScores ?? current.quiz_scores);
    if (missing.sections.length || missing.quizzes.length) {
      return jsonError(c, 400, 'NOT_COMPLETED',
        `Workshop not finished: sections [${missing.sections.join(', ')}] and quizzes [${missing.quizzes.join(', ')}] remain`);
    }
    completedAt = current.completed_at ?? nowIso(); // keep the first completion date
  }

  if (!pool) {
    const row = current;
    if (d.currentSection !== undefined) row.current_section = d.currentSection;
    if (d.completedSections !== undefined) row.completed_sections = d.completedSections;
    if (quizScores !== undefined) row.quiz_scores = quizScores;
    if (d.scenarioChoices !== undefined) row.scenario_choices = d.scenarioChoices;
    if (completedAt !== undefined) row.completed_at = completedAt;
    row.updated_at = nowIso();
    return c.json({ success: true, data: row });
  }

  const sets: string[] = ['updated_at = now()'];
  const vals: unknown[] = [];
  let idx = 1;

  if (parsed.data.currentSection !== undefined) { sets.push(`current_section = $${idx++}`); vals.push(parsed.data.currentSection); }
  if (parsed.data.completedSections !== undefined) { sets.push(`completed_sections = $${idx++}`); vals.push(parsed.data.completedSections); }
  if (quizScores !== undefined) { sets.push(`quiz_scores = $${idx++}`); vals.push(JSON.stringify(quizScores)); }
  if (parsed.data.scenarioChoices !== undefined) { sets.push(`scenario_choices = $${idx++}`); vals.push(JSON.stringify(parsed.data.scenarioChoices)); }
  if (completedAt !== undefined) { sets.push(`completed_at = $${idx++}`); vals.push(completedAt); }

  vals.push(progressId);
  const res = await pool.query(
    `UPDATE workshop_progress SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    vals
  );

  return c.json({ success: true, data: res.rows[0] });
});

// ── Polls endpoints ──────────────────────────────────────────

workshop.get('/sessions/:sessionId/polls', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const sid = requireUUID(c, 'sessionId');
  if (sid instanceof Response) return sid;

  if (!hasDatabase()) {
    if (!workshopSessions.has(sid)) return jsonError(c, 404, 'NOT_FOUND', 'Session not found');
    if (!memSessionRole(sid, auth.userId)) return jsonError(c, 403, 'FORBIDDEN', 'Not a member of this session');
    return c.json({ success: true, data: latestFirst([...polls.values()].filter((pl) => pl.session_id === sid), 'created_at') });
  }

  const pool = getDbPool();

  // Verify session membership
  const sessionCheck = await pool.query('SELECT facilitator_id FROM workshop_sessions WHERE id = $1', [sid]);
  if (!sessionCheck.rows[0]) return jsonError(c, 404, 'NOT_FOUND', 'Session not found');
  if (sessionCheck.rows[0].facilitator_id !== auth.userId) {
    const partCheck = await pool.query('SELECT 1 FROM session_participants WHERE session_id = $1 AND user_id = $2 LIMIT 1', [sid, auth.userId]);
    if (!partCheck.rows[0]) return jsonError(c, 403, 'FORBIDDEN', 'Not a member of this session');
  }

  const res = await pool.query(
    'SELECT * FROM polls WHERE session_id = $1 ORDER BY created_at DESC',
    [sid]
  );

  return c.json({ success: true, data: res.rows });
});

workshop.get('/sessions/:sessionId/polls/active', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const sid = requireUUID(c, 'sessionId');
  if (sid instanceof Response) return sid;

  if (!hasDatabase()) {
    if (!workshopSessions.has(sid)) return jsonError(c, 404, 'NOT_FOUND', 'Session not found');
    if (!memSessionRole(sid, auth.userId)) return jsonError(c, 403, 'FORBIDDEN', 'Not a member of this session');
    return c.json({ success: true, data: [...polls.values()].find((pl) => pl.session_id === sid && pl.is_active) ?? null });
  }

  const pool = getDbPool();

  // Verify session membership
  const sessionCheck = await pool.query('SELECT facilitator_id FROM workshop_sessions WHERE id = $1', [sid]);
  if (!sessionCheck.rows[0]) return jsonError(c, 404, 'NOT_FOUND', 'Session not found');
  if (sessionCheck.rows[0].facilitator_id !== auth.userId) {
    const partCheck = await pool.query('SELECT 1 FROM session_participants WHERE session_id = $1 AND user_id = $2 LIMIT 1', [sid, auth.userId]);
    if (!partCheck.rows[0]) return jsonError(c, 403, 'FORBIDDEN', 'Not a member of this session');
  }

  const res = await pool.query(
    'SELECT * FROM polls WHERE session_id = $1 AND is_active = true LIMIT 1',
    [sid]
  );

  return c.json({ success: true, data: res.rows[0] ?? null });
});

workshop.post('/sessions/:sessionId/polls', async (c) => {
  const limited = await rateLimit('workshop:polls', { windowMs: RATE_LIMITS.WORKSHOP_WRITE_WINDOW_MS, max: RATE_LIMITS.WORKSHOP_WRITE_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const schema = z.object({
    question: z.string().min(1).max(500),
    options: z.array(z.string().min(1)).min(2).max(10),
  });
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Question and at least 2 options required');

  const sessionId = requireUUID(c, 'sessionId');
  if (sessionId instanceof Response) return sessionId;

  if (!hasDatabase()) {
    const session = workshopSessions.get(sessionId);
    if (!session) return jsonError(c, 404, 'NOT_FOUND', 'Session not found');
    if (session.facilitator_id !== auth.userId) return jsonError(c, 403, 'FORBIDDEN', 'Not your session');
    const row = { id: newId(), session_id: sessionId, question: parsed.data.question, options: parsed.data.options, is_active: true, created_at: nowIso() };
    polls.set(row.id, row);
    broadcastToSession(sessionId, 'poll_created', row);
    return c.json({ success: true, data: row }, 201);
  }

  const pool = getDbPool();

  // Verify facilitator
  const check = await pool.query('SELECT facilitator_id FROM workshop_sessions WHERE id = $1', [sessionId]);
  if (!check.rows[0]) return jsonError(c, 404, 'NOT_FOUND', 'Session not found');
  if (check.rows[0].facilitator_id !== auth.userId) return jsonError(c, 403, 'FORBIDDEN', 'Not your session');

  const res = await pool.query(
    'INSERT INTO polls (session_id, question, options, is_active) VALUES ($1, $2, $3, true) RETURNING *',
    [sessionId, parsed.data.question, JSON.stringify(parsed.data.options)]
  );

  broadcastToSession(sessionId, 'poll_created', res.rows[0]);

  return c.json({ success: true, data: res.rows[0] }, 201);
});

workshop.patch('/polls/:pollId', async (c) => {
  const limited = await rateLimit('workshop:polls', { windowMs: RATE_LIMITS.WORKSHOP_WRITE_WINDOW_MS, max: RATE_LIMITS.WORKSHOP_WRITE_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const schema = z.object({ isActive: z.boolean() });
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid data');

  const pollId = requireUUID(c, 'pollId');
  if (pollId instanceof Response) return pollId;

  if (!hasDatabase()) {
    const poll = polls.get(pollId);
    if (!poll) return jsonError(c, 404, 'NOT_FOUND', 'Poll not found');
    if (workshopSessions.get(poll.session_id)?.facilitator_id !== auth.userId) return jsonError(c, 403, 'FORBIDDEN', 'Not your session');
    poll.is_active = parsed.data.isActive;
    if (!parsed.data.isActive) broadcastToSession(poll.session_id, 'poll_closed', { id: pollId });
    return c.json({ success: true, data: poll });
  }

  const pool = getDbPool();

  // Get poll + verify facilitator
  const pollCheck = await pool.query(
    'SELECT p.session_id, s.facilitator_id FROM polls p JOIN workshop_sessions s ON s.id = p.session_id WHERE p.id = $1',
    [pollId]
  );
  if (!pollCheck.rows[0]) return jsonError(c, 404, 'NOT_FOUND', 'Poll not found');
  if (pollCheck.rows[0].facilitator_id !== auth.userId) return jsonError(c, 403, 'FORBIDDEN', 'Not your session');

  const res = await pool.query(
    'UPDATE polls SET is_active = $1 WHERE id = $2 RETURNING *',
    [parsed.data.isActive, pollId]
  );

  const sessionId = pollCheck.rows[0].session_id;
  if (!parsed.data.isActive) {
    broadcastToSession(sessionId, 'poll_closed', { id: pollId });
  }

  return c.json({ success: true, data: res.rows[0] });
});

workshop.post('/polls/:pollId/respond', async (c) => {
  const limited = await rateLimit('workshop:poll-respond', { windowMs: RATE_LIMITS.WORKSHOP_WRITE_WINDOW_MS, max: RATE_LIMITS.WORKSHOP_WRITE_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const schema = z.object({ selectedOption: z.number().int().min(0) });
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'selectedOption required');

  const pollId = requireUUID(c, 'pollId');
  if (pollId instanceof Response) return pollId;

  if (!hasDatabase()) {
    const poll = polls.get(pollId);
    if (!poll) return jsonError(c, 404, 'NOT_FOUND', 'Poll not found');
    if (!poll.is_active) return jsonError(c, 400, 'POLL_CLOSED', 'Poll is no longer active');
    if (!memSessionRole(poll.session_id, auth.userId)) {
      return jsonError(c, 403, 'FORBIDDEN', 'You must join the session before responding to polls');
    }
    if (parsed.data.selectedOption >= poll.options.length) {
      return jsonError(c, 400, 'VALIDATION_ERROR', 'selectedOption out of range');
    }
    if (!pollResponses.has(pollId)) pollResponses.set(pollId, new Map());
    pollResponses.get(pollId)!.set(auth.userId, parsed.data.selectedOption);
    return c.json({ success: true });
  }

  const pool = getDbPool();

  // Verify poll exists and is active
  const pollCheck = await pool.query('SELECT is_active, options, session_id FROM polls WHERE id = $1', [pollId]);
  if (!pollCheck.rows[0]) return jsonError(c, 404, 'NOT_FOUND', 'Poll not found');
  if (!pollCheck.rows[0].is_active) return jsonError(c, 400, 'POLL_CLOSED', 'Poll is no longer active');

  // Verify user is a participant of the poll's session (or the facilitator)
  const sessionId = pollCheck.rows[0].session_id;
  const participantCheck = await pool.query(
    'SELECT 1 FROM session_participants WHERE session_id = $1 AND user_id = $2 LIMIT 1',
    [sessionId, auth.userId]
  );
  if (!participantCheck.rows[0]) {
    // Also allow the facilitator to respond
    const facCheck = await pool.query('SELECT 1 FROM workshop_sessions WHERE id = $1 AND facilitator_id = $2', [sessionId, auth.userId]);
    if (!facCheck.rows[0]) {
      return jsonError(c, 403, 'FORBIDDEN', 'You must join the session before responding to polls');
    }
  }

  // Validate selectedOption is within bounds of poll options
  const options = typeof pollCheck.rows[0].options === 'string'
    ? JSON.parse(pollCheck.rows[0].options)
    : pollCheck.rows[0].options;
  if (parsed.data.selectedOption >= options.length) {
    return jsonError(c, 400, 'VALIDATION_ERROR', 'selectedOption out of range');
  }

  await pool.query(
    `INSERT INTO poll_responses (poll_id, user_id, selected_option)
     VALUES ($1, $2, $3)
     ON CONFLICT (poll_id, user_id) DO UPDATE SET selected_option = $3`,
    [pollId, auth.userId, parsed.data.selectedOption]
  );

  return c.json({ success: true });
});

// ── Questions (Q&A) endpoints ────────────────────────────────

workshop.get('/sessions/:sessionId/questions', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const sid = requireUUID(c, 'sessionId');
  if (sid instanceof Response) return sid;

  if (!hasDatabase()) {
    if (!workshopSessions.has(sid)) return jsonError(c, 404, 'NOT_FOUND', 'Session not found');
    if (!memSessionRole(sid, auth.userId)) return jsonError(c, 403, 'FORBIDDEN', 'Not a member of this session');
    const rows = [...questions.values()].filter((q) => q.session_id === sid)
      .sort((a, b) => b.upvotes - a.upvotes || b.created_at.localeCompare(a.created_at));
    return c.json({ success: true, data: rows });
  }

  const pool = getDbPool();

  // Verify session membership
  const sessionCheck = await pool.query('SELECT facilitator_id FROM workshop_sessions WHERE id = $1', [sid]);
  if (!sessionCheck.rows[0]) return jsonError(c, 404, 'NOT_FOUND', 'Session not found');
  if (sessionCheck.rows[0].facilitator_id !== auth.userId) {
    const partCheck = await pool.query('SELECT 1 FROM session_participants WHERE session_id = $1 AND user_id = $2 LIMIT 1', [sid, auth.userId]);
    if (!partCheck.rows[0]) return jsonError(c, 403, 'FORBIDDEN', 'Not a member of this session');
  }

  const res = await pool.query(
    'SELECT * FROM questions WHERE session_id = $1 ORDER BY upvotes DESC, created_at DESC',
    [sid]
  );

  return c.json({ success: true, data: res.rows });
});

workshop.post('/sessions/:sessionId/questions', async (c) => {
  const limited = await rateLimit('workshop:questions', { windowMs: RATE_LIMITS.WORKSHOP_WRITE_WINDOW_MS, max: RATE_LIMITS.WORKSHOP_WRITE_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const schema = z.object({ questionText: z.string().min(1).max(1000) });
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'questionText required');

  const sessionId = requireUUID(c, 'sessionId');
  if (sessionId instanceof Response) return sessionId;

  if (!hasDatabase()) {
    if (!memSessionRole(sessionId, auth.userId)) {
      return jsonError(c, 403, 'FORBIDDEN', 'You must join the session before posting questions');
    }
    const row = {
      id: newId(), session_id: sessionId, user_id: auth.userId, question_text: parsed.data.questionText,
      upvotes: 0, is_answered: false, created_at: nowIso(),
    };
    questions.set(row.id, row);
    broadcastToSession(sessionId, 'question_added', row);
    return c.json({ success: true, data: row }, 201);
  }

  const pool = getDbPool();

  // Verify user is a participant or facilitator of the session
  const participantCheck = await pool.query(
    'SELECT 1 FROM session_participants WHERE session_id = $1 AND user_id = $2 LIMIT 1',
    [sessionId, auth.userId]
  );
  if (!participantCheck.rows[0]) {
    const facCheck = await pool.query('SELECT 1 FROM workshop_sessions WHERE id = $1 AND facilitator_id = $2', [sessionId, auth.userId]);
    if (!facCheck.rows[0]) {
      return jsonError(c, 403, 'FORBIDDEN', 'You must join the session before posting questions');
    }
  }

  const res = await pool.query(
    'INSERT INTO questions (session_id, user_id, question_text) VALUES ($1, $2, $3) RETURNING *',
    [sessionId, auth.userId, parsed.data.questionText]
  );

  broadcastToSession(sessionId, 'question_added', res.rows[0]);

  return c.json({ success: true, data: res.rows[0] }, 201);
});

workshop.patch('/questions/:questionId', async (c) => {
  const limited = await rateLimit('workshop:questions', { windowMs: RATE_LIMITS.WORKSHOP_WRITE_WINDOW_MS, max: RATE_LIMITS.WORKSHOP_WRITE_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const schema = z.object({ isAnswered: z.boolean() });
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid data');

  const questionId = requireUUID(c, 'questionId');
  if (questionId instanceof Response) return questionId;

  if (!hasDatabase()) {
    const question = questions.get(questionId);
    if (!question) return jsonError(c, 404, 'NOT_FOUND', 'Question not found');
    if (workshopSessions.get(question.session_id)?.facilitator_id !== auth.userId) return jsonError(c, 403, 'FORBIDDEN', 'Not your session');
    question.is_answered = parsed.data.isAnswered;
    broadcastToSession(question.session_id, 'question_updated', question);
    return c.json({ success: true, data: question });
  }

  const pool = getDbPool();

  // Get question + verify facilitator
  const qCheck = await pool.query(
    'SELECT q.session_id, s.facilitator_id FROM questions q JOIN workshop_sessions s ON s.id = q.session_id WHERE q.id = $1',
    [questionId]
  );
  if (!qCheck.rows[0]) return jsonError(c, 404, 'NOT_FOUND', 'Question not found');
  if (qCheck.rows[0].facilitator_id !== auth.userId) return jsonError(c, 403, 'FORBIDDEN', 'Not your session');

  const res = await pool.query(
    'UPDATE questions SET is_answered = $1 WHERE id = $2 RETURNING *',
    [parsed.data.isAnswered, questionId]
  );

  broadcastToSession(qCheck.rows[0].session_id, 'question_updated', res.rows[0]);

  return c.json({ success: true, data: res.rows[0] });
});

workshop.post('/questions/:questionId/upvote', async (c) => {
  const limited = await rateLimit('workshop:upvote', { windowMs: RATE_LIMITS.WORKSHOP_WRITE_WINDOW_MS, max: RATE_LIMITS.WORKSHOP_WRITE_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const questionId = requireUUID(c, 'questionId');
  if (questionId instanceof Response) return questionId;

  if (!hasDatabase()) {
    const question = questions.get(questionId);
    if (!question) return jsonError(c, 404, 'NOT_FOUND', 'Question not found');
    if (!memSessionRole(question.session_id, auth.userId)) return jsonError(c, 403, 'FORBIDDEN', 'Not a member of this session');
    // A second upvote from the same person takes the first back, as in the database version
    const key = `${questionId}:${auth.userId}`;
    if (questionUpvotes.delete(key)) question.upvotes = Math.max(question.upvotes - 1, 0);
    else { questionUpvotes.add(key); question.upvotes += 1; }
    broadcastToSession(question.session_id, 'question_updated', question);
    return c.json({ success: true, data: question });
  }

  const pool = getDbPool();

  // Verify the user belongs to the session this question is in
  const qSession = await pool.query(
    `SELECT q.session_id, ws.facilitator_id
     FROM questions q JOIN workshop_sessions ws ON ws.id = q.session_id
     WHERE q.id = $1`,
    [questionId]
  );
  if (!qSession.rows[0]) return jsonError(c, 404, 'NOT_FOUND', 'Question not found');
  if (qSession.rows[0].facilitator_id !== auth.userId) {
    const partCheck = await pool.query(
      'SELECT 1 FROM session_participants WHERE session_id = $1 AND user_id = $2 LIMIT 1',
      [qSession.rows[0].session_id, auth.userId]
    );
    if (!partCheck.rows[0]) {
      return jsonError(c, 403, 'FORBIDDEN', 'Not a member of this session');
    }
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if already upvoted
    const existing = await client.query(
      'SELECT id FROM question_upvotes WHERE question_id = $1 AND user_id = $2 LIMIT 1',
      [questionId, auth.userId]
    );

    if (existing.rows[0]) {
      // Remove upvote
      await client.query('DELETE FROM question_upvotes WHERE id = $1', [existing.rows[0].id]);
      await client.query('UPDATE questions SET upvotes = GREATEST(upvotes - 1, 0) WHERE id = $1', [questionId]);
    } else {
      // Add upvote
      await client.query(
        'INSERT INTO question_upvotes (question_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [questionId, auth.userId]
      );
      await client.query('UPDATE questions SET upvotes = upvotes + 1 WHERE id = $1', [questionId]);
    }

    // Get updated question
    const updated = await client.query('SELECT * FROM questions WHERE id = $1', [questionId]);

    await client.query('COMMIT');

    if (updated.rows[0]) {
      broadcastToSession(updated.rows[0].session_id, 'question_updated', updated.rows[0]);
    }

    return c.json({ success: true, data: updated.rows[0] ?? null });
  } catch (err: unknown) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ── Action Plans endpoints ───────────────────────────────────

workshop.get('/action-plans', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  if (!hasDatabase()) {
    const latest = latestFirst([...actionPlans.values()].filter((ap) => ap.user_id === auth.userId), 'generated_at')[0];
    return c.json({ success: true, data: latest ?? null });
  }

  const pool = getDbPool();
  const res = await pool.query(
    'SELECT * FROM action_plans WHERE user_id = $1 ORDER BY generated_at DESC LIMIT 1',
    [auth.userId]
  );

  return c.json({ success: true, data: res.rows[0] ?? null });
});

workshop.post('/action-plans', async (c) => {
  const limited = await rateLimit('workshop:action-plans', { windowMs: RATE_LIMITS.WORKSHOP_WRITE_WINDOW_MS, max: RATE_LIMITS.WORKSHOP_WRITE_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const schema = z.object({
    sessionId: z.string().uuid().optional(),
    actionItems: z.unknown().refine(
      (v) => JSON.stringify(v).length <= 100_000,
      'actionItems payload too large (max 100KB)'
    ),
    commitments: z.array(z.string().max(2000)).max(50).optional(),
  });
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid action plan data');

  if (!hasDatabase()) {
    const row = {
      id: newId(), user_id: auth.userId, session_id: parsed.data.sessionId ?? null,
      action_items: parsed.data.actionItems ?? [], commitments: parsed.data.commitments ?? [], generated_at: nowIso(),
    };
    actionPlans.set(row.id, row);
    return c.json({ success: true, data: row }, 201);
  }

  const pool = getDbPool();
  const res = await pool.query(
    `INSERT INTO action_plans (user_id, session_id, action_items, commitments)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [auth.userId, parsed.data.sessionId ?? null, JSON.stringify(parsed.data.actionItems), parsed.data.commitments ?? []]
  );

  return c.json({ success: true, data: res.rows[0] }, 201);
});

workshop.patch('/action-plans/:id', async (c) => {
  const limited = await rateLimit('workshop:action-plans', { windowMs: RATE_LIMITS.WORKSHOP_WRITE_WINDOW_MS, max: RATE_LIMITS.WORKSHOP_WRITE_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const schema = z.object({
    actionItems: z.unknown().refine(
      (v) => v === undefined || JSON.stringify(v).length <= 100_000,
      'actionItems payload too large (max 100KB)'
    ).optional(),
    commitments: z.array(z.string().max(2000)).max(50).optional(),
  });
  const parsed = schema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid data');

  const planId = requireUUID(c, 'id');
  if (planId instanceof Response) return planId;

  if (!hasDatabase()) {
    const plan = actionPlans.get(planId);
    if (!plan) return jsonError(c, 404, 'NOT_FOUND', 'Action plan not found');
    if (plan.user_id !== auth.userId) return jsonError(c, 403, 'FORBIDDEN', 'Not your action plan');
    if (parsed.data.actionItems === undefined && parsed.data.commitments === undefined) {
      return jsonError(c, 400, 'VALIDATION_ERROR', 'No fields to update');
    }
    if (parsed.data.actionItems !== undefined) plan.action_items = parsed.data.actionItems;
    if (parsed.data.commitments !== undefined) plan.commitments = parsed.data.commitments;
    return c.json({ success: true, data: plan });
  }

  const pool = getDbPool();

  // Verify ownership
  const check = await pool.query('SELECT user_id FROM action_plans WHERE id = $1', [planId]);
  if (!check.rows[0]) return jsonError(c, 404, 'NOT_FOUND', 'Action plan not found');
  if (check.rows[0].user_id !== auth.userId) return jsonError(c, 403, 'FORBIDDEN', 'Not your action plan');

  const sets: string[] = [];
  const vals: unknown[] = [];
  let idx = 1;

  if (parsed.data.actionItems !== undefined) { sets.push(`action_items = $${idx++}`); vals.push(JSON.stringify(parsed.data.actionItems)); }
  if (parsed.data.commitments !== undefined) { sets.push(`commitments = $${idx++}`); vals.push(parsed.data.commitments); }

  if (sets.length === 0) return jsonError(c, 400, 'VALIDATION_ERROR', 'No fields to update');

  vals.push(planId);
  const res = await pool.query(
    `UPDATE action_plans SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
    vals
  );

  return c.json({ success: true, data: res.rows[0] });
});

// ── Certificates endpoints ───────────────────────────────────

workshop.get('/certificates', async (c) => {
  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  if (!hasDatabase()) {
    const latest = latestFirst([...certificates.values()].filter((ct) => ct.user_id === auth.userId), 'issued_at')[0];
    return c.json({ success: true, data: latest ?? null });
  }

  const pool = getDbPool();
  const res = await pool.query(
    'SELECT * FROM certificates WHERE user_id = $1 ORDER BY issued_at DESC LIMIT 1',
    [auth.userId]
  );

  return c.json({ success: true, data: res.rows[0] ?? null });
});

workshop.post('/certificates', async (c) => {
  const limited = await rateLimit('workshop:cert', { windowMs: RATE_LIMITS.CERTIFICATE_WINDOW_MS, max: RATE_LIMITS.CERTIFICATE_MAX })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const schema = z.object({ sessionId: z.string().uuid().optional() });
  const parsed = schema.safeParse(await c.req.json().catch(() => ({})));

  // Generate certificate number server-side
  const certNumber = `FRA-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  let issued: unknown;

  if (hasDatabase()) {
    const pool = getDbPool();

    // Check if already has a certificate
    const existing = await pool.query('SELECT * FROM certificates WHERE user_id = $1 LIMIT 1', [auth.userId]);
    if (existing.rows[0]) return c.json({ success: true, data: existing.rows[0] });

    // Verify workshop completion before issuing certificate
    const progress = await pool.query(
      'SELECT completed_at FROM workshop_progress WHERE user_id = $1 AND completed_at IS NOT NULL LIMIT 1',
      [auth.userId]
    );
    if (!progress.rows[0]) {
      return jsonError(c, 400, 'NOT_COMPLETED', 'Workshop must be completed before generating a certificate');
    }

    const res = await pool.query(
      `INSERT INTO certificates (user_id, session_id, certificate_number)
       VALUES ($1, $2, $3) RETURNING *`,
      [auth.userId, parsed.data?.sessionId ?? null, certNumber]
    );
    issued = res.rows[0];
  } else {
    const existing = [...certificates.values()].find((ct) => ct.user_id === auth.userId);
    if (existing) return c.json({ success: true, data: existing });
    const completed = [...workshopProgress.values()].some((wp) => wp.user_id === auth.userId && wp.completed_at);
    if (!completed) return jsonError(c, 400, 'NOT_COMPLETED', 'Workshop must be completed before generating a certificate');
    const row = { id: newId(), user_id: auth.userId, session_id: parsed.data?.sessionId ?? null, certificate_number: certNumber, issued_at: nowIso() };
    certificates.set(row.id, row);
    issued = row;
  }

  await auditLog({
    eventType: 'workshop.certificate_generate', actorId: auth.userId, actorEmail: auth.email,
    organisationId: auth.organisationId, resourceType: 'certificate', resourceId: certNumber,
    ipAddress: getClientIp(c), userAgent: c.req.header('user-agent'),
  });

  return c.json({ success: true, data: issued }, 201);
});

// ── SSE Events endpoint ──────────────────────────────────────

// Exchange a valid JWT for a short-lived, single-use SSE token.
// The frontend calls this before opening an EventSource connection.
workshop.post('/sse-token', async (c) => {
  const limited = await rateLimit('workshop:sse-token', { windowMs: 60_000, max: 20 })(c);
  if (limited instanceof Response) return limited;

  const auth = requireAuth(c);
  if (auth instanceof Response) return auth;

  const token = crypto.randomUUID();
  await storeSseToken(token, auth);

  return c.json({ success: true, data: { sseToken: token } });
});

workshop.get('/sessions/:sessionId/events', async (c) => {
  const auth = await getAuthWithSseToken(c);
  if (!auth) return jsonError(c, 401, 'UNAUTHORIZED', 'Missing or invalid access token');

  const sessionId = requireUUID(c, 'sessionId');
  if (sessionId instanceof Response) return sessionId;

  // Verify the user is the facilitator or a session participant
  if (hasDatabase()) {
    const pool = getDbPool();
    const sessionCheck = await pool.query(
      'SELECT facilitator_id FROM workshop_sessions WHERE id = $1',
      [sessionId]
    );
    if (!sessionCheck.rows[0]) return jsonError(c, 404, 'NOT_FOUND', 'Session not found');
    if (sessionCheck.rows[0].facilitator_id !== auth.userId) {
      const partCheck = await pool.query(
        'SELECT 1 FROM session_participants WHERE session_id = $1 AND user_id = $2 LIMIT 1',
        [sessionId, auth.userId]
      );
      if (!partCheck.rows[0]) {
        return jsonError(c, 403, 'FORBIDDEN', 'Not a member of this session');
      }
    }
  } else {
    if (!workshopSessions.has(sessionId)) return jsonError(c, 404, 'NOT_FOUND', 'Session not found');
    if (!memSessionRole(sessionId, auth.userId)) return jsonError(c, 403, 'FORBIDDEN', 'Not a member of this session');
  }

  return streamSSE(c, async (stream) => {
    const clientId = crypto.randomUUID();

    const client: SSEClient = {
      id: clientId,
      userId: auth.userId,
      write: (event: string, data: unknown) => {
        stream.writeSSE({ event, data: JSON.stringify(data), id: crypto.randomUUID() });
      },
      close: () => {
        const clients = sseClients.get(sessionId);
        if (clients) {
          clients.delete(client);
          if (clients.size === 0) sseClients.delete(sessionId);
        }
      },
    };

    // Register client
    if (!sseClients.has(sessionId)) sseClients.set(sessionId, new Set());
    sseClients.get(sessionId)!.add(client);

    // Send initial connected event
    stream.writeSSE({ event: 'connected', data: JSON.stringify({ clientId }), id: crypto.randomUUID() });

    // Heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      try {
        stream.writeSSE({ event: 'heartbeat', data: JSON.stringify({ ts: Date.now() }), id: crypto.randomUUID() });
      } catch (err: unknown) {
        logger.warn('SSE heartbeat failed, closing client', { sessionId, clientId, error: String(err) });
        clearInterval(heartbeat);
        client.close();
      }
    }, 30_000);

    // Clean up on disconnect
    stream.onAbort(() => {
      clearInterval(heartbeat);
      client.close();
    });

    // Keep the stream open indefinitely until client disconnects
    await new Promise<void>((resolve) => {
      stream.onAbort(() => resolve());
    });
  });
});

export default workshop;
