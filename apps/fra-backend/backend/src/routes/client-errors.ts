// ============================================================
// POST /api/v1/client-errors: the web dashboard reports an uncaught
// browser error. No sign-in, since errors also happen on public pages
// and before login. Rate limited per IP so a broken page in a loop
// cannot flood the log. The IP itself is never logged.
// ============================================================

import { Hono } from 'hono';
import { jsonError } from '../helpers.js';
import { rateLimit } from '../middleware.js';
import { clientErrorSchema, recordClientError } from '../client-errors.js';

const clientErrors = new Hono();

clientErrors.post('/client-errors', async (c) => {
  const limited = await rateLimit('client-errors', { windowMs: 60_000, max: 20 })(c);
  if (limited instanceof Response) return limited;

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid JSON');
  }
  const parsed = clientErrorSchema.safeParse(body);
  if (!parsed.success) return jsonError(c, 400, 'VALIDATION_ERROR', 'Invalid error report');

  recordClientError(parsed.data, c.req.header('user-agent'));
  return c.body(null, 204);
});

export default clientErrors;
